package app.dancedance.tv

import app.dancedance.tv.PickFixtures.hipsDontLie
import app.dancedance.tv.PickFixtures.shakeItOff
import app.dancedance.tv.PickFixtures.stayinAlive
import app.dancedance.tv.PickFixtures.takeOnMe
import app.dancedance.tv.SongPicker.Entry
import app.dancedance.tv.SongPicker.Request
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The TV picker must choose exactly what the cloud picker (tools/beatmaps/pick.ts) chooses:
 * these mirror tools/beatmaps/pick.test.ts on the same real search results, plus the traps.
 */
class SongPickerTest {
    private fun e(
        id: String,
        title: String,
        channel: String,
        verified: Boolean = false,
        views: Long? = 1_000_000,
        duration: Long? = 200,
        description: String = "",
        liveStatus: String? = null,
    ) = Entry(id, title, channel, verified, views, duration, description, liveStatus)

    private fun ids(req: Request, entries: List<Entry>) = SongPicker.rank(req, entries).ranked.map { "${it.tier.label}:${it.entry.id}" }
    private fun reason(req: Request, entries: List<Entry>, id: String) =
        SongPicker.rank(req, entries).rejected.firstOrNull { it.entry.id == id }?.reason

    // --- real search results (same fixtures as the cloud tool) -----------------------------

    @Test fun shakeItOff() {
        val req = Request("Taylor Swift", "Shake It Off", 219)
        val ranked = ids(req, shakeItOff)
        assertEquals(listOf("lyric:8xG7mH8i-WE", "lyric:Z4A9ZZo_rAE", "lyric:YytmnsOPWyk", "lyric:w9uTc7_FB_0"), ranked.take(4))
        assertEquals("music-video:nfWlot6h_JM", ranked.last())
        // Re-recording ("Taylor's Version"), even on the artist's own channel and in the window.
        assertEquals("version", reason(req, shakeItOff, "mvVBuG4IOW4"))
        assertEquals("version", reason(req, shakeItOff, "H59xVMF4zxE"))
        // Look-alike channels ("Music Topic BR", "gran republica records") with "(Audio)" uploads.
        assertTrue(reason(req, shakeItOff, "w9E7tRTkf5E")!!.contains("not official"))
        assertTrue(reason(req, shakeItOff, "9M-h3AthyMU")!!.contains("not official"))
        assertEquals("live", reason(req, shakeItOff, "P8ZnjqbOuyc"))
        assertEquals("translation", reason(req, shakeItOff, "XJSGoZo9888"))
        assertTrue(reason(req, shakeItOff, "c-AgYomOouY")!!.contains("only 122168 views"))
        assertTrue(reason(req, shakeItOff, "zIOVMHMNfJ4")!!.contains("length 216"))
    }

    @Test fun askingForTheReRecordingPicksIt() {
        val req = Request("Taylor Swift", "Shake It Off (Taylor's Version)", 219)
        val ranked = ids(req, shakeItOff)
        assertEquals("official:mvVBuG4IOW4", ranked[0])
        assertTrue("topic:H59xVMF4zxE" in ranked)
        assertFalse("lyric:8xG7mH8i-WE" in ranked)
    }

    @Test fun stayinAliveAlbumLength() {
        val req = Request("Bee Gees", "Stayin' Alive (From \"Saturday Night Fever\" Soundtrack)", 285)
        assertEquals(listOf("lyric:_Vj092UgKwQ", "lyric:UMANMEfZtYA", "topic:GbsFCYEJGZ0"), ids(req, stayinAlive))
        assertTrue(reason(req, stayinAlive, "orrBiGO-gGs")!!.contains("not official")) // fake VEVO, unverified
        assertTrue(reason(req, stayinAlive, "8lytDLaMfls")!!.contains("length 420"))
        assertEquals("version", reason(req, stayinAlive, "DY7pipZGUkg")) // 10-minute disco version
        assertEquals("different song", reason(req, stayinAlive, "qr-_iuS3EZ8"))
    }

    @Test fun stayinAliveSingleEditExcludesLongerVersions() {
        val req = Request("Bee Gees", "Stayin' Alive", 249)
        val ranked = ids(req, stayinAlive)
        assertEquals("lyric:WlgoUlOkyzU", ranked[0])
        assertFalse("topic:GbsFCYEJGZ0" in ranked)
        assertFalse("lyric:_Vj092UgKwQ" in ranked)
        assertEquals(listOf("music-video:I_izvAbhExY", "music-video:fNFzfwLM72c"), ranked.filter { it.startsWith("music-video") })
    }

    @Test fun hipsDontLie() {
        val req = Request("Shakira", "Hips Don't Lie (feat. Wyclef Jean)", 218)
        val ranked = ids(req, hipsDontLie)
        assertEquals("lyric:p3pEe6aAJ4k", ranked[0])
        assertEquals("music-video:DUT5rEU6pqM", ranked.last())
        assertEquals("version", reason(req, hipsDontLie, "41ZY18JqI2A"))
        assertEquals("live", reason(req, hipsDontLie, "2Ndra-1Pwug"))
        assertEquals("different song", reason(req, hipsDontLie, "Q0zYjFJhd-4"))
    }

    @Test fun takeOnMe() {
        val req = Request("a-ha", "Take On Me", 225)
        val ranked = ids(req, takeOnMe)
        assertEquals(listOf("lyric:irljBY9J5ig", "lyric:hGPL5rzd3tQ"), ranked.take(2))
        assertTrue("topic:NaQ083rNUwc" in ranked)
        assertEquals("acoustic channel", reason(req, takeOnMe, "kmDBDn8Ju6w"))
        assertEquals("acoustic", reason(req, takeOnMe, "X50VeoRaNmY"))
        assertEquals("version", reason(req, takeOnMe, "-iKeUC5_Wyw"))
    }

    // --- traps ------------------------------------------------------------------------------

    private val lev = Request("Dua Lipa", "Levitating", 203)
    private val official = e("OFFLYRIC000", "Dua Lipa - Levitating (Official Lyrics Video)", "Dua Lipa", true, 140_000_000, 205)
    private val officialAudio = e("OFFAUDIO000", "Dua Lipa - Levitating (Official Audio)", "DuaLipaVEVO", true, 9_000_000, 204)
    private val thirdParty = e("LYRIC000000", "Dua Lipa - Levitating (Lyrics)", "ChillTracks", false, 112_000_000, 208)
    private val topic = e("TOPIC000000", "Levitating", "Dua Lipa", true, 80_000_000, 203, "Provided to YouTube by Warner Records Lev")

    @Test fun tierOrder() {
        assertEquals(
            listOf("official:OFFLYRIC000", "official:OFFAUDIO000", "lyric:LYRIC000000", "topic:TOPIC000000"),
            ids(lev, listOf(topic, thirdParty, officialAudio, official)),
        )
    }

    @Test fun fakeTopicChannel() {
        val fake = e("FAKETOPIC00", "Levitating", "Dua Lipa - Topic", views = 1_204, duration = 203, description = "Provided to YouTube by DistroKid Levitat")
        assertEquals("art track with only 1204 views", reason(lev, listOf(fake), "FAKETOPIC00"))
        val elsewhere = e("OTHERTOPIC0", "Levitating", "Pop Hits - Topic", views = 5_000_000, duration = 203, description = "Provided to YouTube by Kontor")
        val r = reason(lev, listOf(elsewhere), "OTHERTOPIC0")!!
        assertTrue(r, r == "art track from another channel" || r == "artist not named")
    }

    @Test fun lookAlikeArtistChannels() {
        val sameName = e("IMPOSTER000", "Dua Lipa - Levitating (Official Lyric Video)", "Dua Lipa", false, 40_000, 204)
        val lookAlike = e("LOOKALIKE00", "Dua Lipa - Levitating (Official Audio)", "Dua Lipá Officiall", false, 2_000_000, 204)
        val homoglyph = e("HOMOGLYPH00", "Dua Lipa - Levitating (Official Audio)", "DuaLlpaVEVO", true, 2_000_000, 204)
        assertEquals("unverified channel using the artist's name", reason(lev, listOf(sameName), "IMPOSTER000"))
        assertEquals(emptyList<String>(), ids(lev, listOf(lookAlike, homoglyph)))
    }

    @Test fun reRecordingWithDifferentLength() {
        // A newer re-recording on the artist's own (verified) channel, 14 s longer than the original.
        val req = Request("Dua Lipa", "Levitating", 203)
        val rerec = e("REREC000000", "Dua Lipa - Levitating (2025 Re-recorded) [Official Audio]", "Dua Lipa", true, 3_000_000, 217)
        val longer = e("LONGAUDIO00", "Dua Lipa - Levitating (Official Audio)", "Dua Lipa", true, 3_000_000, 217)
        assertEquals("version", reason(req, listOf(rerec), "REREC000000"))
        // Same title words but the wrong length: not usable as official audio, nor as a music video.
        assertEquals("length 217 s vs 203 s", reason(req, listOf(longer), "LONGAUDIO00"))
    }

    @Test fun extendedVersion() {
        val ext = e("EXTENDED000", "Dua Lipa - Levitating (Extended Version) (Lyrics)", "Lyric Vault", false, 9_000_000, 204)
        val extMix = e("EXTMIX00000", "Dua Lipa - Levitating (Extended Mix)", "DuaLipaVEVO", true, 9_000_000, 290)
        assertEquals("extended", reason(lev, listOf(ext), "EXTENDED000"))
        assertEquals("remix", reason(lev, listOf(extMix), "EXTMIX00000"))
        // ...unless the request asks for it.
        assertEquals(listOf("lyric:EXTENDED000"), ids(Request("Dua Lipa", "Levitating (Extended Version)", 203), listOf(ext)))
    }

    @Test fun badWords() {
        val titles = listOf(
            "Dua Lipa - Levitating (Remix) (Lyrics)", "Dua Lipa - Levitating (Sped Up) Lyrics", "Nightcore - Levitating (Lyrics)",
            "Dua Lipa - Levitating (8D Audio) Lyrics", "Dua Lipa - Levitating (Karaoke Version)", "Dua Lipa - Levitating (Instrumental) Lyrics",
            "Dua Lipa - Levitating [1 Hour] Lyrics", "Dua Lipa - Levitating (Extended Mix) Lyrics", "Dua Lipa - Levitating (Clean) (Lyrics)",
            "Dua Lipa - Levitating REACTION lyrics", "Dua Lipa - Levitating / Physical Mashup (Lyrics)", "Levitating - Dua Lipa (Cover) Lyrics",
            "Dua Lipa - Levitating (Slowed + Reverb) Lyrics", "Dua Lipa - Levitating (Radio Edit) Lyrics",
        )
        val entries = titles.mapIndexed { i, t -> e("BADWORD%04d".format(i), t, "Some Lyrics", duration = 204) }
        assertEquals(emptyList<String>(), ids(lev, entries))
    }

    @Test fun otherArtistOrSong() {
        val other = e("OTHERART000", "Olivia Newton-John - Levitating (Lyrics)", "Lyrics Hub", duration = 204)
        val longer = e("LONGER00000", "Dua Lipa - Levitating Again (Lyrics)", "Lyrics Hub", duration = 204)
        assertEquals("different artist", reason(lev, listOf(other), "OTHERART000"))
        assertEquals("different song or artist", reason(lev, listOf(longer), "LONGER00000"))
    }

    @Test fun wordsThatBelongToTheSong() {
        assertEquals(
            listOf("lyric:LIVEFOREVER"),
            ids(Request("Oasis", "Live Forever", 276), listOf(e("LIVEFOREVER", "Oasis - Live Forever (Lyrics)", "Lyrics", duration = 277))),
        )
        assertEquals(
            listOf("lyric:RATHERBE000"),
            ids(Request("Clean Bandit", "Rather Be (feat. Jess Glynne)", 228), listOf(e("RATHERBE000", "Clean Bandit - Rather Be ft. Jess Glynne (Lyrics)", "Lyrics", duration = 228))),
        )
    }

    @Test fun lengthWindows() {
        fun at(d: Long, i: Int) = e("LEN%08d".format(i), "Dua Lipa - Levitating (Lyrics)", "Lyrics", duration = d)
        assertEquals(listOf("lyric:LEN00000002", "lyric:LEN00000003"), ids(lev, listOf(at(201, 1), at(202, 2), at(209, 3), at(210, 4))))
        fun mv(d: Long, i: Int) = e("MV%09d".format(i), "Dua Lipa - Levitating (Official Music Video)", "Dua Lipa", true, duration = d)
        assertEquals(listOf("music-video:MV000000003", "music-video:MV000000002"), ids(lev, listOf(mv(270, 1), mv(240, 2), mv(215, 3))))
    }

    @Test fun liveStreamsAndMissingLength() {
        assertEquals(emptyList<String>(), ids(lev, listOf(thirdParty.copy(liveStatus = "is_live"), official.copy(duration = null))))
    }

    // --- helpers ----------------------------------------------------------------------------

    @Test fun queries() {
        assertEquals(
            listOf("Shakira Hips Don't Lie lyrics", "Shakira Hips Don't Lie official audio"),
            SongPicker.searchQueries("Shakira", "Hips Don't Lie (feat. Wyclef Jean)"),
        )
        assertEquals("Taylor Swift Shake It Off (Taylor's Version) lyrics", SongPicker.searchQueries("Taylor Swift", "Shake It Off (Taylor's Version)")[0])
    }

    @Test fun normalisation() {
        assertEquals(listOf("shake", "it", "off", "taylor", "swift"), SongPicker.coreTokens("Shake It Off - Taylor Swift (Lyrics) 🎵"))
        assertEquals(listOf("chappell", "roan", "hot", "to", "go"), SongPicker.coreTokens("Chappell Roan - HOT TO GO! (Lyrics) \"you can take me hot to go\""))
        assertEquals(listOf("rosebrunomars", "rose", "brunomars"), SongPicker.artistVariants("ROSÉ & Bruno Mars"))
        assertEquals(listOf("earthwindfire", "earth"), SongPicker.artistVariants("Earth, Wind & Fire"))
    }

    @Test fun itunesResults() {
        val hits = SongPicker.parseItunes(
            listOf(
                mapOf("kind" to "song", "artistName" to "a-ha", "trackName" to "Take On Me", "collectionName" to "Hunting High and Low",
                    "trackTimeMillis" to 225_280, "releaseDate" to "1985-06-01T07:00:00Z", "artworkUrl100" to "https://is1-ssl.mzstatic.com/x/100x100bb.jpg"),
                mapOf("kind" to "song", "artistName" to "a-ha", "trackName" to "Take On Me", "trackTimeMillis" to 226_000), // deluxe dup
                mapOf("kind" to "song", "artistName" to "a-ha", "trackName" to "Take On Me (Live)", "trackTimeMillis" to 300_000),
                mapOf("kind" to "music-video", "artistName" to "a-ha", "trackName" to "Take On Me", "trackTimeMillis" to 244_000),
                mapOf("kind" to "song", "artistName" to "x", "trackName" to "Too long", "trackTimeMillis" to 2_000_000),
            ),
        )
        assertEquals(listOf("Take On Me" to 225, "Take On Me (Live)" to 300), hits.map { it.title to it.durationSec })
        assertEquals("https://is1-ssl.mzstatic.com/x/300x300bb.jpg", hits[0].artworkUrl)
        assertEquals("1985", hits[0].year)
    }
}
