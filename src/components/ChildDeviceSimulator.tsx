import React, { useState } from 'react';
import { Device, PermId, PermissionState } from '../types/aman';
import { amanStore, PRESET_LOCATIONS, getConnectionStatus } from '../services/store';
import { translations } from '../i18n/translations';
import { 
  Smartphone, 
  Shield, 
  MapPin, 
  Home, 
  RefreshCw, 
  Battery, 
  BatteryCharging, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Navigation,
  Play,
  RotateCcw,
  Unlink,
  Check,
  ChevronRight,
  ShieldAlert,
  Video,
  Mic,
  Camera,
  Square
} from 'lucide-react';

interface ChildDeviceSimulatorProps {
  lang: 'ar' | 'en';
}

export const ChildDeviceSimulator: React.FC<ChildDeviceSimulatorProps> = ({ lang }) => {
  const t = translations[lang];
  const state = amanStore.getState();
  const activeDevices = state.devices.filter((d) => d.status === 'active');
  
  // Currently simulated device
  const currentDeviceId = state.activeChildDeviceId || activeDevices[0]?.id;
  const simulatedDevice = state.devices.find((d) => d.id === currentDeviceId);

  // Pairing state if no active device or user wants to pair a new one
  const [pairingInputCode, setPairingInputCode] = useState('');
  const [pairingPreview, setPairingPreview] = useState<{ familyName: string; childName: string } | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isPairingBusy, setIsPairingBusy] = useState(false);

  // Wizard state (for permissions walkthrough)
  const [wizardStep, setWizardStep] = useState<number | null>(null);

  // Child bottom navigation tab in mobile
  const [childTab, setChildTab] = useState<'home' | 'permissions'>('home');

  // Simulation controls
  const [simBattery, setSimBattery] = useState(simulatedDevice?.deviceStatus.battery || 85);
  const [simIsCharging, setSimIsCharging] = useState(simulatedDevice?.deviceStatus.isCharging || false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const notifySim = (msg: string) => {
    setSimMessage(msg);
    setTimeout(() => setSimMessage(null), 3000);
  };

  const handleVerifyPairingCode = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPairingBusy(true);
    setPairingError(null);

    const code = pairingInputCode.trim().toUpperCase();
    const found = amanStore.previewPairingCode(code);

    if (found) {
      setPairingPreview({ familyName: found.familyName, childName: found.childName });
    } else {
      setPairingError(lang === 'ar' ? 'الرمز غير صحيح أو انتهت صلاحيته (10 دقائق).' : 'Invalid or expired pairing code.');
    }
    setIsPairingBusy(false);
  };

  const handleConfirmPairing = () => {
    if (!pairingInputCode) return;
    setIsPairingBusy(true);

    const dev = amanStore.redeemPairingCode(pairingInputCode.trim().toUpperCase(), {
      deviceName: `${pairingPreview?.childName}'s Android`,
      manufacturer: 'Samsung',
      model: 'Galaxy A54',
      sdk: 34
    });

    if (dev) {
      setPairingPreview(null);
      setPairingInputCode('');
      setWizardStep(0); // Start permission wizard!
      notifySim(lang === 'ar' ? 'تم ربط الجهاز بنجاح! انتقل لمعالج الصلاحيات' : 'Device paired! Proceeding to permission wizard');
    }
    setIsPairingBusy(false);
  };

  const handleSelectSimulatedLocation = (preset: typeof PRESET_LOCATIONS[0]) => {
    if (!simulatedDevice) return;
    amanStore.simulateChildMovement(
      simulatedDevice.id,
      preset.lat,
      preset.lng,
      'manual',
      lang === 'ar' ? preset.nameAr : preset.nameEn
    );
    notifySim(lang === 'ar' ? `تم نقل موقع الطفل إلى: ${preset.nameAr}` : `Location moved to: ${preset.nameEn}`);
  };

  const handleToggleSimPermission = (permId: PermId) => {
    if (!simulatedDevice) return;
    const currentState = simulatedDevice.currentPermissions[permId]?.state;
    const newState: PermissionState = currentState === 'GRANTED' ? 'REVOKED' : 'GRANTED';
    amanStore.updatePermission(simulatedDevice.id, permId, newState);
    notifySim(
      lang === 'ar' 
        ? `تم تغيير صلاحية (${permId}) إلى: ${newState === 'GRANTED' ? 'ممنوحة' : 'مسحوبة (تنبيه للأب)'}` 
        : `Permission (${permId}) updated to: ${newState}`
    );
  };

  const handleUpdateBattery = (value: number) => {
    setSimBattery(value);
    if (simulatedDevice) {
      amanStore.updateBattery(simulatedDevice.id, value, simIsCharging);
    }
  };

  const handleToggleCharging = () => {
    const nextCharging = !simIsCharging;
    setSimIsCharging(nextCharging);
    if (simulatedDevice) {
      amanStore.updateBattery(simulatedDevice.id, simBattery, nextCharging);
      notifySim(nextCharging ? 'تم توصيل الشاحن' : 'تم فصل الشاحن');
    }
  };

  const handleSimulateAppUsage = (pkg: string, name: string, category: any, minutes: number) => {
    if (!simulatedDevice) return;
    amanStore.addAppUsage(simulatedDevice.id, { pkg, name, category, minutes });
    notifySim(lang === 'ar' ? `تم إضافة ${minutes} دقيقة استخدام لتطبيق: ${name}` : `Logged ${minutes} min usage for ${name}`);
  };

  const handleChildUnlink = () => {
    if (!simulatedDevice) return;
    if (window.confirm(lang === 'ar' ? 'هل يريد الطفل إلغاء ربط جهازه من هذه العائلة؟' : 'Unlink this device from the family?')) {
      amanStore.unlinkDevice(simulatedDevice.id, 'device');
      notifySim(lang === 'ar' ? 'تم إلغاء الربط من جهة الطفل.' : 'Device unlinked by child.');
    }
  };

  const permList: { id: PermId; name: string }[] = [
    { id: 'location_fine', name: t.permLocationFine },
    { id: 'location_background', name: t.permLocationBg },
    { id: 'location_services', name: t.permLocationServices },
    { id: 'notifications', name: t.permNotifications },
    { id: 'usage_access', name: t.permUsage },
    { id: 'battery_opt', name: t.permBattery },
    { id: 'camera', name: lang === 'ar' ? 'الكاميرا' : 'Camera' },
    { id: 'microphone', name: lang === 'ar' ? 'الميكروفون' : 'Microphone' },
  ];

  const pendingLiveSession = state.liveSessions.find(
    (s) => s.deviceId === simulatedDevice?.id && s.status === 'requested'
  );
  const activeLiveSession = state.liveSessions.find(
    (s) => s.deviceId === simulatedDevice?.id && (s.status === 'active' || s.status === 'connecting')
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* Phone Mockup Canvas (Columns 1-7) */}
      <div className="lg:col-span-7 flex flex-col items-center">
        
        {/* Device Switcher bar if multiple devices */}
        {activeDevices.length > 1 && (
          <div className="flex items-center gap-2 mb-4 bg-slate-900 border border-slate-800 p-2 rounded-2xl text-xs">
            <span className="text-slate-400 font-medium px-2">
              {lang === 'ar' ? 'الجهاز المعروض بالمحاكي:' : 'Simulated Device:'}
            </span>
            {activeDevices.map((d) => (
              <button
                key={d.id}
                onClick={() => amanStore.setActiveChildDeviceId(d.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  d.id === simulatedDevice?.id
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {d.childName}
              </button>
            ))}
          </div>
        )}

        {/* Realistic Mobile Frame */}
        <div className="relative w-full max-w-[360px] h-[700px] bg-slate-950 rounded-[48px] p-3 shadow-2xl ring-8 ring-slate-800/80 border-4 border-slate-700/60 overflow-hidden flex flex-col justify-between">
          
          {/* Dynamic Island / Camera Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-40 flex items-center justify-end px-3">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-1 ring-slate-800"></div>
          </div>

          {/* Status Bar */}
          <div className="w-full pt-3 px-6 pb-2 flex items-center justify-between text-[11px] text-slate-400 font-mono z-30">
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px]">5G</span>
              <div className="flex items-center gap-1">
                <span>{simulatedDevice?.deviceStatus.battery || 85}%</span>
                {simulatedDevice?.deviceStatus.isCharging ? (
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Battery className="w-3.5 h-3.5" />
                )}
              </div>
            </div>
          </div>

          {/* Mobile Screen Content */}
          <div className="relative flex-1 bg-slate-900 rounded-[36px] overflow-y-auto overflow-x-hidden text-slate-100 flex flex-col p-4 shadow-inner">
            
            {/* Condition 1: Not Paired / Pairing Screen */}
            {!simulatedDevice || simulatedDevice.status !== 'active' ? (
              <div className="flex-1 flex flex-col justify-center space-y-4 py-6">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-7 h-7" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-white">{t.childPairTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed px-2">
                    {t.childPairHint}
                  </p>
                </div>

                {!pairingPreview ? (
                  <form onSubmit={handleVerifyPairingCode} className="space-y-3">
                    <input
                      type="text"
                      maxLength={8}
                      value={pairingInputCode}
                      onChange={(e) => setPairingInputCode(e.target.value.toUpperCase())}
                      placeholder="AMAN7842"
                      className="w-full text-center tracking-widest font-mono text-xl py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />

                    {pairingError && (
                      <p className="text-xs text-rose-400 text-center">{pairingError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={pairingInputCode.length < 6 || isPairingBusy}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      {t.childPairCheck}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400">{lang === 'ar' ? 'العائلة المعثور عليها:' : 'Family Found:'}</span>
                      <p className="text-sm font-bold text-emerald-400">{pairingPreview.familyName}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400">{lang === 'ar' ? 'ملف الطفل:' : 'Child Profile:'}</span>
                      <p className="text-sm font-bold text-white">{pairingPreview.childName}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {lang === 'ar' 
                        ? 'سيقوم هذا الجهاز بمشاركة بيانات الموقع واستخدام التطبيقات مع أولياء أمور هذه العائلة فقط.' 
                        : 'This device will share location fixes and usage stats with parents of this family only.'}
                    </p>
                    <button
                      onClick={handleConfirmPairing}
                      disabled={isPairingBusy}
                      className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
                    >
                      {t.childPairConfirm}
                    </button>
                    <button
                      onClick={() => setPairingPreview(null)}
                      className="w-full py-1 text-slate-400 text-[11px]"
                    >
                      {t.back}
                    </button>
                  </div>
                )}
              </div>
            ) : wizardStep !== null ? (
              /* Condition 2: Permission Wizard */
              <div className="flex-1 flex flex-col justify-between py-4 space-y-4">
                <div className="space-y-2 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === 'ar' ? 'معالج إعداد الصلاحيات' : 'Permission Setup Wizard'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {lang === 'ar' ? 'خطوة 1 من 6: منح الأذونات المطلوبة للمزامنة' : 'Step 1 of 6: Granting required sync permissions'}
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.permLocationFine}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {lang === 'ar' 
                      ? 'يطلب تطبيق أمان جارد صلاحية الموقع لإرسال إحداثيات تواجدك للأهل عند الحاجة.' 
                      : 'AmanGuard requests location permission to relay GPS coordinates to your parents.'}
                  </p>
                  <button
                    onClick={() => {
                      amanStore.updatePermission(simulatedDevice.id, 'location_fine', 'GRANTED');
                      setWizardStep(null);
                      notifySim(lang === 'ar' ? 'تم إنهاء معالج الصلاحيات بنجاح' : 'Permission setup completed');
                    }}
                    className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    {lang === 'ar' ? 'منح الصلاحية ومتابعة' : 'Grant Permission & Finish'}
                  </button>
                </div>
              </div>
            ) : childTab === 'home' ? (
              /* Condition 3: Child Home Screen */
              <div className="flex-1 flex flex-col justify-between space-y-3 py-2">
                <div className="space-y-3">
                  {/* Android 14+ Interactive Consent Dialog when Live Stream Requested */}
                  {pendingLiveSession && (
                    <div className="p-3.5 bg-rose-950/90 border-2 border-rose-500 rounded-2xl space-y-2.5 text-xs animate-in zoom-in-95 shadow-xl">
                      <div className="flex items-center gap-2 text-rose-300 font-bold">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>
                          {pendingLiveSession.type === 'screen'
                            ? (lang === 'ar' ? 'طلب مشاركة الشاشة (Android 14+)' : 'Screen Capture Request')
                            : pendingLiveSession.type === 'camera'
                            ? (lang === 'ar' ? 'طلب بث الكاميرا' : 'Camera Stream Request')
                            : (lang === 'ar' ? 'طلب الاستماع الصوتي' : 'Audio Stream Request')}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {pendingLiveSession.type === 'screen'
                          ? (lang === 'ar' 
                              ? 'طلب ولي الأمر بدء جلسة مشاركة لشاشة هذا الجهاز. يلزم نظام Android الحصول على موافقتك الصريحة لبدء التقاط الشاشة.' 
                              : 'Parent requested to view this device screen. Android requires explicit consent before starting MediaProjection.')
                          : pendingLiveSession.type === 'camera'
                          ? (lang === 'ar'
                              ? 'طلب ولي الأمر بث الكاميرا المباشر. سيظهر إشعار نظام مستمر في شريط الإشعارات طوال مدة البث.'
                              : 'Parent requested live camera stream. A persistent system notification will remain visible.')
                          : (lang === 'ar'
                              ? 'طلب ولي الأمر الاستماع للصوت المحيط عبر الميكروفون. سيظهر إشعار نظام مستمر في شريط الإشعارات.'
                              : 'Parent requested ambient audio listening. A persistent notification will remain visible.')}
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            amanStore.respondToLiveSession(pendingLiveSession.id, true);
                            notifySim(lang === 'ar' ? 'تمت الموافقة وبدء البث المباشر' : 'Live stream consented and started');
                          }}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          {lang === 'ar' ? 'موافقة وبدء البث' : 'Allow & Start'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            amanStore.respondToLiveSession(pendingLiveSession.id, false, 'declined_by_child');
                            notifySim(lang === 'ar' ? 'تم رفض طلب البث' : 'Live stream declined');
                          }}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          {lang === 'ar' ? 'رفض' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Android Foreground Service Persistent Notification Banner */}
                  {activeLiveSession && (
                    <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-2xl flex items-center justify-between text-xs animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <div>
                          <span className="text-[11px] font-bold text-rose-300 block">
                            {lang === 'ar' ? 'أمان جارد: بث مباشر قيد التشغيل' : 'AmanGuard: Active Live Stream'}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {lang === 'ar' ? 'خدمة أمامية مرئية بشريط إشعارات Android' : 'Persistent foreground service in status bar'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          amanStore.stopLiveSession(activeLiveSession.id, 'stopped_by_child');
                          notifySim(lang === 'ar' ? 'تم إيقاف البث من جهة الطفل' : 'Stream stopped by child');
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1"
                      >
                        <Square className="w-2.5 h-2.5 fill-current" />
                        <span>{lang === 'ar' ? 'إنهاء البث' : 'End'}</span>
                      </button>
                    </div>
                  )}

                  {/* Status header */}
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                        {lang === 'ar' ? 'حالة الحماية' : 'Protection Status'}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    </div>
                    <h4 className="text-sm font-bold text-white">
                      {lang === 'ar' ? `مرتبط بـ: ${state.family.name}` : `Linked to: ${state.family.name}`}
                    </h4>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>
                        {lang === 'ar' ? 'آخر مزامنة:' : 'Last sync:'} {new Date(simulatedDevice.deviceStatus.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                  </div>

                  {/* Active features list */}
                  <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-2 text-xs">
                    <span className="text-[11px] font-bold text-slate-300 block">
                      {lang === 'ar' ? 'الوظائف النشطة على هذا الجهاز:' : 'Active Services on Device:'}
                    </span>
                    <ul className="space-y-1.5 text-[11px] text-slate-400">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{lang === 'ar' ? 'تحديث الموقع كل 15 دقيقة دورياً' : 'Location updates every 15 mins'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{lang === 'ar' ? 'مزامنة تقرير وقت الشاشة اليومي' : 'Daily screen time sync'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{lang === 'ar' ? 'إشعار فوري عند خروج أو دخول المناطق الآمنة' : 'Instant safe zone enter/exit alerts'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{lang === 'ar' ? 'خدمة المراقبة المباشرة (شاشة، كاميرا، صوت) بإشعار أمامي' : 'Live monitoring service (Screen, Camera, Mic) with foreground notice'}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Privacy boundary badge */}
                  <div className="p-3 bg-indigo-950/20 border border-indigo-800/30 rounded-2xl text-[10px] text-indigo-300 leading-relaxed">
                    🛡️ {t.liveUnavailable}
                  </div>
                </div>

                {/* Unlink from child side */}
                <button
                  onClick={handleChildUnlink}
                  className="w-full py-2.5 px-3 bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/40 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إلغاء ربط هذا الجهاز' : 'Unlink Device'}</span>
                </button>
              </div>
            ) : (
              /* Child Permissions Screen */
              <div className="flex-1 space-y-3 py-2 overflow-y-auto">
                <h4 className="text-xs font-bold text-white mb-2">
                  {lang === 'ar' ? 'صلاحيات التطبيق على هذا الجهاز' : 'Permissions on this phone'}
                </h4>
                <div className="space-y-2">
                  {permList.map((p) => {
                    const isGranted = simulatedDevice.currentPermissions[p.id]?.state === 'GRANTED';
                    return (
                      <div
                        key={p.id}
                        className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <span className="text-[11px] text-slate-300">{p.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isGranted 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isGranted ? t.permGranted : t.permDenied}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile Bottom Navigation Bar */}
            {simulatedDevice && simulatedDevice.status === 'active' && wizardStep === null && (
              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-around text-xs">
                <button
                  onClick={() => setChildTab('home')}
                  className={`flex flex-col items-center gap-1 ${
                    childTab === 'home' ? 'text-emerald-400 font-bold' : 'text-slate-500'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span className="text-[10px]">{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
                </button>
                <button
                  onClick={() => setChildTab('permissions')}
                  className={`flex flex-col items-center gap-1 ${
                    childTab === 'permissions' ? 'text-emerald-400 font-bold' : 'text-slate-500'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-[10px]">{lang === 'ar' ? 'الصلاحيات' : 'Perms'}</span>
                </button>
              </div>
            )}

          </div>

          {/* Android Navigation Bar Pill */}
          <div className="w-full pb-2 pt-2 flex items-center justify-center">
            <div className="w-32 h-1 bg-slate-600 rounded-full"></div>
          </div>
        </div>

      </div>

      {/* Simulator Control Cockpit (Columns 8-12) */}
      <div className="lg:col-span-5 space-y-5">
        
        {/* Cockpit Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {lang === 'ar' ? 'غرفة التحكم بمحاكاة جهاز الطفل' : 'Child Device Simulator Controls'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'تحكم في إحداثيات ومستوى بطارية وصلاحيات الجهاز لاختبار ردود أفعال الخادم' : 'Simulate GPS movement, battery changes, and permission revocations'}
              </p>
            </div>
          </div>

          {/* Toast feedback in cockpit */}
          {simMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{simMessage}</span>
            </div>
          )}

          {/* Location Presets */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block">
              {lang === 'ar' ? '1. محاكاة تحرك الطفل إلى موقع محدد:' : '1. Simulate Child GPS Location:'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_LOCATIONS.map((preset) => (
                <button
                  key={preset.nameEn}
                  onClick={() => handleSelectSimulatedLocation(preset)}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-xs text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-2 text-right rtl:text-right ltr:text-left"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{lang === 'ar' ? preset.nameAr : preset.nameEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Battery Simulator */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                {lang === 'ar' ? '2. تعديل نسبة البطارية:' : '2. Simulate Battery Level:'}
              </span>
              <span className="font-mono font-bold text-emerald-400">{simBattery}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="100"
                value={simBattery}
                onChange={(e) => handleUpdateBattery(Number(e.target.value))}
                className="flex-1 accent-emerald-500 cursor-pointer"
              />
              <button
                onClick={handleToggleCharging}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  simIsCharging
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <BatteryCharging className="w-3.5 h-3.5" />
                <span>{simIsCharging ? t.charging : t.notCharging}</span>
              </button>
            </div>
          </div>

          {/* Permission Revocation Simulation */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                {lang === 'ar' ? '3. اختبار سحب الصلاحيات (يُرسل تنبيه فوري للأب):' : '3. Toggle Permission (Triggers alert if revoked):'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {permList.map((p) => {
                const isGranted = simulatedDevice?.currentPermissions[p.id]?.state === 'GRANTED';
                return (
                  <button
                    key={p.id}
                    onClick={() => handleToggleSimPermission(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                      isGranted
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-500/40'
                        : 'bg-rose-950/40 text-rose-300 border-rose-500/40 hover:bg-emerald-950/40 hover:text-emerald-300 hover:border-emerald-500/40'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono">
                      {isGranted ? '✓' : '✕'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simulate App Activity */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block">
              {lang === 'ar' ? '4. محاكاة تشغيل تطبيق (إضافة 15 دقيقة استخدام):' : '4. Simulate App Usage (+15 min):'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSimulateAppUsage('com.roblox.client', 'Roblox', 'games', 15)}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition cursor-pointer text-center"
              >
                🎮 Roblox (+15m)
              </button>
              <button
                onClick={() => handleSimulateAppUsage('com.google.android.youtube', 'YouTube Kids', 'entertainment', 15)}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition cursor-pointer text-center"
              >
                📺 YouTube Kids (+15m)
              </button>
              <button
                onClick={() => handleSimulateAppUsage('com.duolingo', 'Duolingo', 'education', 15)}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition cursor-pointer text-center"
              >
                🦉 Duolingo (+15m)
              </button>
              <button
                onClick={() => handleSimulateAppUsage('com.whatsapp', 'WhatsApp', 'social', 15)}
                className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 transition cursor-pointer text-center"
              >
                💬 WhatsApp (+15m)
              </button>
            </div>
          </div>

          {/* Instant Heartbeat Sync button */}
          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                if (simulatedDevice) {
                  amanStore.simulateChildMovement(simulatedDevice.id, undefined, undefined, 'periodic');
                  notifySim(lang === 'ar' ? 'تم إرسال نبضة مزامنة فورية وتحديث آخر اتصال' : 'Heartbeat sync dispatched');
                }
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t.childSyncNow}</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
