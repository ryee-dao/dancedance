package app.dancedance.tv

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
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

    fun itunes(term: String, limit: Int = 10): List<SongPicker.SongHit> {
        val url = "https://itunes.apple.com/search".toHttpUrl().newBuilder()
            .addQueryParameter("term", term.trim())
            .addQueryParameter("entity", "song")
            .addQueryParameter("limit", limit.toString())
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
        /** iTunes primary genre of the picked track ("" = unknown; songs saved before it was kept). */
        val genre: String = "",
        /** Storage only: when a [GenreBackfill] lookup last found no genre (ISO), so it isn't asked every start. */
        val genreTriedAt: String = "",
        /** Multi-source genres (the page's src/genre lookup, bridge v7), best first; empty until looked up. */
        val genres: List<String> = emptyList(),
        /** That lookup as JSON text (what each source said; the page's cache for later lookups); "" until looked up. */
        val genreLookup: String = "",
        /** The artist's usual genres, best first (weak evidence, kept apart from [genres]); empty when unknown or older lookups. */
        val artistGenres: List<String> = emptyList(),
        /** Parallel to [genres] (same length and order): "song", "album" or "artist", the level each genre came from; empty when unknown. */
        val genreLevels: List<String> = emptyList(),
    ) {
        /** What the page gets (getAddedSongs / addedSongsChanged). */
        fun toJson(): JSONObject = JSONObject()
            .put("videoId", videoId).put("title", title).put("artist", artist).put("addedAt", addedAt)
            .put("durationSec", durationSec).put("videoTitle", videoTitle).put("channel", channel).put("tier", tier)
            .apply { if (tier == SongPicker.Tier.MUSIC_VIDEO.label) put("note", "music-video") }
            .apply { if (genre.isNotEmpty()) put("genre", genre) }
            .apply { if (genres.isNotEmpty()) put("genres", JSONArray(genres)) }
            .apply { if (artistGenres.isNotEmpty()) put("artistGenres", JSONArray(artistGenres)) }
            .apply { if (genreLevels.isNotEmpty()) put("genreLevels", JSONArray(genreLevels)) }
            .apply { lookupJson(genreLookup)?.let { put("genreLookup", it) } }

        fun toStoredJson(): JSONObject = toJson().apply { if (genreTriedAt.isNotEmpty()) put("genreTriedAt", genreTriedAt) }
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
                // Entries saved before the genre was kept have no "genre": they load with "".
                val genres = cleanGenres(o.optJSONArray("genres"))
                Song(id, o.optString("title"), o.optString("artist"), o.optString("addedAt"), o.optInt("durationSec"),
                    o.optString("videoTitle"), o.optString("channel"), o.optString("tier"),
                    SongPicker.cleanGenre(o.opt("genre")), o.optString("genreTriedAt"),
                    genres, o.optJSONObject("genreLookup")?.toString().orEmpty(),
                    cleanGenres(o.optJSONArray("artistGenres")), cleanLevels(o.optJSONArray("genreLevels"), genres.size))
            }
        } catch (e: Exception) {
            emptyList()
        }
        cache = songs
        return songs
    }

    /**
     * Backfill result for one song: [genre] found, or null for "looked, none found" (remembered
     * as [triedAt]). No-op if the song is gone or already has a genre. Returns true if saved.
     */
    @Synchronized
    fun updateGenre(videoId: String, genre: String?, triedAt: String): Boolean {
        val before = list()
        val s = before.firstOrNull { it.videoId == videoId } ?: return false
        if (s.genre.isNotEmpty()) return false
        val clean = genre?.let { SongPicker.cleanGenre(it) }.orEmpty()
        val updated = if (clean.isNotEmpty()) s.copy(genre = clean, genreTriedAt = "") else s.copy(genreTriedAt = triedAt)
        save(before.map { if (it.videoId == videoId) updated else it })
        return true
    }

    /**
     * Bridge v7: the page's multi-source genre lookup for one song (JSON object with a `genres`
     * array, see src/genre/types.ts GenreLookup). Replaces any earlier lookup, including an empty
     * one (the page retries those later). Returns false if the song is gone or the JSON unusable.
     */
    @Synchronized
    fun updateGenres(videoId: String, lookupJson: String): Boolean {
        if (lookupJson.length > MAX_LOOKUP_CHARS) return false
        val o = lookupJson(lookupJson) ?: return false
        val before = list()
        val s = before.firstOrNull { it.videoId == videoId } ?: return false
        val genres = cleanGenres(o.optJSONArray("genres"))
        val updated = s.copy(genres = genres, genreLookup = o.toString(), artistGenres = cleanGenres(o.optJSONArray("artistGenres")),
            genreLevels = cleanLevels(o.optJSONArray("genreLevels"), genres.size))
        save(before.map { if (it.videoId == videoId) updated else it })
        return true
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
        tmp.writeText(JSONArray().apply { songs.forEach { put(it.toStoredJson()) } }.toString())
        if (!tmp.renameTo(file)) {
            file.writeText(tmp.readText())
            tmp.delete()
        }
        cache = songs
    }

    companion object {
        fun now(): String = Instant.now().toString()

        /** A stored lookup is small (a few KB); anything far bigger is refused. */
        const val MAX_LOOKUP_CHARS = 64 * 1024
        const val MAX_GENRES = 8

        /** Strings only, trimmed, 1..60 characters, no control characters, no duplicates, at most [MAX_GENRES]. */
        fun cleanGenres(arr: JSONArray?): List<String> {
            if (arr == null) return emptyList()
            val out = LinkedHashSet<String>()
            for (i in 0 until arr.length()) {
                val g = arr.opt(i) as? String ?: continue
                val t = g.replace(Regex("\\s+"), " ").trim()
                if (t.isNotEmpty() && t.length <= 60 && t.none { it.code < 0x20 }) out += t
                if (out.size >= MAX_GENRES) break
            }
            return out.toList()
        }

        /** Strings only, each exactly song/album/artist (trimmed, lower-cased); kept only when there are [size] of them and none was invalid. */
        fun cleanLevels(arr: JSONArray?, size: Int): List<String> {
            if (arr == null || arr.length() != size) return emptyList()
            val out = ArrayList<String>(size)
            for (i in 0 until arr.length()) {
                val t = (arr.opt(i) as? String)?.trim()?.lowercase()
                if (t != "song" && t != "album" && t != "artist") return emptyList()
                out += t
            }
            return out
        }

        fun lookupJson(text: String): JSONObject? =
            if (text.isEmpty()) null else runCatching { JSONObject(text) }.getOrNull()
    }
}

/**
 * Fills in the genre of added songs saved without one (before the TV kept it, or iTunes gave none
 * for the tapped hit): one iTunes search per song for "artist title" (only that text is sent, as
 * in the phone's own search), matched by [SongPicker.genreFor], saved, and the page told through
 * [onChanged]. Runs in the background a few seconds after app start (and after an add without a
 * genre), [PARALLEL] songs at a time, at most [MAX_PER_RUN] per run. Failures are logged and
 * retried on a later run; a song for which iTunes answered but had no match isn't asked again for
 * [RETRY_MISS_MS]. Never touches audio, so it can't hold up playback.
 */
class GenreBackfill(
    private val store: AddedSongsStore,
    private val search: (term: String) -> List<SongPicker.SongHit>,
    private val onChanged: () -> Unit,
    private val now: () -> Instant = Instant::now,
) {
    companion object {
        private const val TAG = "DanceDance"
        const val PARALLEL = 2
        const val MAX_PER_RUN = 20
        const val ITUNES_LIMIT = 25
        const val RETRY_MISS_MS = 30L * 24 * 3600 * 1000
        /** Consecutive failed lookups after which a run gives up (offline, rate-limited). */
        const val MAX_FAILURES = 3
    }

    private val running = java.util.concurrent.atomic.AtomicBoolean(false)

    /** Start a run in [scope] unless one is going. */
    fun start(scope: kotlinx.coroutines.CoroutineScope, delayMs: Long = 5_000) {
        if (!running.compareAndSet(false, true)) return
        scope.launch {
            try {
                delay(delayMs)
                run()
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (t: Throwable) {
                Log.w(TAG, "Genre backfill failed", t)
            } finally {
                running.set(false)
            }
        }
    }

    /** Songs that need a lookup now. */
    fun due(): List<AddedSongsStore.Song> {
        val t = now()
        return store.list().filter { s ->
            s.genre.isEmpty() && s.artist.isNotBlank() && s.title.isNotBlank() &&
                (runCatching { Instant.parse(s.genreTriedAt) }.getOrNull()?.let { t.toEpochMilli() - it.toEpochMilli() >= RETRY_MISS_MS } ?: true)
        }.take(MAX_PER_RUN)
    }

    /** One pass; returns how many songs got a genre. */
    suspend fun run(): Int {
        val todo = due()
        if (todo.isEmpty()) return 0
        var found = 0
        var failuresInARow = 0
        for (batch in todo.chunked(PARALLEL)) {
            if (failuresInARow >= MAX_FAILURES) break
            val results = coroutineScope {
                batch.map { s ->
                    async(Dispatchers.IO) {
                        s to runCatching { runInterruptible { search("${s.artist} ${s.title}") } }
                    }
                }.awaitAll()
            }
            for ((s, r) in results) {
                val hits = r.getOrElse { e ->
                    if (e is kotlinx.coroutines.CancellationException) throw e
                    failuresInARow++
                    Log.w(TAG, "Genre backfill: lookup for ${s.videoId} failed (${e.message})")
                    null
                } ?: continue
                failuresInARow = 0
                val genre = SongPicker.genreFor(s.artist, s.title, s.durationSec, hits)
                if (store.updateGenre(s.videoId, genre, now().toString()) && genre != null) found++
                Log.i(TAG, "Genre backfill: ${s.videoId} ${s.artist} - ${s.title}: ${genre ?: "no match"}")
            }
        }
        if (found > 0) onChanged()
        return found
    }
}
