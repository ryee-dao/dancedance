package app.dancedance.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File

/** Synthetic containers only (no audio is stored in the repo). */
class AudioCheckTest {
    // --- WebM builders -------------------------------------------------------------------

    private fun id(v: Long): ByteArray {
        val n = when {
            v > 0xFFFFFF -> 4
            v > 0xFFFF -> 3
            v > 0xFF -> 2
            else -> 1
        }
        return ByteArray(n) { ((v shr (8 * (n - 1 - it))) and 0xff).toByte() }
    }

    /** 8-byte size vint (what muxers use for big elements). */
    private fun size8(n: Long) = ByteArray(8) { if (it == 0) 0x01 else ((n shr (8 * (7 - it))) and 0xff).toByte() }

    private fun el(idv: Long, body: ByteArray) = id(idv) + size8(body.size.toLong()) + body
    private fun uintEl(idv: Long, v: Long) = el(idv, ByteArray(4) { ((v shr (8 * (3 - it))) and 0xff).toByte() })

    private fun cluster(ts: Long, payload: Int) = el(0x1F43B675, uintEl(0xE7, ts) + el(0xA3, ByteArray(payload) { (it * 7).toByte() }))

    /** EBML header + Segment(Info, Tracks, Cues -> clusters, clusters). */
    private fun webm(clusters: Int = 5, payload: Int = 3000, brokenCue: Boolean = false): ByteArray {
        val info = el(0x1549A966, uintEl(0x2AD7B1, 1000000))
        val tracks = el(0x1654AE6B, el(0xAE, uintEl(0xD7, 1)))
        val cl = (0 until clusters).map { cluster(it * 10_000L, payload) }
        // Cues size is fixed (same element sizes whatever the positions), so compute positions after.
        fun cues(positions: List<Long>) = el(
            0x1C53BB6B,
            positions.mapIndexed { i, p -> el(0xBB, uintEl(0xB3, i * 10_000L) + el(0xB7, uintEl(0xF7, 1) + uintEl(0xF1, p))) }
                .fold(ByteArray(0)) { a, b -> a + b },
        )
        val head = info + tracks
        val cuesLen = cues(List(clusters) { 0L }).size
        val positions = ArrayList<Long>()
        var at = (head.size + cuesLen).toLong()
        for (c in cl) {
            positions.add(at)
            at += c.size
        }
        if (brokenCue) positions[2] = positions[2] + 3
        val body = head + cues(positions) + cl.fold(ByteArray(0)) { a, b -> a + b }
        val ebml = el(0x1A45DFA3, el(0x4282, "webm".toByteArray()))
        return ebml + el(0x18538067, body)
    }

    private fun webmResult(b: ByteArray) = AudioCheck.checkWebm(AudioCheck.Bytes(b))

    @Test fun wellFormedWebmPasses() {
        assertEquals(AudioCheck.Result.Ok, webmResult(webm()))
    }

    @Test fun truncatedWebmFails() {
        val b = webm()
        assertTrue(webmResult(b.copyOf(b.size - 500)) is AudioCheck.Result.Bad)
        assertTrue(webmResult(b.copyOf(b.size / 2)) is AudioCheck.Result.Bad)
    }

    @Test fun duplicatedOrMissingBytesFail() {
        val b = webm()
        val mid = b.size / 2
        val doubled = b.copyOfRange(0, mid) + b.copyOfRange(mid - 1000, mid) + b.copyOfRange(mid, b.size)
        assertTrue(webmResult(doubled) is AudioCheck.Result.Bad)
        val missing = b.copyOfRange(0, mid) + b.copyOfRange(mid + 1000, b.size)
        assertTrue(webmResult(missing) is AudioCheck.Result.Bad)
    }

    @Test fun splicedEncodeFails() {
        // Same length, but the second half comes from a file with different cluster sizes.
        val a = webm(payload = 3000)
        val other = webm(clusters = 9, payload = 2400)
        assertTrue(other.size >= a.size)
        val mid = a.size / 2
        val spliced = a.copyOfRange(0, mid) + other.copyOfRange(mid, mid + (a.size - mid))
        assertTrue(webmResult(spliced) is AudioCheck.Result.Bad)
    }

    @Test fun cueNotAtAClusterFails() {
        assertTrue(webmResult(webm(brokenCue = true)) is AudioCheck.Result.Bad)
    }

    @Test fun notWebmFails() {
        assertTrue(webmResult(ByteArray(100)) is AudioCheck.Result.Bad)
        assertTrue(webmResult(ByteArray(0)) is AudioCheck.Result.Bad)
    }

    // --- MP4 builders ----------------------------------------------------------------------

    private fun box(type: String, body: ByteArray): ByteArray {
        val n = body.size + 8
        return byteArrayOf((n shr 24).toByte(), (n shr 16).toByte(), (n shr 8).toByte(), n.toByte()) + type.toByteArray(Charsets.ISO_8859_1) + body
    }

    private fun u32(v: Long) = byteArrayOf((v shr 24).toByte(), (v shr 16).toByte(), (v shr 8).toByte(), v.toByte())

    private fun sidx(sizes: List<Int>, extra: Long = 0): ByteArray {
        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0, 0, 0, 0)) // version 0, flags
        out.write(u32(1)) // reference_ID
        out.write(u32(44100)) // timescale
        out.write(u32(0)) // earliest_presentation_time
        out.write(u32(0)) // first_offset
        out.write(byteArrayOf(0, 0, 0, sizes.size.toByte())) // reserved, reference_count
        for (s in sizes) {
            out.write(u32(s.toLong() + extra))
            out.write(u32(44100))
            out.write(u32(0x90000000L))
        }
        return box("sidx", out.toByteArray())
    }

    private fun m4a(fragments: Int = 4, badIndex: Boolean = false): ByteArray {
        val frags = (0 until fragments).map { box("moof", ByteArray(40)) + box("mdat", ByteArray(2000 + it)) }
        return box("ftyp", "dash".toByteArray() + ByteArray(4)) + box("moov", ByteArray(300)) +
            sidx(frags.map { it.size }, if (badIndex) 1 else 0) + frags.fold(ByteArray(0)) { a, b -> a + b }
    }

    private fun mp4Result(b: ByteArray) = AudioCheck.checkMp4(AudioCheck.Bytes(b))

    @Test fun wellFormedM4aPasses() {
        assertEquals(AudioCheck.Result.Ok, mp4Result(m4a()))
    }

    @Test fun damagedM4aFails() {
        val b = m4a()
        assertTrue(mp4Result(b.copyOf(b.size - 10)) is AudioCheck.Result.Bad)
        val mid = b.size / 2
        assertTrue(mp4Result(b.copyOfRange(0, mid) + b.copyOfRange(mid - 64, b.size)) is AudioCheck.Result.Bad)
        assertTrue(mp4Result(m4a(badIndex = true)) is AudioCheck.Result.Bad)
        assertTrue(mp4Result(ByteArray(64)) is AudioCheck.Result.Bad)
    }

    @Test fun checksFilesByExtension() {
        val dir = java.nio.file.Files.createTempDirectory("audiocheck").toFile()
        try {
            val w = File(dir, "abcdefghijk.webm").apply { writeBytes(webm()) }
            val m = File(dir, "abcdefghijk.m4a").apply { writeBytes(m4a()) }
            val part = File(dir, "abcdefghijk.webm.x1.part").apply { writeBytes(webm().copyOf(4000)) }
            assertEquals(AudioCheck.Result.Ok, AudioCheck.check(w))
            assertEquals(AudioCheck.Result.Ok, AudioCheck.check(m))
            assertTrue(AudioCheck.check(part, "webm") is AudioCheck.Result.Bad)
            assertTrue(AudioCheck.check(File(dir, "missing.webm")) is AudioCheck.Result.Bad)
        } finally {
            dir.deleteRecursively()
        }
    }
}
