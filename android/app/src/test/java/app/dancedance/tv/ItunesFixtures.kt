package app.dancedance.tv

// Hand-written iTunes Search API results (the fields parseItunes reads), shaped like the real
// API's answers. Kept apart from PickFixtures, which is generated from the cloud tool's fixtures.

object ItunesFixtures {
    private fun track(artist: String, title: String, ms: Int, genre: String?, album: String = "", kind: String = "song") =
        buildMap<String, Any?> {
            put("kind", kind)
            put("artistName", artist)
            put("trackName", title)
            put("collectionName", album)
            put("trackTimeMillis", ms)
            put("releaseDate", "2021-01-29T08:00:00Z")
            if (genre != null) put("primaryGenreName", genre)
        }

    /** "Pooh Shiesty Back in Blood": the song that showed up as Pop on the TV. */
    val backInBlood: List<Map<String, Any?>> = listOf(
        // Explicit single (the hit tapped on the phone), then the album copy (dup within 2 s, no genre).
        track("Pooh Shiesty", "Back in Blood (feat. Lil Durk)", 132_160, "Hip-Hop/Rap", "Back in Blood (feat. Lil Durk) - Single"),
        track("Pooh Shiesty", "Back in Blood (feat. Lil Durk)", 133_000, null, "Shiesty Season"),
        // Same title and artist, a different cut 20 s longer, other genre label: not the closest length.
        track("Pooh Shiesty", "Back in Blood (feat. Lil Durk)", 152_000, "Rap"),
        // Same title, other artist.
        track("Sentinel Choir", "Back in Blood", 241_000, "Rock"),
        track("Pooh Shiesty", "Back in Blood (feat. Lil Durk)", 132_000, "Music Video", kind = "music-video"),
    )
}
