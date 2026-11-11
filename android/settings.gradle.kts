pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // NewPipe Extractor (and its nanojson fork) are published on JitPack only.
        maven("https://jitpack.io") {
            content { includeGroupByRegex("com\\.github\\.[Tt]eam[Nn]ew[Pp]ipe.*") }
        }
    }
}

rootProject.name = "DanceDance"
include(":app")
