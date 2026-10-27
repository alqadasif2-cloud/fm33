# تقرير الحالة الصادقة والشاملة لمنظومة AmanGuard Family
**تاريخ الفحص والتحديث:** 25 أكتوبر 2026  
**المستودع المستهدف:** `alqadasif2-cloud/aman1.git`  
**البيئة الحالية:** Node.js Web Runtime (AI Studio) + مستودع Android الأصلي (Kotlin + Jetpack Compose)

---

## 1. تصنيف الحالات المعتمد
- ✅ **منفذة ومختبرة فعلياً:** كود مكتمل واختُبر آلياً أو وظيفياً.
- 🟡 **منفذة برمجياً (بانتظار هاتف حقيقي أو مفاتيح Firebase):** كود أصلي مكتوب بالكامل في Kotlin أو TypeScript، ويتطلب جهازي Android أو مشروع Firebase للاختبار الميداني.
- 🧪 **محاكاة تجريبية (Demo Simulation):** نماذج تشغيل تفاعلية في المتصفح لتوضيح السلوك واختبار تدفق البيانات بدون الحاجة لجهازين فعليين.
- 🖥️ **واجهة فقط:** شاشة أو زر دون ربط خلفي.
- ❌ **غير منفذة:** ميزة مؤجلة أو غير مدعومة في إصدار v1.
- ⚠️ **تعذر اختبارها محلياً بسبب قيود البيئة:** عدم توفر Android SDK / Gradle محلياً في حاوية الويب، مع إتاحة البناء عبر GitHub Actions.

---

## 2. جدول حالة الوظائف التفصيلي

| الوظيفة / المكون | الحالة الفعلية | نوع التنفيذ والملفات المسؤولة | تفاصيل الصدق والقيود |
|---|---|---|---|
| **بناء Android (APK)** | ⚠️ تعذر محلياً / ✅ مدعوم عبر GitHub | `build.gradle.kts`, `.github/workflows/build-amanguard.yml` | بيئة حاوية AI Studio هي بيئة Node.js لا تحتوي على Android SDK أو Gradle محلياً. تم بناء workflow آلي متكامل على GitHub Actions لتنزيل APK لولي الأمر والطفل. |
| **ربط الجهاز (Pairing Code & QR)** | 🟡 منفذة برمجياً + 🧪 محاكاة | `child/MainActivity.kt`, `parent/Screens.kt`, `functions/src/index.ts` | الرمز 8 خانات أحادي الاستخدام لمدة 10 دقائق مشفر ومحمي من التخمين بـ rate limiting. في الويب: محاكاة تفاعلية تتيح نسخ الرمز ومسحه. |
| **الموقع الجغرافي الدوري (Periodic GPS)** | 🟡 منفذة برمجياً + 🧪 محاكاة | `child/Tasks.kt (captureLocation)`, `LocationWorker.kt` | في Android: يستخدم `FusedLocationProviderClient` مع صلاحيات الخلفية والـ GPS الفعلي. في الويب: محاكاة إحداثيات الرياض. |
| **الأمر الفوري لتحديث الموقع** | 🟡 منفذة برمجياً + 🧪 محاكاة | `CommandTypes.LOCATION_REFRESH`, `CommandWorker.kt` | في Android: يطلب موقع عالي الدقة فورياً فور وصول رسالة FCM ويرفعه لـ Firestore. |
| **المناطق الآمنة (Geofencing)** | 🟡 منفذة برمجياً + 🧪 محاكاة | `functions/src/index.ts (onLocationCreated)` | حساب مسافات Haversine خادمي مع هامش أمان (40 متر Hysteresis) لمنع التذبذب. |
| **حظر التطبيقات (App Blocking)** | 🟡 منفذة برمجياً (جديد) | `child/AmanAccessibilityService.kt`, `BlockedAppActivity.kt`, `RulesStore.kt` | نُفّذت عبر `AccessibilityService` في Android: تعترض تشغيل الحزم المحظورة وتُخرج المستخدم للشاشة الرئيسية فوراً وتعرض شاشة الحظر. |
| **وقت الشاشة وجدول النوم (Screen Time & Bedtime)** | 🟡 منفذة برمجياً (جديد) | `child/RulesStore.kt`, `child/Tasks.kt (syncRules)`, `Workers.kt` | تم برمجة جدول النوم (مثل 22:00 إلى 06:00) وفحص النوافذ الزمنية وفرض التقييد تلقائياً. |
| **مزامنة الأوامر (Command Lifecycle)** | 🟡 منفذة برمجياً + 🧪 محاكاة | `functions/src/index.ts (sendCommand)`, `Workers.kt` | دورة حياة موثقة (`sent` → `received` → `applied` / `failed`) مع منع التكرار خلال 30 ثانية. |
| **تقرير استخدام التطبيقات** | 🟡 منفذة برمجياً | `child/Tasks.kt (syncUsage)` | يستخدم `UsageStatsManager` الفعلي في Android لقراءة دقائق تشغيل التطبيقات آخر 7 أيام. |
| **مخزون التطبيقات (App Inventory)** | 🟡 منفذة برمجياً | `child/Tasks.kt (syncInventory)` | يستخدم `PackageManager` واستعلام `CATEGORY_LAUNCHER` لجلب أسماء التطبيقات القابلة للتشغيل. |
| **معالج الصلاحيات الستة (Permissions)** | ✅ مختبر منطقياً + 🟡 منفذ | `core/LogicTest.kt`, `child/PermissionManager.kt` | يختبر بدقة حالات: `GRANTED`, `DENIED`, `NEEDS_MANUAL`, `REVOKED`, `PARTIAL`. |
| **تنبيه سحب الصلاحيات** | 🟡 منفذة برمجياً | `functions/src/index.ts (onPermissionsWritten)` | يُطلق Cloud Function تنبيهاً فورياً عند تحول أي صلاحية من GRANTED إلى حالة أخرى. |
| **كشف انقطاع الجهاز (Offline Check)** | 🟡 منفذة برمجياً | `functions/src/index.ts (checkOfflineDevices)` | فحص دوري مجدول كل 15 دقيقة؛ إذا تجاوز آخر اتصال 45 دقيقة يُرسل تنبيه انقطاع. |
| **بث الشاشة / الكاميرا / الميكروفون المباشر** | 🟡 منفذة برمجياً في Android وFirebase + 🧪 محاكاة تفاعلية | `child/LiveSessionService.kt`, `child/ScreenCaptureConsentActivity.kt`, `parent/Screens.kt`, `functions/src/index.ts` | **منفذة برمجياً بالكود الأصلي:** مشاركة الشاشة عبر `MediaProjection` (مع موافقة تفاعلية لكل جلسة على Android 14+)، وبث الكاميرا الأمامية/الخلفية عبر `CameraManager`، والاستماع عبر `AudioRecord` كخدمة أمامية `mediaProjection\|camera\|microphone` مع إشعار نظام مستمر وزر إيقاف فوري للطفل. استدعاءات Cloud Functions مؤمّنة في Firestore وFCM. |
| **حماية الويب وتصفية المواقع** | ❌ غير منفذة | — | تتطلب VPN محلي أو VpnService لتصفية DNS / SNI. |
| **مزامنة إشعارات المحادثات** | ❌ غير منفذة | — | تتطلب `NotificationListenerService`. |

---

## 3. تدقيق بيانات واجهة الويب (أحمد، سارة، الرياض)
- **بيانات الأطفال الحالية المعروضة في واجهة الويب (`احمد`، `سارة`، بطارية 84%، إحداثيات الرياض):**  
  هي **بيانات محاكاة تجريبية (Demo Data)** مخزنة محلياً في `localStorage` لتمكين المعاينة التفاعلية والتطوير السريع في بيئة الويب دون الحاجة لربط هاتفين فعليين فوراً.
- **الوضع الفعلي (Live Mode):**  
  أُضيف خيار واضح في واجهة الويب يُبيّن للمستخدم ما إذا كان التطبيق يعمل بـ **وضع المحاكاة (Simulation Mode)** أو بـ **وضع الربط الحي مع Firebase (Live Firebase Mode)**، مع زر للربط ببيانات مشروع Firebase الفعلي وتوثيق عدم الخلط بين التجريبي والواقعي.

---

## 4. مسار ملفات Android وملفات البناء الناتجة
- **كود تطبيق ولي الأمر:** `/parent/src/main/java/com/amanguard/parent/`
- **كود تطبيق الطفل:** `/child/src/main/java/com/amanguard/child/`
- **المكتبة المشتركة:** `/core/src/main/java/com/amanguard/core/`
- **ملف بناء GitHub Actions:** `/.github/workflows/build-amanguard.yml`
- **مسار ملفات APK الناتجة عند البناء على GitHub:**
  - `parent/build/outputs/apk/debug/parent-debug.apk`
  - `child/build/outputs/apk/debug/child-debug.apk`
