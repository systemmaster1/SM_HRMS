plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // Reads app/google-services.json (written by CI from the GOOGLE_SERVICES_JSON secret).
    id("com.google.gms.google-services")
}

android {
    namespace = "in.systemmaster.hrms"
    compileSdk = 36

    defaultConfig {
        applicationId = "in.systemmaster.hrms"
        minSdk = 26
        targetSdk = 36
        versionCode = 11
        versionName = "1.8.2"
        buildConfigField("String", "WEB_APP_URL", "\"https://hrms.systemmaster.in\"")
    }

    buildFeatures { buildConfig = true }

    // One permanent release key. Every APK must be signed with the SAME key,
    // otherwise Android refuses to update the installed app ("App not installed").
    // The key comes from GitHub Secrets (see .github/workflows/android-apk.yml).
    signingConfigs {
        create("release") {
            val ks = System.getenv("SMHRMS_KEYSTORE_PATH")
            if (!ks.isNullOrBlank()) {
                storeFile = file(ks)
                storePassword = System.getenv("SMHRMS_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("SMHRMS_KEY_ALIAS")
                keyPassword = System.getenv("SMHRMS_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
}
