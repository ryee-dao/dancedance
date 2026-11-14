package app.dancedance.tv

import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.Instant

class AddedSongsStoreTest {
    private fun withFile(body: (File) -> Unit) {
        val dir = java.nio.file.Files.createTempDirectory("added").toFile()
        try {
            body(File(dir, "added-songs.json"))
        } finally {
            dir.deleteRecursively()
        }
    }

    private fun song(id: String, artist: String = "Pooh Shiesty", title: String = "Back in Blood (feat. Lil Durk)", genre: String = "") =
        AddedSongsStore.Song(id, title, artist, "2026-11-01T10:00:00Z", 132, "Pooh Shiesty - Back In Blood (Lyrics)", "Lyrics Hub", "lyric", genre)

    // Exactly what an earlier app version wrote: no genre field.
    private val oldFormat = """[{"videoId":"AAAAAAAAAAA","title":"Back in Blood (feat. Lil Durk)","artist":"Pooh Shiesty",""" +
        """"addedAt":"2026-11-01T10:00:00Z","durationSec":132,"videoTitle":"Back In Blood","channel":"Lyrics Hub","tier":"lyric"},""" +
        """{"videoId":"BBBBBBBBBBB","title":"Take On Me","artist":"a-ha","addedAt":"2026-11-02T10:00:00Z","durationSec":225,""" +
        """"videoTitle":"a-ha - Take On Me (Official Video)","channel":"a-ha","tier":"music-video"}]"""

    @Test fun oldEntriesWithoutAGenreStillLoad() = withFile { f ->
        f.writeText(oldFormat)
        val songs = AddedSongsStore(f).list()
        assertEquals(listOf("AAAAAAAAAAA", "BBBBBBBBBBB"), songs.map { it.videoId })
        assertEquals(listOf("", ""), songs.map { it.genre })
        val json = AddedSongsStore(f).toJson()
        assertFalse(json.getJSONObject(0).has("genre"))
        assertEquals("music-video", json.getJSONObject(1).getString("note"))
    }

    @Test fun genreIsStoredAndSentToThePage() = withFile { f ->
        val store = AddedSongsStore(f)
        assertTrue(store.add(song("AAAAAAAAAAA", genre = "Hip-Hop/Rap")))
        val reread = AddedSongsStore(f)
        assertEquals("Hip-Hop/Rap", reread.list().single().genre)
        assertEquals("Hip-Hop/Rap", reread.toJson().getJSONObject(0).getString("genre"))
    }

    @Test fun aBadStoredGenreIsDropped() = withFile { f ->
        f.writeText(oldFormat.replaceFirst("\"tier\":\"lyric\"", "\"tier\":\"lyric\",\"genre\":42"))
        assertEquals("", AddedSongsStore(f).list()[0].genre)
    }

    @Test fun updateGenre() = withFile { f ->
        f.writeText(oldFormat)
        val store = AddedSongsStore(f)
        assertTrue(store.updateGenre("AAAAAAAAAAA", " Hip-Hop/Rap ", "2026-11-13T00:00:00Z"))
        // A miss is remembered for the backfill, but never shown to the page.
        assertTrue(store.updateGenre("BBBBBBBBBBB", null, "2026-11-13T00:00:00Z"))
        assertFalse(store.updateGenre("CCCCCCCCCCC", "Pop", "x")) // not there
        assertFalse(store.updateGenre("AAAAAAAAAAA", "Pop", "x")) // already has one
        val reread = AddedSongsStore(f).list()
        assertEquals("Hip-Hop/Rap", reread[0].genre)
        assertEquals("", reread[1].genre)
        assertEquals("2026-11-13T00:00:00Z", reread[1].genreTriedAt)
        assertFalse(AddedSongsStore(f).toJson().getJSONObject(1).has("genreTriedAt"))
        assertTrue(JSONArray(f.readText()).getJSONObject(1).has("genreTriedAt"))
    }

    // --- multi-source genres (bridge v7) ---------------------------------------------------------

    private val lookup = """{"genres":["hip hop","trap","drill"],"sources":{"wikipedia":{"status":"found","at":"2026-11-14T00:00:00Z",""" +
        """"genres":["Hip hop","drill","trap"],"ref":"Back in Blood"},"theaudiodb":{"status":"none","at":"2026-11-14T00:00:00Z",""" +
        """"reason":"no track"}},"complete":true,"at":"2026-11-14T00:00:00Z"}"""

    @Test fun oldEntriesHaveNoGenresAndSendNone() = withFile { f ->
        f.writeText(oldFormat)
        val songs = AddedSongsStore(f).list()
        assertEquals(listOf(emptyList<String>(), emptyList()), songs.map { it.genres })
        val json = AddedSongsStore(f).toJson().getJSONObject(0)
        assertFalse(json.has("genres"))
        assertFalse(json.has("genreLookup"))
    }

    @Test fun genresRoundTripAndReachThePage() = withFile { f ->
        f.writeText(oldFormat)
        val store = AddedSongsStore(f)
        assertTrue(store.updateGenres("AAAAAAAAAAA", lookup))
        val reread = AddedSongsStore(f)
        val s = reread.list()[0]
        assertEquals(listOf("hip hop", "trap", "drill"), s.genres)
        val page = reread.toJson().getJSONObject(0)
        assertEquals("trap", page.getJSONArray("genres").getString(1))
        assertEquals("Back in Blood", page.getJSONObject("genreLookup").getJSONObject("sources").getJSONObject("wikipedia").getString("ref"))
        // The other song is untouched.
        assertTrue(reread.list()[1].genres.isEmpty())
        // A later empty lookup (all sources failed) replaces it: the page retries those itself.
        assertTrue(store.updateGenres("AAAAAAAAAAA", """{"genres":[],"sources":{},"complete":false,"at":"x"}"""))
        assertTrue(AddedSongsStore(f).list()[0].genres.isEmpty())
        assertFalse(AddedSongsStore(f).toJson().getJSONObject(0).has("genres"))
        assertTrue(AddedSongsStore(f).toJson().getJSONObject(0).has("genreLookup"))
    }

    @Test fun badGenreInputIsRefusedOrCleaned() = withFile { f ->
        f.writeText(oldFormat)
        val store = AddedSongsStore(f)
        assertFalse(store.updateGenres("CCCCCCCCCCC", lookup)) // no such song
        assertFalse(store.updateGenres("AAAAAAAAAAA", "not json"))
        assertFalse(store.updateGenres("AAAAAAAAAAA", "{\"genres\":[\"" + "x".repeat(AddedSongsStore.MAX_LOOKUP_CHARS) + "\"]}"))
        val long = "y".repeat(61)
        assertTrue(store.updateGenres("AAAAAAAAAAA", """{"genres":[" pop ",42,"pop","","\u0001x","$long","rock","a","b","c","d","e","f","g"]}"""))
        assertEquals(listOf("pop", "rock", "a", "b", "c", "d", "e", "f"), AddedSongsStore(f).list()[0].genres)
        // A hand-edited file with bad genre fields still loads.
        f.writeText(oldFormat.replaceFirst("\"tier\":\"lyric\"", "\"tier\":\"lyric\",\"genres\":\"pop\",\"genreLookup\":3"))
        val s = AddedSongsStore(f).list()[0]
        assertTrue(s.genres.isEmpty())
        assertEquals("", s.genreLookup)
    }

    private val levelLookup = """{"genres":["hip hop","trap","drill"],"artistGenres":["rap"," Memphis rap "],"genreLevels":["song","album"," Artist "]}"""

    @Test fun artistGenresAndLevelsRoundTrip() = withFile { f ->
        f.writeText(oldFormat)
        assertTrue(AddedSongsStore(f).updateGenres("AAAAAAAAAAA", levelLookup))
        val reread = AddedSongsStore(f)
        val s = reread.list()[0]
        assertEquals(listOf("rap", "Memphis rap"), s.artistGenres)
        assertEquals(listOf("song", "album", "artist"), s.genreLevels)
        val page = reread.toJson().getJSONObject(0)
        assertEquals("Memphis rap", page.getJSONArray("artistGenres").getString(1))
        assertEquals("album", page.getJSONArray("genreLevels").getString(1))
    }

    @Test fun oldLookupsAndFilesHaveNoArtistGenresOrLevels() = withFile { f ->
        f.writeText(oldFormat)
        assertTrue(AddedSongsStore(f).list().all { it.artistGenres.isEmpty() && it.genreLevels.isEmpty() })
        assertTrue(AddedSongsStore(f).updateGenres("AAAAAAAAAAA", lookup))
        val reread = AddedSongsStore(f)
        assertTrue(reread.list()[0].artistGenres.isEmpty())
        assertTrue(reread.list()[0].genreLevels.isEmpty())
        val page = reread.toJson().getJSONObject(0)
        assertFalse(page.has("artistGenres"))
        assertFalse(page.has("genreLevels"))
    }

    @Test fun mismatchedOrInvalidLevelsAreDroppedButGenresStay() = withFile { f ->
        f.writeText(oldFormat)
        val store = AddedSongsStore(f)
        assertTrue(store.updateGenres("AAAAAAAAAAA", """{"genres":["hip hop","trap"],"genreLevels":["song"]}"""))
        assertEquals(listOf("hip hop", "trap"), AddedSongsStore(f).list()[0].genres)
        assertTrue(AddedSongsStore(f).list()[0].genreLevels.isEmpty())
        assertTrue(store.updateGenres("AAAAAAAAAAA", """{"genres":["hip hop","trap"],"genreLevels":["song","track"]}"""))
        assertEquals(listOf("hip hop", "trap"), AddedSongsStore(f).list()[0].genres)
        assertTrue(AddedSongsStore(f).list()[0].genreLevels.isEmpty())
        assertFalse(AddedSongsStore(f).toJson().getJSONObject(0).has("genreLevels"))
    }

    @Test fun theItunesBackfillKeepsMultiSourceGenres() = withFile { f ->
        f.writeText(oldFormat)
        val store = AddedSongsStore(f)
        assertTrue(store.updateGenres("AAAAAAAAAAA", lookup))
        assertTrue(store.updateGenre("AAAAAAAAAAA", "Hip-Hop/Rap", "2026-11-13T00:00:00Z"))
        val s = AddedSongsStore(f).list()[0]
        assertEquals("Hip-Hop/Rap", s.genre)
        assertEquals(listOf("hip hop", "trap", "drill"), s.genres)
    }

    // --- backfill -----------------------------------------------------------------------------

    private val hits = SongPicker.parseItunes(ItunesFixtures.backInBlood)

    @Test fun backfillFindsSavesAndTellsThePage() = withFile { f ->
        f.writeText(oldFormat)
        val store = AddedSongsStore(f)
        val terms = mutableListOf<String>()
        var changed = 0
        val now = Instant.parse("2026-11-13T00:00:00Z")
        val b = GenreBackfill(store, { t -> synchronized(terms) { terms += t }; if (t.startsWith("Pooh")) hits else emptyList() }, { changed++ }, { now })
        assertEquals(1, runBlocking { b.run() })
        assertEquals(1, changed)
        // Only the search text goes out.
        assertEquals(setOf("Pooh Shiesty Back in Blood (feat. Lil Durk)", "a-ha Take On Me"), terms.toSet())
        val songs = AddedSongsStore(f).list()
        assertEquals("Hip-Hop/Rap", songs[0].genre)
        assertEquals(now.toString(), songs[1].genreTriedAt)

        // Next start: the found one is done, the miss isn't asked again for a while.
        terms.clear()
        assertEquals(0, runBlocking { b.run() })
        assertTrue(terms.isEmpty())
        val later = GenreBackfill(store, { t -> terms += t; emptyList() }, {}, { now.plusMillis(GenreBackfill.RETRY_MISS_MS) })
        runBlocking { later.run() }
        assertEquals(listOf("a-ha Take On Me"), terms)
    }

    @Test fun backfillToleratesFailures() = withFile { f ->
        val store = AddedSongsStore(f)
        (0 until 8).forEach { store.add(song("SONG%07d".format(it), title = "Song $it")) }
        val calls = java.util.concurrent.atomic.AtomicInteger()
        var changed = 0
        val offline = GenreBackfill(store, { calls.incrementAndGet(); throw java.io.IOException("offline") }, { changed++ })
        assertEquals(0, runBlocking { offline.run() })
        assertEquals(0, changed)
        // Gives up after a few failures in a row instead of trying every song.
        assertTrue("calls=$calls", calls.get() in GenreBackfill.MAX_FAILURES..GenreBackfill.MAX_FAILURES + 1)
        // Nothing was marked: all are tried again next time.
        assertEquals(8, offline.due().size)
        // A failure between successes doesn't stop the run.
        val n = java.util.concurrent.atomic.AtomicInteger()
        val flaky = GenreBackfill(store, { t ->
            if (n.getAndIncrement() == 1) throw java.io.IOException("blip")
            hits.map { it.copy(title = t.removePrefix("Pooh Shiesty ")) }
        }, { changed++ })
        assertEquals(7, runBlocking { flaky.run() })
        assertEquals(1, changed)
        assertEquals(1, flaky.due().size)
    }
}
