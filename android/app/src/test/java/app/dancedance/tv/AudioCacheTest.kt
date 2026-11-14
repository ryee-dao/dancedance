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

    // --- old (pre-index, highest-bitrate) downloads -------------------------------------------

    @Test fun sweepClearsOldFilesAndKeepsNewOnes() = withCache(1_000_000) { cache, dir ->
        val old1 = put(dir, "aaaaaaaaaaa.webm", 3000, 0) // from before this version: no record
        val old2 = put(dir, "bbbbbbbbbbb.m4a", 2000, 0)
        val fresh = put(dir, "ccccccccccc.webm", 1500, 0)
        cache.record(fresh, 250, 69_000)
        assertFalse(cache.isCurrent(old1))
        assertTrue(cache.isCurrent(fresh))
        assertEquals(AudioCache.Stream(250, 69, 1500), cache.streamOf(fresh))

        val s = cache.sweepOld(now = 42)
        assertEquals(2, s.filesRemoved)
        assertEquals(5000L, s.bytesFreed)
        assertFalse(old1.exists())
        assertFalse(old2.exists())
        assertTrue(fresh.exists())
        assertEquals(s, cache.lastSweep)

        // Next launch: the record survived, nothing more to do, and the result is still reported.
        val again = AudioCache(dir, 1_000_000)
        assertTrue(again.isCurrent(fresh))
        assertEquals(0, again.sweepOld().filesRemoved)
        assertTrue(fresh.exists())
        assertEquals(AudioCache.Sweep(2, 5000, 42), again.lastSweep)
        // The index is not a song: not counted, not served.
        assertEquals(listOf(fresh.name), again.files().map { it.name })
        assertEquals(null, again.byName(AudioCache.INDEX_NAME))
    }

    @Test fun aFileRewrittenWithoutTheIndexCountsAsOld() = withCache(1_000_000) { cache, dir ->
        // E.g. an older app version (after a downgrade) re-downloaded it at the old bitrate.
        val f = put(dir, "aaaaaaaaaaa.webm", 1000, 0)
        cache.record(f, 250, 69_000)
        f.writeBytes(ByteArray(2000))
        assertFalse(cache.isCurrent(f))
        assertEquals(1, AudioCache(dir, 1_000_000).sweepOld().filesRemoved)
        assertFalse(f.exists())
    }

    @Test fun anInterruptedSweepFinishesOnTheNextLaunch() = withCache(1_000_000) { cache, dir ->
        val fresh = put(dir, "ccccccccccc.webm", 100, 0)
        cache.record(fresh, 250, 69_000)
        val recordedThenLost = put(dir, "ddddddddddd.webm", 100, 0)
        cache.record(recordedThenLost, 250, 69_000)
        // State after a kill mid-way: one old file already deleted, another still there, a record
        // whose file is gone (evicted / deleted before the index was saved), a half-written index
        // and a download's .part file.
        val leftover = put(dir, "bbbbbbbbbbb.webm", 700, 0)
        recordedThenLost.delete()
        File(dir, "${AudioCache.INDEX_NAME}.tmp").writeText("{\"fil")
        val part = File(dir, "eeeeeeeeeee.webm.x1.part").apply { writeBytes(ByteArray(5)) }
        // A download renamed into place but killed before its record was written: also old.
        val unrecordedNew = put(dir, "fffffffffff.webm", 300, 0)

        val next = AudioCache(dir, 1_000_000)
        assertFalse(part.exists())
        assertFalse(File(dir, "${AudioCache.INDEX_NAME}.tmp").exists())
        val s = next.sweepOld()
        assertEquals(2, s.filesRemoved)
        assertEquals(1000L, s.bytesFreed)
        assertFalse(leftover.exists())
        assertFalse(unrecordedNew.exists())
        assertTrue(fresh.exists())
        // The stale record went too: a new file of that name later must be recorded afresh.
        val reused = put(dir, "ddddddddddd.webm", 100, 0)
        assertFalse(AudioCache(dir, 1_000_000).isCurrent(reused))
    }

    @Test fun sweepNeverTouchesAFileInUse() = withCache(1_000_000) { cache, dir ->
        val playing = put(dir, "aaaaaaaaaaa.webm", 1000, 0)
        cache.markInUse(playing)
        assertEquals(0, cache.sweepOld().filesRemoved)
        assertTrue(playing.exists())
        assertTrue(cache.isInUse(playing))
    }

    @Test fun anUnreadableIndexMeansEverythingIsOld() = withCache(1_000_000) { _, dir ->
        val f = put(dir, "aaaaaaaaaaa.webm", 1000, 0)
        File(dir, AudioCache.INDEX_NAME).writeText("not json")
        val c = AudioCache(dir, 1_000_000)
        assertFalse(c.isCurrent(f))
        assertEquals(1, c.sweepOld().filesRemoved)
    }

    @Test fun dropEvictAndDeleteForgetTheRecord() = withCache(1500) { cache, dir ->
        val a = put(dir, "aaaaaaaaaaa.webm", 1000, age = 50_000).also { cache.record(it, 250, 69_000) }
        val b = put(dir, "bbbbbbbbbbb.webm", 1000, age = 0).also { cache.record(it, 250, 69_000) }
        cache.evict(keep = setOf(b))
        assertFalse(a.exists())
        put(dir, "aaaaaaaaaaa.webm", 1000, 0)
        assertFalse(cache.isCurrent(a)) // not the recorded download any more
        assertEquals(1, cache.drop("bbbbbbbbbbb"))
        put(dir, "bbbbbbbbbbb.webm", 1000, 0)
        assertFalse(cache.isCurrent(b))
        val c = put(dir, "ccccccccccc.webm", 10, 0).also { cache.record(it, 250, 69_000) }
        assertTrue(cache.delete(c))
        assertFalse(c.exists())
        assertFalse(AudioCache(dir, 1_000_000).isCurrent(put(dir, "ccccccccccc.webm", 10, 0)))
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
