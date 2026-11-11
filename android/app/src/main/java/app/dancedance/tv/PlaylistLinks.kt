package app.dancedance.tv

import android.net.Uri

/**
 * Kotlin port of parsePlaylistLink() in src/player/playlistReader.ts: same rules, same messages,
 * so the phone page and the web app agree on what a valid playlist link is.
 */
object PlaylistLinks {
    sealed class Parsed {
        data class Ok(val listId: String) : Parsed()
        data class Error(val message: String) : Parsed()
    }

    private val PRIVATE_LISTS = setOf("WL", "LL", "LM")
    const val PRIVATE_LIST_MESSAGE =
        "Watch Later and Liked videos are private, so DanceDance can't read them. " +
            "Make a playlist, set it to Public or Unlisted, and paste its link."
    private val YT_HOSTS = setOf(
        "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
        "youtu.be", "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com",
    )
    private val ID_RE = Regex("^[A-Za-z0-9_-]+$")
    private val SCHEME_RE = Regex("^[a-z][a-z0-9+.-]*://", RegexOption.IGNORE_CASE)

    fun parse(input: String): Parsed {
        val text = input.trim()
        if (text.isEmpty()) return Parsed.Error("Paste a YouTube playlist link first.")

        if (ID_RE.matches(text)) {
            if (text.uppercase() in PRIVATE_LISTS) return Parsed.Error(PRIVATE_LIST_MESSAGE)
            if (text.length == 11) {
                return Parsed.Error("That looks like a single video, not a playlist. Open the playlist and copy its link.")
            }
            if (text.length < 12) return Parsed.Error("That doesn't look like a playlist ID.")
            return Parsed.Ok(text)
        }

        val uri = runCatching { Uri.parse(if (SCHEME_RE.containsMatchIn(text)) text else "https://$text") }.getOrNull()
        val host = uri?.host?.lowercase()
        if (uri == null || host.isNullOrEmpty() || text.any { it.isWhitespace() }) {
            return Parsed.Error("That doesn't look like a YouTube playlist link.")
        }
        if (host !in YT_HOSTS) {
            return Parsed.Error("That isn't a YouTube link. Copy the link from YouTube's Share button.")
        }
        val list = runCatching { uri.getQueryParameter("list") }.getOrNull()
        if (list.isNullOrEmpty()) {
            val v = runCatching { uri.getQueryParameter("v") }.getOrNull()
            if (!v.isNullOrEmpty() || host.endsWith("youtu.be")) {
                return Parsed.Error("That link is a single video, not a playlist. Open the playlist and copy its link.")
            }
            return Parsed.Error("That link doesn't contain a playlist.")
        }
        if (list.uppercase() in PRIVATE_LISTS) return Parsed.Error(PRIVATE_LIST_MESSAGE)
        if (!ID_RE.matches(list)) return Parsed.Error("That link's playlist ID looks wrong.")
        return Parsed.Ok(list)
    }
}
