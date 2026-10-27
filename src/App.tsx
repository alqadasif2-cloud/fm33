import React, { useState, useEffect } from 'react';
import { amanStore, AmanState } from './services/store';
import { Navbar } from './components/Navbar';
import { ParentDashboard } from './components/ParentDashboard';
import { DeviceDetail } from './components/DeviceDetail';
import { ChildDeviceSimulator } from './components/ChildDeviceSimulator';
import { AddChildModal } from './components/AddChildModal';
import { AlertsPanel } from './components/AlertsPanel';
import { ArchitectureInfoModal } from './components/ArchitectureInfoModal';
import { translations } from './i18n/translations';

export default function App() {
  const [storeState, setStoreState] = useState<AmanState>(amanStore.getState());
  const [viewMode, setViewMode] = useState<'parent' | 'child' | 'split'>('parent');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Modals & Panels
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = amanStore.subscribe((newState) => {
      setStoreState({ ...newState });
    });
    return () => unsubscribe();
  }, []);

  // Update HTML document direction and language
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const selectedDevice = selectedDeviceId
    ? storeState.devices.find((d) => d.id === selectedDeviceId && d.status === 'active')
    : null;

  const unreadAlertsCount = storeState.alerts.filter((a) => !a.read).length;

  const handleResetDemo = () => {
    if (window.confirm(lang === 'ar' ? 'هل تريد استعادة البيانات التجريبية الافتراضية لمنظومة أمان؟' : 'Reset all data to default demo state?')) {
      amanStore.resetToDemo();
      setSelectedDeviceId(null);
    }
  };

  const handleDeviceLinked = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    setViewMode('parent');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        lang={lang}
        setLang={setLang}
        unreadAlertsCount={unreadAlertsCount}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
        onResetDemo={handleResetDemo}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Alerts View Mode (if active) */}
        {isAlertsOpen ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsAlertsOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-800 cursor-pointer"
              >
                ← {translations[lang].back}
              </button>
            </div>
            <AlertsPanel lang={lang} />
          </div>
        ) : (
          <>
            {/* 1. Parent Mode */}
            {viewMode === 'parent' && (
              <div>
                {selectedDevice ? (
                  <DeviceDetail
                    device={selectedDevice}
                    onBack={() => setSelectedDeviceId(null)}
                    lang={lang}
                  />
                ) : (
                  <ParentDashboard
                    onSelectDevice={(id) => setSelectedDeviceId(id)}
                    onOpenAddChild={() => setIsAddChildOpen(true)}
                    lang={lang}
                  />
                )}
              </div>
            )}

            {/* 2. Child Mode */}
            {viewMode === 'child' && (
              <div className="max-w-5xl mx-auto">
                <ChildDeviceSimulator lang={lang} />
              </div>
            )}

            {/* 3. Split / Dual View Mode */}
            {viewMode === 'split' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Left Side: Parent Dashboard or Detail (7 columns) */}
                <div className="xl:col-span-7 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>{translations[lang].parentMode}</span>
                    </span>
                    {selectedDevice && (
                      <button
                        onClick={() => setSelectedDeviceId(null)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        {translations[lang].back}
                      </button>
                    )}
                  </div>

                  {selectedDevice ? (
                    <DeviceDetail
                      device={selectedDevice}
                      onBack={() => setSelectedDeviceId(null)}
                      lang={lang}
                    />
                  ) : (
                    <ParentDashboard
                      onSelectDevice={(id) => setSelectedDeviceId(id)}
                      onOpenAddChild={() => setIsAddChildOpen(true)}
                      lang={lang}
                    />
                  )}
                </div>

                {/* Right Side: Child Simulator (5 columns) */}
                <div className="xl:col-span-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                      <span>{translations[lang].childMode}</span>
                    </span>
                  </div>
                  <ChildDeviceSimulator lang={lang} />
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p>
            {translations[lang].appName} — {lang === 'ar' ? 'منظومة الرقابة الأبوية الذكية مستوردة من GitHub (Kotlin Compose + Firebase)' : 'Parental Control Suite migrated from GitHub'}
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsArchitectureOpen(true)}
              className="hover:text-emerald-400 transition cursor-pointer"
            >
              {translations[lang].architectureTab}
            </button>
            <span>•</span>
            <span className="text-slate-600 font-mono">alqadasif2-cloud/aman1</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddChildModal
        isOpen={isAddChildOpen}
        onClose={() => setIsAddChildOpen(false)}
        lang={lang}
        onDeviceLinked={handleDeviceLinked}
      />

      <ArchitectureInfoModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
        lang={lang}
      />
    </div>
  );
}
