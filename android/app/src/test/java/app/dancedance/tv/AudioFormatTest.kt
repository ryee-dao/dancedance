package app.dancedance.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AudioFormatTest {
    private fun c(index: Int, itag: Int, ext: String, kbps: Int, original: Boolean = true) =
        AudioPick.Candidate(index, itag, ext, kbps * 1000, original)

    // What YouTube offers for a typical music video.
    private val typical = listOf(
        c(0, 139, "m4a", 48), c(1, 140, "m4a", 129), c(2, 249, "webm", 53), c(3, 250, "webm", 69), c(4, 251, "webm", 135),
    )

    @Test fun prefersOpusByDefault() {
        assertEquals(251, AudioPick.choose(typical, AudioPick.DEFAULT_ORDER)?.itag)
    }

    @Test fun m4aWhenThePageAsksForIt() {
        assertEquals(140, AudioPick.choose(typical, listOf("m4a", "webm"))?.itag)
    }

    @Test fun fallsBackToTheOtherFormat() {
        val noOpus = typical.filter { it.ext == "m4a" }
        assertEquals(140, AudioPick.choose(noOpus, listOf("webm", "m4a"))?.itag)
        val noAac = typical.filter { it.ext == "webm" }
        assertEquals(251, AudioPick.choose(noAac, listOf("m4a"))?.itag)
        assertNull(AudioPick.choose(emptyList(), AudioPick.DEFAULT_ORDER))
    }

    @Test fun refreshKeepsTheSameItag() {
        assertEquals(140, AudioPick.choose(typical, AudioPick.DEFAULT_ORDER, preferItag = 140)?.itag)
    }

    @Test fun originalTrackFirst() {
        val dubbed = listOf(c(0, 251, "webm", 160, original = false), c(1, 250, "webm", 70, original = true))
        assertEquals(250, AudioPick.choose(dubbed, AudioPick.DEFAULT_ORDER)?.itag)
    }

    @Test fun parseOrder() {
        assertEquals(listOf("m4a", "webm"), AudioPick.parseOrder(" M4A ,webm"))
        assertEquals(listOf("webm"), AudioPick.parseOrder("webm,flac,webm"))
        assertEquals(AudioPick.DEFAULT_ORDER, AudioPick.parseOrder(""))
        assertEquals(AudioPick.DEFAULT_ORDER, AudioPick.parseOrder(null))
    }

    @Test fun primingUndeclared() {
        val info = Mp4Priming.parse(withoutEditList)
        assertEquals(44100L, info.timescale)
        assertNull(info.editMediaTime)
        assertEquals(1600 / 44100.0, Mp4Priming.primingSec(info), 1e-9)
    }

    @Test fun primingDeclaredInEditList() {
        val info = Mp4Priming.parse(withEditList)
        assertEquals(44100L, info.timescale)
        assertEquals(1600L, info.editMediaTime)
        assertEquals(0.0, Mp4Priming.primingSec(info), 0.0)
    }

    @Test fun primingUnknownLayouts() {
        assertEquals(0.0, Mp4Priming.primingSec(Mp4Priming.Info(48000, null)), 0.0)
        assertEquals(0.0, Mp4Priming.primingSec(Mp4Priming.parse(ByteArray(0))), 0.0)
        // Truncated header and garbage don't throw.
        Mp4Priming.parse(withEditList.copyOf(300))
        Mp4Priming.parse(ByteArray(64) { 0x7f })
    }

    @Test fun webmHasNoPriming() {
        assertEquals(0.0, Mp4Priming.primingSec(java.io.File("x/abcdefghijk.webm")), 0.0)
    }

    // ftyp + moov of a real itag-140 download (jz7C2W4m26U.m4a).
    private val withEditList = hex(
            "0000001866747970646173680000000069736f366d703431000002846d6f6f760000006c6d76686400000000da06236eda06236e0000ac4400767ed4" +
            "000100000100000000000000000000000001000000000000000000000000000000010000000000000000000000000000400000000000000000000000" +
            "0000000000000000000000000000000000000002000000286d7665780000002074726578000000000000000100000001000000000000000000000000" +
            "000001e87472616b0000005c746b686400000003da06236eda06236e000000010000000000767ed40000000000000000000000000100000000010000" +
            "0000000000000000000000000001000000000000000000000000000040000000000000000000000000000024656474730000001c656c737400000000" +
            "0000000100767ed40000064000010000000001606d646961000000206d64686400000000da06236eda06236e0000ac4400767ed455c4000000000047" +
            "68646c720000000000000000736f756e00000000000000000000000049534f204d656469612066696c652070726f647563656420627920476f6f676c" +
            "6520496e632e00000000f16d696e660000002464696e660000001c6472656600000000000000010000000c75726c2000000001000000b57374626c00" +
            "000069737473640000000000000001000000596d703461000000000000000100000000000000000002001000000000ac440000000000356573647300" +
            "0000000327000100041f4015000000000000000000000005101210000000000000000000000000000006010200000010737474730000000000000000" +
            "00000010737473630000000000000000000000107374636f0000000000000000000000147374737a00000000000000000000000000000010736d6864" +
            "0000000000000000",
    )

    // ftyp + moov of a real itag-140 download (1j_XvebOg4c.m4a).
    private val withoutEditList = hex(
            "0000001866747970646173680000000069736f366d703431000002606d6f6f760000006c6d76686400000000dd30ceaddd30cead0000ac44008bac00" +
            "000100000100000000000000000000000001000000000000000000000000000000010000000000000000000000000000400000000000000000000000" +
            "0000000000000000000000000000000000000002000000286d7665780000002074726578000000000000000100000001000000000000000000000000" +
            "000001c47472616b0000005c746b686400000003dd30ceaddd30cead0000000100000000008bac000000000000000000000000000100000000010000" +
            "00000000000000000000000000010000000000000000000000000000400000000000000000000000000001606d646961000000206d64686400000000" +
            "dd30ceaddd30cead0000ac44008bac0015c700000000004768646c720000000000000000736f756e00000000000000000000000049534f204d656469" +
            "612066696c652070726f647563656420627920476f6f676c6520496e632e00000000f16d696e660000002464696e660000001c647265660000000000" +
            "0000010000000c75726c2000000001000000b57374626c00000069737473640000000000000001000000596d70346100000000000000010000000000" +
            "0000000002001000000000ac4400000000003565736473000000000327000100041f4015000000000000000000000005101210000000000000000000" +
            "00000000000601020000001073747473000000000000000000000010737473630000000000000000000000107374636f000000000000000000000014" +
            "7374737a00000000000000000000000000000010736d68640000000000000000",
    )

    private fun hex(s: String) = ByteArray(s.length / 2) { s.substring(2 * it, 2 * it + 2).toInt(16).toByte() }
}
