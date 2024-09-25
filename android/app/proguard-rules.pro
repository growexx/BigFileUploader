# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Firebase Crashlytics
-keepattributes *Annotation*
-keep class com.google.firebase.crashlytics.** { *; }
-keep class com.google.firebase.analytics.** { *; }
-keep public class * extends java.lang.Exception

# Keep React Native classes
-keep class com.facebook.react.** { *; }

# Keep native modules and views
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Keep JS and other assets
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}

# Keep activities

# Keep all the native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom react-native-native libraries (if any)
# Example:
# -keep class com.example.mylibrary.** { *; }

# Optimization: Disable certain optimizations to prevent issues with reflection or dynamic class loading
-dontoptimize