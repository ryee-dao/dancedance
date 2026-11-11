package app.dancedance.tv

import android.util.Log
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runInterruptible
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeSearchQueryHandlerFactory
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeStreamLinkHandlerFactory
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import org.schabi.newpipe.extractor.stream.StreamType
import java.io.File
import java.time.Instant

/**
 * "Find a song" (I/O side; the choice itself is [SongPicker]):
 *  1. song matches with the official length from the iTunes Search API (only the search text is sent),
 *  2. after the user taps one, two YouTube searches through NewPipe Extractor, ranked by [SongPicker].
 * Blocking; call from a background thread.
 */
class SongSearch(private val http: OkHttpClient) {
    companion object {
        private const val TAG = "DanceDance"
        /** Same as the cloud job (yt-dlp "ytsearch10:"). */
        private const val PER_QUERY = 10
    }

    fun itunes(term: String): List<SongPicker.SongHit> {
        val url = "https://itunes.apple.com/search".toHttpUrl().newBuilder()
            .addQueryParameter("term", term.trim())
            .addQueryParameter("entity", "song")
            .addQueryParameter("limit", "10")
            .build()
        http.newCall(Request.Builder().url(url).build()).execute().use { r ->
            if (r.code == 403 || r.code == 429 || r.code == 503) {
                throw BridgeException("network", "The song search is busy. Try again in a minute.")
            }
            if (!r.isSuccessful) throw BridgeException("network", "The song search didn't answer (HTTP ${r.code}).")
            val results = JSONObject(r.body?.string() ?: "{}").optJSONArray("results") ?: JSONArray()
            val maps = (0 until results.length()).mapNotNull { i ->
                val o = results.optJSONObject(i) ?: return@mapNotNull null
                o.keys().asSequence().associateWith { k -> o.opt(k).takeUnless { it == JSONObject.NULL } }
            }
            return SongPicker.parseItunes(maps)
        }
    }

    /** Both searches for the song, merged, ranked. */
    suspend fun findVideos(hit: SongPicker.Request): SongPicker.Result = coroutineScope {
        val queries = SongPicker.searchQueries(hit.artist, hit.title)
        val lists = queries.map { q -> async { runInterruptible { youtubeSearch(q) } } }.awaitAll()
        val result = SongPicker.rank(hit, SongPicker.merge(lists))
        Log.i(TAG, "Find a song: ${hit.artist} - ${hit.title} (${hit.durationSec} s): " +
            "${result.ranked.size} usable, picked ${result.ranked.firstOrNull()?.let { "${it.tier.label} ${it.entry.id} \"${it.entry.title}\" / ${it.entry.channel} ${it.entry.duration} s" }}")
        result
    }

    private fun youtubeSearch(query: String): List<SongPicker.Entry> {
        val service = ServiceList.YouTube
        val handler = service.searchQHFactory.fromQuery(query, listOf(YoutubeSearchQueryHandlerFactory.VIDEOS), "")
        val info = SearchInfo.getInfo(service, handler)
        val ids = YoutubeStreamLinkHandlerFactory.getInstance()
        return info.relatedItems.filterIsInstance<StreamInfoItem>().take(PER_QUERY).mapNotNull { s ->
            val id = runCatching { ids.getId(s.url) }.getOrNull() ?: return@mapNotNull null
            SongPicker.Entry(
                id = id,
                title = s.name ?: "",
                channel = s.uploaderName ?: "",
                verified = s.isUploaderVerified,
                views = s.viewCount.takeIf { it >= 0 },
                duration = s.duration.takeIf { it > 0 },
                description = s.shortDescription ?: "",
                liveStatus = when (s.streamType) {
                    StreamType.LIVE_STREAM, StreamType.AUDIO_LIVE_STREAM -> "is_live"
                    StreamType.POST_LIVE_STREAM, StreamType.POST_LIVE_AUDIO_STREAM -> "post_live"
                    else -> null
                },
            )
        }
    }
}

/**
 * Songs added from the phone, stored app-private on the TV (a small JSON file). The shape matches
 * the web's AddedSong (src/beat/cloud.ts) plus a few details about the chosen video.
 */
class AddedSongsStore(private val file: File) {
    data class Song(
        val videoId: String,
        val title: String,
        val artist: String,
        val addedAt: String,
        val durationSec: Int,
        val videoTitle: String,
        val channel: String,
        val tier: String,
    ) {
        fun toJson(): JSONObject = JSONObject()
            .put("videoId", videoId).put("title", title).put("artist", artist).put("addedAt", addedAt)
            .put("durationSec", durationSec).put("videoTitle", videoTitle).put("channel", channel).put("tier", tier)
            .apply { if (tier == SongPicker.Tier.MUSIC_VIDEO.label) put("note", "music-video") }
    }

    private var cache: List<Song>? = null

    @Synchronized
    fun list(): List<Song> {
        cache?.let { return it }
        val songs = try {
            val arr = JSONArray(file.readText())
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val id = o.optString("videoId")
                if (!Regex("^[A-Za-z0-9_-]{11}$").matches(id)) return@mapNotNull null
                Song(id, o.optString("title"), o.optString("artist"), o.optString("addedAt"), o.optInt("durationSec"),
                    o.optString("videoTitle"), o.optString("channel"), o.optString("tier"))
            }
        } catch (e: Exception) {
            emptyList()
        }
        cache = songs
        return songs
    }

    /** Adds (or moves to the newest position). Returns false if it was already there. */
    @Synchronized
    fun add(song: Song): Boolean {
        val before = list()
        val existed = before.any { it.videoId == song.videoId }
        save(before.filter { it.videoId != song.videoId } + song)
        return !existed
    }

    @Synchronized
    fun remove(videoId: String): Song? {
        val before = list()
        val gone = before.firstOrNull { it.videoId == videoId } ?: return null
        save(before.filter { it.videoId != videoId })
        return gone
    }

    fun toJson(): JSONArray = JSONArray().apply { list().forEach { put(it.toJson()) } }

    private fun save(songs: List<Song>) {
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(JSONArray().apply { songs.forEach { put(it.toJson()) } }.toString())
        if (!tmp.renameTo(file)) {
            file.writeText(tmp.readText())
            tmp.delete()
        }
        cache = songs
    }

    companion object {
        fun now(): String = Instant.now().toString()
    }
}
