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
 *   3 TOPIC        the artist's genuine "Provided to YouTube" art track (>= 10 k views, or on the
 *                  artist's verified channel, or, for a little-known song, on the artist's
 *                  "- Topic" channel at the official length; or on a label's "- Topic" channel
 *                  when the art track's "Title · Artist" credit names the artist, same conditions)
 *   4 MUSIC_VIDEO  fallback: the official music video closest in length
 *
 * Within that order, an upload tagged with an era or style the request doesn't name
 * ("Insane (1920s Style)") goes after the untagged ones, and one tagged with a bare year
 * ("Insane (1920)") after an untagged one with 10x its views.
 *
 * When the two searches ([searchQueries]) rank nothing, the caller runs the plain "Artist Title"
 * search ([fallbackQuery]) too and ranks all results again.
 *
 * Tiers 1-3 must be within -1 .. +6 s of the official length; the fallback within -2 .. +60 s.
 * Live, remix, cover, sped up, slowed, karaoke, "1 hour", extended, other "versions",
 * translations and other artists' songs are rejected unless the request itself asks for them.
 */
object SongPicker {
    /** [genre]: the iTunes primary genre of the tapped song, carried to the added song ("" = unknown). Not used for ranking. */
    data class Request(val artist: String, val title: String, val durationSec: Int, val genre: String = "")

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
    /** A matching upload with this many views makes the song "known" (see [genuineArtTrack]). */
    const val KNOWN_SONG_VIEWS = 100_000L
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
        "with", "letra", "letras", "paroles", "lirik", "가사", "歌詞", "oficial", "remastered", "remaster", "full", "song", "explicit", "the",
    )

    /** A lyric video, in English or the usual other words ("Letra", "Paroles", "Lirik", 가사, 歌詞). */
    private val LYRIC = re("\\blyrics?\\b|\\blyric\\s*video\\b|\\bletras?\\b|\\bparoles\\b|\\blirik\\b|가사|歌詞")

    private val FEAT = re("\\s*[(\\[]?\\s*\\b(?:feat|ft|featuring)\\b\\.?\\s.*$")
    private fun stripFeat(s: String) = s.replace(FEAT, "").trim()

    /** A bracketed qualifier that changes which recording it is ("Taylor's Version"). */
    private val QUALIFIER = re("\\b(?:version|remix|mix|live|acoustic|demo|extended|instrumental|sped|slowed|unplugged|stripped|re-?recorded)\\b")

    /** "Artist Title" without feat. credits or non-qualifier brackets. */
    private fun queryBase(artist: String, title: String): String {
        val t = Regex("\\s*(?:\\(([^)]*)\\)|\\[([^\\]]*)\\])").replace(title) { m ->
            val inner = m.groups[1]?.value ?: m.groups[2]?.value ?: ""
            if (QUALIFIER.containsMatchIn(inner)) m.value else " "
        }
        return "$artist ${stripFeat(t)}".replace(Regex("\\s+"), " ").trim()
    }

    /** The two searches run for a song. */
    fun searchQueries(artist: String, title: String): List<String> {
        val base = queryBase(artist, title)
        return listOf("$base lyrics", "$base official audio")
    }

    /**
     * The third search, run only when the first two rank nothing: plain "Artist Title". For
     * little-known songs the "lyrics" / "official audio" words pull in other songs, while the
     * plain search finds the art track or the upload.
     */
    fun fallbackQuery(artist: String, title: String): String = queryBase(artist, title)

    /**
     * Title words without brackets, quotes, features, trailing "| ..." / "// ...", or decoration.
     * [keepQuoted] keeps the words inside double quotes (only the marks go): the quotes then hold
     * the song title (`21 Savage - "Rap Saved Me" Ft Quavo`), not an appended lyric line.
     */
    fun coreTokens(title: String, keepQuoted: Boolean = false): List<String> {
        var s = title.split(Regex("\\s(?:\\||//)\\s?"))[0]
        s = s.replace(Regex("\\([^)]*\\)|\\[[^\\]]*\\]|\\{[^}]*\\}|【[^】]*】"), " ")
        s = if (keepQuoted) s.replace(Regex("[\"“”]"), " ") else s.replace(Regex("\"[^\"]*\"|“[^”]*”"), " ")
        s = stripFeat(s)
        return toks(s).filter { it !in NOISE }
    }

    /** The ways an upload title's words can be read: quoted text dropped, and (when there is any) kept. */
    private fun titleReadings(title: String): List<List<String>> =
        if (Regex("[\"“”]").containsMatchIn(title)) listOf(coreTokens(title), coreTokens(title, true)) else listOf(coreTokens(title))

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

    /**
     * Words a channel puts around the artist's name ("officialfacetoface", "Face To Face Band",
     * "FaceToFaceVEVO"), "official" also in other languages ("Legendaire Officiel", "米津玄師 公式").
     * Normalised like channel names (NFKD: 공식 is compared as its jamo).
     */
    private val CHANNEL_AFFIXES = listOf(
        "official", "vevo", "music", "band", "tv", "topic", "channel",
        "officiel", "oficial", "offiziell", "ufficiale", "officieel", "oficjalny", "официальный", "公式", "オフィシャル", "官方", "공식",
    ).map(::joined)

    /**
     * A channel name made of the artist's name in two scripts or forms: "神山羊 / Yoh Kamiyama".
     * Only " / " and " | " with spaces (not "AC/DC"), or their full-width forms.
     */
    private val CHANNEL_NAME_SPLIT = Regex("\\s+[/|]\\s+|\\s*[／｜]\\s*")

    /**
     * Ways the artist may be written in a channel name: [artistVariants], also with "&" / "+"
     * spelled "and" and "and" spelled "&" ("Heavy D & The Boyz" -> "HeavyDAndTheBoyzVEVO").
     */
    private fun channelVariants(artist: String): List<String> =
        (artistVariants(artist) + joined(artist.replace(Regex("\\s*[&+]\\s*"), " and ")) + joined(artist.replace(re("\\s+and\\s+"), " & ")))
            .distinct()
            .filter { it.length >= 2 }

    /**
     * The channel is the artist's own: one of its cores spells the artist. A verified channel may
     * also give the name in two forms ("神山羊 / Yoh Kamiyama"); then either form counts.
     */
    private fun isArtistChannel(e: Entry, variants: List<String>): Boolean {
        val names = mutableListOf(e.channel)
        if (e.verified) {
            val parts = e.channel.split(CHANNEL_NAME_SPLIT).filter { it.isNotBlank() }
            if (parts.size >= 2) names += parts
        }
        return names.any { n -> channelCores(n).any { it in variants } }
    }

    /** [joinedName] without leading / trailing [CHANNEL_AFFIXES]; at least 3 letters stay. */
    private fun stripAffixes(joinedName: String): String {
        var j = joinedName
        var changed = true
        while (changed) {
            changed = false
            for (a in CHANNEL_AFFIXES) {
                if (j.length - a.length < 3) continue
                if (j.startsWith(a)) { j = j.substring(a.length); changed = true }
                else if (j.endsWith(a)) { j = j.substring(0, j.length - a.length); changed = true }
            }
        }
        return j
    }

    /**
     * Ways the channel name may spell the artist: joined, with "- Topic", "and 2 more" and VEVO
     * removed, with or without the words official / music / tv / channel / vevo, and with
     * [CHANNEL_AFFIXES] glued to the front or back stripped.
     */
    private fun channelCores(channel: String): List<String> {
        val s = channel
            .replace(re("\\s+and\\s+\\d+\\s+more$"), "")
            .replace(re("\\s*-\\s*topic$"), "")
            .replace(re("vevo$"), "")
        val plain = toks(s).joinToString("")
        val filtered = toks(s).filter { it !in setOf("official", "music", "tv", "channel", "vevo") }
            .joinToString("")
            .replace(Regex("(?:official|music)$"), "")
        return listOf(plain, filtered, stripAffixes(plain), stripAffixes(filtered)).distinct().filter { it.isNotEmpty() }
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
        // UK rap/drill premiere platforms: the official music video often appears only there.
        "grm daily", "mixtape madness", "link up tv",
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
            "\\breversed\\b|\\b\\d{3}\\s*hz\\b|\\bbackwards\\b|\\bbass\\s*boost(?:ed)?\\b|\\btiktok\\b|\\bchipmunk\\b|\\b8\\s*-?\\s*bit\\b|\\bshorts?\\b|\\btutorial\\b|\\bchoreography\\b|\\bdance (?:video|practice|cover)\\b|\\blesson\\b|\\bfan\\s*made\\b|\\bteaser\\b|\\btrailer\\b|\\bbehind the scenes\\b|\\bmaking of\\b|\\binterview\\b",
        ),
        "translation" to re(
            "\\blegendad[oa]\\b|\\btraduc(?:ida|ido|ción|cion|ao|ão)\\b|\\btradução\\b|\\btraduzione\\b|\\bsub(?:titulado|titulada|s?)?\\s*(?:español|espanol|ita|pt|br)\\b|\\bespañol\\b|\\bespanol\\b|перевод|해석|번역|和訳|中字|中文字幕|\\bvietsub\\b|\\bthaisub\\b|\\bpolskie\\b|\\bnapisy\\b",
        ),
    )

    /** Labels that name the released recording itself: "(Album Version)", "(Single Version)", "(Explicit Version)", "(Original Mix)". */
    private val SAME_RECORDING = re("\\b(?:album|single|lp|explicit|dirty)\\s+version\\b|\\boriginal\\s+mix\\b")

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
            val t = if (label == "version" || label == "remix") title.replace(SAME_RECORDING, " ") else title
            if (r.containsMatchIn(t) && !r.containsMatchIn(reqText)) return label
            if (label in BAD_CHANNEL && r.containsMatchIn(e.channel) && !r.containsMatchIn(reqText)) return "$label channel"
        }
        val words = toks(title).toSet()
        for (q in requestQualifiers(req.title)) {
            if (!q.all { it in words }) return "not the requested \"${q.joinToString(" ")}\""
        }
        val want = requestCore(req.title)
        if (want.isEmpty()) return "empty title"
        // "Artist | Title" / "Artist | 'Title'": the artist's name exactly, then the title.
        val bars = title.split(Regex("\\s+\\|\\s+"))
        if (bars.size >= 2 && joined(bars[0]) in variants && titleReadings(bars[1]).any { sameTokens(it, want) }) return null
        val dash = Regex("\\s+[-–—~]+\\s+").find(title)
        if (dash != null) {
            val left = title.substring(0, dash.range.first)
            val right = title.substring(dash.range.last + 1)
            val inLeft = mentionsArtist(left, variants)
            val inRight = mentionsArtist(right, variants)
            fun isWant(side: String) = titleReadings(side).any { sameTokens(it, want) }
            if ((inLeft && isWant(right)) || (inRight && isWant(left))) return null
            if (!inLeft && !inRight) return if (mentionsArtist(e.channel, variants)) "different song" else "different artist"
            return "different song or artist"
        }
        val names = artistTokenLists(req.artist)
        fun withoutArtist(have: List<String>): List<String> {
            for (name in names) removeRun(have, name)?.let { return it }
            return have
        }
        if (titleReadings(title).none { sameTokens(withoutArtist(it), want) }) return "different song"
        if (mentionsArtist(title, variants) || mentionsArtist(e.channel, variants)) return null
        return if (creditsArtist(req, e)) null else "artist not named"
    }

    private val TOPIC_CHANNEL = re("\\s-\\s*topic$")
    private val PROVIDED = re("^\\s*provided to youtube by\\b")

    /**
     * A label's art track ("Release - Topic") whose YouTube-generated credit line ("Provided to
     * YouTube by <label> <Title> · <Artist> · ...") names the requested artist, with exactly the
     * requested title. The credit must follow the upload's own title and start one of the "·"
     * parts with the artist's name.
     */
    private fun creditsArtist(req: Request, e: Entry): Boolean {
        if (!PROVIDED.containsMatchIn(e.description) || !TOPIC_CHANNEL.containsMatchIn(e.channel)) return false
        if (normalizeName(e.title) != normalizeName(req.title)) return false
        val parts = e.description.split('·')
        if (parts.size < 2) return false
        val head = toks(parts[0])
        val t = toks(e.title)
        if (head.size <= t.size || t.indices.any { head[head.size - t.size + it] != t[it] }) return false
        val names = artistTokenLists(req.artist)
        return parts.drop(1).any { p ->
            val words = toks(p)
            names.any { n -> n.indices.all { words.getOrNull(it) == n[it] } }
        }
    }

    private class Facts(
        val dt: Double,
        val lyric: Boolean,
        val audio: Boolean,
        val artTrack: Boolean,
        val artistChannel: Boolean,
        /** A label's art track whose credit line names the artist (see [creditsArtist]). */
        val credited: Boolean,
        val official: Boolean,
        val musicVideo: Boolean,
    )

    private fun facts(req: Request, e: Entry, chanVariants: List<String>): Facts {
        val artistChannel = isArtistChannel(e, chanVariants)
        val label = joined(e.channel) in LABELS
        val artTrack = PROVIDED.containsMatchIn(e.description) || TOPIC_CHANNEL.containsMatchIn(e.channel)
        return Facts(
            dt = (e.duration ?: 0L).toDouble() - req.durationSec,
            lyric = LYRIC.containsMatchIn(e.title),
            audio = re("\\baudio\\b").containsMatchIn(e.title),
            artTrack = artTrack,
            artistChannel = artistChannel,
            credited = !artistChannel && creditsArtist(req, e),
            official = e.verified && (artistChannel || label) && !artTrack,
            musicVideo = re("\\bvideo\\b|\\bmv\\b|\\bclip\\b").containsMatchIn(e.title) ||
                !Regex("[(\\[]").containsMatchIn(withoutRequestBrackets(e.title, req.title)),
        )
    }

    private val BRACKETS = Regex("\\(([^)]*)\\)|\\[([^\\]]*)\\]")

    /** A bracket that only describes the song: "(A Hazbin Hotel Song)". */
    private val DESCRIPTIVE = re("^\\s*an?\\s+\\S.*\\bsong\\s*$")

    /**
     * [title] without the bracketed parts the requested title has too ("Delilah (pull me out of
     * this)") and without descriptive ones ("(A Hazbin Hotel Song)").
     */
    private fun withoutRequestBrackets(title: String, reqTitle: String): String {
        val own = BRACKETS.findAll(reqTitle).map { normalizeName(it.groups[1]?.value ?: it.groups[2]?.value ?: "") }.toSet()
        return BRACKETS.replace(title) { m ->
            val inner = m.groups[1]?.value ?: m.groups[2]?.value ?: ""
            if (normalizeName(inner) in own || DESCRIPTIVE.containsMatchIn(inner)) " " else m.value
        }
    }

    /** A bracketed era or style the request doesn't name: "(1920s Style)", "(80s)", "(Swing)". */
    private val ERA_STYLE = re("\\b(?:\\d{2}|\\d{4})'?s\\b|\\b(?:style|era|vintage|retro|swing|jazz|ragtime|big\\s*band)\\b")
    /** A bracketed bare year: "(1920)". Often the original's release year ("(1985)"), so it only counts beside a far more viewed upload. */
    private val YEAR_TAG = Regex("^\\s*\\d{4}\\s*$")

    private enum class EraTag { STYLE, YEAR }

    private fun eraTag(title: String, reqTitle: String): EraTag? {
        var out: EraTag? = null
        for (m in BRACKETS.findAll(withoutRequestBrackets(title, reqTitle))) {
            val inner = m.groups[1]?.value ?: m.groups[2]?.value ?: ""
            if (ERA_STYLE.containsMatchIn(inner) && !ERA_STYLE.containsMatchIn(reqTitle)) return EraTag.STYLE
            if (YEAR_TAG.containsMatchIn(inner)) out = EraTag.YEAR
        }
        return out
    }

    /**
     * An upload tagged with an era or style the request doesn't name goes after the untagged
     * ones; one tagged with a bare year only after an untagged one with 10x its views ("Insane
     * (1920)", 3.9 M, a 1920s re-arrangement, vs the original's 175 M). Kept, not rejected: it
     * may be all there is.
     */
    private fun untaggedFirst(req: Request, ranked: List<Ranked>): List<Ranked> {
        val tag = ranked.associateWith { eraTag(it.entry.title, req.title) }
        val untagged = ranked.filter { tag[it] == null }
        val most = untagged.maxOfOrNull { it.entry.views ?: 0L } ?: 0L
        fun later(r: Ranked) = when (tag[r]) {
            EraTag.STYLE -> untagged.isNotEmpty()
            EraTag.YEAR -> most > 0 && most >= 10 * (r.entry.views ?: 0L)
            null -> false
        }
        return ranked.filterNot(::later) + ranked.filter(::later)
    }

    /**
     * An art track that needs no view count: uploaded by the artist's own verified channel (an
     * impostor can't be verified), or, for a little-known song (no matching upload has
     * [KNOWN_SONG_VIEWS]), a real "Provided to YouTube by" upload on a "- Topic" channel at the
     * official length (+-1 s).
     */
    private fun genuineArtTrack(e: Entry, f: Facts, knownSong: Boolean): Boolean {
        if (e.verified && !TOPIC_CHANNEL.containsMatchIn(e.channel)) return true
        return littleKnownArtTrack(e, f, knownSong)
    }

    private fun littleKnownArtTrack(e: Entry, f: Facts, knownSong: Boolean): Boolean =
        !knownSong && PROVIDED.containsMatchIn(e.description) && TOPIC_CHANNEL.containsMatchIn(e.channel) && abs(f.dt) <= 1.0

    /** Rank the candidates: `ranked` in the order to offer them, `rejected` explains the rest. */
    fun rank(req: Request, entries: List<Entry>): Result {
        val variants = artistVariants(req.artist)
        val chanVariants = channelVariants(req.artist)
        val tiers = Tier.entries.associateWith { ArrayList<Pair<Entry, List<Double>>>() }
        val rejected = ArrayList<Rejected>()
        val why = entries.associateWith { mismatch(req, it, variants) }
        // A song with a popular upload: a genuine art track of it has views too.
        val knownSong = entries.any { why[it] == null && (it.views ?: 0L) >= KNOWN_SONG_VIEWS }
        for (e in entries) {
            fun reject(reason: String) = rejected.add(Rejected(e, reason))
            if (e.liveStatus == "is_live" || e.liveStatus == "is_upcoming" || e.liveStatus == "post_live") {
                reject("live stream"); continue
            }
            if (e.duration == null) {
                reject("no length"); continue
            }
            val whyNot = why[e]
            if (whyNot != null) {
                reject(whyNot); continue
            }
            val f = facts(req, e, chanVariants)
            val views = (e.views ?: 0L).toDouble()
            val inWindow = f.dt in WINDOW
            if (inWindow && f.official && (f.lyric || f.audio)) {
                tiers.getValue(Tier.OFFICIAL) += e to listOf(if (f.lyric) 0.0 else 1.0, -views)
            } else if (inWindow && f.lyric && !f.artTrack && !f.artistChannel && !e.channel.contains("topic", ignoreCase = true)) {
                if (views >= LYRIC_MIN_VIEWS) tiers.getValue(Tier.LYRIC) += e to listOf(-views)
                else reject("lyric video with only ${e.views ?: 0} views")
            } else if (inWindow && f.artTrack && f.artistChannel) {
                if (views >= TOPIC_MIN_VIEWS || genuineArtTrack(e, f, knownSong)) tiers.getValue(Tier.TOPIC) += e to listOf(-views)
                else reject("art track with only ${e.views ?: 0} views")
            } else if (inWindow && f.credited) {
                // A label's art track: only for a little-known song, at the official length.
                if (littleKnownArtTrack(e, f, knownSong)) tiers.getValue(Tier.TOPIC) += e to listOf(-views)
                else reject(if (knownSong) "label art track of a known song" else "label art track ${e.duration} s vs ${req.durationSec} s")
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
        return Result(untaggedFirst(req, ranked), rejected)
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
        /** iTunes `primaryGenreName` ("Pop", "Hip-Hop/Rap", ...), cleaned by [cleanGenre]; "" when absent. */
        val genre: String = "",
        /** iTunes `trackExplicitness` "cleaned": the clean version of an explicit song ([SongMerge]). */
        val clean: Boolean = false,
        /** "itunes" or "deezer" ([SongCatalog]). */
        val source: String = "itunes",
    ) {
        val key: String get() = "${normalizeName(artist)} - ${normalizeName(title)}"
    }

    /** Same as cleanGenre() in tools/beatmaps/itunes.ts: spaces collapsed, at most 60 characters, else "". */
    fun cleanGenre(g: Any?): String {
        if (g !is String) return ""
        val t = g.replace(Regex("\\s+"), " ").trim()
        return if (t.isNotEmpty() && t.length <= 60 && !Regex("[\\u0000-\\u001f]").containsMatchIn(t)) t else ""
    }

    /**
     * Same as parseItunesResults() in src/ui/songSearch.ts: songs 20 s .. 15 min, one per
     * artist + title within 2 s (album vs deluxe), first (most relevant) kept. A kept hit without
     * a genre takes the first one its duplicates have (like the cloud job's pickOfficialLength).
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
                genre = cleanGenre(r["primaryGenreName"]),
                clean = r["trackExplicitness"] == "cleaned",
            )
            val dup = out.indexOfFirst { it.key == hit.key && abs(it.durationSec - sec) <= 2 }
            if (dup >= 0) {
                if (out[dup].genre.isEmpty() && hit.genre.isNotEmpty()) out[dup] = out[dup].copy(genre = hit.genre)
                continue
            }
            out += hit
        }
        return out
    }

    /**
     * Backfill: the genre of a saved song from iTunes search [hits] for "artist title". Only hits
     * with the same artist + title (normalised) and a genre count; the one whose length is
     * closest to the saved [durationSec] wins (the first, i.e. most relevant, on a tie). Null if none.
     */
    fun genreFor(artist: String, title: String, durationSec: Int, hits: List<SongHit>): String? {
        val key = "${normalizeName(artist)} - ${normalizeName(title)}"
        return hits.filter { it.key == key && it.genre.isNotEmpty() }
            .minByOrNull { if (durationSec > 0) abs(it.durationSec - durationSec) else 0 }
            ?.genre
    }
}
