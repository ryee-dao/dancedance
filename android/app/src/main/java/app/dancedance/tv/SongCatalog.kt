package app.dancedance.tv

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.text.Normalizer
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.math.abs

/**
 * "Find a song", step 1: both song catalogs at once (iTunes through [SongSearch.itunes], Deezer
 * through [Deezer]), one request each per search, merged by [SongMerge]. Either catalog alone is
 * enough; when iTunes fails and Deezer has nothing either, iTunes' error is thrown. A catalog that
 * answers 403/429 (Deezer: its quota error) is left alone for [BACKOFF_MS]. Blocking; call from a
 * background thread. Same as searchSongs() in src/ui/songSearch.ts.
 */
class SongCatalog(
    private val http: OkHttpClient,
    private val itunes: (term: String) -> List<SongPicker.SongHit>,
    private val now: () -> Long = System::currentTimeMillis,
) {
    companion object {
        private const val TAG = "DanceDance"
        const val BACKOFF_MS = 60_000L
    }

    private val pausedUntil = ConcurrentHashMap<String, Long>()

    /** Deezer only fills gaps: a slow answer is not worth more than a few seconds of the search. */
    private val deezerHttp = http.newBuilder().callTimeout(10, TimeUnit.SECONDS).build()

    private fun paused(source: String) = (pausedUntil[source] ?: 0L) > now()
    private fun pause(source: String) { pausedUntil[source] = now() + BACKOFF_MS }

    fun search(term: String): List<SongPicker.SongHit> = runBlocking(Dispatchers.IO) {
        val it = async { runCatching { searchItunes(term) } }
        val dz = async { runCatching { deezer(term) } }
        val itR = it.await()
        val dzR = dz.await()
        dzR.exceptionOrNull()?.let { e -> Log.w(TAG, "Deezer search failed (${e.message})") }
        val merged = SongMerge.merge(term, itR.getOrDefault(emptyList()), dzR.getOrDefault(emptyList()))
        itR.exceptionOrNull()?.let { e -> if (merged.isEmpty()) throw e }
        merged
    }

    private fun searchItunes(term: String): List<SongPicker.SongHit> {
        if (paused("itunes")) throw BridgeException("network", "The song search is busy. Try again in a minute.")
        try {
            return itunes(term)
        } catch (e: BridgeException) {
            // SongSearch.itunes says "busy" for 403/429/503.
            if (e.message.contains("busy")) pause("itunes")
            throw e
        }
    }

    private fun deezer(term: String): List<Deezer.Track> {
        if (paused("deezer")) throw Deezer.DeezerException(true)
        deezerHttp.newCall(Request.Builder().url(Deezer.url(term)).build()).execute().use { r ->
            if (r.code == 403 || r.code == 429) {
                pause("deezer")
                throw Deezer.DeezerException(true)
            }
            if (!r.isSuccessful) throw Deezer.DeezerException(false)
            try {
                return Deezer.parse(JSONObject(r.body?.string() ?: "{}"))
            } catch (e: Deezer.DeezerException) {
                if (e.busy) pause("deezer")
                throw e
            }
        }
    }
}

/**
 * One result list from the two catalogs; the same rules as src/ui/songMerge.ts (see there):
 * a Deezer track that is the same recording as an iTunes hit (an artist in common, within 2 s,
 * the same title or a censored iTunes title the real one fits) is merged into it, the real title
 * replacing a censored one; other Deezer tracks are added when every search word is in their
 * artist, title or album and they are not karaoke/covers the search didn't ask for; hits whose
 * artist and title hold every search word come first; at most [LIMIT].
 */
object SongMerge {
    const val LIMIT = 15

    private fun words(s: String) = SongPicker.normalizeName(s).split(' ').filter { it.isNotEmpty() }
    private fun joined(s: String) = words(s).joinToString("")

    private val STOP = setOf("the", "a", "feat", "ft", "featuring", "and", "by", "x", "with", "vs")

    fun queryTokens(term: String): List<String> = words(term).filter { it !in STOP }

    private fun covers(tokens: List<String>, text: String): Boolean {
        val ws = words(text)
        val j = ws.joinToString("")
        return tokens.all { t -> ws.any { it.startsWith(t) } || (t.length >= 3 && j.contains(t)) }
    }

    private val OPTS = setOf(RegexOption.IGNORE_CASE)
    private val BRACKETS = Regex("\\([^)]*\\)|\\[[^\\]]*\\]|\\{[^}]*\\}")
    private val FEAT = Regex("\\s*\\b(?:feat|ft|featuring)\\b\\.?\\s.*$", OPTS)
    private val SUFFIX = Regex("\\s[-–—]\\s.*$")

    private fun coreText(title: String) = title.replace(BRACKETS, " ").replace(SUFFIX, "").replace(FEAT, "").trim()

    fun titleCore(title: String): String = words(coreText(title)).joinToString(" ")

    /** Brackets and " - ..." parts that name no other version (see versionText in songMerge.ts). */
    private val SAME_SONG_PART = Regex("^(?:feat|ft|featuring|with)\\b|\\b(?:explicit|dirty|clean|amended|edited|censored|(?:album|lp|single) version)\\b", OPTS)
    private val BRACKET_GROUP = Regex("\\(([^)]*)\\)|\\[([^\\]]*)\\]|\\{([^}]*)\\}")
    private val DASH_PART = Regex("\\s[-–—]\\s(.*)$")

    private fun versionText(title: String): String = title
        .replace(BRACKET_GROUP) { m ->
            val inner = m.groupValues.drop(1).firstOrNull { it.isNotEmpty() } ?: ""
            if (SAME_SONG_PART.containsMatchIn(inner.trim())) " " else m.value
        }
        .replace(DASH_PART) { m -> if (SAME_SONG_PART.containsMatchIn(m.groupValues[1].trim())) "" else m.value }
        .replace(FEAT, "")
        .trim()

    fun versionCore(title: String): String = words(versionText(title)).joinToString(" ")

    private val CENSORED = Regex("\\*|[(\\[{][^)\\]}]*\\b(?:amended|clean|edited|censored)\\b|\\s[-–—]\\s.*\\b(?:amended|clean|edited|censored)\\b", OPTS)

    fun looksCensored(title: String) = CENSORED.containsMatchIn(title)

    private fun squash(s: String) = Normalizer.normalize(s, Normalizer.Form.NFKD)
        .replace(Regex("\\p{M}+"), "").lowercase().replace(Regex("[^\\p{L}\\p{N}*]+"), "")

    /** Whether [real] is the uncensored form of the clean title [clean] (see censorFits in songMerge.ts). */
    fun censorFits(clean: String, real: String): Boolean {
        val c = squash(versionText(clean))
        val r = squash(versionText(real)).replace("*", "")
        if (c.isEmpty() || r.isEmpty()) return false
        if (c.contains('*')) {
            val re = Regex("^" + c.split(Regex("\\*+")).joinToString("\\p{L}*") { Regex.escape(it) } + "$")
            return re.matches(r)
        }
        return c == r || (c.length >= 3 && r.contains(c) && !r.startsWith(c))
    }

    private val CREDIT = Regex("\\s*(?:,|&|\\+|;|/|\\band\\b|\\bx\\b|\\bfeat\\.?|\\bft\\.?|\\bfeaturing\\b|\\bwith\\b|\\bvs\\.?)\\s*", OPTS)

    private fun artistParts(artist: String) = (listOf(joined(artist)) + artist.split(CREDIT).map { joined(it) }).filter { it.length >= 2 }

    fun sameArtist(a: String, b: String): Boolean {
        val pa = artistParts(a)
        return artistParts(b).any { it in pa }
    }

    fun sameRecording(hit: SongPicker.SongHit, d: Deezer.Track): Boolean {
        if (abs(hit.durationSec - d.durationSec) > 2 || !sameArtist(hit.artist, d.artist)) return false
        val a = versionCore(hit.title)
        if (a.isNotEmpty() && a == versionCore(d.title)) return true
        return d.explicit && (hit.clean || looksCensored(hit.title)) && censorFits(hit.title, d.title)
    }

    private val NOT_THE_SONG = Regex(
        "\\b(?:karaoke|instrumental|originally (?:performed|by)|in the style of|made famous|tribute|emulation|8-bit|sped up|slowed|nightcore|reverb|chopped|screwed|reversed|lullaby|cover|type beat|remix|rework|parody|diss+|mashup|medley|workout)\\b",
        OPTS,
    )

    private val FEAT_START = Regex("^(?:feat|ft|featuring|with)\\b", OPTS)

    /** Title words for the relevance check (with the artist): brackets dropped except a "(feat. X)" credit. */
    private fun relevanceText(title: String) = title.replace(BRACKET_GROUP) { m ->
        val inner = (m.groupValues.drop(1).firstOrNull { it.isNotEmpty() } ?: "").trim()
        if (FEAT_START.containsMatchIn(inner)) " $inner " else " "
    }

    fun fromDeezer(d: Deezer.Track) = SongPicker.SongHit(
        artist = d.artist, title = d.title, album = d.album, year = "", durationSec = d.durationSec,
        artworkUrl = d.artworkUrl, source = "deezer",
    )

    fun merge(term: String, itunes: List<SongPicker.SongHit>, deezer: List<Deezer.Track>, limit: Int = LIMIT): List<SongPicker.SongHit> {
        val out = ArrayList(itunes)
        /** iTunes rows that already took a Deezer track. */
        val taken = HashSet<Int>()
        val tokens = queryTokens(term)
        for (d in Deezer.dedupe(deezer)) {
            val i = itunes.indices.firstOrNull { it !in taken && sameRecording(out[it], d) }
            if (i == null && taken.any { sameRecording(out[it], d) && versionCore(out[it].title) == versionCore(d.title) }) continue // another copy
            if (i != null) {
                taken += i
                val h = out[i]
                val censored = looksCensored(h.title) || (h.clean && versionCore(h.title) != versionCore(d.title))
                if (censored && !looksCensored(d.title) && h.title != d.title) out[i] = h.copy(title = d.title, clean = false)
                if (out[i].artworkUrl.isEmpty() && d.artworkUrl.isNotEmpty()) out[i] = out[i].copy(artworkUrl = d.artworkUrl)
                continue
            }
            if (tokens.isEmpty() || !covers(tokens, "${d.artist} ${relevanceText(d.title)}")) continue
            if (NOT_THE_SONG.containsMatchIn("${d.title} ${d.album}") && !NOT_THE_SONG.containsMatchIn(term)) continue
            val hit = fromDeezer(d)
            if (out.any { it.key == hit.key && abs(it.durationSec - hit.durationSec) <= 2 }) continue
            out += hit
        }
        val unique = out.filterIndexed { i, h -> (0 until i).none { j -> out[j].key == h.key && abs(out[j].durationSec - h.durationSec) <= 2 } }
        fun strong(h: SongPicker.SongHit) = tokens.isNotEmpty() && covers(tokens, "${h.artist} ${coreText(h.title)}")
        return (unique.filter { strong(it) } + unique.filterNot { strong(it) }).take(limit)
    }
}
