package app.dancedance.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.schabi.newpipe.extractor.exceptions.AgeRestrictedContentException
import org.schabi.newpipe.extractor.exceptions.ContentNotAvailableException
import org.schabi.newpipe.extractor.exceptions.ParsingException
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.exceptions.SignInConfirmNotBotException
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class ErrorsTest {
    @Test fun networkDown() {
        assertEquals("network", Errors.classify(UnknownHostException("www.youtube.com")).code)
        // NewPipe wraps IO failures in its own exceptions; the cause chain decides.
        assertEquals("network", Errors.classify(ParsingException("Could not get page", UnknownHostException("x"))).code)
        assertEquals("network", Errors.classify(SocketTimeoutException("timeout")).code)
    }

    @Test fun videoProblems() {
        assertEquals("unavailable", Errors.classify(ContentNotAvailableException("gone")).code)
        assertEquals("age-restricted", Errors.classify(AgeRestrictedContentException("18+")).code)
        assertEquals("playlist-unavailable", Errors.classify(ContentNotAvailableException("gone"), forPlaylist = true).code)
    }

    @Test fun youtubeChangedSomething() {
        val e = Errors.classify(ParsingException("Could not find the signature function"))
        assertEquals("extractor", e.code)
        assert(e.message.contains(BuildConfig.NEWPIPE_VERSION))
    }

    @Test fun botCheck() {
        assertEquals("bot-check", Errors.classify(SignInConfirmNotBotException("Sign in to confirm")).code)
        assertEquals("bot-check", Errors.classify(ReCaptchaException("429", "u")).code)
    }

    @Test fun plainIo() {
        assertEquals("network", Errors.classify(IOException("unexpected end of stream")).code)
    }
}

class RangeTest {
    @Test fun ranges() {
        assertEquals(0L to 99L, AudioServer.parseRange("bytes=0-99", 1000))
        assertEquals(500L to 999L, AudioServer.parseRange("bytes=500-", 1000))
        assertEquals(900L to 999L, AudioServer.parseRange("bytes=-100", 1000))
        assertEquals(990L to 999L, AudioServer.parseRange("bytes=990-5000", 1000))
        assertNull(AudioServer.parseRange("bytes=1000-", 1000))
        assertNull(AudioServer.parseRange("bytes=5-1", 1000))
        assertNull(AudioServer.parseRange("items=0-1", 1000))
    }
}
