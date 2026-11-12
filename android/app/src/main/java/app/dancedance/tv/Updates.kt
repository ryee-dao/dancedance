package app.dancedance.tv

import android.app.Activity
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.lang.ref.WeakReference
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLException
import kotlin.coroutines.coroutineContext

/**
 * "Options -> App update": checks GitHub for a newer release of this app's own repository
 * (BuildConfig.GITHUB_REPO, the same source of truth as the cloud trigger), downloads its
 * dancedance.apk into app-private cache, checks it (package, higher versionCode, same signing
 * key as the installed app) and hands it to the system installer through a PackageInstaller
 * session. Android then asks the person to confirm.
 *
 * Unauthenticated on purpose: the GitHub token linked for cloud triggers is never used here,
 * and nothing but status strings and progress numbers reaches JavaScript ([State.toJson]).
 *
 * At most one automatic check per app start (the result is kept for the session); "Retry" and
 * "Check again" ask again.
 */
class Updates(private val app: DanceApp, http: OkHttpClient, private val scope: CoroutineScope) {
    companion object {
        private const val TAG = "DanceDance"
        const val ACTION_INSTALL_STATUS = "app.dancedance.tv.UPDATE_INSTALL_STATUS"
        private const val USER_AGENT = "DanceDance-TV-Updater"
        private const val MAX_JSON_BYTES = 1_000_000
        private const val PROGRESS_EVERY_MS = 250L
        private const val PREF_LAST_CODE = "update.lastVersionCode"
        private const val PREF_RELAUNCH = "update.relaunchAfterReplace"
    }

    /**
     * What the Options row shows. `phase`:
     *   off            update checks aren't configured in this build (local builds)
     *   idle           not checked yet
     *   checking       asking GitHub
     *   up-to-date     nothing newer
     *   available      `latest` can be installed (Update button)
     *   downloading    `received` of `total` bytes (total 0 = unknown); Back / Cancel stops it
     *   verifying      checking the downloaded APK
     *   needs-permission  Android must allow DanceDance to install apps (settings screen opened)
     *   installing     handed to the system installer, waiting for the person to confirm
     *   error          `stage` "check" (Retry) or "update" (Try again), with `message`
     *   manual         this update can't install over the current app: `message` + `manualUrl`
     */
    data class State(
        val phase: String,
        val latest: String? = null,
        val message: String? = null,
        val stage: String? = null,
        val manualUrl: String? = null,
        val received: Long = 0,
        val total: Long = 0,
    ) {
        fun toJson(): JSONObject = JSONObject()
            .put("phase", phase)
            .put("installed", BuildConfig.VERSION_NAME)
            .put("installedCode", BuildConfig.VERSION_CODE)
            .put("latest", latest ?: JSONObject.NULL)
            .put("message", message ?: JSONObject.NULL)
            .put("stage", stage ?: JSONObject.NULL)
            .put("manualUrl", manualUrl ?: JSONObject.NULL)
            .put("received", received)
            .put("total", total)
    }

    private val lock = Any()
    private val main = Handler(Looper.getMainLooper())
    private val checkClient = http.newBuilder().callTimeout(30, TimeUnit.SECONDS).build()
    private val downloadClient = http.newBuilder().callTimeout(0, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).build()

    @Volatile private var state = State("idle")
    private var checkedThisSession = false
    private var release: UpdateLogic.Release? = null
    private var job: Job? = null
    private var call: Call? = null
    /** A verified APK waiting for the "install unknown apps" permission. */
    private var waitingFile: File? = null
    private var sessionId = -1
    private var activity = WeakReference<Activity>(null)
    private var updatedNotice: String? = null

    /** Set by the bridge: told about every state change (JSON from [State.toJson]). */
    @Volatile var listener: ((JSONObject) -> Unit)? = null

    private val repo: String? get() = app.cloud.repo
    private val dir: File get() = app.cacheDir.resolve("update")

    /** Debug builds may point the check at a local server (-Pdancedance.updateReleaseUrl=...). */
    private val override: String? get() = if (BuildConfig.DEBUG) BuildConfig.UPDATE_RELEASE_URL else null

    private val releaseUrl: String?
        get() = override ?: repo?.let { "https://api.github.com/repos/$it/releases/latest" }

    private val apkPrefix: String?
        get() = override?.let { Uri.parse(it).let { u -> "${u.scheme}://${u.encodedAuthority}/" } }
            ?: repo?.let { "https://github.com/$it/releases/download/" }

    /** The Downloader address (the same one the README gives). */
    val manualUrl: String?
        get() = repo?.let { "https://github.com/$it/releases/latest/download/${UpdateLogic.APK_ASSET}" }

    // --- lifecycle ---------------------------------------------------------------------------

    /** App start: delete leftovers from an earlier attempt and note whether we were just updated. */
    fun onAppStart() {
        dir.deleteRecursively()
        val sp = app.getSharedPreferences("dancedance", Context.MODE_PRIVATE)
        val last = sp.getInt(PREF_LAST_CODE, 0)
        if (last in 1 until BuildConfig.VERSION_CODE) updatedNotice = BuildConfig.VERSION_NAME
        if (last != BuildConfig.VERSION_CODE) sp.edit().putInt(PREF_LAST_CODE, BuildConfig.VERSION_CODE).apply()
        if (releaseUrl == null) state = State("off")
    }

    fun attach(a: Activity) {
        activity = WeakReference(a)
    }

    fun detach(a: Activity) {
        if (activity.get() === a) activity = WeakReference(null)
    }

    /** The activity came back to the front (e.g. from the "install unknown apps" screen). */
    fun onActivityResumed() {
        val file = synchronized(lock) {
            if (state.phase != "needs-permission") return
            waitingFile
        } ?: return
        if (!canInstall()) return
        Log.i(TAG, "Update: install permission granted, continuing")
        scope.launch { install(file) }
    }

    /** "Updated to X" once after an update (then empty). */
    fun takeUpdatedNotice(): String = synchronized(lock) { (updatedNotice ?: "").also { updatedNotice = null } }

    fun stateJson(): JSONObject = state.toJson()

    // --- check -------------------------------------------------------------------------------

    /** `force`: Retry / Check again. Otherwise only the first call per app start asks GitHub. */
    fun check(force: Boolean) {
        synchronized(lock) {
            val busy = state.phase in setOf("checking", "downloading", "verifying", "needs-permission", "installing")
            if (busy || state.phase == "off") return emit()
            if (!force && checkedThisSession) return emit()
            checkedThisSession = true
            set(State("checking"))
        }
        scope.launch { runCheck() }
    }

    private fun runCheck() {
        val url = releaseUrl ?: return set(State("off"))
        val prefix = apkPrefix ?: return set(State("off"))
        val req = Request.Builder().url(url).get()
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .header("User-Agent", USER_AGENT)
            .build()
        val next = try {
            checkClient.newCall(req).execute().use { r ->
                if (!r.isSuccessful) {
                    val why = UpdateLogic.checkFailure(
                        r.code, r.header("X-RateLimit-Remaining"), r.header("X-RateLimit-Reset"), r.header("Retry-After"),
                        System.currentTimeMillis(),
                    )
                    Log.w(TAG, "Update check: HTTP ${r.code}")
                    checkError(why)
                } else {
                    val text = r.body?.byteStream()?.let { readLimited(it, MAX_JSON_BYTES) }
                    when (val p = if (text == null) UpdateLogic.Parsed.Bad("GitHub's answer was too long.") else UpdateLogic.parseRelease(text, prefix)) {
                        is UpdateLogic.Parsed.Bad -> checkError(p.message.trimEnd('.'))
                        is UpdateLogic.Parsed.Ok -> decide(p.release)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Update check failed", e)
            checkError(networkReason(e))
        }
        synchronized(lock) { if (state.phase == "checking") set(next) }
    }

    private fun decide(r: UpdateLogic.Release): State {
        val newer = UpdateLogic.isNewer(r, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE)
        Log.i(TAG, "Update check: latest ${r.tag} (${r.versionName}, code ${r.versionCode}), installed ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}): newer=$newer")
        return when (newer) {
            null -> checkError("couldn't compare versions; the newest release is ${r.versionName}")
            false -> State("up-to-date", latest = r.versionName)
            true -> {
                release = r
                val name = UpdateLogic.displayName(r, BuildConfig.VERSION_NAME)
                // A release build signed with a debug key (no signing secrets back then) can never
                // be updated in place: say so now instead of after a download.
                if (BuildConfig.BUILD_TYPE == "release" && installedIsDebugSigned()) manualState(name) else State("available", latest = name)
            }
        }
    }

    private fun checkError(reason: String) = State("error", stage = "check", message = reason)

    // --- download, verify, install --------------------------------------------------------------

    /** The Update / Try again button. */
    fun start() {
        synchronized(lock) {
            val r = release ?: return emit()
            val ok = state.phase == "available" || (state.phase == "error" && state.stage == "update")
            if (!ok) return emit()
            val name = UpdateLogic.displayName(r, BuildConfig.VERSION_NAME)
            set(State("downloading", latest = name, total = r.apkBytes))
            job = scope.launch { runUpdate(r, name) }
        }
    }

    /** Cancel / Back while downloading or waiting: back to "Update available". */
    fun cancel() {
        val (j, c, id) = synchronized(lock) {
            if (state.phase !in setOf("downloading", "verifying", "needs-permission", "installing")) return emit()
            val t = Triple(job, call, sessionId)
            job = null
            call = null
            sessionId = -1
            waitingFile = null
            set(State("available", latest = state.latest, message = "Update cancelled."))
            t
        }
        c?.cancel()
        j?.cancel()
        if (id >= 0) runCatching { app.packageManager.packageInstaller.abandonSession(id) }
        dir.deleteRecursively()
    }

    private suspend fun runUpdate(r: UpdateLogic.Release, name: String) {
        val file = try {
            download(r, name)
        } catch (e: CancellationException) {
            dir.deleteRecursively()
            return
        } catch (e: Exception) {
            Log.w(TAG, "Update download failed", e)
            dir.deleteRecursively()
            return fail(name, if (e is UpdateFailure) e.message else "the download failed (${networkReason(e)})")
        }
        if (!coroutineContext.isActive) return
        synchronized(lock) { if (state.phase == "downloading") set(state.copy(phase = "verifying")) else return }
        when (val v = verify(file)) {
            is Verdict.Bad -> {
                file.delete()
                Log.w(TAG, "Update refused: ${v.message}")
                synchronized(lock) { if (state.phase == "verifying") set(if (v.manual) manualState(name) else updateError(name, v.message)) }
                return
            }
            Verdict.Ok -> Unit
        }
        if (!canInstall()) {
            synchronized(lock) {
                if (state.phase != "verifying") return
                waitingFile = file
                set(State("needs-permission", latest = name))
            }
            openInstallSettings()
            return
        }
        install(file)
    }

    private class UpdateFailure(override val message: String) : Exception(message)

    private suspend fun download(r: UpdateLogic.Release, name: String): File {
        dir.deleteRecursively()
        dir.mkdirs()
        val need = if (r.apkBytes > 0) r.apkBytes else 60L * 1024 * 1024
        if (dir.usableSpace in 1 until need * 2) throw UpdateFailure("there isn't enough free space on the TV")
        val part = dir.resolve("${UpdateLogic.APK_ASSET}.part")
        val req = Request.Builder().url(r.apkUrl).get().header("User-Agent", USER_AGENT).build()
        val c = downloadClient.newCall(req)
        synchronized(lock) { call = c }
        c.execute().use { res ->
            if (!res.isSuccessful) throw UpdateFailure("GitHub answered HTTP ${res.code} for the download")
            val body = res.body ?: throw UpdateFailure("the download was empty")
            val total = body.contentLength().takeIf { it > 0 } ?: r.apkBytes
            if (total > UpdateLogic.MAX_APK_BYTES) throw UpdateFailure("the download is unexpectedly large")
            var received = 0L
            var lastEmit = 0L
            body.byteStream().use { input ->
                part.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        if (!coroutineContext.isActive) throw CancellationException()
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        received += n
                        if (received > UpdateLogic.MAX_APK_BYTES) throw UpdateFailure("the download is unexpectedly large")
                        val now = System.currentTimeMillis()
                        if (now - lastEmit >= PROGRESS_EVERY_MS) {
                            lastEmit = now
                            synchronized(lock) { if (state.phase == "downloading") set(State("downloading", latest = name, received = received, total = total)) }
                        }
                    }
                    out.fd.sync()
                }
            }
            if (r.apkBytes > 0 && received != r.apkBytes) throw UpdateFailure("the download was incomplete (${received} of ${r.apkBytes} bytes)")
            synchronized(lock) { if (state.phase == "downloading") set(State("downloading", latest = name, received = received, total = received)) }
        }
        synchronized(lock) { call = null }
        val apk = dir.resolve(UpdateLogic.APK_ASSET)
        if (!part.renameTo(apk)) throw UpdateFailure("couldn't save the download")
        return apk
    }

    private sealed class Verdict {
        object Ok : Verdict()
        data class Bad(val message: String, val manual: Boolean = false) : Verdict()
    }

    /** The APK must be this app, newer than what's installed, and signed with the same key. */
    private fun verify(file: File): Verdict {
        val pm = app.packageManager
        val flags = signatureFlags()
        val apk = try {
            pm.getPackageArchiveInfo(file.path, flags)
        } catch (e: Exception) {
            null
        } ?: return Verdict.Bad("the download isn't a valid app")
        if (apk.packageName != app.packageName) return Verdict.Bad("the download is a different app (${apk.packageName.take(60)})")
        val code = versionCodeOf(apk)
        if (code <= BuildConfig.VERSION_CODE) {
            return Verdict.Bad("the download (${apk.versionName ?: "?"}, build $code) isn't newer than this app (build ${BuildConfig.VERSION_CODE})")
        }
        val installed = try {
            pm.getPackageInfo(app.packageName, flags)
        } catch (e: Exception) {
            return Verdict.Bad("couldn't read this app's own signature")
        }
        val (have, _) = signers(installed)
        val (got, history) = signers(apk)
        if (got.isEmpty()) return Verdict.Bad("couldn't read the download's signature")
        if (!UpdateLogic.signersMatch(have, got, history)) return Verdict.Bad("signed with a different key", manual = true)
        Log.i(TAG, "Update verified: ${apk.versionName} ($code)")
        return Verdict.Ok
    }

    private fun versionCodeOf(p: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= 28) p.longVersionCode else @Suppress("DEPRECATION") p.versionCode.toLong()

    /** SHA-256 digests of the current signer(s), and the signing lineage (key rotation). */
    private fun signers(p: PackageInfo): Pair<Set<String>, List<String>> {
        val si = if (Build.VERSION.SDK_INT >= 28) p.signingInfo else null
        if (si != null && Build.VERSION.SDK_INT >= 28) {
            val current = si.apkContentsSigners?.map(::digest)?.toSet() ?: emptySet()
            val history = if (si.hasMultipleSigners()) emptyList() else si.signingCertificateHistory?.map(::digest) ?: emptyList()
            if (current.isNotEmpty()) return current to history
        }
        // API 26-27, and Android 9's getPackageArchiveInfo, which only fills `signatures`.
        @Suppress("DEPRECATION")
        val old = p.signatures
        return (old?.map(::digest)?.toSet() ?: emptySet()) to emptyList()
    }

    /** Both flags: Android 9 collects an archive's certificates only for GET_SIGNATURES. */
    @Suppress("DEPRECATION")
    private fun signatureFlags(): Int =
        PackageManager.GET_SIGNATURES or (if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else 0)

    private fun digest(s: Signature) = UpdateLogic.hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray()))

    private fun installedIsDebugSigned(): Boolean = try {
        val p = app.packageManager.getPackageInfo(app.packageName, signatureFlags())
        @Suppress("DEPRECATION")
        val sigs: Array<Signature>? = (if (Build.VERSION.SDK_INT >= 28) p.signingInfo?.apkContentsSigners else null) ?: p.signatures
        val cf = CertificateFactory.getInstance("X.509")
        sigs?.any {
            val cert = cf.generateCertificate(ByteArrayInputStream(it.toByteArray())) as X509Certificate
            cert.subjectX500Principal.name.contains("CN=Android Debug")
        } == true
    } catch (e: Exception) {
        false
    }

    private fun canInstall(): Boolean = Build.VERSION.SDK_INT < 26 || app.packageManager.canRequestPackageInstalls()

    /** Open Android's "install unknown apps" switch for DanceDance (the needs-permission step). */
    fun openInstallSettings() {
        main.post {
            val a = activity.get()
            val ctx: Context = a ?: app
            val flags = if (a == null) Intent.FLAG_ACTIVITY_NEW_TASK else 0
            val tries = listOf(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${app.packageName}")),
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES),
                Intent(Settings.ACTION_SECURITY_SETTINGS),
            )
            for (i in tries) {
                try {
                    ctx.startActivity(i.addFlags(flags))
                    return@post
                } catch (e: ActivityNotFoundException) {
                    continue
                } catch (e: SecurityException) {
                    continue
                }
            }
            synchronized(lock) {
                if (state.phase == "needs-permission") {
                    set(state.copy(message = "This TV has no shortcut to that setting. Open Settings → Apps → Security & restrictions → Unknown sources and turn on DanceDance."))
                }
            }
        }
    }

    private fun install(file: File) {
        val name = synchronized(lock) {
            if (state.phase != "verifying" && state.phase != "needs-permission") return
            waitingFile = null
            set(State("installing", latest = state.latest))
            state.latest
        }
        val pi = app.packageManager.packageInstaller
        var id = -1
        try {
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
                setAppPackageName(app.packageName)
                setSize(file.length())
                if (Build.VERSION.SDK_INT >= 26) setInstallReason(PackageManager.INSTALL_REASON_USER)
            }
            id = pi.createSession(params)
            synchronized(lock) { sessionId = id }
            pi.openSession(id).use { session ->
                session.openWrite(UpdateLogic.APK_ASSET, 0, file.length()).use { out ->
                    file.inputStream().use { it.copyTo(out, 64 * 1024) }
                    session.fsync(out)
                }
                val intent = Intent(app, UpdateInstallReceiver::class.java).setAction(ACTION_INSTALL_STATUS).setPackage(app.packageName)
                val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                val sender = PendingIntent.getBroadcast(app, id, intent, piFlags).intentSender
                app.getSharedPreferences("dancedance", Context.MODE_PRIVATE).edit().putBoolean(PREF_RELAUNCH, true).apply()
                session.commit(sender)
            }
            Log.i(TAG, "Update: session $id committed")
        } catch (e: Exception) {
            Log.w(TAG, "Update: install session failed", e)
            if (id >= 0) runCatching { pi.abandonSession(id) }
            synchronized(lock) {
                sessionId = -1
                if (state.phase == "installing") set(updateError(name, "the TV couldn't start the installer (${e.javaClass.simpleName})"))
            }
        } finally {
            // The session holds its own copy now; ours isn't needed either way.
            dir.deleteRecursively()
        }
    }

    /** From [UpdateInstallReceiver]: the system installer's answer for our session. */
    fun onInstallStatus(intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val id = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)
        Log.i(TAG, "Update: install status $status for session $id")
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            @Suppress("DEPRECATION")
            val confirm: Intent = (if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java) else intent.getParcelableExtra(Intent.EXTRA_INTENT))
                ?: return
            main.post {
                val a = activity.get()
                try {
                    if (a != null) a.startActivity(confirm) else app.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (e: Exception) {
                    Log.w(TAG, "Update: couldn't show the install confirmation", e)
                    synchronized(lock) { if (state.phase == "installing") set(updateError(state.latest, "the TV's installer didn't open")) }
                }
            }
            return
        }
        val sp = app.getSharedPreferences("dancedance", Context.MODE_PRIVATE)
        if (status != PackageInstaller.STATUS_SUCCESS) sp.edit().remove(PREF_RELAUNCH).apply()
        synchronized(lock) {
            if (id >= 0 && id != sessionId) return
            sessionId = -1
            if (state.phase != "installing") return
            val name = state.latest
            set(
                when (status) {
                    // Usually not seen: Android stops this app to replace it.
                    PackageInstaller.STATUS_SUCCESS -> State("up-to-date", latest = name, message = "Installed. Restart DanceDance to use it.")
                    PackageInstaller.STATUS_FAILURE_ABORTED -> State("available", latest = name, message = "Install cancelled.")
                    PackageInstaller.STATUS_FAILURE_INCOMPATIBLE, PackageInstaller.STATUS_FAILURE_CONFLICT -> manualState(name)
                    PackageInstaller.STATUS_FAILURE_STORAGE -> updateError(name, "there isn't enough free space on the TV")
                    PackageInstaller.STATUS_FAILURE_BLOCKED -> updateError(name, "the TV blocked the install")
                    else -> updateError(
                        name,
                        "the TV's installer said: " + (intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)?.take(120) ?: "failed (status $status)"),
                    )
                },
            )
        }
    }

    /** From [PackageReplacedReceiver]: we were just replaced by our own update; try to come back. */
    fun onPackageReplaced() {
        val sp = app.getSharedPreferences("dancedance", Context.MODE_PRIVATE)
        if (!sp.getBoolean(PREF_RELAUNCH, false)) return
        sp.edit().remove(PREF_RELAUNCH).apply()
        // Android 10+ may not allow this from the background; then the person opens the app.
        val launch = app.packageManager.getLeanbackLaunchIntentForPackage(app.packageName)
            ?: app.packageManager.getLaunchIntentForPackage(app.packageName)
            ?: return
        try {
            app.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            Log.i(TAG, "Update: relaunch not allowed (${e.javaClass.simpleName})")
        }
    }

    // --- helpers -------------------------------------------------------------------------------

    private fun manualState(name: String?) = State(
        "manual",
        latest = name,
        manualUrl = manualUrl,
        message = "This update is signed with a different key than the copy on this TV (older installs used a temporary key), " +
            "so this one update needs a manual reinstall: uninstall DanceDance, then install it with Downloader from",
    )

    private fun updateError(name: String?, reason: String) = State("error", stage = "update", latest = name, message = reason)

    private fun fail(name: String, reason: String) {
        synchronized(lock) { if (state.phase == "downloading" || state.phase == "verifying") set(updateError(name, reason)) }
    }

    private fun networkReason(e: Throwable): String {
        val chain = generateSequence(e) { it.cause }.take(6).toList()
        return when {
            chain.any { it is UnknownHostException } -> "no internet connection"
            chain.any { it is java.net.ConnectException } -> "couldn't reach GitHub"
            chain.any { it is SocketTimeoutException } -> "GitHub didn't answer in time"
            chain.any { it is SSLException } -> "the secure connection failed; check the TV's date and time"
            chain.any { it is IOException } -> "the connection dropped"
            else -> "something went wrong: ${e.javaClass.simpleName}"
        }
    }

    private fun readLimited(input: InputStream, max: Int): String? {
        val out = java.io.ByteArrayOutputStream()
        val buf = ByteArray(16 * 1024)
        input.use {
            while (true) {
                val n = it.read(buf)
                if (n < 0) break
                out.write(buf, 0, n)
                if (out.size() > max) return null
            }
        }
        return out.toString("UTF-8")
    }

    /** Call with [lock] held (or from a single-threaded spot). */
    private fun set(s: State) {
        state = s
        emit()
    }

    private fun emit() {
        val l = listener ?: return
        val json = state.toJson()
        try {
            l(json)
        } catch (e: Exception) {
            Log.w(TAG, "Update listener failed", e)
        }
    }
}

/** Receives the PackageInstaller session's status (not exported: only our PendingIntent reaches it). */
class UpdateInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Updates.ACTION_INSTALL_STATUS) return
        (context.applicationContext as? DanceApp)?.updates?.onInstallStatus(intent)
    }
}

/** MY_PACKAGE_REPLACED: the new version is in place; reopen the app if we started the update. */
class PackageReplacedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        (context.applicationContext as? DanceApp)?.updates?.onPackageReplaced()
    }
}
