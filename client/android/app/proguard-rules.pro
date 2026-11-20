# Flutter Core and Embedder
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.common.** { *; }
-keep class io.flutter.plugin.platform.** { *; }
-keep class io.flutter.plugins.** { *; }

# WireGuard Tunnel Library
-keep class com.wireguard.** { *; }
-dontwarn com.wireguard.**

# Keep annotations, signatures, and reflection metadata
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# General Android Parcelable and Enum preservation for JNI/Reflection safety
-keepclassmembers class * extends android.app.Activity {
    public void *(android.view.View);
}

-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}
