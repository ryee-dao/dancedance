package app.dancedance.tv

import java.text.Normalizer
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * "Find a song" on the TV: choose the YouTube video for a song (artist, title, official length)
 * from YouTube search results. Pure: no I/O, no Android APIs (JVM unit tests in SongPickerTest).
 *
 * A Kotlin port of tools/beatmaps/pick.ts (the cloud job's picker) with the SAME rules, so the TV
 * and the cloud choose the same kind of video. Keep the two in step when either changes.
 *
 * Ranking, best first:
 *   1 OFFICIAL     official lyric video or official audio on the artist's own, VEVO or label
 *                  channel (verified); lyric before audio
 *   2 LYRIC        third-party lyric video, most views first (>= 300 k views)
 *   3 TOPIC        the artist's genuine "Provided to YouTube" art track
 *   4 MUSIC_VIDEO  fallback: the official music video closest in length
 *
 * Tiers 1-3 must be within -1 .. +6 s of the official length; the fallback within -2 .. +60 s.
 * Live, remix, cover, sped up, slowed, karaoke, "1 hour", extended, other "versions",
 * translations and other artists' songs are rejected unless the request itself asks for them.
 */
object SongPicker {
    data class Request(val artist: String, val title: String, val durationSec: Int)

    /** One search result, reduced to what the ranking uses. */
    data class Entry(
        val id: String,
        val title: String,
        val channel: String,
        val verified: Boolean,
        val views: Long?,
        val duration: Long?,
        /** Search snippet; art tracks start "Provided to YouTube by". */
        val description: String,
        /** "is_live" / "is_upcoming" / "post_live" like yt-dlp, or null. */
        val liveStatus: String? = null,
    )

    enum class Tier(val label: String) { OFFICIAL("official"), LYRIC("lyric"), TOPIC("topic"), MUSIC_VIDEO("music-video") }

    data class Ranked(val entry: Entry, val tier: Tier)
    data class Rejected(val entry: Entry, val reason: String)
    data class Result(val ranked: List<Ranked>, val rejected: List<Rejected>)

    const val LYRIC_MIN_VIEWS = 300_000L
    const val TOPIC_MIN_VIEWS = 10_000L
    private val WINDOW = -1.0..6.0
    private val MV_WINDOW = -2.0..60.0

    private val OPTS = setOf(RegexOption.IGNORE_CASE)
    private fun re(p: String) = Regex(p, OPTS)

    // --- text helpers ----------------------------------------------------------------------

    /** Same as normalizeName() in src/beat/cloud.ts. */
    fun normalizeName(s: String): String =
        Normalizer.normalize(s, Normalizer.Form.NFKD)
            .replace(Regex("\\p{M}+"), "")
            .lowercase()
            .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
            .trim()

    private fun toks(s: String) = normalizeName(s).split(' ').filter { it.isNotEmpty() }
    private fun joined(s: String) = toks(s).joinToString("")

    private val NOISE = setOf(
        "lyrics", "lyric", "video", "official", "audio", "hd", "hq", "4k", "music", "mv", "visualizer", "visualiser",
        "with", "letra", "oficial", "remastered", "remaster", "full", "song", "explicit", "the",
    )

    private val FEAT = re("\\s*[(\\[]?\\s*\\b(?:feat|ft|featuring)\\b\\.?\\s.*$")
    private fun stripFeat(s: String) = s.replace(FEAT, "").trim()

    /** A bracketed qualifier that changes which recording it is ("Taylor's Version"). */
    private val QUALIFIER = re("\\b(?:version|remix|mix|live|acoustic|demo|extended|instrumental|sped|slowed|unplugged|stripped|re-?recorded)\\b")

    /** The two searches run for a song. */
    fun searchQueries(artist: String, title: String): List<String> {
        val t = Regex("\\s*(?:\\(([^)]*)\\)|\\[([^\\]]*)\\])").replace(title) { m ->
            val inner = m.groups[1]?.value ?: m.groups[2]?.value ?: ""
            if (QUALIFIER.containsMatchIn(inner)) m.value else " "
        }
        val base = "$artist ${stripFeat(t)}".replace(Regex("\\s+"), " ").trim()
        return listOf("$base lyrics", "$base official audio")
    }

    /** Title words without brackets, quotes, features, trailing "| ..." / "// ...", or decoration. */
    fun coreTokens(title: String): List<String> {
        var s = title.split(Regex("\\s(?:\\||//)\\s?"))[0]
        s = s.replace(Regex("\\([^)]*\\)|\\[[^\\]]*\\]|\\{[^}]*\\}|【[^】]*】"), " ")
        s = s.replace(Regex("\"[^\"]*\"|“[^”]*”"), " ")
        s = stripFeat(s)
        return toks(s).filter { it !in NOISE }
    }

    private fun sameTokens(a: List<String>, b: List<String>) = a.isNotEmpty() && a == b

    private val CREDIT_SPLIT = re("\\s*(?:,|&|\\+|;|/|\\band\\b|\\bx\\b|\\bfeat\\.?|\\bft\\.?|\\bfeaturing\\b|\\bwith\\b|\\bvs\\.?)\\s*")
    private fun splitCredit(artist: String) = artist.split(CREDIT_SPLIT).filter { it.isNotBlank() }

    /** Ways the artist may be written, joined without spaces (see pick.ts artistVariants). */
    fun artistVariants(artist: String): List<String> {
        val parts = splitCredit(artist).map(::joined)
        val out = listOf(joined(artist), parts.getOrElse(0) { "" }) + parts.drop(1).filter { it.length >= 5 }
        return out.filter { it.length >= 2 }.distinct()
    }

    private fun artistTokenLists(artist: String): List<List<String>> =
        (listOf(toks(artist)) + splitCredit(artist).map(::toks)).filter { it.isNotEmpty() }.sortedByDescending { it.size }

    private fun mentionsArtist(text: String, variants: List<String>): Boolean {
        val j = joined(text)
        return variants.any { j.contains(it) }
    }

    private fun removeRun(hay: List<String>, needle: List<String>): List<String>? {
        var i = 0
        while (i + needle.size <= hay.size) {
            if (needle.indices.all { hay[i + it] == needle[it] }) return hay.subList(0, i) + hay.subList(i + needle.size, hay.size)
            i++
        }
        return null
    }

    /** The requested title's words, without " - Remastered 2011"-style suffixes. */
    fun requestCore(title: String): List<String> =
        coreTokens(title.replace(re("\\s[-–—]\\s.*\\b(?:remaster(?:ed)?|edit|version|mix|mono|stereo|single|live|acoustic|demo|from)\\b.*$"), ""))

    private fun channelCore(channel: String): String {
        val s = channel
            .replace(re("\\s+and\\s+\\d+\\s+more$"), "")
            .replace(re("\\s*-\\s*topic$"), "")
            .replace(re("vevo$"), "")
        return toks(s).filter { it !in setOf("official", "music", "tv", "channel", "vevo") }
            .joinToString("")
            .replace(Regex("(?:official|music)$"), "")
    }

    private val LABELS = listOf(
        "atlantic records", "warner records", "warner bros records", "warner music group", "republic records", "columbia records",
        "interscope records", "capitol records", "rca records", "epic records", "island records", "def jam recordings",
        "universal music group", "sony music entertainment", "parlophone", "parlophone records", "mercury records", "arista records",
        "geffen records", "roc nation", "polydor records", "virgin records", "rhino", "rhino entertainment", "big machine records",
        "hollywood records", "aftermath records", "young money", "cash money records", "bad boy records", "jive records",
        "elektra records", "300 entertainment", "fueled by ramen", "sire records", "reprise records", "capitol music group",
        "motown records", "ultra records", "spinnin records", "monstercat", "hybe labels", "sm town", "jyp entertainment",
        "yg entertainment", "xl recordings", "domino recordings", "sub pop records", "big beat records", "astralwerks",
    ).map(::joined).toSet()

    /** Words that mean "not the original recording" (only when the request doesn't contain them). */
    private val BAD: List<Pair<String, Regex>> = listOf(
        "live" to re("\\blive\\b|\\bconcert\\b|\\btour\\b|\\bfestival\\b|\\bperformance\\b|\\bperforms?\\b"),
        "remix" to re("\\bremix(?:es|ed)?\\b|\\bmix\\b|\\brework\\b|\\bbootleg\\b|\\bflip\\b"),
        "cover" to re("\\bcover\\b|\\btribute\\b|\\bparody\\b|\\bimpression\\b"),
        "sped up" to re("\\bsped\\b|\\bspeed\\s*up\\b|\\bspeedup\\b|\\bfaster\\b"),
        "slowed" to re("\\bslowed\\b|\\bslow(?:er)? version\\b"),
        "reverb" to re("\\breverb\\b"),
        "nightcore" to re("\\bnightcore\\b"),
        "8D" to re("\\b8\\s*d\\b|\\b16\\s*d\\b"),
        "karaoke" to re("\\bkaraoke\\b|\\bsing\\s*along\\b"),
        "instrumental" to re("\\binstrumental\\b|\\bbacking track\\b|\\bminus one\\b"),
        "mashup" to re("\\bmash\\s*-?\\s*up\\b|\\bmedley\\b|\\bmegamix\\b"),
        "1 hour" to re("\\b\\d+\\s*(?:hours?|hrs?)\\b|\\bloop(?:ed)?\\b|\\bon repeat\\b"),
        "extended" to re("\\bextended\\b|\\bfull length\\b"),
        "edit" to re("\\bclean\\b|\\bradio\\s*edit\\b|\\bedit\\b|\\bcensored\\b"),
        "reaction" to re("\\breact(?:ion|s|ing)?\\b|\\breview\\b|\\bfirst time hearing\\b"),
        "acoustic" to re("\\bacoustic\\b|\\bunplugged\\b|\\bstripped\\b|\\bpiano\\b|\\bguitar\\b|\\borchestra(?:l)?\\b|\\bsymphonic\\b|\\blofi\\b|\\blo-fi\\b"),
        "version" to re("\\bversion\\b|\\bversi[oó]n\\b|\\brerecord(?:ed|ing)?\\b|\\bre-recorded\\b"),
        "demo" to re("\\bdemo\\b|\\bsnippet\\b|\\bpreview\\b|\\bunreleased\\b|\\bleak(?:ed)?\\b"),
        "other media" to re(
            "\\breversed\\b|\\bbackwards\\b|\\bbass\\s*boost(?:ed)?\\b|\\btiktok\\b|\\bchipmunk\\b|\\b8\\s*-?\\s*bit\\b|\\bshorts?\\b|\\btutorial\\b|\\bchoreography\\b|\\bdance (?:video|practice|cover)\\b|\\blesson\\b|\\bfan\\s*made\\b|\\bteaser\\b|\\btrailer\\b|\\bbehind the scenes\\b|\\bmaking of\\b|\\binterview\\b",
        ),
        "translation" to re(
            "\\blegendad[oa]\\b|\\btraduc(?:ida|ido|ción|cion|ao|ão)\\b|\\btradução\\b|\\btraduzione\\b|\\bsub(?:titulado|titulada|s?)?\\s*(?:español|espanol|ita|pt|br)\\b|\\bespañol\\b|\\bespanol\\b|\\bперевод\\b|\\bvietsub\\b|\\bthaisub\\b|\\bpolskie\\b|\\bnapisy\\b",
        ),
    )

    /** BAD labels that also disqualify a channel ("Nightcore Hub", "7clouds Acoustic"). */
    private val BAD_CHANNEL = setOf("cover", "sped up", "slowed", "reverb", "nightcore", "8D", "karaoke", "instrumental", "acoustic", "1 hour")

    private fun requestQualifiers(title: String): List<List<String>> {
        val out = ArrayList<List<String>>()
        for (m in Regex("\\(([^)]*)\\)|\\[([^\\]]*)\\]|\\s[-–—]\\s(.+)$").findAll(title)) {
            val inner = m.groups[1]?.value ?: m.groups[2]?.value ?: m.groups[3]?.value ?: ""
            if (re("^\\s*(?:feat|ft|featuring|with|from)\\b").containsMatchIn(inner)) continue
            if (QUALIFIER.containsMatchIn(inner)) out += toks(inner).filter { it !in NOISE }
        }
        return out
    }

    // --- classification -----------------------------------------------------------------------

    /** Why [e] can't be this song (null = it matches). */
    private fun mismatch(req: Request, e: Entry, variants: List<String>): String? {
        val title = e.title
        val reqText = "${req.title} ${req.artist}"
        for ((label, r) in BAD) {
            if (r.containsMatchIn(title) && !r.containsMatchIn(reqText)) return label
            if (label in BAD_CHANNEL && r.containsMatchIn(e.channel) && !r.containsMatchIn(reqText)) return "$label channel"
        }
        val words = toks(title).toSet()
        for (q in requestQualifiers(req.title)) {
            if (!q.all { it in words }) return "not the requested \"${q.joinToString(" ")}\""
        }
        val want = requestCore(req.title)
        if (want.isEmpty()) return "empty title"
        val dash = Regex("\\s+[-–—~]+\\s+").find(title)
        if (dash != null) {
            val left = title.substring(0, dash.range.first)
            val right = title.substring(dash.range.last + 1)
            val inLeft = mentionsArtist(left, variants)
            val inRight = mentionsArtist(right, variants)
            if ((inLeft && sameTokens(coreTokens(right), want)) || (inRight && sameTokens(coreTokens(left), want))) return null
            if (!inLeft && !inRight) return if (mentionsArtist(e.channel, variants)) "different song" else "different artist"
            return "different song or artist"
        }
        var have = coreTokens(title)
        for (name in artistTokenLists(req.artist)) {
            val cut = removeRun(have, name)
            if (cut != null) {
                have = cut
                break
            }
        }
        if (!sameTokens(have, want)) return "different song"
        return if (mentionsArtist(title, variants) || mentionsArtist(e.channel, variants)) null else "artist not named"
    }

    private class Facts(
        val dt: Double,
        val lyric: Boolean,
        val audio: Boolean,
        val artTrack: Boolean,
        val artistChannel: Boolean,
        val official: Boolean,
        val musicVideo: Boolean,
    )

    private fun facts(req: Request, e: Entry, variants: List<String>): Facts {
        val core = channelCore(e.channel)
        val artistChannel = core.isNotEmpty() && core in variants
        val label = joined(e.channel) in LABELS
        val artTrack = re("^\\s*provided to youtube by\\b").containsMatchIn(e.description) || re("\\s-\\s*topic$").containsMatchIn(e.channel)
        return Facts(
            dt = (e.duration ?: 0L).toDouble() - req.durationSec,
            lyric = re("\\blyrics?\\b|\\blyric\\s*video\\b").containsMatchIn(e.title),
            audio = re("\\baudio\\b").containsMatchIn(e.title),
            artTrack = artTrack,
            artistChannel = artistChannel,
            official = e.verified && (artistChannel || label) && !artTrack,
            musicVideo = re("\\bvideo\\b|\\bmv\\b|\\bclip\\b").containsMatchIn(e.title) || !Regex("[(\\[]").containsMatchIn(e.title),
        )
    }

    /** Rank the candidates: `ranked` in the order to offer them, `rejected` explains the rest. */
    fun rank(req: Request, entries: List<Entry>): Result {
        val variants = artistVariants(req.artist)
        val tiers = Tier.entries.associateWith { ArrayList<Pair<Entry, List<Double>>>() }
        val rejected = ArrayList<Rejected>()
        for (e in entries) {
            fun reject(reason: String) = rejected.add(Rejected(e, reason))
            if (e.liveStatus == "is_live" || e.liveStatus == "is_upcoming" || e.liveStatus == "post_live") {
                reject("live stream"); continue
            }
            if (e.duration == null) {
                reject("no length"); continue
            }
            val why = mismatch(req, e, variants)
            if (why != null) {
                reject(why); continue
            }
            val f = facts(req, e, variants)
            val views = (e.views ?: 0L).toDouble()
            val inWindow = f.dt in WINDOW
            if (inWindow && f.official && (f.lyric || f.audio)) {
                tiers.getValue(Tier.OFFICIAL) += e to listOf(if (f.lyric) 0.0 else 1.0, -views)
            } else if (inWindow && f.lyric && !f.artTrack && !f.artistChannel && !e.channel.contains("topic", ignoreCase = true)) {
                if (views >= LYRIC_MIN_VIEWS) tiers.getValue(Tier.LYRIC) += e to listOf(-views)
                else reject("lyric video with only ${e.views ?: 0} views")
            } else if (inWindow && f.artTrack && f.artistChannel) {
                if (views >= TOPIC_MIN_VIEWS) tiers.getValue(Tier.TOPIC) += e to listOf(-views)
                else reject("art track with only ${e.views ?: 0} views")
            } else if (f.official && f.musicVideo && !f.lyric && f.dt in MV_WINDOW) {
                tiers.getValue(Tier.MUSIC_VIDEO) += e to listOf(abs(f.dt), -views)
            } else if (!inWindow) {
                reject("length ${e.duration} s vs ${req.durationSec} s")
            } else if (f.artTrack) {
                reject("art track from another channel")
            } else if (f.artistChannel && !e.verified) {
                reject("unverified channel using the artist's name")
            } else {
                reject(if (f.official) "official upload, but not lyric/audio" else "not official, not a lyric video")
            }
        }
        val cmp = Comparator<Pair<Entry, List<Double>>> { a, b ->
            val n = maxOf(a.second.size, b.second.size)
            for (i in 0 until n) {
                val x = a.second.getOrElse(i) { 0.0 }
                val y = b.second.getOrElse(i) { 0.0 }
                if (x != y) return@Comparator x.compareTo(y)
            }
            0
        }
        val ranked = Tier.entries.flatMap { t -> tiers.getValue(t).sortedWith(cmp).map { Ranked(it.first, t) } }
        return Result(ranked, rejected)
    }

    /** Union of result lists; the first occurrence of a video wins. */
    fun merge(lists: List<List<Entry>>): List<Entry> {
        val seen = HashSet<String>()
        return lists.flatten().filter { seen.add(it.id) }
    }

    // --- iTunes ----------------------------------------------------------------------------

    /** One song match from the iTunes Search API (the official length comes from here). */
    data class SongHit(
        val artist: String,
        val title: String,
        val album: String,
        val year: String,
        val durationSec: Int,
        /** HTTPS artwork URL (300x300) or "". */
        val artworkUrl: String,
    ) {
        val key: String get() = "${normalizeName(artist)} - ${normalizeName(title)}"
    }

    /**
     * Same as parseItunesResults() in src/ui/songSearch.ts: songs 20 s .. 15 min, one per
     * artist + title within 2 s (album vs deluxe), first (most relevant) kept.
     */
    fun parseItunes(results: List<Map<String, Any?>>): List<SongHit> {
        val out = ArrayList<SongHit>()
        for (r in results) {
            val kind = r["kind"]
            if (kind != null && kind != "song") continue
            val artist = r["artistName"] as? String ?: continue
            val title = r["trackName"] as? String ?: continue
            val ms = (r["trackTimeMillis"] as? Number)?.toDouble() ?: 0.0
            val sec = (ms / 1000).roundToInt()
            if (sec < 20 || sec > 15 * 60) continue
            val hit = SongHit(
                artist = artist.trim(),
                title = title.trim(),
                album = r["collectionName"] as? String ?: "",
                year = (r["releaseDate"] as? String)?.take(4) ?: "",
                durationSec = sec,
                artworkUrl = (r["artworkUrl100"] as? String)?.takeIf { it.startsWith("https://") }
                    ?.replace(Regex("/\\d+x\\d+bb\\."), "/300x300bb.") ?: "",
            )
            if (out.any { it.key == hit.key && abs(it.durationSec - sec) <= 2 }) continue
            out += hit
        }
        return out
    }
}
