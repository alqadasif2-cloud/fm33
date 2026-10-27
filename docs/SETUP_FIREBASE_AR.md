# إعداد Firebase

1. أنشئ مشروعًا في Firebase Console (خطة Blaze مطلوبة لـ Cloud Functions).
2. فعّل **Authentication**: Email/Password و **Anonymous** (لأجهزة الأطفال).
3. أنشئ **Firestore** (وضع الإنتاج).
4. أضف تطبيقي Android إلى المشروع نفسه: `com.amanguard.parent` و `com.amanguard.child`. أضف بصمة SHA-1 لكل منهما (مطلوبة لـ Play Integrity)، ونزّل `google-services.json` لكل تطبيق.
5. فعّل **Cloud Messaging** و **App Check** (Play Integrity). أثناء الاختبار استخدم Debug provider وسجّل رمز التصحيح من Logcat في App Check.
6. انشر الخادم من جهازك:
   ```
   npm i -g firebase-tools && firebase login
   firebase use --add
   firebase deploy --only firestore,functions
   ```
7. بعد التأكد أن التطبيقين يعملان مع App Check، اضبط متغير `ENFORCE_APPCHECK=true` للدوال وأعد النشر.
8. مفتاح Google Maps: فعّل Maps SDK for Android وقيّد المفتاح بحزمة التطبيق (`com.amanguard.parent`). لا تضعه في المستودع.
9. Realtime Database: غير مستخدمة في هذا الإصدار (الحالة تُحدَّث عبر Firestore).
