import { ShieldCheck } from 'lucide-react';

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-start gap-2 p-3 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            RA 10173 Privacy Notice:{' '}
          </span>
          Arrival and departure logs are strictly collected for student campus safety and attendance.
          Messages are optional and visible only to authorized parents and school staff. Never include
          sensitive personal details.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
      <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 text-sm">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span>Data Privacy & Safety (Republic Act 10173)</span>
      </div>
      <p className="leading-relaxed">
        This portal strictly observes the <strong className="text-slate-700 dark:text-slate-300">Philippines Data Privacy Act of 2012</strong>.
        Check-in and check-out logs are recorded to safeguard students while on campus and verify attendance.
      </p>
      <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
        <li>Student rosters and identity records are never exposed to public browsers.</li>
        <li>Optional arrival/departure messages are visible only to the student's designated parent/guardian and authorized school staff.</li>
        <li>Students and families are advised <strong>never to enter private or sensitive information</strong> (such as medical records, home addresses, or credentials) in the message box.</li>
        <li>Attendance is retained for the current school year for auditing.</li>
      </ul>
    </div>
  );
}
