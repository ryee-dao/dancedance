package app.dancedance.tv

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File
import java.io.InputStream

class AudioServerTest {
    private val bytes = ByteArray(10_000) { (it * 31 + 7).toByte() }

    private fun withFile(body: (File) -> Unit) {
        val f = File.createTempFile("aaaaaaaaaaa", ".webm")
        try {
            f.writeBytes(bytes)
            body(f)
        } finally {
            f.delete()
        }
    }

    private fun InputStream.drain(): ByteArray = readBytes()

    /**
     * What the WebView does with an intercepted response to a Range request (Chromium's
     * InputStreamReader): resource size = available(), range checked against it, skip() to the
     * range start (skip may come back short), then read to the end.
     */
    private fun webViewRead(s: InputStream, first: Long, last: Long?): ByteArray? {
        val size = s.available().toLong()
        val end = last ?: (size - 1)
        if (first < 0 || first > end || end >= size) return null // ERR_REQUEST_RANGE_NOT_SATISFIABLE
        var skipped = 0L
        while (skipped < first) {
            val k = s.skip(minOf(4096L, first - skipped))
            if (k <= 0) return null
            skipped += k
        }
        return s.drain()
    }

    @Test fun webViewStyleRangeReadsGetTheRightBytes() = withFile { f ->
        for ((a, b) in listOf(0L to 99L, 100L to 199L, 3000L to 9999L, 9990L to 9999L)) {
            val s = AudioServer.RangeStream(f, a, b)
            assertArrayEquals("bytes=$a-$b", bytes.copyOfRange(a.toInt(), b.toInt() + 1), webViewRead(s, a, b))
        }
    }

    @Test fun openEndedAndSuffixRanges() = withFile { f ->
        val (a, b) = AudioServer.parseRange("bytes=7000-", bytes.size.toLong())!!
        assertArrayEquals(bytes.copyOfRange(7000, bytes.size), webViewRead(AudioServer.RangeStream(f, a, b), a, null))
        val (c, d) = AudioServer.parseRange("bytes=-500", bytes.size.toLong())!!
        assertEquals(9500L, c)
        assertArrayEquals(bytes.copyOfRange(9500, bytes.size), webViewRead(AudioServer.RangeStream(f, c, d), c, d))
    }

    @Test fun aStreamThatIsNotSkippedStartsAtTheRangeStart() = withFile { f ->
        assertArrayEquals(bytes.copyOfRange(4000, 5000), AudioServer.RangeStream(f, 4000, 4999).drain())
    }

    @Test fun theOldPositionedStreamFailsTheWebViewCheck() = withFile { f ->
        // Regression guard for the bug: a body positioned at the range start reports only the
        // range's bytes as available, so the WebView rejects any range not starting at 0.
        val positioned = f.inputStream().apply { channel.position(3000) }
        positioned.use { assertNull(webViewRead(it, 3000, 9999)) }
    }

    @Test fun parseRangeRejectsJunk() {
        assertNull(AudioServer.parseRange("bytes=5-2", 100))
        assertNull(AudioServer.parseRange("bytes=100-", 100))
        assertNull(AudioServer.parseRange("items=0-1", 100))
        assertEquals(0L to 99L, AudioServer.parseRange("bytes=0-500", 100))
    }
}
