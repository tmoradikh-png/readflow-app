# The sherpa wrapper extracts classes.jar from its AAR, losing the AAR consumer rules.
# Its native library looks up these DTO fields, constructors and callbacks by name.
-keep class com.k2fsa.sherpa.onnx.** { *; }

# The boxed FloatArray callback is looked up by JNI, not by Kotlin's bridge method.
-keepclassmembers class com.sherpaonnx.SherpaOnnxTtsHelper$* {
    public java.lang.Integer invoke(float[]);
}

# Backport Expo PR51206: record options can fail when this annotation is renamed.
-keep @interface expo.modules.kotlin.records.Field { *; }

# Optional PDFBox JPX integration is not shipped or used by readFlow.
# PDF rendering/OCR uses Android PdfRenderer; original-page display uses PDFium.
-dontwarn com.gemalto.jp2.**
