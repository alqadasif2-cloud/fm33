import React from 'react';
import { X, Code2, Database, Shield, FileText, CheckCircle2, AlertCircle, ExternalLink, GitBranch } from 'lucide-react';

interface ArchitectureInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export const ArchitectureInfoModal: React.FC<ArchitectureInfoModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-y-auto text-slate-100">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <GitBranch className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {lang === 'ar' ? 'معمارية مستودع AmanGuard Family' : 'AmanGuard Family Architecture'}
            </h2>
            <p className="text-xs text-slate-400">
              {lang === 'ar' 
                ? 'توثيق البنية التقنية لمستودع GitHub المستورد (Kotlin Compose + Firebase)' 
                : 'Imported repository breakdown (Kotlin Compose multi-module + Firebase Functions)'}
            </p>
          </div>
        </div>

        {/* Architecture Grid */}
        <div className="space-y-6 text-xs text-slate-300">
          
          {/* Modules Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'ar' ? 'الوحدات البرمجية الأصلية في المستودع:' : 'Original Modules in Repository:'}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-mono font-bold text-emerald-400 block">parent/</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'ar' 
                    ? 'تطبيق ولي الأمر بنظام Android (Jetpack Compose). يحتوي على واجهات المتابعة، طلب الأوامر الفورية، إنشاء رموز الربط، وإدارة المناطق الآمنة.' 
                    : 'Parent Android app in Jetpack Compose: Dashboard, real-time map, command dispatch, safe zones.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-mono font-bold text-sky-400 block">child/</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'ar' 
                    ? 'تطبيق الطفل (Child App). يحتوي على معالج الصلاحيات (PermissionWizard)، وخدمات الخلفية لمزامنة الموقع كل 15 دقيقة، واستقبال أوامر FCM.' 
                    : 'Child Android app: Permission wizard, background location tracking workers, FCM command receiver.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-mono font-bold text-indigo-400 block">core/</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'ar' 
                    ? 'المكتبة المشتركة (Core Library). تحتوي على نماذج البيانات المشتركة (Models)، وحالات الصلاحيات، ومحددات وقت الاتصال (Freshness).' 
                    : 'Shared library: Data models, permissions state machine, connection freshness calculations.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="font-mono font-bold text-amber-400 block">functions/ (Cloud Functions)</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'ar' 
                    ? 'وظائف سحابية في TypeScript: التحقق من رمز الربط، إرسال الأوامر مع منع التكرار (30 ثانية)، فحص المناطق الآمنة بهامش أمان (40 متر)، وكشف الأجهزة غير المتصلة.' 
                    : 'Cloud Functions: Pairing code redeem, command deduplication (30s), geofence hysteresis (40m), offline detection.'}
                </p>
              </div>
            </div>
          </div>

          {/* Firestore Security Rules */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'ar' ? 'قواعد أمان Firestore (firestore.rules):' : 'Firestore Security Rules:'}</span>
            </h3>
            <p className="text-slate-400 leading-relaxed">
              {lang === 'ar' 
                ? 'تطبيق قواعد أمان صارمة تعتمد على التحقق من أن request.auth.uid ينتمي لأعضاء العائلة أو أنه الجهاز المربوط نفسه (isDevice). رموز الربط ومعدلات الطلبات محمية على مستوى الخادم فقط.' 
                : 'Strict rules enforce request.auth.uid membership. Devices can only update their own status/location/permissions, while parents can dispatch commands.'}
            </p>
          </div>

          {/* Honest Status Breakdown */}
          <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-2 text-amber-200">
            <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{lang === 'ar' ? 'حالة الوظائف الفعلية (شفافية كاملة وفقاً لـ FEATURE_STATUS_AR.md):' : 'Honest Feature Status (FEATURE_STATUS_AR.md):'}</span>
            </h3>
            <div className="space-y-1 text-[11px]">
              <p>✅ <strong>{lang === 'ar' ? 'منفذ بالكامل:' : 'Fully Implemented:'}</strong> {lang === 'ar' ? 'الموقع الدوري كل 15 دقيقة، الأوامر الفورية، كشف المناطق الآمنة، تقارير الاستخدام، الربط برمز 8 خانات/QR، وفحص الصلاحيات الستة.' : 'Periodic GPS, instant commands, geofencing with hysteresis, usage reports, 8-char QR pairing, permissions audit.'}</p>
              <p>⚠️ <strong>{lang === 'ar' ? 'غير منفذ في الإصدار الأولي (قيود نظام):' : 'Intentionally Not Implemented in v1:'}</strong> {lang === 'ar' ? 'حظر التطبيقات الإلزامي ووقت الشاشة المقفل (يتطلب إذن Accessibility أو Device Owner)، بث الشاشة أو الكاميرا الحية (لم تُنفذ لضمان الخصوصية).' : 'Hard app blocking (requires Device Owner), live screen/camera streaming (omitted for privacy).'}</p>
            </div>
          </div>

        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition"
          >
            {lang === 'ar' ? 'إغلاق التوثيق' : 'Close Architecture Docs'}
          </button>
        </div>

      </div>
    </div>
  );
};
