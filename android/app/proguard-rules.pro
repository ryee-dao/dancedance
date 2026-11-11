# Keep stack traces readable in logcat (the app is small; obfuscation buys nothing).
-dontobfuscate

# The JavaScript bridge: methods are looked up by name from the WebView.
-keepclassmembers class app.dancedance.tv.DanceBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# NewPipe Extractor (see its README) and Rhino, which it uses to run YouTube's player JS.
-keep class org.schabi.newpipe.extractor.timeago.patterns.** { *; }
-keep class org.mozilla.javascript.** { *; }
-keep class org.mozilla.javascript.engine.** { *; }
-keep class org.mozilla.classfile.ClassFileWriter
-dontwarn org.mozilla.javascript.JavaToJSONConverters
-dontwarn org.mozilla.javascript.tools.**
-keep class javax.script.** { *; }
-dontwarn javax.script.**
-keep class jdk.dynalink.** { *; }
-dontwarn jdk.dynalink.**
-keepclassmembers class * extends com.google.protobuf.GeneratedMessageLite { <fields>; }
-dontwarn com.google.re2j.**
-dontwarn org.jspecify.annotations.**

# OkHttp / Okio
-dontwarn okhttp3.**
-dontwarn okio.**
