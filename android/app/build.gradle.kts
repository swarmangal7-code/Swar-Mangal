plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing uses the COMMITTED shared debug key
// (build-keys/debug.jks, standard 'android' passwords) — deliberately, no
// private keystore anywhere in this pipeline. Founder decision: any machine
// must be able to cut a release with byte-identical signatures, so a lost
// key can never strand updates again. This is for internal sideload
// distribution only (own server, in-app updater); these APKs can never go
// to the Play Store, and anyone with repo access can sign updates the app
// accepts. See BACKEND_SETUP.md "Android signing".

// Push notifications (Firebase Cloud Messaging). The google-services plugin
// FAILS THE BUILD outright if google-services.json is missing, so it is only
// applied when that file actually exists — the app builds and runs fine
// without it, just with push disabled. Drop the real file (from the
// Firebase console, Android app registered as in.swarmangal.academy) at
// android/app/google-services.json to turn push on; no other change needed.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {
        namespace = "in.swarmangal.academy"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Required by flutter_local_notifications (used to show the
        // in-foreground push banner Android otherwise suppresses).
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "in.swarmangal.academy"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("sharedDebug") {
            keyAlias = "androiddebugkey"
            keyPassword = "android"
            storeFile = rootProject.file("../build-keys/debug.jks")
            storePassword = "android"
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("sharedDebug")
        }
    }
}

dependencies {
    // Required by flutter_local_notifications (isCoreLibraryDesugaringEnabled above).
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

flutter {
    source = "../.."
}