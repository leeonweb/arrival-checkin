import { useState } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { StudentCheckIn } from './components/StudentCheckIn.tsx';
import { ParentStatus } from './components/ParentStatus.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { ShieldCheck, Sparkles, Check, Copy } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'student' | 'parent' | 'admin'>('student');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const copyText = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Navbar currentView={currentView} onSelectView={setCurrentView} />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-10 flex flex-col items-center">
        {currentView === 'student' && <StudentCheckIn />}
        {currentView === 'parent' && <ParentStatus />}
        {currentView === 'admin' && <AdminDashboard />}

        {/* Quick Testing Helper for Easy Review */}
        <section
          aria-label="Testing reference"
          className="w-full max-w-lg mt-8 p-4 rounded-2xl bg-indigo-50/70 dark:bg-slate-900/80 border border-indigo-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Reference Testing Data</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Tap to Copy
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Student &amp; Parent Codes:
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Student S001', code: 'S001' },
                { label: 'Student S002', code: 'S002' },
                { label: 'Student S003', code: 'S003' },
                { label: 'Staff T4829', code: 'T4829' },
                { label: 'Staff T7311', code: 'T7311' },
                { label: 'Parent P4821', code: 'P4821' },
                { label: 'Parent P7390', code: 'P7390' },
                { label: 'Station License: GATE2026', code: 'GATE2026' },
              ].map((sample) => (
                <button
                  key={sample.code}
                  type="button"
                  onClick={() => copyText(sample.code, sample.code)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-indigo-400 transition-colors shadow-2xs cursor-pointer"
                  title={`Copy ${sample.code}`}
                >
                  <span>{sample.label}</span>
                  {copiedItem === sample.code ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Admin &amp; School Head Passwords:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText('head_pass', 'schoolhead2026')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300 font-mono text-xs font-semibold hover:border-amber-400 transition-colors cursor-pointer"
              >
                <span>School Head: schoolhead2026</span>
                {copiedItem === 'head_pass' ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => copyText('staff_pass', 'schooladmin2026')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-indigo-400 transition-colors cursor-pointer"
              >
                <span>Staff: schooladmin2026</span>
                {copiedItem === 'staff_pass' ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
            <strong>Device Approval Flow:</strong> The student check-in portal works only on Head-approved stations. Sign in as <strong>School Head</strong> to generate a license code under <strong>Devices</strong>, then enter it on the student page to activate the station. Parents can view status from any device without authorization.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-6 px-4 bg-white/50 dark:bg-slate-900/50 mt-auto text-xs text-slate-500 dark:text-slate-400 text-center">
        <div className="max-w-5xl mx-auto space-y-2">
          <div className="flex items-center justify-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Arrival Check-in System • School Head Approved Stations &amp; Child Privacy Protected</span>
          </div>
          <p>
            Compliant with RA 10173 (Philippines Data Privacy Act). Server time synchronized to Asia/Manila (UTC+8).
          </p>
        </div>
      </footer>
    </div>
  );
}
