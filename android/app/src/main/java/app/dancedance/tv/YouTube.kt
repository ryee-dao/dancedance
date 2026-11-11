package app.dancedance.tv

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.MediaFormat
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.Page
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization
import org.schabi.newpipe.extractor.playlist.PlaylistInfo
import org.schabi.newpipe.extractor.services.youtube.YoutubeParsingHelper
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeStreamLinkHandlerFactory
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.AudioTrackType
import org.schabi.newpipe.extractor.stream.DeliveryMethod
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import java.util.Locale

/**
 * NewPipe Extractor, used as a library: read a playlist, and pick an audio-only stream for one
 * video. Everything here is blocking; call it from Dispatchers.IO.
 */
class YouTube(private val http: OkHttpClient) {

    data class PlaylistEntry(val videoId: String, val title: String, val artist: String?, val durationSec: Long?)

    data class AudioSource(
        val url: String,
        /** "m4a" or "webm": also the cache file extension. */
        val ext: String,
        val mimeType: String,
        /** Bytes, or -1 when YouTube didn't say. */
        val contentLength: Long,
        val durationSec: Long?,
        val bitrate: Int,
        val itag: Int,
    ) {
        /** The extra request headers this stream URL needs (matches what NewPipe itself sends). */
        fun requestHeaders(): Map<String, String> = buildMap {
            if (YoutubeParsingHelper.isVisionOsStreamingUrl(url)) {
                put("User-Agent", YoutubeParsingHelper.getVisionOsUserAgent(null))
            } else {
                put("User-Agent", NewPipeDownloader.USER_AGENT)
            }
            if (YoutubeParsingHelper.isWebStreamingUrl(url)) {
                put("Origin", "https://www.youtube.com")
                put("Referer", "https://www.youtube.com/")
            }
            put("Accept-Encoding", "identity")
        }
    }

    init {
        val locale = Locale.getDefault()
        val country = locale.country.takeIf { it.length == 2 } ?: "US"
        NewPipe.init(NewPipeDownloader(http), Localization.fromLocale(locale), ContentCountry(country))
    }

    /** All entries of a playlist, in order, following continuation pages. */
    fun playlist(listId: String, maxItems: Int = 1000): List<PlaylistEntry> {
        val service = ServiceList.YouTube
        val url = "https://www.youtube.com/playlist?list=$listId"
        val info = PlaylistInfo.getInfo(service, url)
        val items = ArrayList<StreamInfoItem>(info.relatedItems)
        var page: Page? = info.nextPage
        while (Page.isValid(page) && items.size < maxItems) {
            val more = PlaylistInfo.getMoreItems(service, url, page)
            if (more.items.isEmpty()) break
            items += more.items
            page = more.nextPage
        }
        val ids = YoutubeStreamLinkHandlerFactory.getInstance()
        val seen = HashSet<String>()
        return items.mapNotNull { item ->
            val id = runCatching { ids.getId(item.url) }.getOrNull() ?: return@mapNotNull null
            if (!seen.add(id)) return@mapNotNull null
            PlaylistEntry(
                videoId = id,
                title = item.name ?: "",
                artist = item.uploaderName?.takeIf { it.isNotBlank() },
                durationSec = item.duration.takeIf { it > 0 },
            )
        }.take(maxItems)
    }

    /**
     * The best audio-only progressive stream: M4A/AAC first (decodes everywhere in WebView), then
     * WebM/Opus. Original-language track preferred over dubbed/descriptive ones.
     */
    fun audio(videoId: String, preferItag: Int? = null): AudioSource {
        val info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=$videoId")
        val usable = info.audioStreams.filter {
            it.deliveryMethod == DeliveryMethod.PROGRESSIVE_HTTP && it.isUrl && !it.content.isNullOrBlank()
        }
        val original = usable.filter { it.audioTrackType == null || it.audioTrackType == AudioTrackType.ORIGINAL }
            .ifEmpty { usable }
        val rate = { s: AudioStream -> if (s.averageBitrate > 0) s.averageBitrate else s.bitrate }
        val pick = original.firstOrNull { preferItag != null && it.itag == preferItag }
            ?: original.filter { it.format == MediaFormat.M4A }.maxByOrNull(rate)
            ?: original.filter { it.format == MediaFormat.WEBMA_OPUS || it.format == MediaFormat.WEBMA || it.format == MediaFormat.OPUS }
                .maxByOrNull(rate)
            ?: throw NoAudioException()
        val isM4a = pick.format == MediaFormat.M4A
        return AudioSource(
            url = pick.content,
            ext = if (isM4a) "m4a" else "webm",
            mimeType = if (isM4a) "audio/mp4" else "audio/webm",
            contentLength = pick.itagItem?.contentLength?.takeIf { it > 0 } ?: -1L,
            durationSec = info.duration.takeIf { it > 0 },
            bitrate = rate(pick),
            itag = pick.itag,
        )
    }
}

class NoAudioException : Exception("No audio-only stream for this video")

/** OkHttp-backed downloader NewPipe Extractor uses for its own (page / API) requests. */
class NewPipeDownloader(private val client: OkHttpClient) : Downloader() {
    companion object {
        const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0"
    }

    override fun execute(request: Request): Response {
        val method = request.httpMethod()
        val body = request.dataToSend()?.toRequestBody()
            ?: if (method == "POST" || method == "PUT" || method == "PATCH") ByteArray(0).toRequestBody() else null
        val builder = okhttp3.Request.Builder()
            .method(method, body)
            .url(request.url())
            .header("User-Agent", USER_AGENT)
        request.headers().forEach { (name, values) ->
            builder.removeHeader(name)
            values.forEach { builder.addHeader(name, it) }
        }
        client.newCall(builder.build()).execute().use { r ->
            if (r.code == 429) throw ReCaptchaException("reCaptcha Challenge requested", request.url())
            val text = r.body?.string() ?: ""
            return Response(r.code, r.message, r.headers.toMultimap(), text, r.request.url.toString())
        }
    }
}
