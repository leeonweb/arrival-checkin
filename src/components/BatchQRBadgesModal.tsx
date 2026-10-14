import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, GraduationCap, ShieldCheck } from 'lucide-react';

interface StudentBadgeItem {
  code: string;
  name: string;
  parent_code?: string;
  role?: string;
}

interface BatchQRBadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentBadgeItem[];
  title?: string;
}

export function BatchQRBadgesModal({
  isOpen,
  onClose,
  students,
}: BatchQRBadgesModalProps) {
  const [badgeImages, setBadgeImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || students.length === 0) return;

    let isMounted = true;
    setLoading(true);

    const generateAll = async () => {
      const map: Record<string, string> = {};
      for (const s of students) {
        try {
          const url = await QRCode.toDataURL(s.code, {
            width: 180,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
            errorCorrectionLevel: 'M',
          });
          map[s.code] = url;
        } catch (err) {
          console.error(`QR gen failed for ${s.code}:`, err);
        }
      }
      if (isMounted) {
        setBadgeImages(map);
        setLoading(false);
      }
    };

    generateAll();

    return () => {
      isMounted = false;
    };
  }, [isOpen, students]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full my-auto overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col print:border-none print:shadow-none print:max-w-none">
        {/* Header (Hidden in Print) */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Print All Student QR Badges ({students.length})
              </h3>
              <p className="text-xs text-slate-500">
                Formatted as a printable sheet for lanyards, cards, and student IDs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Grid */}
        <div className="p-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500">Generating student badges...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-4">
              {students.map((s) => (
                <div
                  key={s.code}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 print:border-slate-300 flex flex-col items-center text-center space-y-2 bg-slate-50/50 dark:bg-slate-950/50 print:bg-white break-inside-avoid shadow-2xs"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 print:text-slate-700">
                    Arrival Check-In ID
                  </div>

                  <h5 className="font-extrabold text-sm text-slate-900 dark:text-white print:text-black line-clamp-1">
                    {s.name}
                  </h5>

                  <div className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 print:bg-slate-100 border border-slate-200 dark:border-slate-700 print:border-slate-300 text-slate-800 dark:text-slate-200 print:text-black">
                    {s.code}
                  </div>

                  {badgeImages[s.code] ? (
                    <img
                      src={badgeImages[s.code]}
                      alt={`QR for ${s.code}`}
                      className="w-32 h-32 object-contain bg-white p-1 rounded-xl border border-slate-100"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center text-xs text-slate-400">
                      Generating...
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 print:text-slate-600">
                    Parent: {s.parent_code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
