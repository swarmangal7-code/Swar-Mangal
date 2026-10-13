plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing is supplied through `android/key.properties` (git-ignored).
// Template:
//   storePassword=...
//   keyPassword=...
//   keyAlias=...
//   storeFile=../keystore/release.jks
// If the file is absent, release falls back to debug signing so `flutter build
// apk --release` keeps working in development. NEVER commit key.properties or
// a keystore. See BACKEND_SETUP.md "Android release signing".
import java.util.Properties
import java.io.FileInputStream

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

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
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Real keystore when key.properties exists; debug signing otherwise.
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
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