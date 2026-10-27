import React, { useState } from 'react';
import { Device } from '../types/aman';
import { amanStore, getConnectionStatus } from '../services/store';
import { translations } from '../i18n/translations';
import { 
  Plus, 
  Smartphone, 
  Battery, 
  BatteryCharging, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight,
  Wifi,
  Sparkles,
  Radio,
  Layers
} from 'lucide-react';

interface ParentDashboardProps {
  onSelectDevice: (deviceId: string) => void;
  onOpenAddChild: () => void;
  lang: 'ar' | 'en';
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  onSelectDevice,
  onOpenAddChild,
  lang,
}) => {
  const t = translations[lang];
  const state = amanStore.getState();
  const activeDevices = state.devices.filter((d) => d.status === 'active');
  const unreadAlerts = state.alerts.filter((a) => !a.read);

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{state.family.name}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {lang === 'ar' ? 'لوحة المتابعة والرعاية الأبوية' : 'Parental Oversight Dashboard'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t.tagline}
            </p>
          </div>

          <button
            onClick={onOpenAddChild}
            className="px-5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            <span>{t.addChild}</span>
          </button>
        </div>

        {/* Ambient Light Accent */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Real Android Codebase & Firebase Cloud Status Banner */}
      <div className={`p-5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs ${
        state.isLiveCloud
          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          : 'bg-slate-900/90 border-amber-500/30 text-amber-200'
      }`}>
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
            state.isLiveCloud
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm block">
                {state.isLiveCloud 
                  ? (lang === 'ar' ? '🟢 الوضع السحابي الحقيقي مفعل (Firebase Live)' : '🟢 Real Firebase Cloud is Active')
                  : (lang === 'ar' ? '🟡 وضع المحاكاة التجريبية (Demo Mode)' : '🟡 Demo Simulation Mode Active')}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                state.isLiveCloud ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {state.isLiveCloud ? 'Live Database' : 'Mock Data'}
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {state.isLiveCloud 
                ? (lang === 'ar'
                    ? 'المنظومة متصلة بقاعدة بيانات Firestore السحابية الحقيقية. عند تثبيت تطبيق أندرويد (child-debug.apk) وإدخال رمز الاقتران، ستصل إحداثيات وموقع طفلك الحقيقي مباشرة إلى هذه اللوحة.'
                    : 'System is connected to live Firestore cloud database. Real Android child APK with pairing code will sync live GPS and status directly here.')
                : (lang === 'ar'
                    ? 'البيانات المعروضة حالياً هي محاكاة تفاعلية (أحمد، سارة). كود أندرويد الحقيقي متوفر بالكامل، ويمكنك التحويل للوضع السحابي الفعلي لربط جهاز طفلك الحقيقي.'
                    : 'Current data is simulated. Real Android codebase is in the repo, switch to Live Cloud to pair actual devices.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {!state.isLiveCloud ? (
            <button
              onClick={() => amanStore.toggleCloudMode(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <span>{lang === 'ar' ? 'تفعيل السحابة الحقيقية (Live)' : 'Switch to Live Cloud'}</span>
            </button>
          ) : (
            <button
              onClick={() => amanStore.startCleanRealFamily()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
              title={lang === 'ar' ? 'إفراغ بيانات التجربة والبدء بحساب عائلي فارغ' : 'Start with clean empty family'}
            >
              <span>{lang === 'ar' ? 'بدء أسرة حقيقية جديدة' : 'Start Clean Family'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">{t.childrenTab}</span>
            <span className="text-lg font-black text-white">{activeDevices.length}</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">{t.geoList}</span>
            <span className="text-lg font-black text-white">{state.geofences.length}</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">
              {lang === 'ar' ? 'الأجهزة المتصلة' : 'Online Devices'}
            </span>
            <span className="text-lg font-black text-white">
              {activeDevices.filter((d) => getConnectionStatus(d.deviceStatus.lastSeen) === 'ONLINE').length}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">{t.alertsTab}</span>
            <span className="text-lg font-black text-white">{unreadAlerts.length}</span>
          </div>
        </div>
      </div>

      {/* Children Devices Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <span>{t.childrenTab}</span>
          </h2>
          <span className="text-xs text-slate-400">
            {lang === 'ar' ? 'انقر على أي بطاقة لعرض الخريطة والتفاصيل الكاملة' : 'Click any card to inspect live map & details'}
          </span>
        </div>

        {activeDevices.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-7 h-7" />
            </div>
            <div className="max-w-sm mx-auto space-y-1">
              <h3 className="text-base font-bold text-white">{t.noDevices}</h3>
              <p className="text-xs text-slate-400">{t.addFirstChild}</p>
            </div>
            <button
              onClick={onOpenAddChild}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              {t.addChild}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeDevices.map((device) => {
              const conn = getConnectionStatus(device.deviceStatus.lastSeen);
              const connColor = {
                ONLINE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                STALE: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                OFFLINE: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                UNKNOWN: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
              }[conn];

              const connLabel = {
                ONLINE: t.online,
                STALE: t.stale,
                OFFLINE: t.offline,
                UNKNOWN: t.unknown,
              }[conn];

              const grantedPerms = Object.values(device.currentPermissions).filter((p) => p.state === 'GRANTED').length;
              const todayUsageRecord = state.usage[device.id]?.[0];
              const screenTimeMins = todayUsageRecord ? Math.round(todayUsageRecord.totalSeconds / 60) : 0;

              return (
                <div
                  key={device.id}
                  onClick={() => onSelectDevice(device.id)}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-5 shadow-xl hover:shadow-2xl transition duration-200 cursor-pointer space-y-4 group relative overflow-hidden"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-extrabold text-lg shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
                        {device.childName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">
                          {device.childName}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span>{device.name}</span>
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${connColor}`}>
                      {connLabel}
                    </span>
                  </div>

                  {/* Location snippet */}
                  <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center gap-2.5 text-xs text-slate-300">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {device.lastLocation?.addressLabel || (lang === 'ar' ? 'موقع نشط (انقر للعرض)' : 'Active location (click to view)')}
                    </span>
                  </div>

                  {/* Diagnostics Row */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60 text-slate-400">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {device.deviceStatus.isCharging ? (
                          <BatteryCharging className="w-4 h-4 text-emerald-400 animate-pulse" />
                        ) : (
                          <Battery className={`w-4 h-4 ${device.deviceStatus.battery < 20 ? 'text-rose-400' : 'text-slate-300'}`} />
                        )}
                        <span className="font-semibold text-white">{device.deviceStatus.battery}%</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{screenTimeMins} {t.minutes}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{grantedPerms}/6</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-emerald-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition text-xs font-medium">
                      <span>{lang === 'ar' ? 'التفاصيل' : 'Details'}</span>
                      {lang === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
