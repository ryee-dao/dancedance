package app.dancedance.tv

import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/** The TV's merge of iTunes and Deezer (SongCatalog.kt), on the same recorded answers as src/ui/songMerge.test.ts. */
class SongMergeTest {
    private fun itunes(f: CatalogFixtures.Fixture): List<SongPicker.SongHit> {
        val arr = JSONObject(f.itunesJson).getJSONArray("results")
        return SongPicker.parseItunes((0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            o.keys().asSequence().associateWith { k -> o.opt(k).takeUnless { it == JSONObject.NULL } }
        })
    }

    private fun deezer(f: CatalogFixtures.Fixture) = Deezer.parse(JSONObject(f.deezerJson))
    private fun merged(f: CatalogFixtures.Fixture) = SongMerge.merge(f.term, itunes(f), deezer(f))

    @Test
    fun `Deezer parser reads the real title, whole-second length, explicit flag and a 300 px cover`() {
        val t = deezer(CatalogFixtures.theBox)[0]
        assertEquals(
            Deezer.Track(
                "Roddy Ricch", "The Box", "Please Excuse Me for Being Antisocial", 196, true,
                "https://cdn-images.dzcdn.net/images/cover/4cecb47ae25837b9dd022004b5cacbdc/300x300-000000-80-0-0.jpg",
            ),
            t,
        )
        assertFalse(deezer(CatalogFixtures.fukumean).first { it.title == "fukumean (instrumental)" }.explicit)
        try {
            Deezer.parse(JSONObject("""{"error":{"type":"Exception","message":"Quota limit exceeded","code":4}}"""))
            fail("expected the quota error")
        } catch (e: Deezer.DeezerException) {
            assertTrue(e.busy)
        }
        assertEquals("https://api.deezer.com/search?q=the%20box&limit=10", Deezer.url(" the box ").toString())
    }

    @Test
    fun `a song iTunes lists no version of comes first, with its own length`() {
        val hits = merged(CatalogFixtures.theBox)
        assertEquals(listOf("Roddy Ricch", "The Box", "196", "deezer"), hits[0].let { listOf(it.artist, it.title, it.durationSec.toString(), it.source) })
        assertFalse(itunes(CatalogFixtures.theBox).any { it.artist == "Roddy Ricch" && it.title == "The Box" })
    }

    @Test
    fun `wrong-artist Deezer hits and karaoke are dropped, the iTunes list stays`() {
        val hits = merged(CatalogFixtures.theBox)
        assertEquals(listOf("Roddy Ricch"), hits.filter { it.source == "deezer" }.map { it.artist })
        assertEquals(emptyList<SongPicker.SongHit>(), merged(CatalogFixtures.notLikeUs).filter { it.source == "deezer" })
        assertTrue(hits.indexOfFirst { it.artist == "EC Twins" } > 0)
    }

    @Test
    fun `the same recording from both catalogs is one entry keeping the iTunes genre and artwork`() {
        val hits = merged(CatalogFixtures.notLikeUs).filter { it.artist == "Kendrick Lamar" && it.title == "Not Like Us" }
        assertEquals(1, hits.size)
        assertEquals(274, hits[0].durationSec)
        assertEquals("Hip-Hop/Rap", hits[0].genre)
        assertTrue(hits[0].artworkUrl.contains("mzstatic"))
        assertEquals("itunes", hits[0].source)
    }

    @Test
    fun `a censored clean title gives way to the real one`() {
        val hits = merged(CatalogFixtures.fukumean)
        assertEquals(listOf("fukumean"), hits.filter { it.artist == "Gunna" && it.title.endsWith("mean", ignoreCase = true) }.map { it.title })
        assertEquals("gunna - fukumean", hits[0].key)
        assertEquals("Hip-Hop/Rap", hits[0].genre)
        assertTrue(hits[0].artworkUrl.contains("mzstatic"))
        val freak = merged(CatalogFixtures.freakOn)
        assertEquals("Get Ur Freak On", freak[0].title)
        assertEquals(237, freak[0].durationSec)
        assertFalse(freak.any { it.title.contains("Amended") })
    }

    @Test
    fun `a clean title is not renamed to another version of the same length`() {
        val lucid = merged(CatalogFixtures.lucidDreams)
        assertEquals("Juice WRLD" to "Lucid Dreams", lucid[0].artist to lucid[0].title)
        assertEquals("itunes", lucid[0].source)
        assertFalse(lucid.any { it.artist == "Juice WRLD" && it.title == "Lucid Dreams (Remix)" })
        assertEquals(1, merged(CatalogFixtures.espresso).count { it.artist == "Sabrina Carpenter" && it.title == "Espresso" })
        assertFalse(SongMerge.censorFits("Lucid Dreams", "Lucid Dreams (Remix)"))
    }

    @Test
    fun `clean and explicit versions of different lengths stay two entries`() {
        val hits = merged(CatalogFixtures.loseYourself).filter { it.artist == "Eminem" && it.title == "Lose Yourself" }
        assertEquals(listOf(322 to "itunes", 326 to "deezer"), hits.map { it.durationSec to it.source })
        assertTrue(hits[0].clean)
    }

    @Test
    fun `each song once, at most 15, same lists as the web`() {
        for (f in listOf(CatalogFixtures.theBox, CatalogFixtures.fukumean, CatalogFixtures.freakOn, CatalogFixtures.loseYourself, CatalogFixtures.notLikeUs, CatalogFixtures.lucidDreams, CatalogFixtures.espresso)) {
            val hits = merged(f)
            assertTrue(hits.size <= 15)
            hits.forEachIndexed { i, h -> assertFalse(hits.withIndex().any { (j, o) -> j != i && o.key == h.key && kotlin.math.abs(o.durationSec - h.durationSec) <= 2 }) }
        }
        // The first entries match songMerge.test.ts.
        assertEquals("The Box", merged(CatalogFixtures.theBox)[0].title)
        assertEquals("fukumean", merged(CatalogFixtures.fukumean)[0].title)
    }

    @Test
    fun `title helpers`() {
        assertTrue(SongMerge.looksCensored("B*tch Better Have My Money"))
        assertTrue(SongMerge.looksCensored("Get Ur Freak On (Amended LP Version)"))
        assertFalse(SongMerge.looksCensored("Clean"))
        assertTrue(SongMerge.censorFits("B**ch", "Bitch"))
        assertTrue(SongMerge.censorFits("umean", "fukumean"))
        assertFalse(SongMerge.censorFits("Love", "Hate"))
        assertEquals("get ur freak on", SongMerge.versionCore("Get Ur Freak On (Amended LP Version)"))
        assertEquals("creepin instrumental", SongMerge.versionCore("Creepin' (Instrumental)"))
        assertEquals("tqg", SongMerge.versionCore("TQG (feat. Shakira)"))
        assertTrue(SongMerge.sameArtist("Drake & 21 Savage", "Drake"))
        assertFalse(SongMerge.sameArtist("8-Bit Arcade", "Roddy Ricch"))
    }

    // --- SongCatalog: both catalogs, back-off --------------------------------------------------

    private class Canned(var code: Int, var body: String) : Interceptor {
        var calls = 0
        override fun intercept(chain: Interceptor.Chain): Response {
            calls++
            return Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(code).message("x")
                .body(body.toResponseBody("application/json".toMediaType())).build()
        }
    }

    @Test
    fun `either catalog alone is enough, iTunes errors only when Deezer has nothing, and a busy catalog is left alone`() {
        val f = CatalogFixtures.theBox
        val dz = Canned(200, f.deezerJson)
        var now = 0L
        var itCalls = 0
        var itunesBusy = true
        val catalog = SongCatalog(OkHttpClient.Builder().addInterceptor(dz).build(), itunes = {
            itCalls++
            if (itunesBusy) throw BridgeException("network", "The song search is busy. Try again in a minute.")
            itunes(f)
        }, now = { now })
        assertEquals(listOf("The Box"), catalog.search(f.term).map { it.title })
        // iTunes left alone for a minute after "busy": the next search asks only Deezer.
        catalog.search(f.term)
        assertEquals(1, itCalls)
        assertEquals(2, dz.calls)
        // Deezer's quota error too: nothing found, so iTunes' error shows.
        dz.body = """{"error":{"code":4,"message":"Quota limit exceeded"}}"""
        try {
            catalog.search(f.term)
            fail("expected iTunes' error")
        } catch (e: BridgeException) {
            assertTrue(e.message.contains("busy"))
        }
        assertEquals(3, dz.calls)
        // A minute later both are asked again; Deezer's 429 leaves iTunes alone in the list, and Deezer paused.
        now = 200_000
        itunesBusy = false
        dz.code = 429
        assertEquals(itunes(f).size, catalog.search(f.term).size)
        assertEquals(2, itCalls)
        assertEquals(4, dz.calls)
        catalog.search(f.term)
        assertEquals(4, dz.calls)
    }
}
