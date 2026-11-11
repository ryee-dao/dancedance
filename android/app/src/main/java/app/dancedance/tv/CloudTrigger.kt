package app.dancedance.tv

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

/**
 * TV -> cloud: starts the repo's beatmaps.yml workflow (workflow_dispatch on main, no inputs; the
 * job re-reads the playlist itself). Uses the fine-grained token from [TokenStore], which never
 * leaves native code. At most one attempt per [MIN_INTERVAL_MS], and only when the page reports
 * songs that have neither a cloud map nor a known cloud failure.
 */
class CloudTrigger(private val http: OkHttpClient, private val prefs: Prefs) {
    companion object {
        const val MIN_INTERVAL_MS = 10 * 60 * 1000L
        private const val TAG = "DanceDance"
    }

    val repo: String? get() = BuildConfig.GITHUB_REPO

    /** Blocking; call from Dispatchers.IO. Always returns a status object (never throws). */
    fun request(missingCount: Int): JSONObject {
        val result = JSONObject()
        val repo = repo
        val token = prefs.githubToken
        val now = System.currentTimeMillis()
        val since = now - prefs.lastCloudAttemptAt
        when {
            repo == null -> return result.put("status", "not-configured")
            token == null -> return result.put("status", "no-token")
            missingCount <= 0 -> return result.put("status", "not-needed")
            since in 0 until MIN_INTERVAL_MS ->
                return result.put("status", "rate-limited").put("retryAfterSec", (MIN_INTERVAL_MS - since) / 1000)
        }
        prefs.lastCloudAttemptAt = now
        val req = Request.Builder()
            .url("https://api.github.com/repos/$repo/actions/workflows/beatmaps.yml/dispatches")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .header("User-Agent", "DanceDance-TV/${BuildConfig.VERSION_NAME}")
            .post("""{"ref":"main"}""".toRequestBody("application/json".toMediaType()))
            .build()
        try {
            http.newCall(req).execute().use { r ->
                if (r.code == 204) {
                    result.put("status", "started")
                } else {
                    val message = when (r.code) {
                        401 -> "GitHub rejected the token (expired or mistyped). Link again from your phone with a new token."
                        403 -> "The GitHub token isn't allowed to start workflows. It needs \"Actions: read and write\" on this repo."
                        404 -> "GitHub couldn't find beatmaps.yml in $repo (or the token can't see the repo)."
                        422 -> "GitHub refused to start the workflow (is it enabled, and is the branch called main?)."
                        else -> "GitHub answered HTTP ${r.code}."
                    }
                    result.put("status", "failed").put("httpStatus", r.code).put("message", message)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Cloud trigger failed", e)
            result.put("status", "failed").put("message", "Couldn't reach GitHub: ${e.javaClass.simpleName}")
        }
        prefs.lastCloudResult = JSONObject(result.toString()).put("at", now).toString()
        return result
    }
}
