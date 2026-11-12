package app.dancedance.tv

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** App-wide singletons. Everything here outlives the Activity (and WebView re-creation). */
class DanceApp : Application() {
    lateinit var http: OkHttpClient
        private set
    lateinit var prefs: Prefs
        private set
    lateinit var youtube: YouTube
        private set
    lateinit var audio: AudioRepository
        private set
    lateinit var cloud: CloudTrigger
        private set
    lateinit var link: LinkController
        private set
    lateinit var playlists: Playlists
        private set
    lateinit var songSearch: SongSearch
        private set
    lateinit var addedSongs: AddedSongsStore
        private set
    lateinit var updates: Updates
        private set

    /** Set by the current bridge: told whenever the added songs change (phone add / remove). */
    @Volatile var onAddedSongsChanged: ((added: AddedSongsStore.Song?, removedId: String?) -> Unit)? = null

    /** Background work that should survive the Activity (downloads, link server reads). */
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        http = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .callTimeout(90, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
        prefs = Prefs(getSharedPreferences("dancedance", Context.MODE_PRIVATE), TokenStore(this))
        youtube = YouTube(http)
        playlists = Playlists(youtube)
        songSearch = SongSearch(http)
        addedSongs = AddedSongsStore(filesDir.resolve("added-songs.json"))
        audio = AudioRepository(
            AudioCache(cacheDir.resolve("audio"), BuildConfig.AUDIO_CACHE_MB * 1024L * 1024L),
            youtube,
            http,
            scope,
        )
        cloud = CloudTrigger(http, prefs)
        link = LinkController(this)
        updates = Updates(this, http, scope)
        updates.onAppStart()
    }
}

/** App-private settings. The GitHub token goes through [TokenStore] (Keystore-encrypted). */
class Prefs(private val sp: SharedPreferences, private val tokens: TokenStore) {
    data class Link(val input: String, val listId: String)

    var playlist: Link?
        get() {
            val id = sp.getString("playlist.listId", null) ?: return null
            return Link(sp.getString("playlist.input", null) ?: id, id)
        }
        set(v) {
            sp.edit().apply {
                if (v == null) {
                    remove("playlist.listId"); remove("playlist.input")
                } else {
                    putString("playlist.listId", v.listId); putString("playlist.input", v.input)
                }
            }.apply()
        }

    var githubToken: String?
        get() = tokens.load(sp)
        set(v) = if (v.isNullOrBlank()) tokens.clear(sp) else tokens.save(sp, v)

    val hasGithubToken: Boolean get() = tokens.has(sp)
    val tokenStorage: String get() = tokens.storageKind(sp)

    var lastCloudAttemptAt: Long
        get() = sp.getLong("cloud.lastAttemptAt", 0L)
        set(v) = sp.edit().putLong("cloud.lastAttemptAt", v).apply()

    var lastCloudResult: String?
        get() = sp.getString("cloud.lastResult", null)
        set(v) = sp.edit().putString("cloud.lastResult", v).apply()
}
