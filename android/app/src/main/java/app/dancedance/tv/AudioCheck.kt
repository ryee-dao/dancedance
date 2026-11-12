package app.dancedance.tv

import java.io.File
import java.io.RandomAccessFile

/**
 * Cheap structural check of a downloaded song before it is used: the container's own sizes
 * must account for every byte of the file, exactly. Wrong, missing or doubled bytes anywhere
 * (a short chunk, a chunk written twice, two different encodes spliced together after a
 * stream-URL refresh, a truncated or half-written file) break that chain, and such a file plays
 * up to the bad spot and then skips, goes silent or stalls in the WebView.
 *
 * WebM: EBML header, then a Segment whose size ends at the end of the file; its children
 * (SeekHead, Info, Tracks, Cues, Cluster, ...) must chain to exactly that end, every Cluster
 * must start with its Timestamp, cluster timestamps must not go backwards, and every Cues
 * entry must point at a Cluster. M4A/MP4: the top-level boxes (ftyp, moov, sidx, moof, mdat,
 * ...) must chain to the end of the file, with a moov, and a sidx (YouTube's DASH files have
 * one) must account for the bytes after it.
 *
 * Reads only element headers (a few hundred small reads): milliseconds, so it also runs on
 * every cache hit, which catches files broken by older app versions. Pure JVM, no Android.
 */
object AudioCheck {
    sealed class Result {
        object Ok : Result()
        data class Bad(val reason: String) : Result()
    }

    /** [ext]: "webm" or "m4a" (the cache file's extension; a ".part" file passes it explicitly). */
    fun check(f: File, ext: String = f.extension): Result = try {
        RandomAccessFile(f, "r").use { raf ->
            val src = object : Source {
                override val length = raf.length()
                override fun read(pos: Long, buf: ByteArray, n: Int): Int {
                    raf.seek(pos)
                    var got = 0
                    while (got < n) {
                        val r = raf.read(buf, got, n - got)
                        if (r < 0) break
                        got += r
                    }
                    return got
                }
            }
            if (ext == "webm") checkWebm(src) else checkMp4(src)
        }
    } catch (e: Exception) {
        Result.Bad("unreadable (${e.message})")
    }

    /** Random-access bytes (a file, or an array in tests). */
    interface Source {
        val length: Long
        /** Reads up to n bytes at pos into buf; returns how many (fewer only at the end). */
        fun read(pos: Long, buf: ByteArray, n: Int): Int
    }

    class Bytes(private val b: ByteArray) : Source {
        override val length = b.size.toLong()
        override fun read(pos: Long, buf: ByteArray, n: Int): Int {
            if (pos >= b.size) return 0
            val k = minOf(n.toLong(), b.size - pos).toInt()
            System.arraycopy(b, pos.toInt(), buf, 0, k)
            return k
        }
    }

    private class Bad(msg: String) : Exception(msg)

    // --- WebM / Matroska --------------------------------------------------------------------

    private const val EBML = 0x1A45DFA3L
    private const val SEGMENT = 0x18538067L
    private const val CLUSTER = 0x1F43B675L
    private const val CUES = 0x1C53BB6BL
    private const val TIMESTAMP = 0xE7L
    private const val CUE_POINT = 0xBBL
    private const val CUE_TRACK_POSITIONS = 0xB7L
    private const val CUE_CLUSTER_POSITION = 0xF1L
    private val LEVEL1 = setOf(
        0x114D9B74L, // SeekHead
        0x1549A966L, // Info
        0x1654AE6BL, // Tracks
        CUES,
        CLUSTER,
        0x1254C367L, // Tags
        0x1043A770L, // Chapters
        0x1941A469L, // Attachments
        0xECL, // Void
        0xBFL, // CRC-32
    )
    private const val UNKNOWN = -1L

    private class Header(val id: Long, val size: Long, val headerLen: Int)

    /** Element header at pos: ID (marker kept) and size (UNKNOWN for the all-ones size). */
    private fun header(s: Source, pos: Long): Header {
        val b = ByteArray(12)
        val n = s.read(pos, b, 12)
        if (n < 2) throw Bad("element header past the end at $pos")
        val idLen = vintLen(b[0])
        if (idLen !in 1..4 || idLen >= n) throw Bad("bad element ID at $pos")
        var id = 0L
        for (i in 0 until idLen) id = (id shl 8) or (b[i].toLong() and 0xff)
        val sizeLen = vintLen(b[idLen])
        if (sizeLen !in 1..8 || idLen + sizeLen > n) throw Bad("bad element size at $pos")
        var size = (b[idLen].toLong() and 0xff) and ((1L shl (8 - sizeLen)) - 1)
        var allOnes = size == (1L shl (8 - sizeLen)) - 1
        for (i in 1 until sizeLen) {
            val v = b[idLen + i].toLong() and 0xff
            if (v != 0xffL) allOnes = false
            size = (size shl 8) or v
        }
        return Header(id, if (allOnes) UNKNOWN else size, idLen + sizeLen)
    }

    private fun vintLen(first: Byte): Int {
        val x = first.toInt() and 0xff
        if (x == 0) return 0
        var len = 1
        var m = 0x80
        while (x and m == 0) {
            len++
            m = m shr 1
        }
        return len
    }

    private fun uint(s: Source, pos: Long, len: Long): Long {
        if (len !in 1..8) throw Bad("bad integer at $pos")
        val b = ByteArray(len.toInt())
        if (s.read(pos, b, b.size) < b.size) throw Bad("integer past the end at $pos")
        var v = 0L
        for (x in b) v = (v shl 8) or (x.toLong() and 0xff)
        return v
    }

    fun checkWebm(s: Source): Result = try {
        val len = s.length
        val e = header(s, 0)
        if (e.id != EBML || e.size == UNKNOWN) throw Bad("not a WebM file")
        val segPos = e.headerLen + e.size
        val seg = header(s, segPos)
        if (seg.id != SEGMENT) throw Bad("no Segment after the EBML header")
        val dataStart = segPos + seg.headerLen
        if (seg.size != UNKNOWN && dataStart + seg.size != len) {
            throw Bad("Segment ends at ${dataStart + seg.size}, file has $len bytes")
        }
        val end = if (seg.size == UNKNOWN) len else dataStart + seg.size
        var p = dataStart
        val clusters = HashSet<Long>()
        var cuesAt = -1L
        var cuesSize = 0L
        var lastTs = -1L
        while (p < end) {
            val h = header(s, p)
            if (h.id !in LEVEL1) throw Bad("unexpected element ${java.lang.Long.toHexString(h.id)} at $p")
            if (h.size == UNKNOWN) {
                // Live-style stream (unknown sizes): can't be walked; YouTube's files never are.
                if (h.id == CLUSTER && clusters.isNotEmpty()) return Result.Ok
                throw Bad("unknown-size element at $p")
            }
            val body = p + h.headerLen
            if (body + h.size > end) throw Bad("element at $p runs past the end (${body + h.size} > $end)")
            if (h.id == CLUSTER) {
                val t = header(s, body)
                if (t.id != TIMESTAMP || t.size == UNKNOWN) throw Bad("cluster at $p has no timestamp")
                val ts = uint(s, body + t.headerLen, t.size)
                if (ts < lastTs) throw Bad("cluster timestamps go backwards at $p")
                lastTs = ts
                clusters.add(p - dataStart)
            } else if (h.id == CUES) {
                cuesAt = body
                cuesSize = h.size
            }
            p = body + h.size
        }
        if (p != end) throw Bad("elements end at $p, not $end")
        if (clusters.isEmpty()) throw Bad("no audio clusters")
        if (cuesAt >= 0) checkCues(s, cuesAt, cuesSize, clusters)
        Result.Ok
    } catch (b: Bad) {
        Result.Bad(b.message ?: "damaged")
    }

    private fun checkCues(s: Source, start: Long, size: Long, clusters: Set<Long>) {
        var p = start
        val end = start + size
        while (p < end) {
            val cp = header(s, p)
            if (cp.size == UNKNOWN) throw Bad("bad Cues")
            val body = p + cp.headerLen
            if (cp.id == CUE_POINT) {
                var q = body
                while (q < body + cp.size) {
                    val c = header(s, q)
                    if (c.size == UNKNOWN) throw Bad("bad CuePoint")
                    val cb = q + c.headerLen
                    if (c.id == CUE_TRACK_POSITIONS) {
                        var r = cb
                        while (r < cb + c.size) {
                            val x = header(s, r)
                            if (x.size == UNKNOWN) throw Bad("bad CueTrackPositions")
                            if (x.id == CUE_CLUSTER_POSITION) {
                                val pos = uint(s, r + x.headerLen, x.size)
                                if (pos !in clusters) throw Bad("a cue points at $pos, which is not a cluster")
                            }
                            r += x.headerLen + x.size
                        }
                    }
                    q = cb + c.size
                }
            }
            p = body + cp.size
        }
    }

    // --- MP4 / M4A ---------------------------------------------------------------------------

    private val BOXES = setOf("ftyp", "styp", "moov", "sidx", "moof", "mdat", "free", "skip", "emsg", "mfra", "uuid", "prft", "meta", "pdin", "wide")

    fun checkMp4(s: Source): Result = try {
        val len = s.length
        var p = 0L
        var first = true
        var hasMoov = false
        var sidxEnd = -1L
        var sidxSpan = -1L
        var mdats = 0
        val b = ByteArray(16)
        while (p < len) {
            if (s.read(p, b, 8) < 8) throw Bad("box header past the end at $p")
            var size = u32(b, 0)
            val type = String(b, 4, 4, Charsets.ISO_8859_1)
            var header = 8
            if (size == 1L) {
                if (s.read(p + 8, b, 8) < 8) throw Bad("box header past the end at $p")
                size = (u32(b, 0) shl 32) or u32(b, 4)
                header = 16
            } else if (size == 0L) {
                size = len - p
            }
            if (type !in BOXES) throw Bad("unexpected box '$type' at $p")
            if (first && type != "ftyp" && type != "styp") throw Bad("not an MP4 file")
            first = false
            if (size < header || p + size > len) throw Bad("box '$type' at $p runs past the end (${p + size} > $len)")
            when (type) {
                "moov" -> hasMoov = true
                "mdat" -> mdats++
                "sidx" -> if (sidxSpan < 0) {
                    sidxEnd = p + size
                    sidxSpan = sidxSpan(s, p + header, p + size)
                }
            }
            p += size
        }
        if (p != len) throw Bad("boxes end at $p, not $len")
        if (!hasMoov) throw Bad("no moov box")
        if (mdats == 0) throw Bad("no audio data")
        if (sidxSpan >= 0 && sidxEnd + sidxSpan != len) {
            throw Bad("the index covers ${sidxEnd + sidxSpan} bytes, file has $len")
        }
        Result.Ok
    } catch (b: Bad) {
        Result.Bad(b.message ?: "damaged")
    }

    /** first_offset + the referenced sizes of a sidx box (its body from..to). */
    private fun sidxSpan(s: Source, from: Long, to: Long): Long {
        val n = (to - from).coerceAtMost(64L * 1024 * 1024).toInt()
        if (n < 24) throw Bad("short sidx")
        val b = ByteArray(n)
        if (s.read(from, b, n) < n) throw Bad("short sidx")
        val v1 = b[0].toInt() == 1
        var q = 4 + 8 // version/flags, reference_ID, timescale
        val firstOffset: Long
        if (v1) {
            q += 8
            firstOffset = (u32(b, q) shl 32) or u32(b, q + 4)
            q += 8
        } else {
            q += 4
            firstOffset = u32(b, q)
            q += 4
        }
        q += 2 // reserved
        val count = ((b[q].toInt() and 0xff) shl 8) or (b[q + 1].toInt() and 0xff)
        q += 2
        var total = firstOffset
        for (i in 0 until count) {
            if (q + 12 > n) throw Bad("short sidx")
            total += u32(b, q) and 0x7fffffff
            q += 12
        }
        return total
    }

    private fun u32(b: ByteArray, at: Int): Long = ((b[at].toLong() and 0xff) shl 24) or ((b[at + 1].toLong() and 0xff) shl 16) or
        ((b[at + 2].toLong() and 0xff) shl 8) or (b[at + 3].toLong() and 0xff)
}
