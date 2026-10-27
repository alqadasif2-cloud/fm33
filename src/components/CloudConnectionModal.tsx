import React, { useState } from 'react';
import { amanStore, AmanState } from '../services/store';
import { translations } from '../i18n/translations';
import { 
  Cloud, 
  CloudOff, 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  LogIn, 
  Trash2, 
  UploadCloud, 
  Smartphone, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface CloudConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export const CloudConnectionModal: React.FC<CloudConnectionModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  if (!isOpen) return null;

  const t = translations[lang];
  const state: AmanState = amanStore.getState();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setFeedback(null);
    const res = await amanStore.signInWithGoogle();
    setLoading(false);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: lang === 'ar' ? 'تم تسجيل الدخول وتفعيل السحابة بنجاح!' : 'Signed in and connected to Firebase Cloud successfully!'
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || (lang === 'ar' ? 'تعذر تسجيل الدخول، يمكنك تجربة الجلسة المباشرة.' : 'Sign in failed.')
      });
    }
  };

  const handleGuestSignIn = async () => {
    setLoading(true);
    setFeedback(null);
    const res = await amanStore.signInAsGuestCloud();
    setLoading(false);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: lang === 'ar' ? 'تم بدء جلسة سحابية حية متصلة بـ Firebase!' : 'Live Firebase Cloud session started!'
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Connection failed'
      });
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await amanStore.signOutCloud();
    setLoading(false);
    setFeedback({
      type: 'success',
      message: lang === 'ar' ? 'تم تسجيل الخروج بنجاح.' : 'Signed out successfully.'
    });
  };

  const handleStartCleanFamily = async () => {
    const confirmMsg = lang === 'ar'
      ? 'هل أنت متأكد من تفريغ البيانات التجريبية (أحمد، سارة) والبدء بأسرة حقيقية فارغة لربط هواتف أطفالك؟'
      : 'Are you sure you want to clear demo data and start with an empty family to pair your real devices?';
    
    if (window.confirm(confirmMsg)) {
      setLoading(true);
      await amanStore.startCleanRealFamily();
      setLoading(false);
      setFeedback({
        type: 'success',
        message: lang === 'ar' ? 'تم إنشاء أسرة حقيقية جديدة وفارغة! يمكنك الآن إضافة هاتف طفلك.' : 'Clean family created! You can now pair your child device.'
      });
    }
  };

  const handleSyncCurrent = async () => {
    setLoading(true);
    await amanStore.syncCurrentStateToCloud();
    setLoading(false);
    setFeedback({
      type: 'success',
      message: lang === 'ar' ? 'تمت مزامنة البيانات الحالية مع Firestore بنجاح!' : 'Current state synced to Firestore!'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'الربط السحابي الفعلي (Firebase Live)' : 'Live Firebase Cloud Integration'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'مزامنة حقيقية بين لوحة الويب وهاتف أندرويد الفعلي' : 'Real-time synchronization with Android child devices'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Mode Selector Toggle */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {lang === 'ar' ? 'وضع تشغيل المنظومة:' : 'System Operating Mode:'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => amanStore.toggleCloudMode(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  !state.isLiveCloud 
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md' 
                    : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                {lang === 'ar' ? 'وضع التجربة (Demo)' : 'Demo Simulation'}
              </button>
              <button
                onClick={() => amanStore.toggleCloudMode(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  state.isLiveCloud 
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md' 
                    : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse"></span>
                <span>{lang === 'ar' ? 'سحابي حقيقي (Live)' : 'Live Cloud'}</span>
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {state.isLiveCloud 
              ? (lang === 'ar' 
                  ? 'الوضع الحي نشط: أي جهاز طفل حقيقي يُدخل رمز الاقتران سيرتبط مباشرة بقاعدة بيانات Firestore السحابية وستظهر بياناته هنا فورياً.'
                  : 'Live Mode active: Any real child device entering the pairing code will sync directly via Firestore.')
              : (lang === 'ar' 
                  ? 'وضع التجربة نشط: يستخدم بيانات وهمية مسبقة (أحمد، سارة) ومحاكي هاتف الطفل داخل المتصفح.'
                  : 'Demo Mode active: Uses preset simulation data and the in-browser phone simulator.')}
          </p>
        </div>

        {/* Cloud Account Status */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'ar' ? 'حساب ولي الأمر السحابي' : 'Parent Cloud Account'}</span>
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              state.cloudUser 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                : 'bg-slate-800 text-slate-400'
            }`}>
              {state.cloudUser ? (lang === 'ar' ? 'متصل' : 'Connected') : (lang === 'ar' ? 'غير مسجل' : 'Not Signed In')}
            </span>
          </div>

          {state.cloudUser ? (
            <div className="space-y-3">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">{state.cloudUser.displayName}</span>
                  <span className="text-slate-400 text-[11px]">{state.cloudUser.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold border border-rose-500/30 transition cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.signOut}</span>
                </button>
              </div>

              {/* Real Cloud Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={handleStartCleanFamily}
                  disabled={loading}
                  className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left rtl:text-right transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                    <Trash2 className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'بدء أسرة حقيقية نظيفة' : 'Start Clean Family'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {lang === 'ar' ? 'إفراغ أجهزة التجربة والبدء من الصفر لربط طفلك' : 'Clear demo devices and pair real phone'}
                  </p>
                </button>

                <button
                  onClick={handleSyncCurrent}
                  disabled={loading}
                  className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left rtl:text-right transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs mb-1">
                    <UploadCloud className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'مزامنة الحالة الحالية' : 'Sync Current State'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {lang === 'ar' ? 'حفظ الأجهزة الحالية في سحابة Firestore' : 'Upload current state to Firestore'}
                  </p>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? 'سجّل الدخول للبدء بربط الأجهزة السحابية الفعلية وحفظ البيانات في مشروع Firebase الخاص بك.'
                  : 'Sign in to connect live devices and persist data to your Firebase project.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t.signInGoogle}</span>
                </button>
                <button
                  onClick={handleGuestSignIn}
                  disabled={loading}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'ar' ? 'جلسة سحابية فورية' : 'Instant Cloud Session'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Real Android App Connection Guide */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-white font-bold">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'ar' ? 'كيف يعمل الربط مع هاتف الطفل الحقيقي؟' : 'How Live Child Pairing Works'}</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
            <li>
              {lang === 'ar' 
                ? 'من لوحة التحكم، انقر على "إضافة جهاز طفل" لإنشاء رمز اقتران مكون من 8 أرقام ورمز QR.'
                : 'Click "Add Child Device" to generate an 8-character pairing code and QR code.'}
            </li>
            <li>
              {lang === 'ar'
                ? 'ثبّت ملف تطبيق أمان جارد للطفل (child-debug.apk) على هاتف الطفل الفعلي.'
                : 'Install the AmanGuard child APK (child-debug.apk) on the actual child phone.'}
            </li>
            <li>
              {lang === 'ar'
                ? 'افتح التطبيق على هاتف الطفل وأدخل رمز الاقتران؛ سيتصل التطبيق بقاعدة بيانات Firebase مباشرة.'
                : 'Open the app on the phone and enter the pairing code to connect to Firebase.'}
            </li>
            <li>
              {lang === 'ar'
                ? 'يتم تحديث الموقع الجغرافي والبطارية والأوامر بين الجهازين في الوقت الفعلي عبر السحابة.'
                : 'GPS coordinates, battery levels, and commands will sync in real time.'}
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            {t.confirm}
          </button>
        </div>

      </div>
    </div>
  );
};
