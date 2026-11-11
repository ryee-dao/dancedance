import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

/** A Gradle property (-Pname=...) or, failing that, an environment variable. Blank = unset. */
fun setting(property: String, env: String): String? =
    (providers.gradleProperty(property).orNull ?: providers.environmentVariable(env).orNull)
        ?.trim()?.takeIf { it.isNotEmpty() }

fun javaString(value: String?): String =
    if (value == null) "null" else "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

// Where the cloud beat maps live (GitHub Pages) and which repo the TV may trigger. Injected by
// CI from github.repository; unset for local builds, which then have no cloud features.
val pagesBaseUrl: String? = setting("dancedance.pagesBaseUrl", "DANCEDANCE_PAGES_BASE_URL")?.let {
    require(Regex("^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~/-]*)?$").matches(it)) {
        "dancedance.pagesBaseUrl must be an https URL, got: $it"
    }
    if (it.endsWith("/")) it else "$it/"
}
val githubRepo: String? = setting("dancedance.githubRepo", "DANCEDANCE_GITHUB_REPO")?.also {
    require(Regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$").matches(it)) {
        "dancedance.githubRepo must look like owner/repo, got: $it"
    }
}

// Audio cache cap (MB). 300 by default; a small value is handy for testing eviction.
val audioCacheMb = setting("dancedance.audioCacheMb", "DANCEDANCE_AUDIO_CACHE_MB")?.toInt() ?: 300

val appVersionName = setting("dancedance.versionName", "DANCEDANCE_VERSION_NAME") ?: "0.1.0-dev"
val appVersionCode = setting("dancedance.versionCode", "DANCEDANCE_VERSION_CODE")?.toInt() ?: 1

// Release signing: a keystore from CI secrets. Without it, release builds are debug-signed
// (installable, but an update then requires uninstalling the old app first).
val keystorePath = setting("dancedance.keystorePath", "ANDROID_KEYSTORE_PATH")
val hasReleaseKeystore = keystorePath != null && file(keystorePath).exists()

android {
    namespace = "app.dancedance.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.dancedance.tv"
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName

        buildConfigField("String", "NEWPIPE_VERSION", javaString(libs.versions.newpipeExtractor.get()))
        buildConfigField("String", "PAGES_BASE_URL", javaString(pagesBaseUrl))
        buildConfigField("String", "GITHUB_REPO", javaString(githubRepo))
        buildConfigField("int", "AUDIO_CACHE_MB", audioCacheMb.toString())
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(keystorePath!!)
                storePassword = setting("dancedance.keystorePassword", "ANDROID_KEYSTORE_PASSWORD")
                keyAlias = setting("dancedance.keyAlias", "ANDROID_KEY_ALIAS")
                keyPassword = setting("dancedance.keyPassword", "ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        // NewPipe Extractor uses java.nio / java.time APIs that need desugaring below API 33.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources {
            excludes += setOf("META-INF/README.md", "META-INF/CHANGES", "META-INF/COPYRIGHT", "META-INF/*.kotlin_module")
        }
    }

    testOptions {
        // android.util.Log etc. return defaults in JVM unit tests.
        unitTests.isReturnDefaultValues = true
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

// ------------------------------------------------------------------------------------------
// The web app (repo root, `npm run build` -> dist/) is bundled into the APK as assets/web/.

abstract class CopyWebBuild : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val distDir: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        val dist = distDir.get().asFile
        if (!dist.resolve("index.html").isFile) {
            throw GradleException(
                "The web build is missing: ${dist.absolutePath}/index.html not found.\n" +
                    "Run `npm ci && npm run build` in the repository root first, then build the APK again.",
            )
        }
        val out = outputDir.get().asFile
        out.deleteRecursively()
        dist.copyRecursively(out.resolve("web"), overwrite = true)
    }
}

val copyWebBuild = tasks.register<CopyWebBuild>("copyWebBuild") {
    group = "build"
    description = "Copies the web app build (../dist) into the APK assets."
    distDir.set(rootProject.layout.projectDirectory.dir("../dist"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyWebBuild, CopyWebBuild::outputDir)
    }
}

dependencies {
    coreLibraryDesugaring(libs.android.desugar)
    implementation(libs.newpipe.extractor)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.webkit)
    implementation(libs.nanohttpd)
    implementation(libs.zxing.core)
    testImplementation(libs.junit)
}
