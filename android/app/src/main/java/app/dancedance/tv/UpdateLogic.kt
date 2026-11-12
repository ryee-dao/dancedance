package app.dancedance.tv

import org.json.JSONObject

/**
 * The pure half of the in-app updater (no Android APIs, unit-tested in UpdateLogicTest):
 * version comparison, reading GitHub's "latest release" answer, deciding whether it is newer
 * than this build, matching signing certificates and wording HTTP failures.
 *
 * How releases are versioned (.github/workflows/android.yml):
 *   - tag `v1.2.0`              -> versionName "1.2.0"
 *   - manual run (no tag)       -> release tag `tv-build-<run>`, versionName "0.0.<run>"
 *   - versionCode is always 1000 + run number, so it grows with every build, tagged or not.
 * Releases made since the updater exist also carry the versionCode in their notes as
 * `<!-- dancedance-version-code: 1042 -->`; when present that decides, else the tag's version.
 * Either way the downloaded APK's own versionCode is checked before installing.
 */
object UpdateLogic {
    const val APK_ASSET = "dancedance.apk"
    /** Never download more than this (the APK is ~20-40 MB). */
    const val MAX_APK_BYTES = 300L * 1024 * 1024

    private val CODE_MARKER = Regex("""<!--\s*dancedance-version-code:\s*(\d{1,9})\s*-->""")
    private val TV_BUILD_TAG = Regex("""^tv-build-(\d{1,9})$""")
    /** Same character set the workflow accepts for a tag-derived versionName. */
    private val VERSION_NAME = Regex("""^[0-9A-Za-z.+-]{1,40}$""")

    // --- versions ------------------------------------------------------------------------

    /** A parsed version name: numeric core (1.2.0) plus optional pre-release (-rc.1); build (+x) ignored. */
    data class Version(val core: List<Long>, val pre: List<String>) : Comparable<Version> {
        override fun compareTo(other: Version): Int {
            val n = maxOf(core.size, other.core.size)
            for (i in 0 until n) {
                val c = (core.getOrElse(i) { 0L }).compareTo(other.core.getOrElse(i) { 0L })
                if (c != 0) return c
            }
            // A release ranks above its own pre-releases (1.2.0 > 1.2.0-rc.1).
            if (pre.isEmpty() || other.pre.isEmpty()) return other.pre.size.coerceAtMost(1) - pre.size.coerceAtMost(1)
            for (i in 0 until minOf(pre.size, other.pre.size)) {
                val a = pre[i]
                val b = other.pre[i]
                val an = a.toLongOrNull()
                val bn = b.toLongOrNull()
                val c = when {
                    an != null && bn != null -> an.compareTo(bn)
                    an != null -> -1 // numeric identifiers rank below alphanumeric ones
                    bn != null -> 1
                    else -> a.compareTo(b)
                }
                if (c != 0) return c
            }
            return pre.size.compareTo(other.pre.size)
        }

        override fun toString() = core.joinToString(".") + if (pre.isEmpty()) "" else "-" + pre.joinToString(".")
    }

    /** "1.2.0", "v1.2", "0.6.0-rc.1", "0.1.0-dev+abc" -> Version; null if it isn't one. */
    fun parseVersion(name: String?): Version? {
        if (name == null) return null
        var s = name.trim()
        if (s.startsWith("v") || s.startsWith("V")) s = s.substring(1)
        s = s.substringBefore('+')
        if (s.isEmpty() || s.length > 40) return null
        val core = s.substringBefore('-')
        val pre = if ('-' in s) s.substringAfter('-') else ""
        val parts = core.split('.')
        if (parts.isEmpty() || parts.size > 4 || parts.any { it.isEmpty() || it.length > 9 || !it.all(Char::isDigit) }) return null
        val preParts = if (pre.isEmpty()) emptyList() else pre.split('.', '-')
        if (preParts.any { it.isEmpty() || !it.all { c -> c.isLetterOrDigit() } }) return null
        return Version(parts.map { it.toLong() }, preParts)
    }

    /** Compare two version names; null when either can't be read. */
    fun compareVersions(a: String?, b: String?): Int? {
        val va = parseVersion(a) ?: return null
        val vb = parseVersion(b) ?: return null
        return Integer.signum(va.compareTo(vb))
    }

    /** The versionName the workflow gives a release tag: v1.2.0 -> 1.2.0, tv-build-37 -> 0.0.37. */
    fun versionNameForTag(tag: String?): String? {
        if (tag == null) return null
        TV_BUILD_TAG.matchEntire(tag)?.let { return "0.0.${it.groupValues[1].toLong()}" }
        val candidate = tag.removePrefix("v")
        return candidate.takeIf { VERSION_NAME.matches(it) }
    }

    // --- the latest release ----------------------------------------------------------------

    data class Release(
        val tag: String,
        /** What the release's APK calls itself (from the tag, see [versionNameForTag]). */
        val versionName: String,
        /** From the release notes' marker; null for releases made before it existed. */
        val versionCode: Int?,
        val apkUrl: String,
        /** Asset size in bytes from GitHub (0 if it didn't say). */
        val apkBytes: Long,
    )

    sealed class Parsed {
        data class Ok(val release: Release) : Parsed()
        /** Not usable, with a message for the person holding the remote. */
        data class Bad(val message: String) : Parsed()
    }

    /**
     * Read GitHub's answer to GET /repos/{repo}/releases/latest. `allowedApkPrefix` is where the
     * APK must be downloaded from (https://github.com/{repo}/releases/download/), so a strange
     * answer can't send the app anywhere else.
     */
    fun parseRelease(json: String, allowedApkPrefix: String): Parsed {
        val o = try {
            JSONObject(json)
        } catch (e: Exception) {
            return Parsed.Bad("GitHub's answer wasn't readable.")
        }
        if (o.optBoolean("draft", false) || o.optBoolean("prerelease", false)) {
            return Parsed.Bad("The newest release is a draft or pre-release.")
        }
        val tag = o.optString("tag_name", "").trim()
        if (tag.isEmpty()) return Parsed.Bad("GitHub's answer has no release tag.")
        val name = versionNameForTag(tag) ?: return Parsed.Bad("The release tag \"${tag.take(40)}\" isn't a version.")
        val code = CODE_MARKER.find(o.optString("body", ""))?.groupValues?.get(1)?.toIntOrNull()
        val assets = o.optJSONArray("assets") ?: return Parsed.Bad("The release has no files.")
        for (i in 0 until assets.length()) {
            val a = assets.optJSONObject(i) ?: continue
            if (a.optString("name") != APK_ASSET) continue
            if (a.optString("state", "uploaded") != "uploaded") return Parsed.Bad("The release's APK is still uploading. Try again in a minute.")
            val url = a.optString("browser_download_url", "")
            if (!url.startsWith(allowedApkPrefix) || !url.endsWith("/$APK_ASSET") || url.contains("..")) {
                return Parsed.Bad("The release's download address looks wrong.")
            }
            val size = a.optLong("size", 0L)
            if (size < 0 || size > MAX_APK_BYTES) return Parsed.Bad("The release's APK has an unexpected size.")
            return Parsed.Ok(Release(tag, name, code, url, size))
        }
        return Parsed.Bad("The newest release has no $APK_ASSET.")
    }

    /**
     * Is `release` newer than the installed build? True / false, or null when it can't tell
     * (a version name that isn't a version).
     */
    fun isNewer(release: Release, installedName: String, installedCode: Int): Boolean? {
        release.versionCode?.let { return it > installedCode }
        val c = compareVersions(release.versionName, installedName) ?: return null
        return c > 0
    }

    /** What to call the release on screen: "0.6.0", or "0.6.0 (build 1043)" when the name alone doesn't say it's newer. */
    fun displayName(release: Release, installedName: String): String =
        if (release.versionCode != null && compareVersions(release.versionName, installedName)?.let { it <= 0 } == true) {
            "${release.versionName} (build ${release.versionCode})"
        } else {
            release.versionName
        }

    // --- signatures --------------------------------------------------------------------------

    /**
     * Does a downloaded APK's signer match the installed app's? Inputs are SHA-256 digests (hex).
     * `installedSigners`: the installed app's current signer(s). `apkSigners`: the APK's current
     * signer(s). `apkHistory`: the APK's signing lineage (key rotation, oldest first) or empty.
     * Same set of signers, or (one signer each) the APK's lineage contains the installed key.
     */
    fun signersMatch(installedSigners: Set<String>, apkSigners: Set<String>, apkHistory: List<String>): Boolean {
        if (installedSigners.isEmpty() || apkSigners.isEmpty()) return false
        val a = installedSigners.map { it.lowercase() }.toSet()
        val b = apkSigners.map { it.lowercase() }.toSet()
        if (a == b) return true
        return a.size == 1 && b.size == 1 && apkHistory.any { it.lowercase() == a.first() }
    }

    // --- HTTP failures -------------------------------------------------------------------------

    /**
     * A short reason for a failed update check (shown as "Couldn't check (reason)").
     * `rateRemaining` / `rateReset` (epoch seconds) / `retryAfter` are GitHub's headers.
     */
    fun checkFailure(code: Int, rateRemaining: String?, rateReset: String?, retryAfter: String?, nowMs: Long): String {
        val limited = code == 429 || (code == 403 && (rateRemaining == "0" || retryAfter != null))
        if (limited) {
            val waitSec = retryAfter?.trim()?.toLongOrNull()
                ?: rateReset?.trim()?.toLongOrNull()?.let { it - nowMs / 1000 }
            val minutes = waitSec?.let { ((it + 59) / 60).coerceIn(1, 120) }
            return if (minutes != null) {
                "GitHub's limit for update checks was reached; try again in about $minutes min"
            } else {
                "GitHub's limit for update checks was reached; try again later"
            }
        }
        return when (code) {
            403 -> "GitHub refused the request (HTTP 403)"
            404 -> "no release found on GitHub yet"
            in 500..599 -> "GitHub is having problems (HTTP $code); try again later"
            else -> "GitHub answered HTTP $code"
        }
    }

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
}
