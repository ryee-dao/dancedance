package app.dancedance.tv

import android.os.Build
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.webkit.WebViewCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runInterruptible
import org.json.JSONArray
import org.json.JSONObject

/**
 * `window.DanceBridge`: the native half of the contract defined in src/platform/androidtv.ts
 * (keep the two in sync; bump [VERSION] on breaking changes).
 *
 * `@JavascriptInterface` methods run on a WebView background thread and must return quickly,
 * so slow calls take a request id, return immediately, and later deliver
 *   {"type":"result","id":...,"ok":true,"value":...} or {"type":"result","id":...,"ok":false,"error":{code,message}}
 * through `window.__danceBridgeReceive(jsonString)`. Events use the same channel:
 *   {"type":"event","name":"audioProgress"|"linkVisited"|"linkSubmitted"|"lifecycle"|"addedSongsChanged","data":{...}}
 *
 * Version 2 added: getAddedSongs(), removeAddedSong(), the addedSongsChanged event (songs added
 * from the phone page's "Find a song").
 * Version 3 added: setAudioFormats() and PreparedAudio.primingSec (beat-map alignment; WebM/Opus
 * downloaded by default, see [AudioPick] / [Mp4Priming]).
 */
class DanceBridge(private val app: DanceApp, private val host: Host) {
    interface Host {
        /** Run JavaScript in the page (any thread; the host posts to the UI thread). */
        fun evaluate(js: String)
        fun setKeepScreenOn(on: Boolean)
        fun exitApp()
        fun webViewVersion(): String?
    }

    companion object {
        const val VERSION = 3
        private const val TAG = "DanceDance"
        private val ID_RE = Regex("^[A-Za-z0-9_-]{1,40}$")
        private val VIDEO_RE = Regex("^[A-Za-z0-9_-]{11}$")
    }

    /** True once the page has talked to us; until then BACK exits natively (safety net). */
    @Volatile var pageReady = false
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val addedListener: (AddedSongsStore.Song?, String?) -> Unit = { added, removed ->
        event(
            "addedSongsChanged",
            JSONObject().put("songs", app.addedSongs.toJson())
                .put("added", added?.toJson() ?: JSONObject.NULL)
                .put("removedVideoId", removed ?: JSONObject.NULL),
        )
    }

    init {
        app.onAddedSongsChanged = addedListener
    }

    // ---------------------------------------------------------------------------------------
    // Synchronous calls

    @JavascriptInterface
    fun bridgeVersion(): Int = VERSION

    @JavascriptInterface
    fun getConfig(): String {
        pageReady = true
        return JSONObject()
            .put("bridgeVersion", VERSION)
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("newPipeVersion", BuildConfig.NEWPIPE_VERSION)
            .put("pagesBaseUrl", BuildConfig.PAGES_BASE_URL ?: JSONObject.NULL)
            .put("cloudRepoConfigured", BuildConfig.GITHUB_REPO != null)
            .put("canTriggerCloud", BuildConfig.GITHUB_REPO != null && app.prefs.hasGithubToken)
            .toString()
    }

    @JavascriptInterface
    fun getLinkedPlaylist(): String {
        val link = app.prefs.playlist ?: return "null"
        return JSONObject().put("input", link.input).put("listId", link.listId).toString()
    }

    @JavascriptInterface
    fun unlinkPlaylist() {
        app.prefs.playlist = null
    }

    @JavascriptInterface
    fun getDiagnostics(): String {
        val cache = app.audio.cache
        val rt = Runtime.getRuntime()
        return JSONObject()
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("versionCode", BuildConfig.VERSION_CODE)
            .put("buildType", BuildConfig.BUILD_TYPE)
            .put("newPipeVersion", BuildConfig.NEWPIPE_VERSION)
            .put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
            .put("android", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            .put("webView", host.webViewVersion() ?: JSONObject.NULL)
            .put("cpuCores", rt.availableProcessors())
            .put("maxHeapMb", rt.maxMemory() / (1024 * 1024))
            .put("cacheBytes", cache.totalBytes())
            .put("cacheFiles", cache.files().size)
            .put("cacheCapBytes", cache.capBytes)
            .put("lastDownload", app.audio.lastDownload ?: JSONObject.NULL)
            .put("pagesBaseUrl", BuildConfig.PAGES_BASE_URL ?: JSONObject.NULL)
            .put("cloudRepo", BuildConfig.GITHUB_REPO ?: JSONObject.NULL)
            .put("hasGithubToken", app.prefs.hasGithubToken)
            .put("tokenStorage", app.prefs.tokenStorage)
            .put("lastCloudTrigger", app.prefs.lastCloudResult?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject.NULL)
            .toString()
    }

    /** JSON array of added songs, oldest first: {videoId, title, artist, addedAt, durationSec, note?, videoTitle, channel, tier}. */
    @JavascriptInterface
    fun getAddedSongs(): String = app.addedSongs.toJson().toString()

    /** Remove a song added from the phone. Returns true if it was there. Emits addedSongsChanged. */
    @JavascriptInterface
    fun removeAddedSong(videoId: String): Boolean {
        val gone = app.addedSongs.remove(videoId) ?: return false
        addedListener(null, gone.videoId)
        return true
    }

    @JavascriptInterface
    fun setKeepScreenOn(on: Boolean) = host.setKeepScreenOn(on)

    /** Called by the page when BACK is pressed on its home screen. */
    @JavascriptInterface
    fun exitApp() = host.exitApp()

    @JavascriptInterface
    fun cancelAudio(videoId: String) {
        if (VIDEO_RE.matches(videoId)) app.audio.cancel(videoId)
    }

    @JavascriptInterface
    fun stopLinkServer() = app.link.stop()

    /**
     * Download format preference, e.g. "webm,m4a" (the default) or "m4a,webm" when the page's
     * probe found the WebView can't play or decode Opus. Returns the order now in effect.
     */
    @JavascriptInterface
    fun setAudioFormats(csv: String?): String {
        val order = AudioPick.parseOrder(csv)
        app.audio.formats = order
        Log.i(TAG, "Audio formats: ${order.joinToString(",")}")
        return order.joinToString(",")
    }

    // ---------------------------------------------------------------------------------------
    // Asynchronous calls (result delivered later by request id)

    /** Value: [{videoId, title, artist?, durationSec?}] in playlist order. `artist` is the uploader. */
    @JavascriptInterface
    fun getPlaylist(requestId: String, listIdOrUrl: String) = async(requestId) {
        val parsed = PlaylistLinks.parse(listIdOrUrl)
        if (parsed is PlaylistLinks.Parsed.Error) throw BridgeException("bad-input", parsed.message)
        val listId = (parsed as PlaylistLinks.Parsed.Ok).listId
        val t0 = System.currentTimeMillis()
        val entries = try {
            runInterruptible { app.playlists.read(listId) }
        } catch (e: CancellationException) {
            throw e
        } catch (t: Throwable) {
            Log.w(TAG, "Playlist read failed", t)
            throw Errors.classify(t, forPlaylist = true)
        }
        Log.i(TAG, "Playlist $listId: ${entries.size} entries in ${System.currentTimeMillis() - t0} ms")
        JSONArray().apply {
            entries.forEach { e ->
                put(
                    JSONObject().put("videoId", e.videoId).put("title", e.title)
                        .put("artist", e.artist ?: JSONObject.NULL)
                        .put("durationSec", e.durationSec ?: JSONObject.NULL),
                )
            }
        }
    }

    /** Value: {videoId, url, mimeType, bytes, durationSec, fromCache, downloadMs, primingSec}. */
    @JavascriptInterface
    fun prepareAudio(requestId: String, videoId: String) = async(requestId) {
        if (!VIDEO_RE.matches(videoId)) throw BridgeException("bad-input", "Not a YouTube video ID.")
        val p = app.audio.prepare(videoId) { pr ->
            event(
                "audioProgress",
                JSONObject().put("videoId", pr.videoId).put("phase", pr.phase)
                    .put("receivedBytes", pr.receivedBytes)
                    .put("totalBytes", if (pr.totalBytes > 0) pr.totalBytes else JSONObject.NULL)
                    .put("attempt", pr.attempt),
            )
        }
        JSONObject()
            .put("videoId", p.videoId)
            .put("url", "https://${MainActivity.ASSET_HOST}${AudioServer.PATH}${p.file.name}")
            .put("mimeType", p.mimeType)
            .put("bytes", p.file.length())
            .put("durationSec", p.durationSec ?: JSONObject.NULL)
            .put("fromCache", p.fromCache)
            .put("downloadMs", p.downloadMs)
            .put("primingSec", p.primingSec)
    }

    /**
     * `missingCount`: songs in the playlist with neither a cloud map nor a known cloud failure
     * (the page knows; it has index.json / status.json). Value: {status, retryAfterSec?, httpStatus?, message?}.
     */
    @JavascriptInterface
    fun requestCloudAnalysis(requestId: String, missingCount: Int) = async(requestId) {
        app.cloud.request(missingCount)
    }

    /** Value: {url, qrDataUrl}. Server runs until stopLinkServer() (the page calls it on leaving). */
    @JavascriptInterface
    fun startLinkServer(requestId: String) = async(requestId) {
        app.link.listener = object : LinkController.Listener {
            override fun onPhoneVisited() = event("linkVisited", JSONObject())
            override fun onLinked(link: Prefs.Link, songCount: Int, tokenChange: String) = event(
                "linkSubmitted",
                JSONObject().put("input", link.input).put("listId", link.listId)
                    .put("songCount", songCount).put("token", tokenChange),
            )
        }
        val s = app.link.start()
        JSONObject().put("url", s.url).put("qrDataUrl", s.qrSvgDataUrl)
    }

    // ---------------------------------------------------------------------------------------

    fun event(name: String, data: JSONObject) =
        deliver(JSONObject().put("type", "event").put("name", name).put("data", data))

    fun dispose() {
        if (app.onAddedSongsChanged === addedListener) app.onAddedSongsChanged = null
        scope.cancel()
    }

    private fun async(requestId: String, block: suspend () -> Any) {
        pageReady = true
        if (!ID_RE.matches(requestId)) {
            Log.w(TAG, "Bridge: bad request id")
            return
        }
        scope.launch {
            val msg = JSONObject().put("type", "result").put("id", requestId)
            try {
                msg.put("ok", true).put("value", block())
            } catch (e: CancellationException) {
                if (!isActive) return@launch // bridge disposed: nobody to tell
                msg.put("ok", false).put("error", errorJson("cancelled", "Cancelled."))
            } catch (t: Throwable) {
                val e = if (t is BridgeException) t else Errors.classify(t)
                if (e.code == "internal") Log.e(TAG, "Bridge call failed", t)
                msg.put("ok", false).put("error", errorJson(e.code, e.message))
            }
            deliver(msg)
        }
    }

    private fun errorJson(code: String, message: String) = JSONObject().put("code", code).put("message", message)

    private fun deliver(msg: JSONObject) {
        host.evaluate("window.__danceBridgeReceive&&window.__danceBridgeReceive(${JSONObject.quote(msg.toString())})")
    }
}

/** For diagnostics: the WebView provider's version (e.g. "120.0.6099.230"). */
fun webViewVersionOf(context: android.content.Context): String? =
    runCatching { WebViewCompat.getCurrentWebViewPackage(context)?.versionName }.getOrNull()
