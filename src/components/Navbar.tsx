import React, { useState } from 'react';
import { translations } from '../i18n/translations';
import { amanStore } from '../services/store';
import { CloudConnectionModal } from './CloudConnectionModal';
import { 
  ShieldCheck, 
  Smartphone, 
  LayoutDashboard, 
  Columns, 
  Bell, 
  FileCode2, 
  RotateCcw, 
  Globe,
  Cloud,
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  viewMode: 'parent' | 'child' | 'split';
  setViewMode: (mode: 'parent' | 'child' | 'split') => void;
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
  unreadAlertsCount: number;
  onOpenAlerts: () => void;
  onOpenArchitecture: () => void;
  onResetDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  lang,
  setLang,
  unreadAlertsCount,
  onOpenAlerts,
  onOpenArchitecture,
  onResetDemo,
}) => {
  const t = translations[lang];
  const state = amanStore.getState();
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 transition">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  {t.appName}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v1.2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {lang === 'ar' ? 'منظومة الرقابة الأبوية الذكية (Kotlin + Firebase)' : 'Parental Control Suite'}
              </p>
            </div>

            {/* Cloud Status Button */}
            <button
              onClick={() => setIsCloudModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition cursor-pointer shadow-sm ${
                state.isLiveCloud
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              }`}
              title={lang === 'ar' ? 'إعدادات وحالة السحابة الحقيقية (Firebase)' : 'Firebase Cloud Status'}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {state.isLiveCloud 
                  ? (lang === 'ar' ? 'سحابي حقيقي (Live)' : 'Live Cloud') 
                  : (lang === 'ar' ? 'وضع التجربة (Demo)' : 'Demo Mode')}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${state.isLiveCloud ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            </button>
          </div>

          {/* View Mode Switcher Pills */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('parent')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'parent'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.parentMode}</span>
              <span className="sm:hidden">{lang === 'ar' ? 'ولي الأمر' : 'Parent'}</span>
            </button>

            <button
              onClick={() => setViewMode('child')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'child'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.childMode}</span>
              <span className="sm:hidden">{lang === 'ar' ? 'الطفل' : 'Child'}</span>
            </button>

            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.splitMode}</span>
              <span className="md:hidden">{lang === 'ar' ? 'متزامن' : 'Dual'}</span>
            </button>
          </div>

          {/* Utility Actions */}
          <div className="flex items-center gap-2">
            
            {/* Alerts Trigger */}
            <button
              onClick={onOpenAlerts}
              className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
              title={t.alertsTab}
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {/* Architecture Documentation Modal Trigger */}
            <button
              onClick={onOpenArchitecture}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
              title={t.architectureTab}
            >
              <FileCode2 className="w-4 h-4 text-indigo-400" />
            </button>

            {/* Demo Reset */}
            <button
              onClick={onResetDemo}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 transition cursor-pointer"
              title={lang === 'ar' ? 'إعادة ضبط البيانات التجريبية' : 'Reset to Demo Data'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
          </div>

        </div>
      </header>

      {/* Cloud Connection Modal */}
      <CloudConnectionModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        lang={lang}
      />
    </>
  );
};
