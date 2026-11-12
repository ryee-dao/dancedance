package app.dancedance.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.Display
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * The whole app: one full-screen WebView running the bundled web build from
 * https://appassets.androidplatform.net/web/ (never file://, never a remote page), plus the
 * native bridge. Remote keys: D-pad/OK arrive as Arrow keys/Enter natively; BACK is turned into
 * Escape for the page, which calls DanceBridge.exitApp() when BACK is pressed on its home screen.
 */
class MainActivity : Activity(), DanceBridge.Host {
    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val START_URL = "https://$ASSET_HOST/web/index.html"
        private const val TAG = "DanceDance"
        private const val WEB_TAG = "DanceDanceWeb"
        /** After this long in the background, coming back reloads (= re-reads the playlist). */
        private const val RELOAD_AFTER_MS = 10 * 60 * 1000L
    }

    private val app get() = application as DanceApp
    private lateinit var container: FrameLayout
    private lateinit var bridge: DanceBridge
    private lateinit var assets: WebViewAssetLoader
    private var webView: WebView? = null
    private var stoppedAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        container = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0F0D17")) }
        setContentView(container)
        assets = WebViewAssetLoader.Builder()
            .setDomain(ASSET_HOST)
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        bridge = DanceBridge(app, this)
        createWebView(savedInstanceState)
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun createWebView(state: Bundle?) {
        val wv = WebView(this)
        wv.setBackgroundColor(Color.parseColor("#0F0D17"))
        // No View layer on the WebView (LAYER_TYPE_NONE, the default): a hardware layer makes the
        // whole page render into an extra offscreen texture that is redrawn and copied every frame
        // while the coach animates, a full-screen pass a weak projector GPU can't spare.
        wv.setLayerType(View.LAYER_TYPE_NONE, null)
        // The page is what the user is looking at: keep its renderer at full priority, even when
        // the activity briefly loses focus (system overlays, the volume bar).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        }
        wv.isFocusable = true
        wv.isFocusableInTouchMode = true
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(false)
            userAgentString = "$userAgentString DanceDanceTV/${BuildConfig.VERSION_NAME}"
        }
        wv.addJavascriptInterface(bridge, "DanceBridge")
        wv.webViewClient = Client()
        wv.webChromeClient = Chrome()
        container.addView(wv, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        webView = wv
        if (state == null || wv.restoreState(state) == null) wv.loadUrl(START_URL)
        wv.requestFocus()
    }

    private inner class Client : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val url = request.url
            if (url.host != ASSET_HOST) return null // thumbnails, cloud beat maps, oEmbed: normal network
            if (url.scheme != "https") return AudioServer.error(403, "Forbidden")
            val path = url.path ?: "/"
            if (path.startsWith(AudioServer.PATH)) return AudioServer.serve(app.audio.cache, request)
            val res = assets.shouldInterceptRequest(url) ?: return AudioServer.error(404, "Not Found")
            if (path.endsWith(".html") || path.endsWith("/")) {
                // No frames at all: the bridge must never be reachable from embedded remote content.
                res.responseHeaders = (res.responseHeaders ?: emptyMap()) +
                    mapOf("Content-Security-Policy" to "frame-src 'none'; object-src 'none'; worker-src 'self'")
            }
            return res
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val ok = isOwnPage(request.url)
            if (!ok) Log.w(TAG, "Blocked navigation to ${request.url}")
            return !ok
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            Log.e(TAG, "WebView renderer gone (crash=${detail.didCrash()}); recreating")
            container.removeView(view)
            view.destroy()
            if (webView === view) webView = null
            if (!isFinishing) createWebView(null)
            return true
        }
    }

    private fun isOwnPage(uri: Uri) = uri.scheme == "https" && uri.host == ASSET_HOST

    private inner class Chrome : WebChromeClient() {
        override fun onConsoleMessage(m: ConsoleMessage): Boolean {
            val level = when (m.messageLevel()) {
                ConsoleMessage.MessageLevel.ERROR -> Log.ERROR
                ConsoleMessage.MessageLevel.WARNING -> Log.WARN
                ConsoleMessage.MessageLevel.DEBUG -> Log.DEBUG
                else -> Log.INFO
            }
            val src = m.sourceId()?.substringAfterLast('/') ?: ""
            Log.println(level, WEB_TAG, "${m.message()} ($src:${m.lineNumber()})")
            return true
        }

        // No microphone, camera or anything else on TV.
        override fun onPermissionRequest(request: PermissionRequest) = request.deny()
    }

    // --- keys ------------------------------------------------------------------------------

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val wv = webView
        if (event.keyCode == KeyEvent.KEYCODE_BACK && wv != null && bridge.pageReady) {
            // Deliver BACK to the page as Escape; the page decides whether to leave the app.
            val esc = KeyEvent(event.downTime, event.eventTime, event.action, KeyEvent.KEYCODE_ESCAPE, event.repeatCount, event.metaState)
            if (!wv.hasFocus()) wv.requestFocus()
            wv.dispatchKeyEvent(esc)
            return true
        }
        if (wv != null && !wv.hasFocus() && event.action == KeyEvent.ACTION_DOWN) wv.requestFocus()
        return super.dispatchKeyEvent(event)
    }

    // --- DanceBridge.Host ------------------------------------------------------------------

    override fun evaluate(js: String) {
        runOnUiThread { webView?.evaluateJavascript(js, null) }
    }

    override fun setKeepScreenOn(on: Boolean) {
        runOnUiThread {
            if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    override fun exitApp() {
        runOnUiThread { finish() }
    }

    override fun webViewVersion(): String? = webViewVersionOf(this)

    override fun graphicsInfo(): JSONObject = onUi {
        val wv = webView
        val d = currentDisplay()
        val mode = d?.mode
        JSONObject()
            .put("android", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            .put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
            .put("viewHardwareAccelerated", wv?.isHardwareAccelerated ?: false)
            .put("windowHardwareAccelerated", (window.attributes.flags and WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED) != 0)
            .put("layerType", layerName(wv?.layerType ?: View.LAYER_TYPE_NONE))
            .put("viewPx", if (wv != null) "${wv.width}x${wv.height}" else "no view")
            .put("displayMode", if (mode != null) "${mode.physicalWidth}x${mode.physicalHeight}@${"%.0f".format(mode.refreshRate)}Hz" else "unknown")
            .put(
                "modes",
                d?.supportedModes?.joinToString(",") { "${it.physicalWidth}x${it.physicalHeight}@${"%.0f".format(it.refreshRate)}" }?.take(120) ?: "unknown",
            )
            .put("density", resources.displayMetrics.densityDpi)
    } ?: JSONObject().put("android", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})").put("device", "${Build.MANUFACTURER} ${Build.MODEL}")

    override fun setWebViewLayerType(type: String): String {
        val t = when (type) {
            "none" -> View.LAYER_TYPE_NONE
            "hardware" -> View.LAYER_TYPE_HARDWARE
            "software" -> View.LAYER_TYPE_SOFTWARE
            else -> return "unknown layer type '$type'"
        }
        return onUi {
            val wv = webView ?: return@onUi "no WebView"
            wv.setLayerType(t, null)
            Log.i(TAG, "Graphics test: WebView layer type ${layerName(wv.layerType)}")
            layerName(wv.layerType)
        } ?: "timed out"
    }

    private fun layerName(t: Int) = when (t) {
        View.LAYER_TYPE_HARDWARE -> "hardware"
        View.LAYER_TYPE_SOFTWARE -> "software"
        else -> "none"
    }

    @Suppress("DEPRECATION")
    private fun currentDisplay(): Display? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display else windowManager.defaultDisplay

    /** Run on the UI thread and wait (bridge calls arrive on a WebView background thread); null on timeout. */
    private fun <T> onUi(f: () -> T): T? {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) return f()
        val task = FutureTask(f)
        runOnUiThread(task)
        return runCatching { task.get(1500, TimeUnit.MILLISECONDS) }.getOrNull()
    }

    // --- lifecycle -------------------------------------------------------------------------

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goImmersive()
    }

    @Suppress("DEPRECATION")
    private fun goImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        }
    }

    override fun onStart() {
        super.onStart()
        webView?.resumeTimers()
        if (stoppedAt > 0 && SystemClock.elapsedRealtime() - stoppedAt > RELOAD_AFTER_MS) {
            Log.i(TAG, "Back after a long break: reloading to re-read the playlist")
            webView?.loadUrl(START_URL)
        }
        stoppedAt = 0
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        bridge.event("lifecycle", org.json.JSONObject().put("state", "resume"))
    }

    override fun onPause() {
        // Tell the page first so it pauses the song (WebView.onPause doesn't stop <audio>).
        bridge.event("lifecycle", org.json.JSONObject().put("state", "pause"))
        webView?.onPause()
        super.onPause()
    }

    override fun onStop() {
        stoppedAt = SystemClock.elapsedRealtime()
        app.link.stop() // never leave the LAN server running in the background
        webView?.pauseTimers()
        super.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView?.saveState(outState)
    }

    override fun onDestroy() {
        bridge.dispose()
        app.link.stop()
        if (isFinishing) app.audio.cancelAll()
        webView?.let {
            container.removeView(it)
            it.destroy()
        }
        webView = null
        super.onDestroy()
    }
}
