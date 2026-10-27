import React, { useState, useEffect } from 'react';
import { Device, Geofence, PermId, PermissionState, CommandType, LiveSessionType } from '../types/aman';
import { amanStore, getConnectionStatus, calculateDistanceMeters } from '../services/store';
import { translations } from '../i18n/translations';
import { MapComponent } from './MapComponent';
import { 
  ArrowRight, 
  ArrowLeft,
  Battery, 
  BatteryCharging, 
  Wifi, 
  MapPin, 
  Clock, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Terminal, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Layers, 
  Smartphone,
  Info,
  Sliders,
  Send,
  Lock,
  Video,
  Mic,
  Camera,
  Radio,
  Play,
  Square,
  Volume2,
  ShieldCheck,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';

interface DeviceDetailProps {
  device: Device;
  onBack: () => void;
  lang: 'ar' | 'en';
}

export const DeviceDetail: React.FC<DeviceDetailProps> = ({ device, onBack, lang }) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'location' | 'usage' | 'permissions' | 'commands' | 'privacy' | 'live'>('location');
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [showRulesSyncModal, setShowRulesSyncModal] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  // Live Monitoring state
  const [selectedLiveType, setSelectedLiveType] = useState<LiveSessionType>('screen');
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveStarting, setLiveStarting] = useState(false);
  const [liveDurationSec, setLiveDurationSec] = useState(0);

  // Geofence form
  const [geoName, setGeoName] = useState('');
  const [geoRadius, setGeoRadius] = useState('200');

  const state = amanStore.getState();
  const history = state.locations[device.id] || [];
  const geofences = state.geofences.filter((g) => g.deviceId === device.id);
  const deviceCommands = state.commands.filter((c) => c.deviceId === device.id).slice(0, 10);
  const todayUsage = state.usage[device.id]?.[0];

  const conn = getConnectionStatus(device.deviceStatus.lastSeen);

  const connColor = {
    ONLINE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-emerald-500/20',
    STALE: 'bg-amber-500/10 text-amber-400 border-amber-500/30 ring-amber-500/20',
    OFFLINE: 'bg-rose-500/10 text-rose-400 border-rose-500/30 ring-rose-500/20',
    UNKNOWN: 'bg-slate-500/10 text-slate-400 border-slate-500/30 ring-slate-500/20',
  }[conn];

  const connLabel = {
    ONLINE: t.online,
    STALE: t.stale,
    OFFLINE: t.offline,
    UNKNOWN: t.unknown,
  }[conn];

  const activeLiveSession = amanStore.getActiveLiveSession(device.id);
  const deviceLiveSessions = amanStore.getDeviceLiveSessions(device.id);

  // Live session duration timer
  useEffect(() => {
    let interval: any;
    if (activeLiveSession && activeLiveSession.status === 'active') {
      const start = activeLiveSession.startedAt || activeLiveSession.createdAt;
      setLiveDurationSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      interval = setInterval(() => {
        setLiveDurationSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      }, 1000);
    } else {
      setLiveDurationSec(0);
    }
    return () => clearInterval(interval);
  }, [activeLiveSession?.status, activeLiveSession?.startedAt, activeLiveSession?.id]);

  const handleStartLiveSession = () => {
    setLiveError(null);
    setLiveStarting(true);
    setTimeout(() => {
      const res = amanStore.requestLiveSession(device.id, selectedLiveType, cameraFacing);
      setLiveStarting(false);
      if (!res.success) {
        setLiveError(res.error || 'فشل بدء الجلسة');
      } else {
        setCommandFeedback(lang === 'ar' ? 'تم إرسال طلب البث المباشر للجهاز' : 'Live session requested');
        setTimeout(() => setCommandFeedback(null), 3000);
      }
    }, 300);
  };

  const handleStopLiveSession = (sessionId: string) => {
    amanStore.stopLiveSession(sessionId, 'stopped_by_parent');
    setCommandFeedback(lang === 'ar' ? 'تم إيقاف جلسة البث المباشر فوراً' : 'Live session terminated');
    setTimeout(() => setCommandFeedback(null), 3000);
  };

  const handleSendCommand = (type: CommandType) => {
    if (type === 'rules.sync') {
      setShowRulesSyncModal(true);
      return;
    }

    setIsSendingCommand(true);
    setCommandFeedback(null);
    try {
      const cmd = amanStore.sendCommand(device.id, type);
      setCommandFeedback(t.commandSentToast);
      setTimeout(() => setCommandFeedback(null), 3500);
    } catch (e: any) {
      setCommandFeedback(e.message);
    } finally {
      setIsSendingCommand(false);
    }
  };

  const handleAddGeofence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!geoName.trim() || !device.lastLocation) return;
    const radiusNum = parseInt(geoRadius, 10);
    if (isNaN(radiusNum) || radiusNum < 50 || radiusNum > 5000) return;

    amanStore.addGeofence({
      deviceId: device.id,
      name: geoName.trim(),
      lat: device.lastLocation.lat,
      lng: device.lastLocation.lng,
      radius: radiusNum,
      enabled: true,
      notifyEnter: true,
      notifyExit: true,
    });

    setGeoName('');
    setGeoRadius('200');
  };

  const handleDeleteGeofence = (id: string) => {
    amanStore.deleteGeofence(id);
  };

  const handlePurgeLocations = () => {
    if (window.confirm(lang === 'ar' ? 'هل تريد بالتأكيد حذف كل سجل المواقع المخزنة لهذا الجهاز؟' : 'Purge all stored locations for this child?')) {
      amanStore.deleteLocations(device.id);
      setCommandFeedback(t.deleteLocationsSuccess);
      setTimeout(() => setCommandFeedback(null), 3000);
    }
  };

  const handleConfirmUnlink = () => {
    amanStore.unlinkDevice(device.id, 'parent');
    setShowUnlinkModal(false);
    onBack();
  };

  const grantedPermsCount = Object.values(device.currentPermissions).filter((p) => p.state === 'GRANTED').length;
  const totalPermsCount = Object.keys(device.currentPermissions).length;

  const permDefinitions: { id: PermId; name: string; desc: string }[] = [
    { id: 'location_fine', name: t.permLocationFine, desc: lang === 'ar' ? 'تحديد إحداثيات GPS بدقة عالية لمعرفة مكان الطفل' : 'High accuracy GPS fixes for exact child location' },
    { id: 'location_background', name: t.permLocationBg, desc: lang === 'ar' ? 'تحديث الموقع أثناء تشغيل الشاشة أو وضع السكون دورياً' : 'Update coordinates periodically even when the screen is off' },
    { id: 'location_services', name: t.permLocationServices, desc: lang === 'ar' ? 'تفعيل نظام تحديد المواقع العالمي في إعدادات النظام' : 'Global system GPS switch state in Android settings' },
    { id: 'notifications', name: t.permNotifications, desc: lang === 'ar' ? 'إرسال واستقبال إشعارات المزامنة ورسائل التنبيه العاجلة' : 'Display transparency sync notifications and high-priority alerts' },
    { id: 'usage_access', name: t.permUsage, desc: lang === 'ar' ? 'إحصاء وقت تشغيل التطبيقات اليومي لاكتشاف الاستخدام المفرط' : 'Log daily application active time without inspecting contents' },
    { id: 'battery_opt', name: t.permBattery, desc: lang === 'ar' ? 'منع نظام أندرويد من قتل خدمة المزامنة في الخلفية' : 'Prevent Android battery saver from killing background sync' },
  ];

  return (
    <div className="space-y-6 text-slate-100 animate-in fade-in duration-300">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              title={t.back}
            >
              {lang === 'ar' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold text-lg shadow-lg shadow-emerald-500/20">
                {device.childName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-white">{device.childName}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${connColor}`}>
                    {connLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{device.name}</span>
                  <span>•</span>
                  <span>{device.deviceStatus.osVersion}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Device Diagnostic Pills */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
              {device.deviceStatus.isCharging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <Battery className={`w-4 h-4 ${device.deviceStatus.battery < 20 ? 'text-rose-400' : 'text-slate-300'}`} />
              )}
              <span className="font-semibold">{device.deviceStatus.battery}%</span>
              {device.deviceStatus.isCharging && <span className="text-[10px] text-emerald-400">({t.charging})</span>}
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
              <Wifi className="w-4 h-4 text-indigo-400" />
              <span>{device.deviceStatus.networkType}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>
                {t.lastSeen}: {new Date(device.deviceStatus.lastSeen).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Commands Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-400 ml-2">
            {lang === 'ar' ? 'الأوامر السريعة:' : 'Quick Commands:'}
          </span>
          <button
            onClick={() => handleSendCommand('location.refresh')}
            disabled={isSendingCommand}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{t.cmdLocation}</span>
          </button>

          <button
            onClick={() => handleSendCommand('permissions.check')}
            disabled={isSendingCommand}
            className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{t.cmdPerms}</span>
          </button>

          <button
            onClick={() => handleSendCommand('sync.now')}
            disabled={isSendingCommand}
            className="px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.cmdSync}</span>
          </button>

          <button
            onClick={() => handleSendCommand('rules.sync')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t.cmdRulesSync}</span>
          </button>
        </div>

        {/* Command Toast Feedback */}
        {commandFeedback && (
          <div className="mt-3 py-2 px-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{commandFeedback}</span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-1 sm:space-x-2 overflow-x-auto pb-1 text-sm font-medium">
        <button
          onClick={() => setActiveTab('location')}
          className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'location'
              ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>{t.sectionLocation}</span>
        </button>

        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'usage'
              ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t.sectionUsage}</span>
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'permissions'
              ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>{t.sectionPerms}</span>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300">
            {grantedPermsCount}/{totalPermsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('commands')}
          className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'commands'
              ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>{t.sectionCommands}</span>
        </button>

        <button
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer relative ${
            activeTab === 'live'
              ? 'bg-slate-900 text-rose-400 border-t-2 border-rose-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>{lang === 'ar' ? 'المراقبة المباشرة' : 'Live Monitoring'}</span>
          {activeLiveSession && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'privacy'
              ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>{t.privacyTab}</span>
        </button>
      </div>

      {/* Tab 1: Location & Geofences */}
      {activeTab === 'location' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  <span>{t.sectionLocation}</span>
                </h2>
                <p className="text-xs text-slate-400">
                  {device.lastLocation?.addressLabel || (lang === 'ar' ? 'يتم التحديث كل 15 دقيقة دورياً أو عند الطلب الفوري' : 'Updates every 15 min or on demand')}
                </p>
              </div>

              {device.lastLocation && (
                <div className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  {t.locInfo
                    .replace('{acc}', String(Math.round(device.lastLocation.accuracy)))
                    .replace('{src}', device.lastLocation.source)
                    .replace('{prov}', device.lastLocation.provider)}
                </div>
              )}
            </div>

            {/* Interactive Map */}
            <div className="h-[420px] w-full">
              <MapComponent
                currentLocation={device.lastLocation}
                history={history}
                geofences={geofences}
                childName={device.childName}
                lang={lang}
              />
            </div>
          </div>

          {/* Geofences Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Create Geofence */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>{t.geoAdd}</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === 'ar' 
                  ? 'قم بإنشاء منطقة آمنة جغرافية (مثل المنزل أو المدرسة) استناداً إلى آخر إحداثيات تم التقاطها للجهاز.' 
                  : 'Define a safe geofence circle around the child\'s current location.'}
              </p>

              <form onSubmit={handleAddGeofence} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.geoName}
                  </label>
                  <input
                    type="text"
                    required
                    value={geoName}
                    onChange={(e) => setGeoName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: مدرسة الأجيال، نادي الحي...' : 'e.g. School, Home...'}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.geoRadius}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="50"
                      max="1500"
                      step="50"
                      value={geoRadius}
                      onChange={(e) => setGeoRadius(e.target.value)}
                      className="flex-1 accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                      {geoRadius} {lang === 'ar' ? 'متر' : 'm'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!geoName.trim() || !device.lastLocation}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حفظ المنطقة الآمنة' : 'Save Safe Zone'}</span>
                </button>
              </form>

              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>{t.geoNote}</span>
              </div>
            </div>

            {/* Existing Geofences List */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>{t.geoList}</span>
                <span className="text-xs bg-indigo-950/60 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {geofences.length}
                </span>
              </h3>

              {geofences.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  {lang === 'ar' ? 'لم تقم بإضافة مناطق آمنة لهذا الجهاز بعد.' : 'No safe zones created for this device yet.'}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {geofences.map((geo) => {
                    const isInside = state.geofenceState[geo.id];
                    return (
                      <div
                        key={geo.id}
                        className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-3 h-3 rounded-full shrink-0 ${isInside ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{geo.name}</span>
                              <span className="text-[10px] text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-800">
                                {geo.radius} {lang === 'ar' ? 'متر' : 'm'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {isInside 
                                ? (lang === 'ar' ? 'الطفل متواجد داخل هذه المنطقة الآن' : 'Child is currently inside this zone')
                                : (lang === 'ar' ? 'الطفل خارج هذه المنطقة' : 'Child is outside this zone')}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteGeofence(geo.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition cursor-pointer"
                          title="Delete Geofence"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Tab 2: App Usage & Screen Time */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <span>{t.sectionUsage}</span>
                </h2>
                <p className="text-xs text-slate-400">
                  {lang === 'ar' ? 'تقرير زمني لنشاط التطبيقات لليوم الحالي وآخر 7 أيام' : 'Daily active screen time and top applications'}
                </p>
              </div>

              {todayUsage && (
                <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400">{t.usageTotal}:</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {Math.floor(todayUsage.totalSeconds / 3600)} {t.hours} {Math.floor((todayUsage.totalSeconds % 3600) / 60)} {t.minutes}
                  </span>
                </div>
              )}
            </div>

            {!todayUsage || todayUsage.apps.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 text-xs text-slate-400">
                {t.usageNone}
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'ar' ? 'التطبيقات الأكثر استخداماً اليوم' : 'Most Used Apps Today'}
                </h3>

                <div className="space-y-3">
                  {todayUsage.apps.map((app) => {
                    const mins = Math.round(app.seconds / 60);
                    const percentage = Math.min(100, Math.round((app.seconds / (todayUsage.totalSeconds || 1)) * 100));

                    const categoryBadge = {
                      entertainment: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
                      games: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
                      social: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
                      education: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
                      productivity: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
                      other: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
                    }[app.category];

                    return (
                      <div key={app.pkg} className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{app.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${categoryBadge}`}>
                              {app.category}
                            </span>
                          </div>
                          <span className="font-mono font-semibold text-slate-300">
                            {mins} {t.minutes} ({percentage}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Permissions Audit */}
      {activeTab === 'permissions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <span>{t.sectionPerms}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'فحص ومتابعة الصلاحيات الستة الحيوية المطلوبة على جهاز الطفل' : 'Status of the 6 essential Android permissions reported by child'}
              </p>
            </div>

            <div className="px-3.5 py-1.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400">
              {t.permSummary.replace('{granted}', String(grantedPermsCount)).replace('{total}', String(totalPermsCount))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {permDefinitions.map((perm) => {
              const current = device.currentPermissions[perm.id];
              const isGranted = current?.state === 'GRANTED';
              const isRevoked = current?.state === 'REVOKED';
              const isManual = current?.state === 'NEEDS_MANUAL';

              return (
                <div
                  key={perm.id}
                  className={`p-4 rounded-2xl border transition ${
                    isGranted
                      ? 'bg-slate-950/80 border-slate-800'
                      : 'bg-rose-950/20 border-rose-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">{perm.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        isGranted
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : isRevoked
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : isManual
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isGranted ? t.permGranted : isRevoked ? t.permRevoked : isManual ? t.permNeedsManual : t.permDenied}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {perm.desc}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60 font-mono">
                    <span>key: {perm.id}</span>
                    <span>
                      {current?.checkedAt ? new Date(current.checkedAt).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US') : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Commands Log */}
      {activeTab === 'commands' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-sky-400" />
              <span>{t.sectionCommands}</span>
            </h2>
            <span className="text-xs text-slate-400">
              {lang === 'ar' ? 'تُرسل الأوامر عبر FCM مع استجابة عكسية موثقة' : 'FCM commands with roundtrip execution acknowledgment'}
            </span>
          </div>

          {deviceCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {lang === 'ar' ? 'لم يتم إرسال أي أوامر لهذا الجهاز بعد.' : 'No commands dispatched yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {deviceCommands.map((cmd) => {
                const statusStyle = {
                  sent: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
                  received: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                  applied: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                  failed: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                  unsupported: 'bg-slate-700/50 text-slate-300 border-slate-600',
                }[cmd.status];

                const statusText = {
                  sent: t.statusSent,
                  received: t.statusReceived,
                  applied: t.statusApplied,
                  failed: t.statusFailed,
                  unsupported: t.statusUnsupported,
                }[cmd.status];

                return (
                  <div key={cmd.id} className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{cmd.type}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusStyle}`}>
                          {statusText}
                        </span>
                      </div>
                      {cmd.result && (
                        <p className="text-[11px] text-slate-400">
                          {cmd.result}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(cmd.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Privacy, Data Purging & Unlink */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              <span>{t.privacyTitle}</span>
            </h2>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <p>• {t.privacyBody1}</p>
              <p>• {t.privacyBody2}</p>
              <p>• {t.privacyBody3}</p>
              <p>• {t.privacyBody4}</p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-xs text-rose-300 space-y-1.5">
              <span className="font-bold block text-rose-400">{lang === 'ar' ? 'ضمان الخصوصية وعدم التجسس:' : 'Privacy Protection Guarantee:'}</span>
              <p>{t.privacyNotCollected}</p>
              <p className="text-[11px] text-slate-400 mt-1">{t.liveUnavailable}</p>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handlePurgeLocations}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>{t.deleteLocations}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowUnlinkModal(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>{t.cmdUnlink}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Live Monitoring (Screen, Camera, Microphone) */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          {/* Header & Device Readiness Inspection */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{lang === 'ar' ? 'المراقبة المباشرة' : 'Live Monitoring'}</span>
                      {activeLiveSession?.status === 'active' && (
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-bold animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                          <span>{lang === 'ar' ? 'مباشر' : 'LIVE'}</span>
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {lang === 'ar' 
                        ? 'بث مباشر لشاشة جهاز الطفل، أو تشغيل الكاميرا الأمامية/الخلفية، أو الاستماع عبر الميكروفون ضمن معايير أمان Android 14+'
                        : 'Real-time screen mirroring, front/back camera streaming, or microphone listening under Android 14+ security policies'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Device Readiness Pill */}
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-semibold ${connColor}`}>
                  <span className={`w-2 h-2 rounded-full ${conn === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : conn === 'STALE' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                  <span>{connLabel}</span>
                </span>
                <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  {device.deviceStatus.osVersion}
                </span>
              </div>
            </div>

            {/* Android 14+ Readiness & Permission Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === 'ar' ? 'مشاركة الشاشة' : 'Screen Share'}</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                    MediaProjection
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'ar'
                    ? 'يتطلب موافقة صريحة من الطفل لكل جلسة على Android 14+ مع خدمة أمامية.'
                    : 'Requires child explicit consent per session on Android 14+ via foreground service.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-rose-400" />
                    <span>{lang === 'ar' ? 'صلاحية الكاميرا' : 'Camera Permission'}</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    device.currentPermissions?.camera?.state === 'GRANTED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {device.currentPermissions?.camera?.state === 'GRANTED' ? (lang === 'ar' ? 'ممنوحة' : 'Granted') : (lang === 'ar' ? 'غير ممنوحة' : 'Denied')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {device.currentPermissions?.camera?.state === 'GRANTED'
                    ? (lang === 'ar' ? 'جاهزة للبث من الكاميرا الأمامية أو الخلفية.' : 'Ready for front or back camera streaming.')
                    : (lang === 'ar' ? 'يجب تمكين إذن الكاميرا من جهاز الطفل لبدء البث.' : 'Must grant camera permission on child device.')}
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-sky-400" />
                    <span>{lang === 'ar' ? 'صلاحية الميكروفون' : 'Microphone Permission'}</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    device.currentPermissions?.microphone?.state === 'GRANTED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {device.currentPermissions?.microphone?.state === 'GRANTED' ? (lang === 'ar' ? 'ممنوحة' : 'Granted') : (lang === 'ar' ? 'غير ممنوحة' : 'Denied')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {device.currentPermissions?.microphone?.state === 'GRANTED'
                    ? (lang === 'ar' ? 'جاهز للاستماع المباشر للصوت المحيط.' : 'Ready for live ambient audio streaming.')
                    : (lang === 'ar' ? 'يجب تمكين إذن الميكروفون من جهاز الطفل.' : 'Must grant microphone permission on child device.')}
                </p>
              </div>
            </div>

            {/* Error Message banner */}
            {liveError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{liveError}</span>
              </div>
            )}

            {/* Active Session Viewer OR Session Request Launcher */}
            {activeLiveSession ? (
              /* Active / Connecting Session Box */
              <div className="p-5 rounded-2xl bg-slate-950 border border-rose-500/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {lang === 'ar' ? 'جلسة مراقبة جارية' : 'Active Live Session'}: {activeLiveSession.type === 'screen' ? (lang === 'ar' ? 'مشاركة الشاشة' : 'Screen Share') : activeLiveSession.type === 'camera' ? (lang === 'ar' ? `كاميرا (${activeLiveSession.cameraFacing === 'front' ? 'أمامية' : 'خلفية'})` : `Camera (${activeLiveSession.cameraFacing})`) : (lang === 'ar' ? 'ميكروفون صوتي' : 'Microphone')}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                      ID: {activeLiveSession.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-xs font-mono font-bold text-rose-400 bg-rose-950/60 px-3 py-1 rounded-xl border border-rose-500/30 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{Math.floor(liveDurationSec / 60).toString().padStart(2, '0')}:{(liveDurationSec % 60).toString().padStart(2, '0')}</span>
                    </div>

                    <button
                      onClick={() => handleStopLiveSession(activeLiveSession.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-950"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{lang === 'ar' ? 'إيقاف الجلسة فوراً' : 'Stop Session Immediately'}</span>
                    </button>
                  </div>
                </div>

                {/* Stream Specs Header */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="text-emerald-400">●</span> {activeLiveSession.quality}
                  </span>
                  <span>·</span>
                  <span>{lang === 'ar' ? 'الكمون:' : 'Latency:'} 118ms (WebRTC Direct)</span>
                  <span>·</span>
                  <span>{lang === 'ar' ? 'معدل النقل:' : 'Bitrate:'} {activeLiveSession.type === 'mic' ? '64 kbps' : '1.4 Mbps'}</span>
                  <span>·</span>
                  <span className="text-indigo-400 font-semibold">{lang === 'ar' ? 'تشفير شامل DTLS/SRTP' : 'DTLS/SRTP Encrypted'}</span>
                </div>

                {/* Stream Display Canvas / Player */}
                <div className="relative rounded-2xl bg-black border border-slate-800 overflow-hidden flex flex-col items-center justify-center min-h-[320px] p-6">
                  {activeLiveSession.type === 'screen' ? (
                    /* Screen Mirroring Visualizer */
                    <div className="w-full max-w-sm rounded-2xl border-4 border-slate-800 bg-slate-900 shadow-2xl p-4 flex flex-col space-y-4">
                      {/* Simulated Child Screen Top Bar */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-2">
                        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <div className="flex items-center gap-1">
                          <Wifi className="w-3 h-3 text-emerald-400" />
                          <span>84%</span>
                        </div>
                      </div>

                      {/* Screen content mockup */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mx-auto">
                          <Smartphone className="w-6 h-6 animate-pulse" />
                        </div>
                        <h4 className="text-xs font-bold text-white">
                          {lang === 'ar' ? 'بث مباشر لشاشة جهاز أحمد' : "Ahmed's Screen Live Mirror"}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {lang === 'ar' ? 'التطبيق النشط حالياً: YouTube Kids' : 'Currently active app: YouTube Kids'}
                        </p>
                      </div>

                      {/* Foreground notification visual reminder */}
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>{lang === 'ar' ? 'إشعار مشاركة الشاشة معروض بشريط إشعارات الطفل' : 'Screen casting notification is visible on child status bar'}</span>
                      </div>
                    </div>
                  ) : activeLiveSession.type === 'camera' ? (
                    /* Camera Viewfinder Visualizer */
                    <div className="w-full max-w-md aspect-video rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden flex flex-col justify-between p-4 shadow-2xl">
                      {/* Camera Viewfinder UI */}
                      <div className="flex items-center justify-between text-xs text-white z-10">
                        <span className="flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-lg">
                          <Camera className="w-3.5 h-3.5 text-rose-400" />
                          <span>{activeLiveSession.cameraFacing === 'front' ? (lang === 'ar' ? 'الكاميرا الأمامية' : 'Front Lens') : (lang === 'ar' ? 'الكاميرا الخلفية' : 'Rear Lens')}</span>
                        </span>
                        <span className="bg-rose-500/80 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                          REC
                        </span>
                      </div>

                      {/* Center Viewfinder Target Grid */}
                      <div className="border border-white/20 rounded-xl w-32 h-32 mx-auto flex items-center justify-center relative">
                        <div className="w-4 h-4 border-t-2 border-l-2 border-white absolute -top-1 -left-1"></div>
                        <div className="w-4 h-4 border-t-2 border-r-2 border-white absolute -top-1 -right-1"></div>
                        <div className="w-4 h-4 border-b-2 border-l-2 border-white absolute -bottom-1 -left-1"></div>
                        <div className="w-4 h-4 border-b-2 border-r-2 border-white absolute -bottom-1 -right-1"></div>
                        <span className="text-[10px] text-slate-400 font-mono">AF-LOCK</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 z-10">
                        <span>ISO 400 · f/1.8 · 1/60s</span>
                        <span>Samsung ISOCELL Sensor</span>
                      </div>
                    </div>
                  ) : (
                    /* Microphone Audio Waveform Visualizer */
                    <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center mx-auto">
                        <Volume2 className="w-6 h-6 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          {lang === 'ar' ? 'استماع مباشر للصوت المحيط' : 'Live Ambient Audio Stream'}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {lang === 'ar' ? 'جودة نقية 48kHz PCM مع إلغاء الصدى الصوتي' : '48kHz PCM Audio with Acoustic Echo Cancellation'}
                        </p>
                      </div>

                      {/* Equalizer Bars Animation */}
                      <div className="flex items-center justify-center gap-1.5 h-16 pt-2">
                        {[40, 65, 85, 30, 95, 75, 45, 90, 60, 80, 50, 70, 85, 40, 65].map((h, i) => (
                          <div
                            key={i}
                            className="w-1.5 bg-gradient-to-t from-sky-500 to-emerald-400 rounded-full transition-all duration-150 animate-pulse"
                            style={{ height: `${h}%`, animationDelay: `${(i % 5) * 100}ms` }}
                          ></div>
                        ))}
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono">
                        Level: -18.4 dBFS · Voice Detection Active
                      </div>
                    </div>
                  )}

                  {/* Android Foreground Service Policy Notice */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 max-w-lg text-center leading-relaxed">
                    🛡️ {lang === 'ar'
                      ? 'التزاماً بسياسات Google Play لنظام Android 14+، يتم تشغيل البث كخدمة أمامية (Foreground Service) مع إشعار دائم مرئي للطفل مع زر إيقاف فوري.'
                      : 'Compliant with Google Play & Android 14+ policies: runs as a foreground service with a persistent status bar notification and instant stop button for the child.'}
                  </div>
                </div>
              </div>
            ) : (
              /* Session Request Form */
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-rose-400" />
                  <span>{lang === 'ar' ? 'بدء جلسة مراقبة جديدة' : 'Start a New Live Session'}</span>
                </h3>

                {/* Session Type Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedLiveType('screen')}
                    className={`p-4 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      selectedLiveType === 'screen'
                        ? 'bg-rose-500/10 border-rose-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Layers className={`w-5 h-5 ${selectedLiveType === 'screen' ? 'text-rose-400' : 'text-slate-400'}`} />
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">Android 14+</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white mb-0.5">
                        {lang === 'ar' ? 'عرض الشاشة مباشرة' : 'Live Screen Mirroring'}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {lang === 'ar' ? 'مشاركة شاشة الطفل في الوقت الحقيقي' : "Real-time child device screen stream"}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedLiveType('camera')}
                    className={`p-4 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      selectedLiveType === 'camera'
                        ? 'bg-rose-500/10 border-rose-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Camera className={`w-5 h-5 ${selectedLiveType === 'camera' ? 'text-rose-400' : 'text-slate-400'}`} />
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">Camera2 API</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white mb-0.5">
                        {lang === 'ar' ? 'بث الكاميرا' : 'Camera Streaming'}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {lang === 'ar' ? 'تشغيل الكاميرا الأمامية أو الخلفية' : 'Front or back camera video stream'}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedLiveType('mic')}
                    className={`p-4 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                      selectedLiveType === 'mic'
                        ? 'bg-rose-500/10 border-rose-500/50 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Mic className={`w-5 h-5 ${selectedLiveType === 'mic' ? 'text-rose-400' : 'text-slate-400'}`} />
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">AudioRecord</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white mb-0.5">
                        {lang === 'ar' ? 'الاستماع الصوتي المباشر' : 'Live Ambient Audio'}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {lang === 'ar' ? 'سماع الصوت المحيط بالجهاز مباشرة' : 'Real-time ambient sound listening'}
                      </p>
                    </div>
                  </button>
                </div>

                {/* Sub-options: Camera Facing if Camera Selected */}
                {selectedLiveType === 'camera' && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">
                      {lang === 'ar' ? 'اختيار عدسة الكاميرا:' : 'Select Camera Lens:'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraFacing('back')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          cameraFacing === 'back'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lang === 'ar' ? 'الكاميرا الخلفية (الأساسية)' : 'Back Camera'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCameraFacing('front')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          cameraFacing === 'front'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lang === 'ar' ? 'الكاميرا الأمامية (السيلفي)' : 'Front Camera'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Launch Button */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {lang === 'ar' 
                      ? 'سيتم إرسال إشعار FCM فوري ذي أولوية قصوى لجهاز الطفل لبدء الخدمة.'
                      : 'A high-priority FCM push notification will trigger the child background service.'}
                  </span>

                  <button
                    type="button"
                    onClick={handleStartLiveSession}
                    disabled={liveStarting || conn === 'OFFLINE'}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg ${
                      conn === 'OFFLINE'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                    }`}
                  >
                    {liveStarting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{lang === 'ar' ? 'جارٍ الاتصال بالجهاز...' : 'Connecting...'}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>{lang === 'ar' ? 'بدء جلسة البث المباشر الآن' : 'Start Live Session Now'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previous Sessions Audit Log Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'ar' ? 'سجل جلسات المراقبة المباشرة السابقة' : 'Live Sessions History & Audit Trail'}</span>
            </h3>

            {deviceLiveSessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                {lang === 'ar' ? 'لم تُجرَ أي جلسات مراقبة مباشرة على هذا الجهاز حتى الآن.' : 'No live sessions recorded yet on this device.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'نوع الجلسة' : 'Type'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'وقت البدء' : 'Started At'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'المدة' : 'Duration'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'الجودة' : 'Quality'}</th>
                      <th className="py-2.5 px-3">{lang === 'ar' ? 'الحالة والسبب' : 'Status & End Reason'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {deviceLiveSessions.map((s) => {
                      const durationSec = s.endedAt && s.startedAt 
                        ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 1000)) 
                        : (s.status === 'active' ? liveDurationSec : 0);
                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                            {s.type === 'screen' ? (
                              <Layers className="w-3.5 h-3.5 text-indigo-400" />
                            ) : s.type === 'camera' ? (
                              <Camera className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <Mic className="w-3.5 h-3.5 text-sky-400" />
                            )}
                            <span>
                              {s.type === 'screen' 
                                ? (lang === 'ar' ? 'شاشة' : 'Screen') 
                                : s.type === 'camera' 
                                ? (lang === 'ar' ? `كاميرا (${s.cameraFacing === 'front' ? 'أمامية' : 'خلفية'})` : `Camera (${s.cameraFacing})`)
                                : (lang === 'ar' ? 'ميكروفون' : 'Microphone')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {s.status === 'active' ? (
                              <span className="text-rose-400 font-bold">{lang === 'ar' ? 'جارية الآن...' : 'Live now...'}</span>
                            ) : durationSec > 0 ? (
                              `${Math.floor(durationSec / 60)} د و ${durationSec % 60} ث`
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-400">{s.quality || '720p @ 30fps'}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'active' 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' 
                                : s.status === 'ended'
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {s.status === 'active' 
                                ? (lang === 'ar' ? 'نشطة' : 'Active') 
                                : s.endReason === 'stopped_by_parent' 
                                ? (lang === 'ar' ? 'أوقفها ولي الأمر' : 'Stopped by parent')
                                : s.endReason === 'stopped_by_child'
                                ? (lang === 'ar' ? 'أوقفها الطفل' : 'Stopped by child')
                                : s.endReason === 'declined_by_child'
                                ? (lang === 'ar' ? 'رفضها الطفل' : 'Declined by child')
                                : (lang === 'ar' ? 'مكتملة' : 'Ended')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules Sync Modal (Honest Note per FEATURE_STATUS_AR.md) */}
      {showRulesSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">{t.cmdRulesSync}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'ar' 
                ? 'وفقاً لتوثيق المشروع الصريح (FEATURE_STATUS_AR.md): خاصية حظر التطبيقات وفرض قواعد وقت الشاشة الإلزامية تتطلب تفعيل صلاحية إمكانية الوصول (Accessibility) أو صلاحية مالك الجهاز (Device Owner)، ولم تُنفّذ بعد في الكود الأصلي. لذلك فإن إرسال هذا الأمر سيُرجع دائماً نتيجة صريحة: «فشل: لا تنفيذ في هذا الإصدار» منعاً للإيهام.' 
                : 'Per the honest repository documentation (FEATURE_STATUS_AR.md): App blocking and strict screen-time enforcement require Accessibility or Device Owner APIs and are not yet implemented. Executing rules.sync returns "unsupported: no implementation in this release".'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRulesSyncModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
              >
                {t.back}
              </button>
              <button
                onClick={() => {
                  setShowRulesSyncModal(false);
                  amanStore.sendCommand(device.id, 'rules.sync');
                  setCommandFeedback(lang === 'ar' ? 'تم إرسال الأمر وتأكيد عدم الدعم في هذا الإصدار' : 'Command sent (unsupported in this release)');
                  setTimeout(() => setCommandFeedback(null), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                {lang === 'ar' ? 'إرسال الأمر على أية حال' : 'Send Anyway to Test Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Confirmation Modal */}
      {showUnlinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">{t.confirmUnlinkTitle}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t.confirmUnlinkBody}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUnlinkModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmUnlink}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
