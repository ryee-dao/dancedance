package app.dancedance.tv

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Stores the optional GitHub token encrypted with an AES-GCM key that lives in the Android
 * Keystore (never exported). The token is only ever read by native code ([CloudTrigger]); it
 * never crosses into JavaScript.
 *
 * Some TV boxes ship broken Keystore implementations. If encryption fails we fall back to
 * app-private preferences (still unreadable by other apps) and report "plain" in diagnostics.
 */
class TokenStore(@Suppress("unused") private val context: Context) {
    private companion object {
        const val ALIAS = "dancedance.github-token"
        const val KEY_ENC = "github.token.enc"
        const val KEY_PLAIN = "github.token.plain"
        const val TAG = "DanceDance"
    }

    fun has(sp: SharedPreferences) = sp.contains(KEY_ENC) || sp.contains(KEY_PLAIN)

    fun storageKind(sp: SharedPreferences) = when {
        sp.contains(KEY_ENC) -> "keystore"
        sp.contains(KEY_PLAIN) -> "plain"
        else -> "none"
    }

    fun save(sp: SharedPreferences, token: String) {
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val ct = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
            val packed = b64(cipher.iv) + ":" + b64(ct)
            sp.edit().putString(KEY_ENC, packed).remove(KEY_PLAIN).apply()
        } catch (e: Exception) {
            Log.w(TAG, "Keystore unavailable; storing the token in app-private prefs", e)
            sp.edit().putString(KEY_PLAIN, token).remove(KEY_ENC).apply()
        }
    }

    fun load(sp: SharedPreferences): String? {
        sp.getString(KEY_PLAIN, null)?.let { return it }
        val packed = sp.getString(KEY_ENC, null) ?: return null
        return try {
            val (iv, ct) = packed.split(":", limit = 2).map { Base64.decode(it, Base64.NO_WRAP) }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(ct), Charsets.UTF_8)
        } catch (e: Exception) {
            Log.w(TAG, "Couldn't decrypt the saved token; forgetting it", e)
            clear(sp)
            null
        }
    }

    fun clear(sp: SharedPreferences) {
        sp.edit().remove(KEY_ENC).remove(KEY_PLAIN).apply()
    }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey()
    }

    private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
}
