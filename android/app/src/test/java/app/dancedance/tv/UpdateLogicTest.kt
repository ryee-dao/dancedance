package app.dancedance.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateLogicTest {
    private val prefix = "https://github.com/ryee-dao/dancedance/releases/download/"

    // --- versions ------------------------------------------------------------------------

    @Test fun comparesNumerically() {
        assertEquals(1, UpdateLogic.compareVersions("0.10.0", "0.9.0"))
        assertEquals(1, UpdateLogic.compareVersions("1.0.0", "0.99.99"))
        assertEquals(-1, UpdateLogic.compareVersions("0.5.0", "0.6.0"))
        assertEquals(0, UpdateLogic.compareVersions("v1.2.0", "1.2.0"))
        // Missing parts count as zero.
        assertEquals(0, UpdateLogic.compareVersions("1.2", "1.2.0"))
        assertEquals(1, UpdateLogic.compareVersions("1.2.1", "1.2"))
    }

    @Test fun preReleasesRankBelowTheRelease() {
        assertEquals(1, UpdateLogic.compareVersions("0.6.0", "0.6.0-rc.1"))
        assertEquals(-1, UpdateLogic.compareVersions("0.6.0-rc.1", "0.6.0-rc.2"))
        assertEquals(-1, UpdateLogic.compareVersions("0.6.0-beta", "0.6.0-rc"))
        assertEquals(-1, UpdateLogic.compareVersions("0.6.0-rc.2", "0.6.0-rc.10"))
        // A local build ("0.1.0-dev") is older than the 0.1.0 release.
        assertEquals(1, UpdateLogic.compareVersions("0.1.0", "0.1.0-dev"))
        // Build metadata is ignored.
        assertEquals(0, UpdateLogic.compareVersions("1.0.0+abc", "1.0.0"))
    }

    @Test fun unreadableVersions() {
        assertNull(UpdateLogic.compareVersions("latest", "1.0.0"))
        assertNull(UpdateLogic.compareVersions("1.0.0", ""))
        assertNull(UpdateLogic.compareVersions("1..0", "1.0"))
        assertNull(UpdateLogic.compareVersions(null, "1.0"))
        assertNull(UpdateLogic.parseVersion("1.2.3.4.5"))
    }

    @Test fun tagsBecomeTheWorkflowsVersionName() {
        assertEquals("1.2.0", UpdateLogic.versionNameForTag("v1.2.0"))
        assertEquals("0.6.0-rc.1", UpdateLogic.versionNameForTag("v0.6.0-rc.1"))
        assertEquals("0.0.37", UpdateLogic.versionNameForTag("tv-build-37"))
        assertNull(UpdateLogic.versionNameForTag("v1.0 final"))
        assertNull(UpdateLogic.versionNameForTag(null))
    }

    // --- release JSON --------------------------------------------------------------------

    private fun release(
        tag: String = "v0.6.0",
        body: String = "DanceDance for Android TV 0.6.0.",
        assets: String = """[{"name":"dancedance.apk","state":"uploaded","size":24000000,
            "browser_download_url":"${prefix}$tag/dancedance.apk"}]""",
        extra: String = "",
    ) = """{"tag_name":"$tag","name":"DanceDance TV","draft":false,"prerelease":false,
        "body":${org.json.JSONObject.quote(body)},"assets":$assets$extra}"""

    @Test fun parsesTheLatestRelease() {
        val p = UpdateLogic.parseRelease(release(), prefix)
        val r = (p as UpdateLogic.Parsed.Ok).release
        assertEquals("v0.6.0", r.tag)
        assertEquals("0.6.0", r.versionName)
        assertNull(r.versionCode)
        assertEquals("${prefix}v0.6.0/dancedance.apk", r.apkUrl)
        assertEquals(24000000L, r.apkBytes)
    }

    @Test fun readsTheVersionCodeMarker() {
        val body = "DanceDance for Android TV 0.6.0.\n\n<!-- dancedance-version-code: 1042 -->"
        val r = (UpdateLogic.parseRelease(release(body = body), prefix) as UpdateLogic.Parsed.Ok).release
        assertEquals(1042, r.versionCode)
    }

    @Test fun picksTheApkAmongOtherAssets() {
        val assets = """[{"name":"notes.txt","browser_download_url":"${prefix}v0.6.0/notes.txt"},
            {"name":"dancedance.apk","size":5,"browser_download_url":"${prefix}v0.6.0/dancedance.apk"}]"""
        assertTrue(UpdateLogic.parseRelease(release(assets = assets), prefix) is UpdateLogic.Parsed.Ok)
    }

    @Test fun refusesBadAnswers() {
        fun bad(json: String) = assertTrue(json, UpdateLogic.parseRelease(json, prefix) is UpdateLogic.Parsed.Bad)
        bad("<html>rate limited</html>")
        bad("")
        bad("[]")
        bad("""{"message":"Not Found"}""")
        bad(release(assets = "[]"))
        bad(release(assets = """[{"name":"other.apk","browser_download_url":"${prefix}v0.6.0/other.apk"}]"""))
        // Download address somewhere else, or sneaking out of the repo.
        bad(release(assets = """[{"name":"dancedance.apk","browser_download_url":"https://evil.example/dancedance.apk"}]"""))
        bad(release(assets = """[{"name":"dancedance.apk","browser_download_url":"https://github.com/someone/else/releases/download/v1/dancedance.apk"}]"""))
        bad(release(assets = """[{"name":"dancedance.apk","browser_download_url":"${prefix}../../x/dancedance.apk"}]"""))
        // Still uploading; absurd size.
        bad(release(assets = """[{"name":"dancedance.apk","state":"starter","browser_download_url":"${prefix}v0.6.0/dancedance.apk"}]"""))
        bad(release(assets = """[{"name":"dancedance.apk","size":999999999999,"browser_download_url":"${prefix}v0.6.0/dancedance.apk"}]"""))
        // Drafts and pre-releases never count.
        bad(release().replace("\"prerelease\":false", "\"prerelease\":true"))
        bad(release().replace("\"draft\":false", "\"draft\":true"))
        // A tag that isn't a version.
        bad(release(tag = "nightly build"))
    }

    // --- newer or not ----------------------------------------------------------------------

    private fun rel(name: String, code: Int? = null) = UpdateLogic.Release("v$name", name, code, "x", 0)

    @Test fun newerByVersionName() {
        assertEquals(true, UpdateLogic.isNewer(rel("0.6.0"), "0.5.0", 1040))
        assertEquals(false, UpdateLogic.isNewer(rel("0.5.0"), "0.5.0", 1040))
        assertEquals(false, UpdateLogic.isNewer(rel("0.4.0"), "0.5.0", 1040))
        assertEquals(true, UpdateLogic.isNewer(rel("0.1.0"), "0.1.0-dev", 1))
        assertNull(UpdateLogic.isNewer(rel("0.6.0"), "weird", 1040))
    }

    @Test fun versionCodeWinsWhenTheReleaseHasIt() {
        // A re-run of the same tag: same name, higher build.
        assertEquals(true, UpdateLogic.isNewer(rel("0.6.0", 1043), "0.6.0", 1042))
        // A manual build (0.0.N) after a tagged one: the name looks older, the code is newer.
        assertEquals(true, UpdateLogic.isNewer(rel("0.0.60", 1060), "0.6.0", 1042))
        assertEquals(false, UpdateLogic.isNewer(rel("0.7.0", 1042), "0.6.0", 1042))
    }

    @Test fun displayName() {
        assertEquals("0.6.0", UpdateLogic.displayName(rel("0.6.0", 1043), "0.5.0"))
        assertEquals("0.6.0 (build 1043)", UpdateLogic.displayName(rel("0.6.0", 1043), "0.6.0"))
        assertEquals("0.6.0", UpdateLogic.displayName(rel("0.6.0"), "0.5.0"))
    }

    // --- signatures ----------------------------------------------------------------------------

    @Test fun signers() {
        assertTrue(UpdateLogic.signersMatch(setOf("AB12"), setOf("ab12"), emptyList()))
        assertFalse(UpdateLogic.signersMatch(setOf("ab12"), setOf("cd34"), emptyList()))
        // Key rotation: the new APK's lineage contains the installed key.
        assertTrue(UpdateLogic.signersMatch(setOf("ab12"), setOf("cd34"), listOf("ab12", "cd34")))
        // Nothing readable never matches.
        assertFalse(UpdateLogic.signersMatch(emptySet(), emptySet(), emptyList()))
        assertFalse(UpdateLogic.signersMatch(setOf("ab12"), emptySet(), listOf("ab12")))
        // Multiple signers must be the same set.
        assertTrue(UpdateLogic.signersMatch(setOf("a", "b"), setOf("b", "a"), emptyList()))
        assertFalse(UpdateLogic.signersMatch(setOf("a", "b"), setOf("a"), emptyList()))
    }

    // --- HTTP failures ---------------------------------------------------------------------------

    @Test fun rateLimits() {
        val now = 1_700_000_000_000L
        val reset = (now / 1000 + 600).toString()
        assertEquals(
            "GitHub's limit for update checks was reached; try again in about 10 min",
            UpdateLogic.checkFailure(403, "0", reset, null, now),
        )
        assertEquals(
            "GitHub's limit for update checks was reached; try again in about 2 min",
            UpdateLogic.checkFailure(429, null, null, "90", now),
        )
        assertEquals(
            "GitHub's limit for update checks was reached; try again later",
            UpdateLogic.checkFailure(429, null, null, null, now),
        )
        assertEquals("GitHub refused the request (HTTP 403)", UpdateLogic.checkFailure(403, "42", reset, null, now))
        assertEquals("no release found on GitHub yet", UpdateLogic.checkFailure(404, null, null, null, now))
        assertTrue(UpdateLogic.checkFailure(502, null, null, null, now).contains("HTTP 502"))
    }
}
