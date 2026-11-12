package app.dancedance.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AudioCacheTest {
    private fun withCache(cap: Long, body: (AudioCache, File) -> Unit) {
        val dir = java.nio.file.Files.createTempDirectory("audiocache").toFile()
        try {
            body(AudioCache(dir, cap), dir)
        } finally {
            dir.deleteRecursively()
        }
    }

    private fun put(dir: File, name: String, bytes: Int, age: Long): File =
        File(dir, name).apply {
            writeBytes(ByteArray(bytes))
            setLastModified(System.currentTimeMillis() - age)
        }

    @Test fun evictionSkipsTheSongInUse() = withCache(2500) { cache, dir ->
        val playing = put(dir, "aaaaaaaaaaa.webm", 1000, age = 60_000) // oldest, but playing
        val old = put(dir, "bbbbbbbbbbb.webm", 1000, age = 50_000)
        val fresh = put(dir, "ccccccccccc.webm", 1000, age = 0)
        cache.markInUse(playing)
        cache.evict(keep = setOf(fresh))
        assertTrue(playing.exists())
        assertFalse(old.exists())
        assertTrue(fresh.exists())
    }

    @Test fun onlyTheLastFewStayProtected() = withCache(0) { cache, dir ->
        val files = (0 until AudioCache.IN_USE_KEEP + 2).map { put(dir, "song$it".padEnd(11, 'x') + ".m4a", 10, age = 1000L * (10 - it)) }
        files.forEach { cache.markInUse(it) }
        cache.evict(keep = emptySet())
        assertFalse(files[0].exists())
        assertTrue(files.last().exists())
    }

    @Test fun dropRemovesEveryFormatOfThatSongOnly() = withCache(1_000_000) { cache, dir ->
        val a = put(dir, "aaaaaaaaaaa.webm", 10, 0)
        val b = put(dir, "aaaaaaaaaaa.m4a", 10, 0)
        val other = put(dir, "bbbbbbbbbbb.webm", 10, 0)
        assertEquals(2, cache.drop("aaaaaaaaaaa"))
        assertFalse(a.exists())
        assertFalse(b.exists())
        assertTrue(other.exists())
    }

    @Test fun partFilesAreUniquePerDownloadAndClearedOnStart() = withCache(1_000_000) { cache, dir ->
        val p1 = cache.partFile("aaaaaaaaaaa", "webm")
        Thread.sleep(1)
        val p2 = cache.partFile("aaaaaaaaaaa", "webm")
        assertNotEquals(p1.name, p2.name)
        assertTrue(p1.name.endsWith(".part"))
        p1.writeBytes(ByteArray(3))
        AudioCache(dir, 1_000_000) // a restart clears leftovers
        assertFalse(p1.exists())
        assertTrue(cache.files().isEmpty())
    }
}
