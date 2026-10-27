# النشر والبناء على GitHub

1. ارفع المشروع إلى مستودع **خاص**.
2. حوّل الملفين إلى base64 وأضفهما في Settings → Secrets → Actions:
   - `GOOGLE_SERVICES_PARENT_B64` = `base64 -w0 parent/google-services.json`
   - `GOOGLE_SERVICES_CHILD_B64` = `base64 -w0 child/google-services.json`
   - `MAPS_API_KEY` = مفتاح الخرائط
3. Actions ← Build AmanGuard ← Run workflow. التنزيل: Artifacts ← AmanGuard-APKs (نسخ debug).
4. للإصدار (release): أنشئ keystore وأضفه كأسرار وأضف signingConfig، ثم استخدم `assembleRelease`. App Check يتطلب بصمة SHA-1 لنسخة التوقيع.
5. الخادم: `firebase deploy --only firestore,functions` (انظر SETUP_FIREBASE_AR.md).
6. التثبيت على الطفل: فعّل «مصادر غير معروفة» إن لزم، ثم اتبع معالج الربط والصلاحيات.
