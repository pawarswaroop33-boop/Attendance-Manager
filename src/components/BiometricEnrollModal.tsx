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
  Check,
  Shield,
  GraduationCap
} from 'lucide-react';
import { webauthnService, RegisteredCredentialInfo } from '../services/webauthnService';
import { AuthUser } from '../types';

interface BiometricEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
}

const FINGER_OPTIONS = [
  'Right Index Finger',
  'Right Thumb',
  'Left Index Finger',
  'Left Thumb',
  'Primary Fingerprint / Passkey'
];

export const BiometricEnrollModal: React.FC<BiometricEnrollModalProps> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [enrolledCred, setEnrolledCred] = useState<RegisteredCredentialInfo | null>(null);
  const [hardwareName, setHardwareName] = useState('Hardware Biometric Sensor');
  const [enrollState, setEnrollState] = useState<'idle' | 'scanning' | 'success' | 'testing' | 'test-success' | 'test-failed' | 'error'>('idle');
  const [selectedFingerLabel, setSelectedFingerLabel] = useState<string>('Right Index Finger');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const userId = currentUser.uniqueCode || currentUser.id;

  const loadStatus = async () => {
    setHardwareName(webauthnService.getHardwareName());
    setIsLoading(true);
    try {
      const list = await webauthnService.getCredentials(userId, currentUser.role);
      if (list.length > 0) {
        setEnrolledCred(list[0]);
        if (list[0].fingerLabel) {
          setSelectedFingerLabel(list[0].fingerLabel);
        }
      } else {
        setEnrolledCred(null);
      }
    } catch {
      setEnrolledCred(null);
    } finally {
      setIsLoading(false);
      setEnrollState('idle');
      setStatusMessage('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleEnroll = async () => {
    setEnrollState('scanning');
    setStatusMessage(`Prompting ${hardwareName}... Please scan your fingerprint on your device's biometric sensor.`);

    try {
      const result = await webauthnService.enrollBiometric(
        userId,
        currentUser.name,
        currentUser.role,
        selectedFingerLabel
      );

      if (result.success && result.credential) {
        setEnrolledCred(result.credential);
        setEnrollState('success');
        setStatusMessage(`Biometric credential successfully bound to ${currentUser.role === 'hod' ? 'HOD' : 'Faculty'} account on this device.`);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([60, 40, 60]); } catch {}
        }
      } else {
        setEnrollState('error');
        setStatusMessage(result.message || 'Biometric enrollment failed. Please try again.');
      }
    } catch (err: any) {
      setEnrollState('error');
      setStatusMessage(err.message || 'Sensor enrollment error.');
    }
  };

  const handleTestPasskey = async () => {
    if (!enrolledCred) return;
    setEnrollState('testing');
    setStatusMessage(`Testing biometric authentication for ${currentUser.name}... Please scan your enrolled fingerprint.`);

    try {
      const result = await webauthnService.authenticateBiometric(
        currentUser.role,
        userId
      );

      if (result.success) {
        setEnrollState('test-success');
        setStatusMessage(`Authentication Success: Verified passkey belongs strictly to ${currentUser.role.toUpperCase()} account (${currentUser.name})!`);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([40, 50, 40]); } catch {}
        }
      } else {
        setEnrollState('test-failed');
        setStatusMessage(result.message || 'Access Denied: Biometric verification failed.');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([100, 50, 100]); } catch {}
        }
      }
    } catch {
      setEnrollState('test-failed');
      setStatusMessage('Access Denied: Sensor verification rejected.');
    }
  };

  const handleRemove = async () => {
    if (!enrolledCred) return;
    const ok = await webauthnService.revokeCredential(enrolledCred.id);
    if (ok) {
      setEnrolledCred(null);
      setEnrollState('idle');
      setStatusMessage('Biometric credential safely revoked from server.');
    } else {
      setStatusMessage('Failed to revoke credential. Please retry.');
    }
  };

  const handleClearAllForUser = async () => {
    setEnrollState('scanning');
    setStatusMessage('Clearing enrolled biometric credentials from server...');
    const res = await webauthnService.clearCredentials(userId, currentUser.role);
    if (res.success) {
      setEnrolledCred(null);
      setEnrollState('idle');
      setStatusMessage('Enrolled fingerprint successfully cleared.');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([40, 40]); } catch {}
      }
    } else {
      setEnrollState('error');
      setStatusMessage(res.message || 'Failed to clear enrolled fingerprint.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
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
              WebAuthn Biometric Security
            </h3>
            <p className="text-xs text-slate-500">
              Hardware-Bound Biometric Passkey &bull; Strict Role Isolation
            </p>
          </div>
        </div>

        {/* Current Account Info Pill */}
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
                  Passkey Active
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

        {/* Role Isolation Note */}
        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl mb-4 text-xs text-blue-900">
          <div className="flex items-center gap-1.5 font-bold mb-0.5">
            <Shield className="w-3.5 h-3.5 text-blue-700" />
            <span>Role-Specific Credential Binding</span>
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            This biometric credential will be bound exclusively to your <strong>{currentUser.role === 'hod' ? 'HOD' : 'Faculty'}</strong> account. Cross-role authentication is strictly blocked.
          </p>
        </div>

        {/* Finger / Passkey Label Selection */}
        {!enrolledCred ? (
          <div className="mb-4 text-left">
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-sky-600" />
              <span>Select Fingerprint / Credential Label:</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {FINGER_OPTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedFingerLabel(label)}
                  className={`p-2 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer flex items-center justify-between ${
                    selectedFingerLabel === label
                      ? 'bg-sky-50 border-sky-500 text-sky-900 ring-2 ring-sky-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{label}</span>
                  {selectedFingerLabel === label && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Enrolled Status Info & Hardware Sensor Test Bay */
          <div className="mb-4 p-3 bg-sky-50/60 border border-sky-200/70 rounded-2xl text-left">
            <div className="flex items-center justify-between text-xs font-bold text-sky-900 mb-1.5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Active Registered Passkey:
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {enrolledCred.fingerLabel || 'Biometric Passkey'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Registered on: {new Date(enrolledCred.createdAt).toLocaleString()} &bull; Authenticator: {enrolledCred.deviceType || hardwareName}
            </p>
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

          {/* Status Message */}
          <div className="mt-3 min-h-[44px] flex flex-col items-center justify-center">
            {statusMessage ? (
              <p className={`text-xs font-semibold max-w-[320px] leading-snug ${
                enrollState === 'error' || enrollState === 'test-failed'
                  ? 'text-rose-600 font-bold'
                  : enrollState === 'success' || enrollState === 'test-success'
                  ? 'text-emerald-700 font-bold'
                  : 'text-sky-700'
              }`}>
                {statusMessage}
              </p>
            ) : enrolledCred ? (
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">{enrolledCred.fingerLabel || 'Biometric Passkey'}</span>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Bound to {currentUser.name} ({currentUser.role.toUpperCase()})
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 max-w-[280px]">
                Click below to register your device's biometric sensor via WebAuthn.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 space-y-2.5">
          {!enrolledCred ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleEnroll}
                disabled={enrollState === 'scanning'}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.35)] transition-all cursor-pointer"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{enrollState === 'scanning' ? 'Scanning Biometric Sensor...' : `Enroll Biometric for ${currentUser.role === 'hod' ? 'HOD' : 'Faculty'}`}</span>
              </button>

              {/* Clear Enrolled Fingerprint option beneath enroll button */}
              <button
                type="button"
                onClick={handleClearAllForUser}
                disabled={enrollState === 'scanning'}
                className="w-full py-2.5 px-3 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50/90 border border-rose-200/90 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                title="Wipe any previously stored biometric credentials for this account"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Clear Enrolled Fingerprint</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleTestPasskey}
                  disabled={enrollState === 'testing'}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Test Passkey</span>
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

              {/* Clear Enrolled Fingerprint option beneath enroll / test buttons */}
              <button
                type="button"
                onClick={handleClearAllForUser}
                className="w-full py-2.5 px-3 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/90 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Clear Enrolled Fingerprint</span>
              </button>
            </div>
          )}
        </div>

        {/* Security / Hardware Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            <span>{hardwareName}</span>
          </div>
          <span className="font-bold text-emerald-700">FIDO2 / WebAuthn Server-Verified</span>
        </div>

      </div>
    </div>
  );
};
