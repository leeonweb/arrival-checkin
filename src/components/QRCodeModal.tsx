import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Download, GraduationCap, ShieldCheck } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  code: string;
  name?: string;
  subtitle?: string;
  meta?: {
    parentCode?: string;
    description?: string;
    type?: 'student' | 'license' | 'parent';
  };
}

export function QRCodeModal({
  isOpen,
  onClose,
  title,
  code,
  name,
  subtitle,
  meta,
}: QRCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !code) return;

    QRCode.toDataURL(code, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [isOpen, code]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_${code}_${name ? name.replace(/\s+/g, '_') : 'code'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col print:border-none print:shadow-none print:max-w-none">
        {/* Screen Header (Hidden when printing) */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Card Area */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4 print:p-8 print:m-auto print:border-2 print:border-slate-800 print:rounded-2xl print:max-w-xs">
          {/* Badge School Header */}
          <div className="space-y-1">
            <div className="text-[11px] font-black tracking-widest uppercase text-indigo-600 dark:text-indigo-400 print:text-slate-800">
              Arrival Check-In ID Pass
            </div>
            {name && (
              <h4 className="text-xl font-black text-slate-900 dark:text-white print:text-black leading-tight">
                {name}
              </h4>
            )}
            <div className="font-mono text-sm font-bold tracking-wider px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 print:bg-slate-100 text-slate-800 dark:text-slate-200 print:text-black inline-block">
              Code: {code}
            </div>
          </div>

          {/* QR Image Box */}
          <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-inner flex items-center justify-center">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={`QR Code for ${code}`}
                className="w-56 h-56 object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                Generating QR...
              </div>
            )}
          </div>

          {/* Subtitle / Details */}
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
            {meta?.parentCode && (
              <div>
                Parent / Family Code: <strong>{meta.parentCode}</strong>
              </div>
            )}
            {subtitle && <div>{subtitle}</div>}
            <div className="text-[11px] pt-1 flex items-center justify-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Valid for campus gate scanners</span>
            </div>
          </div>
        </div>

        {/* Action Controls (Hidden in Print) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Badge</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Save Image</span>
          </button>
        </div>
      </div>
    </div>
  );
}
