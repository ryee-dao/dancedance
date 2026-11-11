package app.dancedance.tv

import android.os.SystemClock
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.runInterruptible
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import kotlin.coroutines.coroutineContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val TAG = "DanceDance"

/** Downloaded songs, app-private, evicted least-recently-used beyond [capBytes]. */
class AudioCache(val dir: File, val capBytes: Long) {
    init {
        dir.mkdirs()
        // Leftovers from a download that was killed mid-way.
        dir.listFiles { f -> f.name.endsWith(".part") }?.forEach { it.delete() }
    }

    fun find(videoId: String): File? =
        listOf("m4a", "webm").map { dir.resolve("$videoId.$it") }.firstOrNull { it.isFile && it.length() > 0 }

    /** A cache file by its served name ("<videoId>.<ext>"), or null if unknown / malformed. */
    fun byName(name: String): File? {
        if (!NAME_RE.matches(name)) return null
        return dir.resolve(name).takeIf { it.isFile }
    }

    fun partFile(videoId: String, ext: String) = dir.resolve("$videoId.$ext.part")
    fun finalFile(videoId: String, ext: String) = dir.resolve("$videoId.$ext")

    fun touch(f: File) {
        f.setLastModified(System.currentTimeMillis())
    }

    fun files(): List<File> = dir.listFiles { f -> NAME_RE.matches(f.name) }?.toList() ?: emptyList()
    fun totalBytes(): Long = files().sumOf { it.length() }

    /** Delete least-recently-used files until the cache fits; never deletes [keep]. */
    @Synchronized
    fun evict(keep: Set<File>) {
        var total = totalBytes()
        if (total <= capBytes) return
        for (f in files().sortedBy { it.lastModified() }) {
            if (total <= capBytes) break
            if (f in keep) continue
            val len = f.length()
            if (f.delete()) {
                total -= len
                Log.i(TAG, "Audio cache: evicted ${f.name} (${len / 1024} KB), now ${total / 1024} KB")
            }
        }
    }

    companion object {
        val NAME_RE = Regex("^[A-Za-z0-9_-]{11}\\.(m4a|webm)$")
    }
}

/** Result of [AudioRepository.prepare], returned to the page as JSON. */
data class PreparedAudio(
    val videoId: String,
    val file: File,
    val mimeType: String,
    val durationSec: Long?,
    val fromCache: Boolean,
    val downloadMs: Long,
)

/** Progress reports while preparing (sent to the page as `audioProgress` events). */
data class AudioProgress(val videoId: String, val phase: String, val receivedBytes: Long, val totalBytes: Long, val attempt: Int)

/**
 * Finds the audio stream with NewPipe, downloads it in ranged chunks into the cache, and hands
 * back a file the WebView reads through [AudioServer]. One download per video at a time;
 * concurrent requests for the same video share it. Cancelling a video cancels its download.
 */
class AudioRepository(
    val cache: AudioCache,
    private val youtube: YouTube,
    private val http: OkHttpClient,
    private val scope: CoroutineScope,
) {
    private val jobs = HashMap<String, Deferred<PreparedAudio>>()
    private val slots = Semaphore(2)

    @Volatile var lastDownload: String? = null
        private set

    suspend fun prepare(videoId: String, progress: (AudioProgress) -> Unit): PreparedAudio {
        cache.find(videoId)?.let {
            cache.touch(it)
            return PreparedAudio(videoId, it, mimeFor(it), null, fromCache = true, downloadMs = 0)
        }
        val job = synchronized(jobs) {
            jobs[videoId]?.takeIf { it.isActive } ?: scope.async { slots.withPermit { download(videoId, progress) } }
                .also { d ->
                    jobs[videoId] = d
                    d.invokeOnCompletion { synchronized(jobs) { if (jobs[videoId] === d) jobs.remove(videoId) } }
                }
        }
        return job.await()
    }

    fun cancel(videoId: String) {
        synchronized(jobs) { jobs[videoId] }?.cancel(CancellationException("Cancelled by the page"))
    }

    fun cancelAll() {
        synchronized(jobs) { jobs.values.toList() }.forEach { it.cancel() }
    }

    private suspend fun download(videoId: String, progress: (AudioProgress) -> Unit): PreparedAudio {
        val started = SystemClock.elapsedRealtime()
        progress(AudioProgress(videoId, "resolving", 0, -1, 1))
        var source = resolve(videoId, null)
        Log.i(TAG, "Audio $videoId: itag ${source.itag} ${source.ext} ${source.bitrate / 1000} kbps, ${source.contentLength} bytes")
        val part = cache.partFile(videoId, source.ext)
        part.delete()
        var received = 0L
        var total = source.contentLength
        var requestNumber = 1
        var refreshes = 0
        var lastEmit = 0L
        try {
            part.outputStream().use { out ->
                while (total < 0 || received < total) {
                    coroutineContext.ensureActive()
                    val end = if (total > 0) minOf(received + CHUNK, total) - 1 else received + CHUNK - 1
                    val (bytes, newSource) = fetchWithRetry(videoId, source, { requestNumber++ }, received, end, total, refreshes) { n, attempt ->
                        val now = SystemClock.elapsedRealtime()
                        if (now - lastEmit > 150) {
                            lastEmit = now
                            progress(AudioProgress(videoId, if (attempt > 1) "retrying" else "downloading", received + n, total, attempt))
                        }
                    }
                    if (newSource !== source) {
                        refreshes++
                        source = newSource
                        if (total < 0) total = newSource.contentLength
                    }
                    out.write(bytes)
                    received += bytes.size
                    progress(AudioProgress(videoId, "downloading", received, total, 1))
                    if (bytes.isEmpty()) break
                    if (total < 0 && bytes.size < (end - (received - bytes.size) + 1)) break // short read: done
                }
            }
            if (total > 0 && received != total) throw IOException("Download incomplete: $received of $total bytes")
            if (received == 0L) throw IOException("Empty download")
            val dest = cache.finalFile(videoId, source.ext)
            if (!part.renameTo(dest)) throw BridgeException("storage", "Couldn't save the song on the projector (storage full?).")
            cache.touch(dest)
            cache.evict(keep = setOf(dest))
            val ms = SystemClock.elapsedRealtime() - started
            lastDownload = "$videoId: ${received / 1024} KB in ${ms} ms"
            Log.i(TAG, "Audio $videoId: downloaded ${received / 1024} KB in $ms ms")
            return PreparedAudio(videoId, dest, source.mimeType, source.durationSec, fromCache = false, downloadMs = ms)
        } catch (t: Throwable) {
            part.delete()
            throw t
        }
    }

    /**
     * One chunk with retries: network errors and 5xx/429 back off exponentially; a 403/410 means
     * the stream URL expired or was rejected, so (at most twice per song) we ask YouTube for a
     * fresh URL of the same format and carry on. Returns the bytes and the source used.
     */
    private suspend fun fetchWithRetry(
        videoId: String,
        initial: YouTube.AudioSource,
        nextRn: () -> Int,
        start: Long,
        end: Long,
        total: Long,
        refreshesSoFar: Int,
        onBytes: (Long, Int) -> Unit,
    ): Pair<ByteArray, YouTube.AudioSource> {
        var source = initial
        var refreshes = refreshesSoFar
        var attempt = 1
        while (true) {
            try {
                return fetchRange(source, nextRn(), start, end) { n -> onBytes(n, attempt) } to source
            } catch (e: HttpStatusException) {
                if ((e.code == 403 || e.code == 410) && refreshes < 2) {
                    refreshes++
                    Log.w(TAG, "Audio $videoId: HTTP ${e.code}, refreshing the stream URL")
                    val fresh = resolve(videoId, source.itag)
                    if (fresh.ext != source.ext) throw Errors.classify(e)
                    source = fresh
                    continue
                }
                if (e.code == 416 && total < 0) return ByteArray(0) to source // past the end
                if (e.code == 403 || e.code == 410) {
                    throw BridgeException("extractor", Errors.extractorMessage(), e)
                }
                if (e.code in 400..499 && e.code != 429) {
                    throw BridgeException("extractor", Errors.extractorMessage(), e)
                }
                if (attempt >= MAX_ATTEMPTS) {
                    throw if (e.code == 429) {
                        BridgeException("bot-check", "YouTube is limiting downloads from this projector right now. Try again in a while.", e)
                    } else {
                        BridgeException("network", "YouTube's servers aren't responding. Try again in a minute.", e)
                    }
                }
                Log.w(TAG, "Audio $videoId: chunk at $start got HTTP ${e.code}, retry $attempt")
            } catch (e: CancellationException) {
                throw e
            } catch (e: IOException) {
                if (attempt >= MAX_ATTEMPTS) throw Errors.classify(e)
                Log.w(TAG, "Audio $videoId: chunk at $start failed (${e.message}), retry $attempt")
            }
            onBytes(0, attempt + 1)
            delay(BACKOFF_MS * (1L shl (attempt - 1)))
            attempt++
        }
    }

    private suspend fun resolve(videoId: String, preferItag: Int?): YouTube.AudioSource = try {
        runInterruptible { youtube.audio(videoId, preferItag) }
    } catch (e: CancellationException) {
        throw e
    } catch (t: Throwable) {
        Log.w(TAG, "NewPipe stream extraction failed for $videoId", t)
        throw Errors.classify(t)
    }

    /**
     * One ranged request, the way YouTube's own clients do it: POST "x\0" to the stream URL with
     * `&rn=<n>&range=a-b`. Small ranges also avoid YouTube's throttling of whole-file downloads.
     */
    private suspend fun fetchRange(
        source: YouTube.AudioSource,
        rn: Int,
        start: Long,
        end: Long,
        onBytes: (Long) -> Unit,
    ): ByteArray {
        val url = source.url + "&rn=$rn&range=$start-$end"
        val req = okhttp3.Request.Builder().url(url).post(POST_BODY.toRequestBody())
        source.requestHeaders().forEach { (k, v) -> req.header(k, v) }
        val call = http.newCall(req.build())
        val response = call.await()
        response.use { r ->
            if (r.code != 200 && r.code != 206) throw HttpStatusException(r.code)
            val buf = ByteArrayOutputStream((end - start + 1).toInt().coerceIn(1024, CHUNK.toInt()))
            val chunk = ByteArray(64 * 1024)
            (r.body ?: throw IOException("Empty response")).byteStream().use { input ->
                while (true) {
                    coroutineContext.ensureActive()
                    val n = input.read(chunk)
                    if (n < 0) break
                    buf.write(chunk, 0, n)
                    if (buf.size() > end - start + 1) throw IOException("Server sent more than asked for")
                    onBytes(buf.size().toLong())
                }
            }
            return buf.toByteArray()
        }
    }

    companion object {
        const val CHUNK = 1L * 1024 * 1024
        const val MAX_ATTEMPTS = 5
        const val BACKOFF_MS = 800L
        private val POST_BODY = byteArrayOf(0x78, 0)

        fun mimeFor(f: File) = if (f.name.endsWith(".webm")) "audio/webm" else "audio/mp4"
    }
}

class HttpStatusException(val code: Int) : IOException("HTTP $code")

/** Cancellable OkHttp call: cancelling the coroutine aborts the socket. */
private suspend fun Call.await(): okhttp3.Response = suspendCancellableCoroutine { cont ->
    enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            if (cont.isActive) cont.resumeWithException(e)
        }

        override fun onResponse(call: Call, response: okhttp3.Response) {
            if (cont.isActive) cont.resume(response) else response.close()
        }
    })
    cont.invokeOnCancellation { cancel() }
}

/**
 * Serves cached songs to the WebView at https://appassets.androidplatform.net/audio/<id>.<ext>,
 * same origin as the page (so fetch() needs no CORS and there's no mixed content), with HTTP
 * Range support so <audio> can seek.
 */
object AudioServer {
    const val PATH = "/audio/"

    fun serve(cache: AudioCache, request: WebResourceRequest): WebResourceResponse {
        val name = request.url.path?.removePrefix(PATH) ?: ""
        val file = cache.byName(name) ?: return error(404, "Not Found")
        cache.touch(file)
        val length = file.length()
        val mime = AudioRepository.mimeFor(file)
        val headers = mutableMapOf(
            "Accept-Ranges" to "bytes",
            "Cache-Control" to "no-store",
            "Access-Control-Allow-Origin" to "https://appassets.androidplatform.net",
        )
        val rangeHeader = request.requestHeaders.entries.firstOrNull { it.key.equals("Range", true) }?.value
        val range = rangeHeader?.let { parseRange(it, length) }
        if (rangeHeader != null && range == null) {
            headers["Content-Range"] = "bytes */$length"
            return WebResourceResponse(mime, null, 416, "Range Not Satisfiable", headers, null)
        }
        return if (range == null) {
            headers["Content-Length"] = length.toString()
            WebResourceResponse(mime, null, 200, "OK", headers, FileInputStream(file))
        } else {
            val (start, end) = range
            headers["Content-Range"] = "bytes $start-$end/$length"
            headers["Content-Length"] = (end - start + 1).toString()
            val input = FileInputStream(file).apply { channel.position(start) }
            WebResourceResponse(mime, null, 206, "Partial Content", headers, Limited(input, end - start + 1))
        }
    }

    /** "bytes=a-b" / "bytes=a-" / "bytes=-n" (single range only). */
    fun parseRange(header: String, length: Long): Pair<Long, Long>? {
        val m = Regex("^bytes=(\\d*)-(\\d*)$").find(header.trim()) ?: return null
        val (a, b) = m.destructured
        if (length == 0L) return null
        val (start, end) = when {
            a.isEmpty() && b.isEmpty() -> return null
            a.isEmpty() -> (length - b.toLong()).coerceAtLeast(0) to length - 1
            else -> a.toLong() to (if (b.isEmpty()) length - 1 else minOf(b.toLong(), length - 1))
        }
        return if (start in 0..end && start < length) start to end else null
    }

    fun error(code: Int, reason: String) = WebResourceResponse(
        "text/plain", "utf-8", code, reason, mapOf("Cache-Control" to "no-store"), "$code $reason".byteInputStream(),
    )

    private class Limited(input: InputStream, private var left: Long) : FilterInputStream(input) {
        override fun read(): Int = if (left <= 0) -1 else super.read().also { if (it >= 0) left-- }
        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (left <= 0) return -1
            val n = super.read(b, off, minOf(len.toLong(), left).toInt())
            if (n > 0) left -= n
            return n
        }
        override fun available(): Int = minOf(super.available().toLong(), left).toInt()
    }
}
