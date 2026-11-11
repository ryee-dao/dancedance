package app.dancedance.tv

import android.content.Context
import android.net.ConnectivityManager
import android.util.Base64
import android.util.Log
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import fi.iki.elonen.NanoHTTPD
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.net.Inet4Address
import java.net.NetworkInterface
import java.security.SecureRandom

private const val TAG = "DanceDance"

/**
 * Phone-to-TV linking. While the TV's link screen is open, a tiny HTTP server on the LAN serves
 * ONE page at a random-token path (shown as a QR code). The phone submits the playlist link and
 * optionally a GitHub token; nothing is ever typed on the TV.
 */
class LinkController(private val app: DanceApp) {

    data class Started(val url: String, val qrSvgDataUrl: String)

    /** What the page hears about: the phone opened the page / submitted the form. */
    interface Listener {
        fun onPhoneVisited()
        fun onLinked(link: Prefs.Link, songCount: Int, tokenChange: String)
    }

    @Volatile var listener: Listener? = null
    private var server: Server? = null

    @Synchronized
    fun start(): Started {
        server?.let { return it.started }
        val ip = lanAddress(app) ?: throw BridgeException(
            "no-network-for-link",
            "The projector isn't on a Wi-Fi or wired network, so your phone can't reach it. Connect it and try again.",
        )
        val token = ByteArray(16).also { SecureRandom().nextBytes(it) }
            .let { Base64.encodeToString(it, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP) }
        var lastError: Exception? = null
        for (port in PORTS) {
            val s = Server(ip, port, token)
            try {
                s.start(NanoHTTPD.SOCKET_READ_TIMEOUT, true)
                val url = "http://$ip:${s.listeningPort}/$token"
                s.started = Started(url, Qr.svgDataUrl(url))
                server = s
                Log.i(TAG, "Link server listening on $ip:${s.listeningPort}")
                return s.started
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw BridgeException("internal", "Couldn't start the link page: ${lastError?.message}", lastError)
    }

    @Synchronized
    fun stop() {
        server?.stop()
        server = null
    }

    private inner class Server(host: String, port: Int, private val token: String) : NanoHTTPD(host, port) {
        lateinit var started: Started

        override fun serve(session: IHTTPSession): Response {
            val path = session.uri.trimEnd('/')
            val base = "/$token"
            if (path != base && !path.startsWith("$base/")) return text(Response.Status.NOT_FOUND, "Not found")
            return try {
                when (path.removePrefix(base)) {
                    "" -> when (session.method) {
                        Method.GET -> {
                            listener?.onPhoneVisited()
                            html(home())
                        }
                        Method.POST -> submit(session)
                        else -> text(Response.Status.METHOD_NOT_ALLOWED, "Method not allowed")
                    }
                    "/search" -> search(session)
                    "/pick" -> pick(session)
                    "/add" -> if (session.method == Method.POST) add(session) else redirectHome()
                    "/remove" -> if (session.method == Method.POST) remove(session) else redirectHome()
                    else -> text(Response.Status.NOT_FOUND, "Not found")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Link page failed", e)
                html(LinkPage.message(base, "Something went wrong", Errors.classify(e).message))
            }
        }

        private fun home(linkError: String? = null, playlistInput: String? = null, notice: String? = null) = LinkPage.home(
            base = "/$token",
            playlist = playlistInput ?: app.prefs.playlist?.input ?: "",
            linked = app.prefs.playlist != null,
            linkError = linkError,
            hasToken = app.prefs.hasGithubToken,
            added = app.addedSongs.list().reversed(),
            notice = notice,
        )

        private fun redirectHome(): Response = html(home())

        private fun param(session: IHTTPSession, name: String, max: Int = 300): String =
            (session.parameters[name]?.firstOrNull() ?: "").replace(Regex("[\\u0000-\\u001f\\u007f]"), " ").trim().take(max)

        private fun parsePost(session: IHTTPSession): Boolean {
            val length = session.headers["content-length"]?.toLongOrNull() ?: 0L
            if (length > 16 * 1024) return false
            return try {
                session.parseBody(HashMap())
                true
            } catch (e: Exception) {
                false
            }
        }

        /** Step 1: song matches (official length) from iTunes. */
        private fun search(session: IHTTPSession): Response {
            val q = param(session, "q", 120)
            if (q.isEmpty()) return html(home())
            val hits = try {
                app.songSearch.itunes(q)
            } catch (e: Exception) {
                Log.w(TAG, "iTunes search failed", e)
                return html(LinkPage.searchResults("/$token", q, emptyList(), (e as? BridgeException)?.message ?: "The song search didn't work. Check the TV's internet connection and try again."))
            }
            return html(LinkPage.searchResults("/$token", q, hits, null))
        }

        /** Step 2: the user tapped a song; find the video with the cloud job's rules. */
        private fun pick(session: IHTTPSession): Response {
            val artist = param(session, "a", 200)
            val title = param(session, "t", 200)
            val dur = param(session, "d").toIntOrNull()
            if (artist.isEmpty() || title.isEmpty() || dur == null || dur !in 20..900) return html(home())
            val art = param(session, "art", 400).takeIf { it.startsWith("https://") } ?: ""
            val req = SongPicker.Request(artist, title, dur)
            val result = try {
                runBlocking { withTimeout(45_000) { app.songSearch.findVideos(req) } }
            } catch (t: Throwable) {
                Log.w(TAG, "YouTube search failed", t)
                return html(LinkPage.message("/$token", "Couldn't search YouTube", Errors.classify(t).message))
            }
            val already = app.addedSongs.list().map { it.videoId }.toSet()
            return html(LinkPage.pick("/$token", req, art, result.ranked.take(6), already))
        }

        private fun add(session: IHTTPSession): Response {
            if (!parsePost(session)) return text(Response.Status.BAD_REQUEST, "Bad request")
            val id = param(session, "v", 11)
            val artist = param(session, "a", 200)
            val title = param(session, "t", 200)
            val dur = param(session, "d").toIntOrNull() ?: 0
            if (!Regex("^[A-Za-z0-9_-]{11}$").matches(id) || artist.isEmpty() || title.isEmpty()) {
                return text(Response.Status.BAD_REQUEST, "Bad request")
            }
            val song = AddedSongsStore.Song(
                videoId = id, title = title, artist = artist, addedAt = AddedSongsStore.now(), durationSec = dur,
                videoTitle = param(session, "vt", 300), channel = param(session, "ch", 200), tier = param(session, "tier", 20),
            )
            val isNew = app.addedSongs.add(song)
            Log.i(TAG, "Added song $id: $artist - $title (${song.tier}, ${song.channel})")
            app.onAddedSongsChanged?.invoke(song, null)
            return html(LinkPage.added("/$token", song, isNew))
        }

        private fun remove(session: IHTTPSession): Response {
            if (!parsePost(session)) return text(Response.Status.BAD_REQUEST, "Bad request")
            val gone = app.addedSongs.remove(param(session, "v", 11))
            if (gone != null) app.onAddedSongsChanged?.invoke(null, gone.videoId)
            return html(home(notice = gone?.let { "Removed “${it.title}” from the TV." }))
        }

        private fun submit(session: IHTTPSession): Response {
            if (!parsePost(session)) return text(Response.Status.BAD_REQUEST, "Bad request")
            val p = session.parameters
            val input = p["playlist"]?.firstOrNull()?.trim().orEmpty()
            val token = p["token"]?.firstOrNull()?.trim().orEmpty()
            val forget = p["forget"]?.firstOrNull() == "1"
            val hasToken = app.prefs.hasGithubToken

            if (token.isNotEmpty() && !TOKEN_RE.matches(token)) {
                return html(home("That doesn't look like a GitHub token. It should start with github_pat_ (or leave it blank).", input))
            }
            val parsed = PlaylistLinks.parse(input)
            if (parsed is PlaylistLinks.Parsed.Error) return html(home(parsed.message, input))
            val listId = (parsed as PlaylistLinks.Parsed.Ok).listId

            // Read it now so the phone can say whether it worked (a few seconds).
            val count = try {
                runBlocking { withTimeout(45_000) { app.playlists.read(listId).size } }
            } catch (t: Throwable) {
                val e = Errors.classify(t, forPlaylist = true)
                Log.w(TAG, "Link: playlist read failed", t)
                return html(home(e.message, input))
            }
            if (count == 0) {
                return html(home("That playlist is empty. Add some songs on YouTube first.", input))
            }

            val link = Prefs.Link(input, listId)
            app.prefs.playlist = link
            val tokenChange = when {
                token.isNotEmpty() -> { app.prefs.githubToken = token; "saved" }
                forget && hasToken -> { app.prefs.githubToken = null; "removed" }
                else -> "unchanged"
            }
            listener?.onLinked(link, count, tokenChange)
            return html(LinkPage.done("/$token", count, tokenChange))
        }

        private fun html(body: String): Response =
            newFixedLengthResponse(Response.Status.OK, "text/html; charset=utf-8", body).secured()

        private fun text(status: Response.Status, body: String): Response =
            newFixedLengthResponse(status, "text/plain; charset=utf-8", body).secured()

        private fun Response.secured() = apply {
            addHeader("Cache-Control", "no-store")
            addHeader("X-Content-Type-Options", "nosniff")
            addHeader("Referrer-Policy", "no-referrer")
            addHeader("X-Frame-Options", "DENY")
            addHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src https:; form-action 'self'; frame-ancestors 'none'")
        }
    }

    companion object {
        private val PORTS = listOf(8765, 8766, 8767, 0)
        private val TOKEN_RE = Regex("^(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})$")

        /** The projector's IPv4 address on the active (Wi-Fi / Ethernet) network. */
        fun lanAddress(context: Context): String? {
            try {
                val cm = context.getSystemService(ConnectivityManager::class.java)
                val props = cm?.getLinkProperties(cm.activeNetwork)
                props?.linkAddresses?.map { it.address }
                    ?.firstOrNull { it is Inet4Address && !it.isLoopbackAddress && !it.isLinkLocalAddress }
                    ?.let { return it.hostAddress }
            } catch (e: Exception) {
                Log.w(TAG, "ConnectivityManager lookup failed", e)
            }
            return NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
                .filter { it.isUp && !it.isLoopback }
                .sortedBy { if (it.name.startsWith("wlan") || it.name.startsWith("eth")) 0 else 1 }
                .flatMap { it.inetAddresses.toList() }
                .firstOrNull { it is Inet4Address && it.isSiteLocalAddress }
                ?.hostAddress
        }
    }
}

/** Playlist reads, with a short memo so the TV doesn't re-read right after the phone link check. */
class Playlists(private val youtube: YouTube) {
    private data class Memo(val listId: String, val at: Long, val entries: List<YouTube.PlaylistEntry>)

    @Volatile private var memo: Memo? = null

    fun read(listId: String, maxAgeMs: Long = 90_000): List<YouTube.PlaylistEntry> {
        memo?.let { if (it.listId == listId && System.currentTimeMillis() - it.at < maxAgeMs) return it.entries }
        val entries = youtube.playlist(listId)
        memo = Memo(listId, System.currentTimeMillis(), entries)
        return entries
    }
}

/** QR code as a crisp SVG data URL (scales to any projector size without blur). */
object Qr {
    fun svgDataUrl(text: String): String {
        val m = QRCodeWriter().encode(
            text, BarcodeFormat.QR_CODE, 0, 0,
            mapOf(EncodeHintType.MARGIN to 2, EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M),
        )
        val d = StringBuilder()
        for (y in 0 until m.height) for (x in 0 until m.width) if (m[x, y]) d.append("M$x ${y}h1v1h-1z")
        val svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${m.width} ${m.height}\" shape-rendering=\"crispEdges\">" +
            "<rect width=\"100%\" height=\"100%\" fill=\"#fff\"/><path fill=\"#000\" d=\"$d\"/></svg>"
        return "data:image/svg+xml;base64," + Base64.encodeToString(svg.toByteArray(), Base64.NO_WRAP)
    }
}

/** The phone pages. Plain HTML + inline CSS, no scripts; every value is escaped. */
object LinkPage {
    private fun esc(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
    private fun q(s: String) = java.net.URLEncoder.encode(s, "UTF-8")
    private fun mmss(sec: Long) = "%d:%02d".format(sec / 60, sec % 60)

    private fun page(title: String, body: String) = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{color-scheme:dark}
body{margin:0;font:17px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0f0d17;color:#f4f1fb}
main{max-width:34rem;margin:0 auto;padding:1.2rem 1rem 3rem}
h1{font-size:1.45rem;margin:.2rem 0 .8rem}
h2{font-size:1.2rem;margin:0 0 .5rem}
.card{background:#1a1726;border:2px solid #2b2640;border-radius:1rem;padding:1rem 1rem 1.1rem;margin:1rem 0}
.jump{display:flex;gap:.6rem;margin:.4rem 0 0}
.jump a{flex:1;text-align:center;padding:.75rem .5rem;border-radius:.7rem;background:#2b2640;color:#f4f1fb;text-decoration:none;font-weight:700}
label{display:block;font-weight:600;margin:.9rem 0 .35rem}
input[type=url],input[type=password],input[type=search]{box-sizing:border-box;width:100%;padding:.8rem;border-radius:.6rem;border:2px solid #3a3352;background:#0f0d17;color:inherit;font:inherit}
input:focus{outline:none;border-color:#ff5c8a}
.hint{color:#b9b2cc;font-size:.92rem;margin:.35rem 0 0}
.err{background:#3a1220;border:1px solid #ff5c8a;border-radius:.6rem;padding:.7rem .9rem;margin:1rem 0}
.ok{background:#0f2e28;border:1px solid #4be3c0;border-radius:.6rem;padding:.9rem 1rem;margin:1rem 0;font-size:1.05rem}
button,.btn{display:block;box-sizing:border-box;margin-top:1rem;width:100%;padding:.9rem;border:0;border-radius:.7rem;background:#ff5c8a;color:#1a0610;font:inherit;font-weight:700;text-align:center;text-decoration:none}
.btn2{background:#2b2640;color:#f4f1fb}
.row{display:flex;gap:.8rem;align-items:center}
.row img{width:64px;height:64px;border-radius:.5rem;flex:none;background:#2b2640;object-fit:cover}
.row .t{font-weight:700}.row .s{color:#b9b2cc;font-size:.9rem}
.hit{display:block;color:inherit;text-decoration:none;padding:.6rem;border-radius:.7rem;border:2px solid #2b2640;margin:.6rem 0}
.vid img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:.6rem;background:#2b2640}
.tag{display:inline-block;font-size:.8rem;font-weight:700;padding:.1rem .5rem;border-radius:1rem;background:#2b2640;color:#4be3c0}
.alt{border-top:1px solid #2b2640;padding-top:.8rem;margin-top:.8rem}
.alt button{margin-top:.5rem;padding:.6rem;background:#2b2640;color:#f4f1fb}
.list form{margin:0}.list button{width:auto;margin:0;padding:.45rem .8rem;background:#2b2640;color:#f4f1fb;font-size:.9rem}
.list .row{justify-content:space-between;border-bottom:1px solid #2b2640;padding:.55rem 0}
a{color:#4be3c0}
</style></head><body><main>$body</main></body></html>"""

    private fun searchForm(base: String, value: String = "") = """
<form method="get" action="$base/search" autocomplete="off">
<label for="q">Song name and artist</label>
<input id="q" name="q" type="search" required placeholder="e.g. Take On Me a-ha" value="${esc(value)}">
<button type="submit">Search</button>
</form>"""

    private fun backHome(base: String) = """<a class="btn btn2" href="$base">Back</a>"""

    fun home(
        base: String,
        playlist: String,
        linked: Boolean,
        linkError: String?,
        hasToken: Boolean,
        added: List<AddedSongsStore.Song>,
        notice: String?,
    ): String {
        val find = """<section class="card" id="song"><h2>Find a song</h2>
<p class="hint">Search for any song. The TV finds a good YouTube version of it and adds it to <b>My added songs</b>. Nothing to type on the TV.</p>
${searchForm(base)}</section>"""
        val link = """<section class="card" id="playlist"><h2>${if (linked) "Change your playlist" else "Link your playlist"}</h2>
${if (linkError != null) "<p class=\"err\" role=\"alert\">${esc(linkError)}</p>" else ""}
<form method="post" action="$base" autocomplete="off">
<label for="playlist">YouTube playlist link</label>
<input id="playlist" name="playlist" type="url" inputmode="url" required placeholder="https://www.youtube.com/playlist?list=…" value="${esc(playlist)}">
<p class="hint">On YouTube, open the playlist, tap Share, then Copy link, and paste it here. It must be Public or Unlisted.</p>
<label for="token">GitHub token (optional)</label>
<input id="token" name="token" type="password" autocapitalize="off" spellcheck="false" placeholder="${if (hasToken) "A token is saved. Leave blank to keep it." else "Leave blank if you don't use it"}">
<p class="hint">Only needed if you set up the DanceDance cloud job: it lets the TV ask GitHub to prepare beat maps for new songs. You can leave it blank.</p>
${if (hasToken) "<label class=\"check\"><input type=\"checkbox\" name=\"forget\" value=\"1\"> Forget the saved token</label>" else ""}
<button type="submit">Send to TV</button>
</form></section>"""
        val list = if (added.isEmpty()) "" else """<section class="card list" id="added"><h2>Songs you added (${added.size})</h2>
${added.joinToString("\n") { s ->
            """<div class="row"><div><div class="t">${esc(s.title)}</div><div class="s">${esc(s.artist)}</div></div>
<form method="post" action="$base/remove"><input type="hidden" name="v" value="${esc(s.videoId)}"><button type="submit">Remove</button></form></div>"""
        }}</section>"""
        // The job you most likely came for first: linking until a playlist is linked, then songs.
        val body = """<h1>DanceDance on your TV</h1>
<div class="jump"><a href="#playlist">Link your playlist</a><a href="#song">Find a song</a></div>
${if (notice != null) "<p class=\"ok\" role=\"status\">${esc(notice)}</p>" else ""}
${if (linkError == null && (linked || added.isNotEmpty())) find + link else link + find}
$list"""
        return page("DanceDance: your TV", body)
    }

    fun searchResults(base: String, query: String, hits: List<SongPicker.SongHit>, error: String?): String {
        val items = hits.joinToString("\n") { h ->
            val href = "$base/pick?a=${q(h.artist)}&t=${q(h.title)}&d=${h.durationSec}&art=${q(h.artworkUrl)}"
            """<a class="hit row" href="${esc(href)}">${if (h.artworkUrl.isNotEmpty()) "<img src=\"${esc(h.artworkUrl)}\" alt=\"\">" else "<img alt=\"\">"}
<div><div class="t">${esc(h.title)}</div><div class="s">${esc(h.artist)}</div><div class="s">${esc(listOf(h.album, h.year).filter { it.isNotBlank() }.joinToString(" · "))} · ${mmss(h.durationSec.toLong())}</div></div></a>"""
        }
        val body = """<h1>Find a song</h1>
${searchForm(base, query)}
${when {
            error != null -> "<p class=\"err\" role=\"alert\">${esc(error)}</p>"
            hits.isEmpty() -> "<p class=\"err\" role=\"alert\">No songs found. Try the song name and the artist, spelled out.</p>"
            else -> "<p class=\"hint\">Tap the right song. The TV then looks for it on YouTube (a few seconds).</p>$items"
        }}
${backHome(base)}"""
        return page("Find a song", body)
    }

    private fun tierText(t: SongPicker.Tier) = when (t) {
        SongPicker.Tier.OFFICIAL -> "Official lyric video or audio"
        SongPicker.Tier.LYRIC -> "Lyric video"
        SongPicker.Tier.TOPIC -> "Official audio track"
        SongPicker.Tier.MUSIC_VIDEO -> "Official music video (no lyric/audio version matched)"
    }

    private fun addForm(base: String, req: SongPicker.Request, r: SongPicker.Ranked, label: String) = """
<form method="post" action="$base/add">
<input type="hidden" name="v" value="${esc(r.entry.id)}"><input type="hidden" name="a" value="${esc(req.artist)}">
<input type="hidden" name="t" value="${esc(req.title)}"><input type="hidden" name="d" value="${req.durationSec}">
<input type="hidden" name="vt" value="${esc(r.entry.title)}"><input type="hidden" name="ch" value="${esc(r.entry.channel)}">
<input type="hidden" name="tier" value="${r.tier.label}">
<button type="submit">${esc(label)}</button></form>"""

    private fun videoLine(req: SongPicker.Request, r: SongPicker.Ranked): String {
        val d = r.entry.duration ?: 0
        val views = r.entry.views?.let { if (it >= 1_000_000) "%.1f M views".format(it / 1e6) else "${it / 1000} k views" } ?: ""
        return "${esc(r.entry.channel)} · ${mmss(d)} (song ${mmss(req.durationSec.toLong())})${if (views.isNotEmpty()) " · $views" else ""}"
    }

    fun pick(base: String, req: SongPicker.Request, art: String, ranked: List<SongPicker.Ranked>, already: Set<String>): String {
        val head = """<div class="row">${if (art.isNotEmpty()) "<img src=\"${esc(art)}\" alt=\"\">" else ""}
<div><div class="t">${esc(req.title)}</div><div class="s">${esc(req.artist)} · ${mmss(req.durationSec.toLong())}</div></div></div>"""
        if (ranked.isEmpty()) {
            return page("Find a song", """<h1>Find a song</h1>$head
<p class="err" role="alert">The TV couldn't find a YouTube video of this song it can trust (no lyric video, official audio or music video of the right length). Try another version of the song from the search results.</p>
${backHome(base)}""")
        }
        val best = ranked.first()
        val others = ranked.drop(1)
        val body = """<h1>Add this song?</h1>$head
<section class="card vid"><img src="https://i.ytimg.com/vi/${esc(best.entry.id)}/mqdefault.jpg" alt="">
<p><span class="tag">${esc(tierText(best.tier))}</span></p>
<div class="t">${esc(best.entry.title)}</div><div class="hint">${videoLine(req, best)}</div>
${if (best.entry.id in already) "<p class=\"hint\">Already on your TV.</p>" else ""}
${addForm(base, req, best, "Add to my TV")}
${if (others.isNotEmpty()) "<div class=\"alt\"><b>Or pick a different video</b>" + others.joinToString("\n") { r ->
            "<div style=\"margin-top:.8rem\"><div class=\"t\">${esc(r.entry.title)}</div><div class=\"hint\">${esc(tierText(r.tier))} · ${videoLine(req, r)}</div>${addForm(base, req, r, "Add this one instead")}</div>"
        } + "</div>" else ""}
</section>
${backHome(base)}"""
        return page("Add this song?", body)
    }

    fun added(base: String, song: AddedSongsStore.Song, isNew: Boolean) = page(
        "Added",
        """<h1>${if (isNew) "Added!" else "Already added"}</h1>
<p class="ok" role="status">“${esc(song.title)}” by ${esc(song.artist)} is in <b>My added songs</b> on your TV.</p>
<section class="card"><h2>Find another song</h2>${searchForm(base)}</section>
${backHome(base)}""",
    )

    fun message(base: String, title: String, text: String) = page(
        title,
        """<h1>${esc(title)}</h1><p class="err" role="alert">${esc(text)}</p>${backHome(base)}""",
    )

    fun done(base: String, count: Int, tokenChange: String) = page(
        "All set",
        """<h1>All set!</h1>
<p class="ok" role="status">Your TV is loading your playlist ($count songs).</p>
${when (tokenChange) {
            "saved" -> "<p class=\"hint\">GitHub token saved on the TV.</p>"
            "removed" -> "<p class=\"hint\">The saved GitHub token was removed from the TV.</p>"
            else -> ""
        }}
<section class="card"><h2>Find a song</h2><p class="hint">Want a song that isn't in the playlist? Search for it here.</p>${searchForm(base)}</section>""",
    )
}
