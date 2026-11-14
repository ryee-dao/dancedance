package app.dancedance.tv

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Deezer's public search API (api.deezer.com/search, no key, no login): the second song catalog
 * for "Find a song". The anonymous iTunes search lists only the clean versions of explicit songs,
 * and nothing for songs without one; Deezer lists the explicit versions under their real titles,
 * with the length in whole seconds. Same as src/ui/deezer.ts. Only the search text is sent.
 */
object Deezer {
    const val LIMIT = 10

    data class Track(
        val artist: String,
        val title: String,
        val album: String,
        val durationSec: Int,
        val explicit: Boolean,
        /** 300x300 cover (HTTPS) or "". */
        val artworkUrl: String,
    )

    /** Deezer's own error answer (HTTP 200 with an `error` object); [busy] = quota exceeded (code 4). */
    class DeezerException(val busy: Boolean) : Exception(if (busy) "Deezer is busy" else "Deezer error")

    fun url(term: String, limit: Int = LIMIT): HttpUrl = "https://api.deezer.com/search".toHttpUrl().newBuilder()
        .addQueryParameter("q", term.trim())
        .addQueryParameter("limit", limit.toString())
        .build()

    private val MD5 = Regex("^[0-9a-f]{32}$")

    /** Tracks of a search answer, songs 20 s .. 15 min, in Deezer's order. Throws [DeezerException] for an error answer. */
    fun parse(json: JSONObject): List<Track> {
        json.optJSONObject("error")?.let { throw DeezerException(it.optInt("code") == 4) }
        val data = json.optJSONArray("data") ?: return emptyList()
        val out = ArrayList<Track>()
        for (i in 0 until data.length()) {
            val r = data.optJSONObject(i) ?: continue
            if (r.has("type") && r.optString("type") != "track") continue
            val artist = r.optJSONObject("artist")?.opt("name") as? String ?: continue
            val title = r.opt("title") as? String ?: continue
            if (artist.isBlank() || title.isBlank()) continue
            val sec = (r.opt("duration") as? Number)?.toDouble()?.roundToInt() ?: 0
            if (sec < 20 || sec > 15 * 60) continue
            val album = r.optJSONObject("album")
            val md5 = (album?.opt("md5_image") as? String) ?: (r.opt("md5_image") as? String) ?: ""
            out += Track(
                artist = artist.trim(),
                title = title.trim(),
                album = (album?.opt("title") as? String)?.trim() ?: "",
                durationSec = sec,
                explicit = r.opt("explicit_lyrics") == true,
                artworkUrl = if (MD5.matches(md5)) "https://cdn-images.dzcdn.net/images/cover/$md5/300x300-000000-80-0-0.jpg" else "",
            )
        }
        return out
    }

    /** One entry per artist + title within 2 s, first kept. */
    fun dedupe(tracks: List<Track>): List<Track> {
        val out = ArrayList<Track>()
        for (t in tracks) {
            val key = SongPicker.SongHit(t.artist, t.title, "", "", 0, "").key
            if (out.any { SongPicker.SongHit(it.artist, it.title, "", "", 0, "").key == key && abs(it.durationSec - t.durationSec) <= 2 }) continue
            out += t
        }
        return out
    }
}
