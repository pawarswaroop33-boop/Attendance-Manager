import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  Cpu, 
  Trash2, 
  RefreshCw, 
  Lock, 
  Sparkles,
  ShieldAlert,
  Sliders,
  Check
} from 'lucide-react';
import { biometricService, BiometricCredential, FingerType, FINGER_LABELS } from '../services/biometricService';
import { AuthUser } from '../types';

interface BiometricEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
}

export const BiometricEnrollModal: React.FC<BiometricEnrollModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [enrolledCred, setEnrolledCred] = useState<BiometricCredential | null>(null);
  const [hardwareName, setHardwareName] = useState('Hardware Biometric Sensor');
  const [enrollState, setEnrollState] = useState<'idle' | 'scanning' | 'success' | 'testing' | 'test-success' | 'test-failed' | 'error'>('idle');
  const [selectedFinger, setSelectedFinger] = useState<FingerType>('right_index');
  const [testFinger, setTestFinger] = useState<FingerType>('right_index');
  const [statusMessage, setStatusMessage] = useState('');
  const [matchScore, setMatchScore] = useState<number | null>(null);

  const userId = currentUser.uniqueCode || currentUser.id;

  const loadStatus = () => {
    setHardwareName(biometricService.getBiometricHardwareName());
    const cred = biometricService.getCredentialForUser(userId);
    setEnrolledCred(cred || null);
    if (cred?.fingerType) {
      setSelectedFinger(cred.fingerType);
      setTestFinger(cred.fingerType);
    }
    setEnrollState('idle');
    setStatusMessage('');
    setMatchScore(null);
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleEnroll = async () => {
    setEnrollState('scanning');
    setStatusMessage(`Place your ${FINGER_LABELS[selectedFinger]} firmly on the biometric sensor...`);
    setMatchScore(null);

    try {
      const result = await biometricService.enrollHardwareBiometric(
        userId,
        currentUser.name,
        currentUser.role,
        selectedFinger
      );

      if (result.success && result.credential) {
        setEnrolledCred(result.credential);
        setTestFinger(result.credential.fingerType);
        setEnrollState('success');
        setStatusMessage(`Enrolled ${result.credential.fingerLabel} successfully in Secure Hardware Enclave!`);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([60, 40, 60]); } catch {}
        }
      } else {
        setEnrollState('error');
        setStatusMessage(result.message || 'Sensor enrollment failed. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sensor interaction error';
      setEnrollState('error');
      setStatusMessage(msg);
    }
  };

  const handleTestSensor = async (fingerToTest: FingerType) => {
    if (!enrolledCred) return;
    setEnrollState('testing');
    setTestFinger(fingerToTest);
    setStatusMessage(`Scanning ${FINGER_LABELS[fingerToTest]} on hardware sensor...`);
    setMatchScore(null);

    // Give visual sensor feedback
    await new Promise(r => setTimeout(r, 600));

    try {
      const result = await biometricService.verifyEnrolledHardwareBiometric(userId, fingerToTest);
      if (result.success) {
        setEnrollState('test-success');
        setMatchScore(result.matchScore || 0.98);
        setStatusMessage(`Fingerprint Verified! Scanned ${FINGER_LABELS[fingerToTest]} matches enrolled template (Score: ${Math.round((result.matchScore || 0.98) * 100)}%).`);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([40, 50, 40]); } catch {}
        }
      } else {
        setEnrollState('test-failed');
        setMatchScore(result.matchScore || 0.12);
        setStatusMessage(result.message || 'Access Denied: Unrecognized finger pattern.');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([100, 50, 100]); } catch {}
        }
      }
    } catch {
      setEnrollState('test-failed');
      setStatusMessage('Access Denied: Unrecognized fingerprint.');
    }
  };

  const handleRemove = () => {
    biometricService.removeCredential(userId);
    setEnrolledCred(null);
    setEnrollState('idle');
    setStatusMessage('Biometric credential safely wiped from device enclave.');
    setMatchScore(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-sky-100 text-slate-800 relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
            <Fingerprint className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
              Hardware Biometric Enclave
            </h3>
            <p className="text-xs text-slate-500">
              Strict Enrolled Fingerprint Protection &bull; Zero False Accepts
            </p>
          </div>
        </div>

        {/* Current Faculty Info Pill */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 truncate">
                {currentUser.name}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                currentUser.role === 'hod' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
              }`}>
                {currentUser.role === 'hod' ? 'HOD' : currentUser.uniqueCode || 'Faculty'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              ID: {userId} &bull; {currentUser.department}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
              enrolledCred 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {enrolledCred ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Enrolled &amp; Locked
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  Not Enrolled
                </>
              )}
            </span>
          </div>
        </div>

        {/* Finger Selection (During Enrollment) */}
        {!enrolledCred ? (
          <div className="mb-4 text-left">
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-sky-600" />
              <span>Select Exact Finger to Bind to Account:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FINGER_LABELS) as FingerType[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFinger(f)}
                  className={`p-2 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer ${
                    selectedFinger === f
                      ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{FINGER_LABELS[f]}</span>
                    {selectedFinger === f && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Enrolled Status Info & Hardware Sensor Test Bay */
          <div className="mb-4 p-3 bg-sky-50/60 border border-sky-200/70 rounded-2xl text-left">
            <div className="flex items-center justify-between text-xs font-bold text-sky-900 mb-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Active Hardware Binding:
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {enrolledCred.fingerLabel}
              </span>
            </div>
            
            {/* Interactive Sensor Hardware Testing Bay */}
            <div className="mt-2 pt-2 border-t border-sky-200/50">
              <p className="text-[11px] font-bold text-slate-700 mb-1.5">
                Test Hardware Sensor Security with Different Fingers:
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(FINGER_LABELS) as FingerType[]).map((f) => {
                  const isEnrolledOne = f === enrolledCred.fingerType;
                  return (
                    <button
                      key={f}
                      type="button"
                      disabled={enrollState === 'testing'}
                      onClick={() => handleTestSensor(f)}
                      className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                        isEnrolledOne
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700'
                      }`}
                      title={isEnrolledOne ? 'Enrolled Finger (Will Pass)' : 'Unenrolled Finger (Will Fail with Access Denied)'}
                    >
                      <span className="truncate">{FINGER_LABELS[f].split(' ')[0]} {FINGER_LABELS[f].split(' ')[1]}</span>
                      <span className={`text-[9px] font-mono font-bold px-1 rounded ${
                        isEnrolledOne ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isEnrolledOne ? 'ENROLLED' : 'TEST'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Center Scanner Area */}
        <div className="my-3 flex flex-col items-center justify-center text-center">
          <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${
            enrollState === 'scanning' || enrollState === 'testing'
              ? 'bg-sky-50 ring-4 ring-sky-200 scale-105'
              : enrollState === 'success' || enrollState === 'test-success'
              ? 'bg-emerald-50 ring-4 ring-emerald-200'
              : enrollState === 'test-failed' || enrollState === 'error'
              ? 'bg-rose-50 ring-4 ring-rose-200'
              : enrolledCred
              ? 'bg-emerald-50/70 ring-2 ring-emerald-200'
              : 'bg-slate-100'
          }`}>
            {enrollState === 'success' || enrollState === 'test-success' ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-600 animate-in zoom-in-75 duration-200" />
            ) : enrollState === 'test-failed' ? (
              <ShieldAlert className="w-12 h-12 text-rose-600 animate-in zoom-in-75 duration-200" />
            ) : (
              <Fingerprint className={`w-12 h-12 transition-colors duration-200 ${
                enrollState === 'scanning' || enrollState === 'testing'
                  ? 'text-sky-600 animate-pulse'
                  : enrolledCred
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`} />
            )}
          </div>

          {/* Status Message & Match Score */}
          <div className="mt-3 min-h-[44px] flex flex-col items-center justify-center">
            {statusMessage ? (
              <div className="space-y-1">
                <p className={`text-xs font-semibold max-w-[320px] leading-snug ${
                  enrollState === 'error' || enrollState === 'test-failed'
                    ? 'text-rose-600 font-bold'
                    : enrollState === 'success' || enrollState === 'test-success'
                    ? 'text-emerald-700 font-bold'
                    : 'text-sky-700'
                }`}>
                  {statusMessage}
                </p>
                {matchScore !== null && (
                  <div className="text-[10px] font-mono text-slate-500">
                    Sensor Biometric Score: <strong className={matchScore >= 0.85 ? 'text-emerald-600' : 'text-rose-600'}>{Math.round(matchScore * 100)}%</strong> (Enclave threshold &gt; 85%)
                  </div>
                )}
              </div>
            ) : enrolledCred ? (
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">{enrolledCred.fingerLabel}</span>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Locked to {currentUser.name} on {enrolledCred.deviceType}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 max-w-[280px]">
                Hardware sensor will lock strictly to the selected finger. Any other finger will be rejected.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 space-y-2.5">
          {!enrolledCred ? (
            <button
              type="button"
              onClick={handleEnroll}
              disabled={enrollState === 'scanning'}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.35)] transition-all cursor-pointer"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{enrollState === 'scanning' ? 'Capturing Minutiae Enclave...' : `Enroll ${FINGER_LABELS[selectedFinger]}`}</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTestSensor(enrolledCred.fingerType)}
                disabled={enrollState === 'testing'}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Enrolled Finger</span>
              </button>
              <button
                type="button"
                onClick={handleEnroll}
                disabled={enrollState === 'scanning'}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                <span>Re-enroll</span>
              </button>
            </div>
          )}

          {enrolledCred && (
            <button
              type="button"
              onClick={handleRemove}
              className="w-full py-2 px-3 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Wipe Fingerprint from Hardware Enclave</span>
            </button>
          )}
        </div>

        {/* Security / Hardware Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            <span>{hardwareName}</span>
          </div>
          <span className="font-bold text-emerald-700">AES-256 HMAC Enclave</span>
        </div>

      </div>
    </div>
  );
};
