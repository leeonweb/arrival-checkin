import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  X,
  Camera,
  RefreshCw,
  AlertCircle,
  Volume2,
  ShieldCheck,
  ImageIcon,
  Upload,
  HelpCircle,
} from 'lucide-react';
import { playScanSuccessSound } from '../utils/audio.ts';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
  subtitle?: string;
  continuous?: boolean;
}

export function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Student QR Badge',
  subtitle = 'Position the QR code inside the frame to check in',
  continuous = false,
}: QRScannerModalProps) {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'permission' | 'device' | 'general' | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setScannerError(null);
    setErrorType(null);
    setLastScanned(null);

    const startScanner = async () => {
      try {
        // Stop any existing instance
        if (scannerRef.current && scannerRef.current.isScanning) {
          try {
            await scannerRef.current.stop();
          } catch {
            // Ignore
          }
        }

        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        // Try starting with facingMode
        await scanner.start(
          { facingMode },
          config,
          (decodedText) => {
            if (!isMounted) return;
            const cleaned = decodedText.trim();
            if (cleaned) {
              playScanSuccessSound();
              setLastScanned(cleaned);
              onScan(cleaned);
              if (!continuous) {
                stopScanner().then(() => onClose());
              }
            }
          },
          () => {
            // Searching frame...
          }
        );
      } catch (err) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        const name = (err as { name?: string })?.name || '';

        console.warn('Camera start error:', name, msg);

        if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied')
        ) {
          setErrorType('permission');
          setScannerError(
            'Camera permission blocked. Please grant camera access in your browser or use the "Snap / Upload Photo" button below.'
          );
        } else if (
          name === 'NotFoundError' ||
          msg.toLowerCase().includes('not found') ||
          msg.toLowerCase().includes('no camera')
        ) {
          setErrorType('device');
          setScannerError('No camera found on this device. You can snap or upload a photo instead.');
        } else {
          setErrorType('general');
          setScannerError('Unable to access camera video stream. Please check permissions or upload a photo.');
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, facingMode, retryCount]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.debug('Error stopping scanner:', err);
      }
    }
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const toggleCamera = async () => {
    await stopScanner();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleRetryCamera = () => {
    setScannerError(null);
    setErrorType(null);
    setRetryCount((prev) => prev + 1);
  };

  // Fallback: Scan photo/image of QR code
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setScannerError(null);

    try {
      await stopScanner();

      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;
      }

      const decodedText = await scanner.scanFile(file, true);
      const cleaned = decodedText.trim();

      if (cleaned) {
        playScanSuccessSound();
        setLastScanned(cleaned);
        onScan(cleaned);
        await stopScanner();
        onClose();
      }
    } catch {
      setScannerError('No clear QR code detected in that photo. Please take a closer photo with good lighting.');
    } finally {
      setIsProcessingFile(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleCamera}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Flip camera (front / back)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Camera Box */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          <div id={containerId} className="w-full h-full" />

          {/* Scanner Guide Frame overlay */}
          {!scannerError && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative w-56 h-56 rounded-2xl border-2 border-indigo-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                {/* Corner Accents */}
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />

                {/* Laser animation */}
                <div className="w-full h-0.5 bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
              </div>

              <div className="absolute bottom-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-xs font-semibold text-white/90">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Audio confirmation enabled</span>
              </div>
            </div>
          )}

          {/* Camera Permission / Error / Guide Banner */}
          {scannerError && (
            <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center space-y-4 text-white z-10 overflow-y-auto">
              <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <div className="font-bold text-base text-rose-200">{scannerError}</div>
                {errorType === 'permission' && (
                  <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Tap the <strong>Lock / Permissions</strong> icon in your browser address bar and set <strong>Camera</strong> to <strong>Allow</strong>.
                  </p>
                )}
              </div>

              {/* Action Buttons for Permission Troubleshooting */}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {/* Instant Photo Fallback Button */}
                <button
                  type="button"
                  disabled={isProcessingFile}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{isProcessingFile ? 'Scanning Image...' : 'Snap or Upload Photo of QR'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRetryCamera}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Camera Stream Again</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for Direct Camera Photo or Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Footer info & Fallback Action Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            title="Snap a photo using system camera shutter"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload or Snap Photo</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
          >
            Cancel / Manual
          </button>
        </div>
      </div>
    </div>
  );
}
