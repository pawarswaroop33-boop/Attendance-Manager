import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle2, AlertCircle, X, ShieldAlert, Cpu, Lock, UserCheck } from 'lucide-react';
import { biometricService, BiometricCredential } from '../services/biometricService';
import { AuthUser, Teacher, SystemSettings } from '../types';

interface BiometricAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoleMode: 'teacher' | 'hod';
  enteredUsername?: string;
  teachers: Teacher[];
  settings: SystemSettings;
  onLoginSuccess: (user: AuthUser) => void;
}

export const BiometricAuthModal: React.FC<BiometricAuthModalProps> = ({
  isOpen,
  onClose,
  activeRoleMode,
  enteredUsername = '',
  teachers,
  settings,
  onLoginSuccess
}) => {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'not-enrolled' | 'unauthorized' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hardwareName, setHardwareName] = useState('System Biometric Sensor');
  const [verifiedTeacher, setVerifiedTeacher] = useState<{ name: string; id: string; role: 'teacher' | 'hod' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHardwareName(biometricService.getBiometricHardwareName());
      setErrorMessage('');
      setVerifiedTeacher(null);
      
      const allEnrolled = biometricService.getRegisteredCredentials();

      if (allEnrolled.length === 0) {
        setScanState('not-enrolled');
      } else {
        // If an ID was entered in the login input or HOD mode is active, check specific enrollment
        const cleanEntered = enteredUsername.trim().toUpperCase();
        const isHodMode = activeRoleMode === 'hod' || cleanEntered === 'DYP' || cleanEntered === 'HOD';

        if (isHodMode) {
          const hodEnrolled = allEnrolled.find(c => 
            c.role === 'hod' || 
            c.userId.toLowerCase() === (settings.hodUsername || 'dyp').toLowerCase() ||
            c.userId.toLowerCase() === 'dyp' || 
            c.userId.toLowerCase() === 'hod'
          );
          if (!hodEnrolled) {
            setScanState('not-enrolled');
            setErrorMessage('HOD has not enrolled a biometric fingerprint on this system yet.');
            return;
          }
        } else if (cleanEntered) {
          const specificEnrolled = allEnrolled.find(c => 
            c.userId.trim().toUpperCase() === cleanEntered ||
            c.userId.replace(/^TEACH/i, '').trim().toUpperCase() === cleanEntered.replace(/^TEACH/i, '').trim().toUpperCase()
          );
          if (!specificEnrolled) {
            setScanState('not-enrolled');
            setErrorMessage(`Faculty ID "${enteredUsername}" has not enrolled a biometric fingerprint on this system yet.`);
            return;
          }
        }

        setScanState('idle');
        // Auto-initiate hardware sensor scan
        handleHardwareBiometricScan();
      }
    }
  }, [isOpen, enteredUsername, activeRoleMode]);

  if (!isOpen) return null;

  const handleHardwareBiometricScan = async () => {
    setScanState('scanning');
    setErrorMessage('');

    try {
      const cleanEntered = enteredUsername.trim();
      const result = await biometricService.verifyEnrolledHardwareBiometric(cleanEntered || undefined);

      if (!result.enrolled) {
        setScanState('not-enrolled');
        setErrorMessage(result.message);
        return;
      }

      if (result.success && result.credential) {
        const cred = result.credential;

        // Security check: If in HOD mode, ensure scanned finger belongs to HOD
        if (activeRoleMode === 'hod' && cred.role !== 'hod') {
          setScanState('unauthorized');
          setErrorMessage('Access Denied: Scanned fingerprint belongs to a faculty member, not the HOD.');
          return;
        }

        // Security check: If specific Faculty ID entered, ensure scanned finger matches that faculty
        if (activeRoleMode === 'teacher' && cleanEntered && cleanEntered.toUpperCase() !== 'DYP') {
          const credUpper = cred.userId.trim().toUpperCase();
          const cleanEnteredUpper = cleanEntered.toUpperCase();
          const isMatch = (
            credUpper === cleanEnteredUpper ||
            cred.userId.replace(/^TEACH/i, '').trim().toUpperCase() === cleanEntered.replace(/^TEACH/i, '').trim().toUpperCase()
          );
          if (!isMatch) {
            setScanState('unauthorized');
            setErrorMessage(`Access Denied: Fingerprint belongs to ${cred.userName} (${cred.userId}), not "${enteredUsername}".`);
            return;
          }
        }

        setVerifiedTeacher({
          name: cred.userName,
          id: cred.userId,
          role: cred.role
        });
        triggerSuccess(cred);
      } else {
        // STRICT: Unrecognized fingerprint is rejected
        setScanState('unauthorized');
        setErrorMessage(result.message || 'Access Denied: Unrecognized fingerprint. Only enrolled faculty fingerprint is allowed to unlock.');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([100, 50, 100, 50, 100]); } catch {}
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Biometric hardware rejected the scan.';
      setScanState('unauthorized');
      setErrorMessage(`Access Denied: ${msg}. Only enrolled faculty fingerprint is allowed.`);
    }
  };

  const triggerSuccess = (cred: BiometricCredential) => {
    setScanState('success');
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([50, 60, 50]); } catch {}
    }

    setTimeout(() => {
      if (cred.role === 'hod') {
        onLoginSuccess({
          role: 'hod',
          id: 'hod-1',
          name: settings.hodName || 'Prof. Prashant Kathole',
          uniqueCode: settings.hodUsername || 'dyp',
          department: settings.departmentName,
          email: 'hod.ece@dypatil.edu'
        });
      } else {
        // Match teacher in registered roster
        const matchedTeacher = teachers.find(
          t => t.uniqueCode.toUpperCase() === cred.userId.toUpperCase() ||
               t.id.toLowerCase() === cred.userId.toLowerCase() ||
               t.name.toLowerCase() === cred.userName.toLowerCase()
        ) || teachers[0];

        onLoginSuccess({
          role: 'teacher',
          id: matchedTeacher.id,
          name: matchedTeacher.name,
          uniqueCode: matchedTeacher.uniqueCode,
          department: matchedTeacher.department,
          email: matchedTeacher.email,
          assignedSubjects: matchedTeacher.subjects,
          assignedClasses: matchedTeacher.assignedClasses
        });
      }
    }, 900);
  };

  const enrolledCount = biometricService.getRegisteredCredentials().length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl border border-sky-100 text-slate-800 text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header Icon */}
        <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
          scanState === 'unauthorized'
            ? 'bg-rose-50 border border-rose-100 text-rose-600'
            : scanState === 'not-enrolled'
            ? 'bg-amber-50 border border-amber-100 text-amber-600'
            : 'bg-sky-50 border border-sky-100 text-sky-600'
        }`}>
          {scanState === 'unauthorized' ? (
            <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
          ) : scanState === 'not-enrolled' ? (
            <Lock className="w-6 h-6 stroke-[2.2]" />
          ) : (
            <Fingerprint className="w-6 h-6 stroke-[2.2]" />
          )}
        </div>

        <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
          Hardware Biometric Unlock
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[260px] mx-auto">
          {scanState === 'not-enrolled'
            ? 'No fingerprint registered on this device'
            : scanState === 'unauthorized'
            ? 'Strict Hardware Security Active'
            : `Hardware verification via ${hardwareName}`}
        </p>

        {/* State 1: NOT ENROLLED */}
        {scanState === 'not-enrolled' ? (
          <div className="my-5 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-left space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Enrollment Required</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              {errorMessage || 'Each teacher has an enrollment option inside their own portal tab.'}
            </p>
            <p className="text-[11px] text-slate-600 pt-1">
              <strong>How to enroll:</strong>
              <br />
              1. Sign in using your Faculty ID and password.
              <br />
              2. Click <span className="font-bold text-slate-800">"Biometric ID"</span> in your tab.
              <br />
              3. Scan your finger once to enroll on this system.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
            >
              Sign In with Password First
            </button>
          </div>
        ) : (
          /* State 2 & 3: SCANNING / UNAUTHORIZED / SUCCESS */
          <div className="my-4 flex flex-col items-center justify-center">
            
            {/* Sensor Scanner Circle - Simple, clean native design */}
            <button
              type="button"
              onClick={handleHardwareBiometricScan}
              disabled={scanState === 'scanning' || scanState === 'success'}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                scanState === 'scanning'
                  ? 'bg-sky-50 ring-4 ring-sky-100'
                  : scanState === 'success'
                  ? 'bg-emerald-50 ring-4 ring-emerald-100'
                  : scanState === 'unauthorized'
                  ? 'bg-rose-50 ring-4 ring-rose-100'
                  : 'bg-slate-100 hover:bg-sky-50 hover:ring-2 hover:ring-sky-100 active:scale-95'
              }`}
            >
              {scanState === 'success' ? (
                <CheckCircle2 className="w-12 h-12 text-emerald-600 animate-in zoom-in-75 duration-200" />
              ) : scanState === 'unauthorized' ? (
                <ShieldAlert className="w-12 h-12 text-rose-600 animate-in zoom-in-75 duration-200" />
              ) : (
                <Fingerprint className={`w-12 h-12 transition-colors duration-200 ${
                  scanState === 'scanning' ? 'text-sky-600 animate-pulse' : 'text-slate-600'
                }`} />
              )}
            </button>

            {/* Status Label & Alerts */}
            <div className="mt-3.5 min-h-[44px] flex flex-col items-center justify-center">
              {scanState === 'scanning' && (
                <span className="text-sky-600 text-xs font-bold inline-flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                  Touch hardware sensor with enrolled finger...
                </span>
              )}
              {scanState === 'success' && verifiedTeacher && (
                <div className="text-emerald-700 text-xs font-bold flex flex-col items-center">
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Enrolled Fingerprint Verified!
                  </span>
                  <span className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                    Unlocking portal for {verifiedTeacher.name}...
                  </span>
                </div>
              )}
              {scanState === 'unauthorized' && (
                <div className="text-rose-600 text-xs font-bold max-w-[280px] text-center leading-snug">
                  <p>{errorMessage || 'Access Denied: Unrecognized fingerprint.'}</p>
                  <p className="text-[11px] text-slate-500 font-normal mt-1">
                    No other fingerprint is allowed. Only enrolled faculty members can enter.
                  </p>
                </div>
              )}
              {scanState === 'idle' && (
                <span className="text-slate-500 text-xs">
                  Tap sensor button to verify hardware fingerprint
                </span>
              )}
            </div>

            {/* Retry Button on Access Denied */}
            {scanState === 'unauthorized' && (
              <button
                type="button"
                onClick={handleHardwareBiometricScan}
                className="mt-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-all active:scale-95"
              >
                Scan Enrolled Finger Again
              </button>
            )}

          </div>
        )}

        {/* Security Notice */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            <span>Hardware Enclave</span>
          </div>
          <span className="font-semibold text-slate-600">
            {enrolledCount} Faculty Fingerprint{enrolledCount !== 1 ? 's' : ''} Enrolled
          </span>
        </div>

      </div>
    </div>
  );
};
