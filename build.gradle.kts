buildscript {
    // The Android Gradle Plugin lives only on Google's Maven; skip it for JVM-only builds.
    val jvmOnly = providers.gradleProperty("jvmOnly").orNull == "true"
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        if (!jvmOnly) classpath("com.android.tools.build:gradle:8.7.3")
    }
}

plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.kotlin.compose) apply false
}
