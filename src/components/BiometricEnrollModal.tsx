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
  KeyRound,
  Sparkles
} from 'lucide-react';
import { biometricService, BiometricCredential } from '../services/biometricService';
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
  const [hardwareName, setHardwareName] = useState('System Biometric Sensor');
  const [enrollState, setEnrollState] = useState<'idle' | 'scanning' | 'success' | 'testing' | 'test-success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const userId = currentUser.uniqueCode || currentUser.id;

  const loadStatus = () => {
    setHardwareName(biometricService.getBiometricHardwareName());
    const cred = biometricService.getCredentialForUser(userId);
    setEnrolledCred(cred || null);
    setEnrollState('idle');
    setStatusMessage('');
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleEnroll = async () => {
    setEnrollState('scanning');
    setStatusMessage('Place your finger on the sensor to enroll...');

    try {
      const result = await biometricService.enrollHardwareBiometric(
        userId,
        currentUser.name,
        currentUser.role
      );

      if (result.success && result.credential) {
        setEnrolledCred(result.credential);
        setEnrollState('success');
        setStatusMessage(`Fingerprint successfully enrolled on ${result.credential.deviceType}!`);
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

  const handleTestSensor = async () => {
    if (!enrolledCred) return;
    setEnrollState('testing');
    setStatusMessage('Place your enrolled finger on the sensor to test hardware recognition...');

    try {
      const result = await biometricService.verifyEnrolledHardwareBiometric(userId);
      if (result.success) {
        setEnrollState('test-success');
        setStatusMessage(`Fingerprint recognized! Hardware verified for ${currentUser.name}.`);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([40, 50, 40]); } catch {}
        }
      } else {
        setEnrollState('error');
        setStatusMessage(result.message || 'Verification failed. Unrecognized fingerprint.');
      }
    } catch {
      setEnrollState('error');
      setStatusMessage('Hardware test failed.');
    }
  };

  const handleRemove = () => {
    biometricService.removeCredential(userId);
    setEnrolledCred(null);
    setEnrollState('idle');
    setStatusMessage('Biometric enrollment removed. You will need your password to log in.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-sky-100 text-slate-800 relative overflow-hidden animate-in zoom-in-95 duration-200">
        
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
              Hardware Biometric ID
            </h3>
            <p className="text-xs text-slate-500">
              Manage your personal Touch ID / Windows Hello login
            </p>
          </div>
        </div>

        {/* Current Faculty Info Pill */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 mb-5">
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
                  Enrolled
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

        {/* Center Scanner Area */}
        <div className="my-4 flex flex-col items-center justify-center text-center">
          <div className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
            enrollState === 'scanning' || enrollState === 'testing'
              ? 'bg-sky-50 ring-8 ring-sky-100 scale-105'
              : enrollState === 'success' || enrollState === 'test-success'
              ? 'bg-emerald-50 ring-8 ring-emerald-100 scale-105'
              : enrolledCred
              ? 'bg-emerald-50/60 ring-4 ring-emerald-100'
              : 'bg-slate-100'
          }`}>
            {(enrollState === 'scanning' || enrollState === 'testing') && (
              <div className="absolute inset-x-4 top-1/4 h-0.5 bg-gradient-to-r from-transparent via-sky-500 to-transparent shadow-[0_0_8px_rgba(14,165,233,1)] animate-bounce" />
            )}

            {enrollState === 'success' || enrollState === 'test-success' ? (
              <CheckCircle2 className="w-14 h-14 text-emerald-600 animate-in zoom-in-75 duration-300" />
            ) : (
              <Fingerprint className={`w-14 h-14 transition-colors duration-200 ${
                enrollState === 'scanning' || enrollState === 'testing'
                  ? 'text-sky-600 animate-pulse'
                  : enrolledCred
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`} />
            )}
          </div>

          {/* Status Message */}
          <div className="mt-3.5 min-h-[36px] flex items-center justify-center">
            {statusMessage ? (
              <p className={`text-xs font-semibold max-w-[280px] leading-snug ${
                enrollState === 'error'
                  ? 'text-rose-600'
                  : enrollState === 'success' || enrollState === 'test-success'
                  ? 'text-emerald-700'
                  : 'text-sky-700'
              }`}>
                {statusMessage}
              </p>
            ) : enrolledCred ? (
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Enrolled on: </span>
                {new Date(enrolledCred.registeredAt).toLocaleDateString()} via {enrolledCred.deviceType}
              </div>
            ) : (
              <p className="text-xs text-slate-500 max-w-[280px]">
                Enroll your fingerprint to unlock the portal in 1 tap without typing passwords.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 space-y-2.5">
          {!enrolledCred ? (
            <button
              type="button"
              onClick={handleEnroll}
              disabled={enrollState === 'scanning'}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.35)] transition-all cursor-pointer"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{enrollState === 'scanning' ? 'Touching Sensor...' : 'Enroll My Fingerprint'}</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleTestSensor}
                disabled={enrollState === 'testing'}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Sensor</span>
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
              <span>Remove Fingerprint from this Device</span>
            </button>
          )}
        </div>

        {/* Security / Hardware Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            <span>{hardwareName}</span>
          </div>
          <span className="font-semibold text-emerald-700">FIDO2 Hardware TPM</span>
        </div>

      </div>
    </div>
  );
};
