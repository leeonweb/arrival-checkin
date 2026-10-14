import { useState, useEffect } from 'react';
import {
  LogIn,
  LogOut,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Info,
  ShieldCheck,
  Tablet,
  Lock,
  QrCode,
  Camera,
} from 'lucide-react';
import { PrivacyNotice } from './PrivacyNotice.tsx';
import { QRScannerModal } from './QRScannerModal.tsx';

interface PublicSettings {
  allow_messages: boolean;
  date: string;
  time: string;
  timezone: string;
}

interface SubmitResponse {
  success?: boolean;
  alreadyCompleted?: boolean;
  action: 'check-in' | 'check-out';
  message: string;
  name?: string;
  studentName?: string;
  session?: string;
  time?: string;
  deviceLabel?: string;
  noCheckInRecorded?: boolean;
  messageSent?: boolean;
  error?: string;
  deviceRevoked?: boolean;
}

interface StationInfo {
  id: string;
  label: string;
  description: string;
  approved_at: string;
}

export function StudentCheckIn() {
  // Device station state
  const [stationToken, setStationToken] = useState<string | null>(() => {
    return localStorage.getItem('arrival_station_token') || null;
  });
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);
  const [stationVerifying, setStationVerifying] = useState(true);
  const [licenseCodeInput, setLicenseCodeInput] = useState('');
  const [activatingStation, setActivatingStation] = useState(false);
  const [stationError, setStationError] = useState<string | null>(null);

  // Student form state
  const [action, setAction] = useState<'check-in' | 'check-out'>('check-in');
  const [studentCode, setStudentCode] = useState('');
  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<SubmitResponse | null>(null);
  const [serverMeta, setServerMeta] = useState<{ date?: string; time?: string }>({});

  // Scanner modal state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'student' | 'license'>('student');

  // Verify device station authorization on mount or token change
  useEffect(() => {
    verifyStation();
    // Fetch public settings
    fetch('/api/public-settings')
      .then((res) => res.json())
      .then((data: PublicSettings) => {
        if (typeof data.allow_messages === 'boolean') {
          setAllowMessages(data.allow_messages);
        }
        if (data.date && data.time) {
          setServerMeta({ date: data.date, time: data.time });
        }
      })
      .catch((err) => console.error('Failed to load settings:', err));
  }, [stationToken]);

  const verifyStation = async () => {
    if (!stationToken) {
      setStationInfo(null);
      setStationVerifying(false);
      return;
    }

    setStationVerifying(true);
    try {
      const res = await fetch('/api/device/verify', {
        headers: { 'X-Device-Token': stationToken },
      });
      const data = await res.json();

      if (res.ok && data.approved) {
        setStationInfo(data.device);
      } else {
        localStorage.removeItem('arrival_station_token');
        setStationToken(null);
        setStationInfo(null);
        setStationError(data.error || 'Device authorization revoked. Please enter a new license code.');
      }
    } catch {
      console.warn('Network issue verifying station token.');
    } finally {
      setStationVerifying(false);
    }
  };

  const handleActivateWithCode = async (codeToUse: string) => {
    if (!codeToUse.trim()) return;

    setActivatingStation(true);
    setStationError(null);

    try {
      const res = await fetch('/api/device/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseCode: codeToUse.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStationError(data.error || 'Failed to activate device.');
      } else {
        localStorage.setItem('arrival_station_token', data.token);
        setStationToken(data.token);
        setStationInfo({
          id: '',
          label: data.label,
          description: data.description,
          approved_at: data.approved_at,
        });
        setLicenseCodeInput('');
      }
    } catch {
      setStationError('Connection error. Please check your network and try again.');
    } finally {
      setActivatingStation(false);
    }
  };

  const handleActivateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleActivateWithCode(licenseCodeInput);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = raw.replace(/[-\s]/g, '').toUpperCase();
    setStudentCode(sanitized);
    if (feedback) setFeedback(null);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= 140) {
      setMessage(text);
    }
  };

  // Perform check-in request with provided or state code
  const submitCheckInOut = async (targetCode: string) => {
    const code = targetCode.trim().replace(/[-\s]/g, '').toUpperCase();
    if (!code || !stationToken) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/check-in-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': stationToken,
        },
        body: JSON.stringify({
          code,
          action,
          message: allowMessages && showMessageBox ? message.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.deviceRevoked || res.status === 403) {
          localStorage.removeItem('arrival_station_token');
          setStationToken(null);
          setStationInfo(null);
          setStationError(data.error || 'This device has been revoked by the School Head.');
          return;
        }

        setFeedback({
          success: false,
          action,
          message: data.error || 'Unable to complete check-in. Please try again.',
        });
      } else {
        setFeedback(data);
        if (data.success) {
          setStudentCode('');
          setMessage('');
          setShowMessageBox(false);
        }
      }
    } catch {
      setFeedback({
        success: false,
        action,
        message: 'Network connection error. Please verify your internet and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCheckInOut(studentCode);
  };

  // Handle scanned QR code
  const handleQRScanResult = (decodedText: string) => {
    if (scannerMode === 'license') {
      setLicenseCodeInput(decodedText.trim().toUpperCase());
      handleActivateWithCode(decodedText);
    } else {
      // Scanned student code
      const cleanCode = decodedText.trim().replace(/[-\s]/g, '').toUpperCase();
      setStudentCode(cleanCode);
      // Automatically submit the check in/out immediately!
      submitCheckInOut(cleanCode);
    }
  };

  const remainingChars = 140 - message.length;

  // 1. Loading Station Authorization
  if (stationVerifying) {
    return (
      <div className="w-full max-w-lg mx-auto p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Verifying station authorization...
        </p>
      </div>
    );
  }

  // 2. UNAPPROVED DEVICE: Show ONLY the License Code screen
  if (!stationToken || !stationInfo) {
    return (
      <div className="w-full max-w-lg mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 mx-auto flex items-center justify-center shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Station Activation Required
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Student arrival check-in is restricted to approved devices (tablets or gate stations) authorized by the School Head.
            </p>
          </div>

          {/* Quick QR Activation Option */}
          <button
            type="button"
            onClick={() => {
              setScannerMode('license');
              setScannerOpen(true);
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-sm border-2 border-dashed border-indigo-300 dark:border-indigo-800 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Scan Head&apos;s License QR Code</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            <span className="flex-shrink mx-3 text-xs uppercase font-bold text-slate-400">Or Type Code</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          </div>

          <form onSubmit={handleActivateStation} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="license-code-input"
                className="block text-sm font-bold text-slate-800 dark:text-slate-200"
              >
                Station License Code
              </label>
              <input
                id="license-code-input"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                value={licenseCodeInput}
                onChange={(e) => {
                  setLicenseCodeInput(e.target.value.replace(/[-\s]/g, '').toUpperCase());
                  if (stationError) setStationError(null);
                }}
                placeholder="e.g. 7K9X2A4"
                maxLength={10}
                required
                className="w-full text-2xl sm:text-3xl font-mono tracking-widest font-black text-center uppercase py-4 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>One-time 6–8 character code.</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">Valid until activated</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={activatingStation || !licenseCodeInput.trim()}
              className="w-full py-4 sm:py-5 px-6 rounded-2xl text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {activatingStation ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validating Code...</span>
                </span>
              ) : (
                <>
                  <Tablet className="w-5 h-5" />
                  <span>Activate This Device</span>
                </>
              )}
            </button>
          </form>

          {stationError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{stationError}</div>
                <div className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                  Ask the School Head to generate a fresh license code from the <strong>Devices</strong> section of the Admin area.
                </div>
              </div>
            </div>
          )}
        </div>

        <PrivacyNotice compact />

        {/* QR Scanner Modal for License */}
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleQRScanResult}
          title="Scan Station License QR"
          subtitle="Point camera at the license QR code on the School Head's screen"
        />
      </div>
    );
  }

  // 3. APPROVED STATION: Render Active Student Check-In with QR Scanning
  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Approved Station Status Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 shadow-sm">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            Approved Station: <strong>{stationInfo.label}</strong>
          </span>
        </div>
        <span className="font-mono text-[11px] opacity-75 hidden sm:inline">
          {stationInfo.description}
        </span>
      </div>

      {/* Action Mode Toggle */}
      <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => {
            setAction('check-in');
            setFeedback(null);
          }}
          className={`flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-lg font-bold transition-all shadow-sm ${
            action === 'check-in'
              ? 'bg-emerald-600 text-white shadow-emerald-700/30'
              : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <LogIn className="w-6 h-6 shrink-0" />
          <span>Check In</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAction('check-out');
            setFeedback(null);
          }}
          className={`flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-lg font-bold transition-all shadow-sm ${
            action === 'check-out'
              ? 'bg-blue-600 text-white shadow-blue-700/30'
              : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <LogOut className="w-6 h-6 shrink-0" />
          <span>Check Out</span>
        </button>
      </div>

      {/* Quick QR Scanner Kiosk Trigger */}
      <button
        type="button"
        onClick={() => {
          setScannerMode('student');
          setScannerOpen(true);
        }}
        className={`w-full py-4 px-6 rounded-3xl font-extrabold text-base sm:text-lg flex items-center justify-center gap-3 transition-all shadow-md active:scale-[0.98] border-2 cursor-pointer ${
          action === 'check-in'
            ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 shadow-emerald-600/10'
            : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800 shadow-blue-600/10'
        }`}
      >
        <QrCode className="w-6 h-6 shrink-0" />
        <span>Scan Student QR Badge ({action === 'check-in' ? 'Check In' : 'Check Out'})</span>
      </button>

      {/* Main Check-In Form */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>Manila Time: {serverMeta.date ? `${serverMeta.date}` : 'School Clock'}</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
            Manual Entry / Kiosk
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student Code Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="student-code"
                className="block text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                Student Code
              </label>
              <button
                type="button"
                onClick={() => {
                  setScannerMode('student');
                  setScannerOpen(true);
                }}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Open Camera</span>
              </button>
            </div>

            <div className="relative">
              <input
                id="student-code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                value={studentCode}
                onChange={handleCodeChange}
                placeholder="e.g. S001"
                maxLength={10}
                required
                className="w-full text-2xl sm:text-3xl font-mono tracking-wider font-extrabold text-center uppercase py-4 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-slate-900 dark:text-white transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Spaces and hyphens are ignored automatically.</span>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">Sample: S001</span>
            </p>
          </div>

          {/* Optional Message Section (Collapsible) */}
          {allowMessages && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={() => setShowMessageBox(!showMessageBox)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  <span>Add a message (optional)</span>
                  {message.trim().length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </span>
                {showMessageBox ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showMessageBox && (
                <div className="p-4 pt-1 space-y-2 border-t border-slate-200 dark:border-slate-800">
                  <textarea
                    value={message}
                    onChange={handleMessageChange}
                    maxLength={140}
                    rows={3}
                    placeholder="Example: Going home with Tita today"
                    className="w-full text-base p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      Visible only to parent and school staff. No real names.
                    </span>
                    <span
                      className={`font-semibold ${
                        remainingChars < 20
                          ? 'text-amber-500'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {remainingChars} left
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Action Button */}
          <button
            type="submit"
            disabled={loading || !studentCode.trim()}
            className={`w-full py-4 sm:py-5 px-6 rounded-2xl text-xl sm:text-2xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
              action === 'check-in'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </span>
            ) : action === 'check-in' ? (
              'Check in'
            ) : (
              'Check out'
            )}
          </button>
        </form>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div
            className={`p-5 rounded-2xl border transition-all ${
              feedback.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                : feedback.alreadyCompleted
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
            }`}
          >
            <div className="flex items-start gap-3">
              {feedback.success ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : feedback.alreadyCompleted ? (
                <Info className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-base sm:text-lg font-bold leading-tight">
                  {feedback.message}
                </div>
                {(feedback.name || feedback.studentName) && feedback.success && (
                  <div className="text-sm opacity-90">
                    Recorded under: <strong>{feedback.name || feedback.studentName}</strong> • Station:{' '}
                    <strong>{feedback.deviceLabel || stationInfo.label}</strong>
                  </div>
                )}
                {feedback.noCheckInRecorded && (
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    Departure recorded without a prior morning check-in.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <PrivacyNotice compact />

      {/* QR Scanner Modal for Student Check-In */}
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleQRScanResult}
        title={scannerMode === 'student' ? `Scan Student QR (${action === 'check-in' ? 'Check In' : 'Check Out'})` : 'Scan Station License QR'}
        subtitle={scannerMode === 'student' ? 'Hold student ID card up to the camera' : 'Point camera at the license QR code'}
      />
    </div>
  );
}
