package app.dancedance.tv

import org.schabi.newpipe.extractor.exceptions.AgeRestrictedContentException
import org.schabi.newpipe.extractor.exceptions.ContentNotAvailableException
import org.schabi.newpipe.extractor.exceptions.ExtractionException
import org.schabi.newpipe.extractor.exceptions.GeographicRestrictionException
import org.schabi.newpipe.extractor.exceptions.PaidContentException
import org.schabi.newpipe.extractor.exceptions.PrivateContentException
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.exceptions.SignInConfirmNotBotException
import org.schabi.newpipe.extractor.exceptions.YoutubeMusicPremiumContentException
import java.io.IOException
import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/**
 * An error with a stable `code` the web layer switches on, and a message written for the person
 * holding the remote. Codes (mirrored in src/platform/androidtv.ts, BridgeErrorCode):
 *   network, unavailable, private, age-restricted, geo, paid, bot-check, extractor, no-audio,
 *   playlist-unavailable, bad-input, no-network-for-link, storage, cancelled, internal
 */
class BridgeException(val code: String, override val message: String, cause: Throwable? = null) :
    Exception(message, cause)

object Errors {
    fun extractorMessage() =
        "YouTube changed something. Update the app (NewPipe Extractor ${BuildConfig.NEWPIPE_VERSION})."

    /** Map anything thrown while talking to YouTube to a user-facing [BridgeException]. */
    fun classify(t: Throwable, forPlaylist: Boolean = false): BridgeException {
        if (t is BridgeException) return t
        val chain = generateSequence(t) { it.cause }.take(8).toList()
        return when {
            chain.any { it is SignInConfirmNotBotException || it is ReCaptchaException } -> BridgeException(
                "bot-check",
                "YouTube is asking this projector to prove it isn't a bot. Wait a while and try again.",
                t,
            )
            chain.any { it is AgeRestrictedContentException } ->
                BridgeException("age-restricted", "This video is age-restricted, so it can't be played here.", t)
            chain.any { it is PrivateContentException } -> BridgeException(
                if (forPlaylist) "playlist-unavailable" else "private",
                if (forPlaylist) "That playlist is private. Set it to Public or Unlisted on YouTube." else "This video is private.",
                t,
            )
            chain.any { it is GeographicRestrictionException } ->
                BridgeException("geo", "This video isn't available in your country.", t)
            chain.any { it is PaidContentException || it is YoutubeMusicPremiumContentException } ->
                BridgeException("paid", "This video needs a paid YouTube subscription.", t)
            chain.any { it is ContentNotAvailableException } -> if (forPlaylist) {
                BridgeException("playlist-unavailable", "Couldn't read that playlist. Check that it's Public or Unlisted.", t)
            } else {
                BridgeException("unavailable", "This video is unavailable.", t)
            }
            chain.any { it is NoAudioException } -> BridgeException("no-audio", "YouTube didn't offer an audio stream for this video.", t)
            chain.any { isNetwork(it) } ->
                BridgeException("network", "Can't reach YouTube. Check the projector's internet connection.", t)
            chain.any { it is ExtractionException } -> BridgeException("extractor", extractorMessage(), t)
            t is IOException -> BridgeException("network", "The connection to YouTube dropped. Try again.", t)
            else -> BridgeException("internal", "Something went wrong: ${t.javaClass.simpleName}.", t)
        }
    }

    private fun isNetwork(t: Throwable) = t is UnknownHostException || t is ConnectException ||
        t is NoRouteToHostException || t is SocketException || t is SSLException ||
        (t is InterruptedIOException && t.message?.contains("timeout", ignoreCase = true) == true)
}
