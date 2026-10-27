import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { amanStore } from '../services/store';
import { PairingCode } from '../types/aman';
import { translations } from '../i18n/translations';
import { X, Copy, Check, QrCode, Sparkles, Smartphone, ShieldCheck, Clock } from 'lucide-react';

interface AddChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
  onDeviceLinked?: (deviceId: string) => void;
}

export const AddChildModal: React.FC<AddChildModalProps> = ({
  isOpen,
  onClose,
  lang,
  onDeviceLinked
}) => {
  const t = translations[lang];
  const [childName, setChildName] = useState('');
  const [activeCode, setActiveCode] = useState<PairingCode | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds

  useEffect(() => {
    if (!isOpen) {
      setChildName('');
      setActiveCode(null);
      setQrDataUrl('');
      setCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!activeCode) return;

    // Generate QR Code data URL
    QRCode.toDataURL(activeCode.code, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(setQrDataUrl).catch(console.error);

    // Countdown interval
    const updateTime = () => {
      const remaining = Math.max(0, Math.floor((activeCode.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setActiveCode(null);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [activeCode]);

  if (!isOpen) return null;

  const handleGenerateCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim()) return;

    const code = amanStore.createPairingCode(childName.trim());
    setActiveCode(code);
  };

  const handleCopy = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSimulateInstantPairing = () => {
    if (!activeCode) return;
    const redeemed = amanStore.redeemPairingCode(activeCode.code, {
      deviceName: `${childName}'s Android`,
      manufacturer: 'Google',
      model: 'Pixel 8a',
      sdk: 34
    });

    if (redeemed && onDeviceLinked) {
      onDeviceLinked(redeemed.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden text-slate-100">
        
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{t.addChild}</h2>
            <p className="text-xs text-slate-400">{t.addFirstChild}</p>
          </div>
        </div>

        {!activeCode ? (
          <form onSubmit={handleGenerateCode} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t.childName}
              </label>
              <input
                type="text"
                required
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: يوسف، فاطمة...' : 'e.g. Liam, Sophia...'}
                className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-sm"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>{lang === 'ar' ? 'آلية الربط الآمنة' : 'Secure Pairing Protocol'}</span>
              </div>
              <p>
                {t.codeExpires}
              </p>
            </div>

            <button
              type="submit"
              disabled={!childName.trim()}
              className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.createCode}</span>
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-center">
            {/* 8-character Pairing Code display */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">{t.childPairHint}</span>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-3xl font-extrabold tracking-widest text-emerald-400 bg-emerald-950/40 px-4 py-1.5 rounded-xl border border-emerald-500/30">
                  {activeCode.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Copy code"
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              {/* Countdown timer */}
              <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? `ينتهي الرمز خلال: ${formatCountdown(timeLeft)}` : `Expires in: ${formatCountdown(timeLeft)}`}</span>
              </div>
            </div>

            {/* QR Code Container */}
            {qrDataUrl && (
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white rounded-2xl shadow-xl ring-4 ring-slate-800/80">
                  <img src={qrDataUrl} alt="Pairing QR Code" className="w-48 h-48 rounded-lg" />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
                  <QrCode className="w-4 h-4 text-slate-300" />
                  <span>{lang === 'ar' ? 'يمكن مسح هذا الرمز مباشرة بكاميرا تطبيق الطفل' : 'Scan this QR code using the Child App camera'}</span>
                </div>
              </div>
            )}

            {/* Simulator Quick Action */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleSimulateInstantPairing}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Smartphone className="w-4 h-4" />
                <span>{lang === 'ar' ? 'ربط تجريبي فوري في المحاكي' : 'Instant Test Pair in Simulator'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCode(null)}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-xs"
              >
                {lang === 'ar' ? 'إنشاء رمز آخر' : 'Generate Another'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
