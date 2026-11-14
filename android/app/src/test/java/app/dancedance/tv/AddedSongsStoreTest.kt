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
