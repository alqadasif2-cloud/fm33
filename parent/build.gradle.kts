plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}
android {
    namespace = "com.amanguard.parent"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.amanguard.parent"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        // Google Maps key comes from env/gradle property, never from the repo.
        manifestPlaceholders["MAPS_API_KEY"] = (System.getenv("MAPS_API_KEY") ?: (project.findProperty("MAPS_API_KEY") as String?) ?: "")
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
}
dependencies {
    implementation(project(":core"))
    implementation("com.google.maps.android:maps-compose:6.1.0")
    implementation("com.google.android.gms:play-services-maps:18.2.0")
    implementation("com.google.zxing:core:3.5.3")
}
