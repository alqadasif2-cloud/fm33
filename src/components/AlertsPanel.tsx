import React from 'react';
import { AlertItem } from '../types/aman';
import { amanStore } from '../services/store';
import { translations } from '../i18n/translations';
import { 
  Bell, 
  MapPin, 
  ShieldAlert, 
  Radio, 
  CheckCheck, 
  Trash2, 
  Clock, 
  Check, 
  AlertTriangle 
} from 'lucide-react';

interface AlertsPanelProps {
  lang: 'ar' | 'en';
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ lang }) => {
  const t = translations[lang];
  const state = amanStore.getState();
  const alerts = state.alerts;

  const handleMarkRead = (id: string) => {
    amanStore.markAlertRead(id);
  };

  const handleMarkAllRead = () => {
    amanStore.markAllAlertsRead();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{t.alertsTab}</span>
                <span className="text-xs bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800">
                  {alerts.filter((a) => !a.read).length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'سجل التنبيهات والأحداث اللحظية من الخادم السحابي' : 'Real-time security and geofence alerts'}
              </p>
            </div>
          </div>

          {alerts.some((a) => !a.read) && (
            <button
              onClick={handleMarkAllRead}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>{t.markAllRead}</span>
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <Bell className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
            <p>{t.alertsNone}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const iconMap: Record<string, React.ReactNode> = {
                geofence_enter: <MapPin className="w-4 h-4 text-emerald-400" />,
                geofence_exit: <MapPin className="w-4 h-4 text-amber-400" />,
                device_offline: <Radio className="w-4 h-4 text-rose-400" />,
                permission_revoked: <ShieldAlert className="w-4 h-4 text-rose-400" />,
                device_unlinked: <AlertTriangle className="w-4 h-4 text-orange-400" />,
                tamper_warning: <ShieldAlert className="w-4 h-4 text-rose-400" />,
              };
              const icon = iconMap[alert.type] || <Bell className="w-4 h-4 text-indigo-400" />;

              return (
                <div
                  key={alert.id}
                  onClick={() => handleMarkRead(alert.id)}
                  className={`p-4 rounded-2xl border transition flex items-start justify-between gap-4 cursor-pointer ${
                    alert.read
                      ? 'bg-slate-950/50 border-slate-800 text-slate-400'
                      : 'bg-slate-950 border-slate-700 ring-1 ring-emerald-500/20 text-slate-100 shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      {icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${alert.read ? 'text-slate-300' : 'text-white'}`}>
                          {alert.title}
                        </span>
                        {!alert.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {alert.body}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(alert.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
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
