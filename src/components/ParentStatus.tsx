import { useState } from 'react';
import { Search, Users, AlertCircle, CheckCircle2, Clock, MessageSquare, QrCode } from 'lucide-react';
import { PrivacyNotice } from './PrivacyNotice.tsx';
import { QRCodeModal } from './QRCodeModal.tsx';

interface ChildStatus {
  student_code: string;
  name: string;
  use_one_session?: boolean;
  status: string;
  morning_status?: string;
  morning_check_in_message?: string | null;
  morning_check_out_message?: string | null;
  afternoon_status?: string;
  afternoon_check_in_message?: string | null;
  afternoon_check_out_message?: string | null;
  check_in_message?: string | null;
  check_out_message?: string | null;
}

interface ParentResult {
  parent_code: string;
  parent_name: string;
  date: string;
  children: ChildStatus[];
}

export function ParentStatus() {
  const [parentCode, setParentCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParentResult | null>(null);

  // Selected student for QR Code Modal
  const [selectedQRStudent, setSelectedQRStudent] = useState<ChildStatus | null>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = raw.replace(/[-\s]/g, '').toUpperCase();
    setParentCode(sanitized);
    if (error) setError(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentCode.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/parent-status?code=${encodeURIComponent(parentCode.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to lookup parent code.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Connection error. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Search Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Family Status Check</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enter your Parent Code to view today&apos;s arrival status and view student QR passes.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="parent-code-input"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Parent Code
            </label>
            <div className="relative">
              <input
                id="parent-code-input"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                value={parentCode}
                onChange={handleCodeChange}
                placeholder="e.g. P4821"
                maxLength={10}
                required
                className="w-full text-2xl font-mono tracking-wider font-extrabold text-center uppercase py-3.5 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-slate-900 dark:text-white transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Case-insensitive, spaces ignored</span>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">Samples: P4821, P7390</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !parentCode.trim()}
            className="w-full py-4 px-6 rounded-2xl text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                <span>Checking...</span>
              </span>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>View Children&apos;s Status</span>
              </>
            )}
          </button>
        </form>

        {/* Error / Rate Limit message */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">{error}</div>
              {error.includes('Too many incorrect code attempts') && (
                <div className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                  Security guard: Maximum 10 incorrect attempts per hour per device to protect student privacy.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lookup Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Family Code: {result.parent_code}
              </span>
              {result.parent_name && (
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {result.parent_name}
                </h3>
              )}
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{result.date}</span>
            </span>
          </div>

          {result.children.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-600 dark:text-slate-400">
              No students are currently linked to parent code {result.parent_code}.
            </div>
          ) : (
            <div className="space-y-3">
              {result.children.map((child) => (
                <div
                  key={child.student_code}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {child.name}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        Code: {child.student_code}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Show QR Pass Button for Gate Scanner */}
                      <button
                        type="button"
                        onClick={() => setSelectedQRStudent(child)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                        title="Show QR Code ID Pass"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Pass</span>
                      </button>

                      {/* Status Badge */}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                          child.status.includes('left')
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : child.status.includes('arrived')
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {child.status.includes('left')
                          ? 'Departed'
                          : child.status.includes('arrived')
                          ? 'On Campus'
                          : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Status Statement */}
                  {child.use_one_session ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {child.name}: {child.status}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-sm space-y-1">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span>
                            <strong>Morning:</strong> {child.morning_status || 'not checked in'}
                          </span>
                        </div>
                        {child.morning_check_in_message && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 pl-4">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Arrival message:</span>{' '}
                            <span className="italic">{String(child.morning_check_in_message)}</span>
                          </div>
                        )}
                        {child.morning_check_out_message && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 pl-4">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Departure message:</span>{' '}
                            <span className="italic">{String(child.morning_check_out_message)}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-sm space-y-1">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                          <span>
                            <strong>Afternoon:</strong> {child.afternoon_status || 'not checked in'}
                          </span>
                        </div>
                        {child.afternoon_check_in_message && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 pl-4">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Arrival message:</span>{' '}
                            <span className="italic">{String(child.afternoon_check_in_message)}</span>
                          </div>
                        )}
                        {child.afternoon_check_out_message && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 pl-4">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Departure message:</span>{' '}
                            <span className="italic">{String(child.afternoon_check_out_message)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Single session Sanitized Plain Text Messages */}
                  {child.use_one_session && (child.check_in_message || child.check_out_message) && (
                    <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                      {child.check_in_message && (
                        <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              Message at arrival:{' '}
                            </span>
                            <span className="italic">{String(child.check_in_message)}</span>
                          </div>
                        </div>
                      )}

                      {child.check_out_message && (
                        <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              Message at departure:{' '}
                            </span>
                            <span className="italic">{String(child.check_out_message)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PrivacyNotice compact />

      {/* QR Code Modal for Selected Child */}
      {selectedQRStudent && (
        <QRCodeModal
          isOpen={Boolean(selectedQRStudent)}
          onClose={() => setSelectedQRStudent(null)}
          title="Student Check-In QR Pass"
          code={selectedQRStudent.student_code}
          name={selectedQRStudent.name}
          subtitle="Show this code to the school gate station camera"
          meta={{
            parentCode: result?.parent_code,
            type: 'student',
          }}
        />
      )}
    </div>
  );
}
