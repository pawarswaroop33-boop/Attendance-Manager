import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ShieldAlert, 
  Cpu, 
  Lock, 
  UserCheck, 
  ShieldCheck,
  KeyRound,
  GraduationCap,
  Shield
} from 'lucide-react';
import { webauthnService, RegisteredCredentialInfo } from '../services/webauthnService';
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
  const [hardwareName, setHardwareName] = useState('Hardware Platform Authenticator');
  const [enrolledCredentials, setEnrolledCredentials] = useState<RegisteredCredentialInfo[]>([]);
  const [verifiedUser, setVerifiedUser] = useState<AuthUser | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const roleTitle = activeRoleMode === 'hod' ? 'HOD / Department Head' : 'Faculty Member';

  // Load enrolled credentials for this role from the server
  useEffect(() => {
    if (isOpen) {
      setHardwareName(webauthnService.getHardwareName());
      setErrorMessage('');
      setVerifiedUser(null);
      setScanState('idle');
      setIsLoadingList(true);

      const fetchCreds = async () => {
        try {
          const list = await webauthnService.getCredentials(
            enteredUsername ? enteredUsername.trim() : undefined,
            activeRoleMode
          );
          setEnrolledCredentials(list);

          if (list.length === 0) {
            setScanState('not-enrolled');
            setErrorMessage(
              activeRoleMode === 'hod'
                ? 'The HOD account does not have a biometric credential enrolled yet. Please log in with password to enroll.'
                : enteredUsername
                ? `Faculty ID "${enteredUsername}" has not enrolled a biometric credential yet.`
                : 'No Faculty biometric credentials have been enrolled yet. Please log in with your Faculty ID and password to enroll.'
            );
          } else {
            setScanState('idle');
            // Automatically prompt the device biometric sensor
            handleBiometricUnlock();
          }
        } catch {
          setScanState('error');
          setErrorMessage('Failed to connect to authentication service.');
        } finally {
          setIsLoadingList(false);
        }
      };

      fetchCreds();
    }
  }, [isOpen, enteredUsername, activeRoleMode]);

  if (!isOpen) return null;

  const handleBiometricUnlock = async () => {
    setScanState('scanning');
    setErrorMessage('');

    try {
      const cleanUser = enteredUsername.trim();
      const result = await webauthnService.authenticateBiometric(
        activeRoleMode,
        cleanUser || undefined
      );

      if (result.success && result.user) {
        // STRICT ROLE ISOLATION: Confirm the role returned by the server matches active role
        if (result.user.role !== activeRoleMode) {
          setScanState('unauthorized');
          setErrorMessage(`Access Denied: Biometric credential belongs to ${result.user.role.toUpperCase()}, not ${activeRoleMode.toUpperCase()}. Cross-role authentication is strictly prohibited.`);
          return;
        }

        // Complete faculty roster matching if teacher
        let fullUser: AuthUser = result.user;
        if (result.user.role === 'teacher') {
          const matched = teachers.find(
            t => t.uniqueCode.toUpperCase() === result.user!.uniqueCode?.toUpperCase() ||
                 t.id.toLowerCase() === result.user!.id.toLowerCase()
          );
          if (matched) {
            fullUser = {
              ...result.user,
              name: matched.name,
              department: matched.department,
              assignedSubjects: matched.subjects,
              assignedClasses: matched.assignedClasses
            };
          }
        }

        setVerifiedUser(fullUser);
        setScanState('success');

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([50, 60, 50]); } catch {}
        }

        // Redirect to appropriate dashboard after short tactile confirmation
        setTimeout(() => {
          onLoginSuccess(fullUser);
          onClose();
        }, 900);
      } else {
        setScanState('unauthorized');
        setErrorMessage(result.message || 'Access Denied: Biometric authentication failed.');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([100, 50, 100]); } catch {}
        }
      }
    } catch (e: any) {
      setScanState('unauthorized');
      setErrorMessage(e.message || 'Biometric hardware sensor rejected the scan.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
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
          WebAuthn Biometric Unlock
        </h3>

        {/* Role Targeting Badge */}
        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
            activeRoleMode === 'hod'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}>
            {activeRoleMode === 'hod' ? <Shield className="w-3 h-3 text-amber-600" /> : <GraduationCap className="w-3 h-3 text-sky-600" />}
            Authenticating as: <strong>{roleTitle}</strong>
          </span>
        </div>

        <p className="text-xs text-slate-500 mt-2 max-w-[270px] mx-auto leading-relaxed">
          {scanState === 'not-enrolled'
            ? 'No biometric passkey enrolled for this role'
            : scanState === 'unauthorized'
            ? 'Strict Hardware Verification & Role Protection Active'
            : `Hardware verification via ${hardwareName}`}
        </p>

        {/* State 1: NOT ENROLLED */}
        {scanState === 'not-enrolled' ? (
          <div className="my-5 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-left space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Enrollment Required for {activeRoleMode === 'hod' ? 'HOD' : 'Faculty'}</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {errorMessage}
            </p>
            <div className="text-[11px] text-slate-600 pt-1 border-t border-amber-200/60 mt-2">
              <strong>How to enroll your biometric passkey:</strong>
              <br />
              1. Sign in using your {activeRoleMode === 'hod' ? 'HOD' : 'Faculty'} password.
              <br />
              2. Click <span className="font-bold text-slate-900">"Biometric ID"</span> in the portal.
              <br />
              3. Scan your fingerprint to create a secure device passkey.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
            >
              Sign In with Password First
            </button>
          </div>
        ) : (
          /* State 2: SCANNING / UNAUTHORIZED / SUCCESS */
          <div className="my-4 flex flex-col items-center justify-center">
            
            {/* Registered Credential Pill */}
            {enrolledCredentials.length > 0 && (
              <div className="mb-3 py-1 px-3 bg-slate-100 rounded-full border border-slate-200 text-[11px] text-slate-700 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Enrolled: <strong>{enrolledCredentials[0].userName}</strong> ({enrolledCredentials[0].fingerLabel || 'Passkey'})</span>
              </div>
            )}

            {/* Sensor Scanner Circle */}
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={scanState === 'scanning' || scanState === 'success'}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                scanState === 'scanning'
                  ? 'bg-sky-50 ring-4 ring-sky-200 scale-105'
                  : scanState === 'success'
                  ? 'bg-emerald-50 ring-4 ring-emerald-200'
                  : scanState === 'unauthorized'
                  ? 'bg-rose-50 ring-4 ring-rose-200'
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

            {/* Status Feedback */}
            <div className="mt-3.5 min-h-[44px] flex flex-col items-center justify-center text-center">
              {scanState === 'scanning' && (
                <span className="text-sky-600 text-xs font-bold inline-flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                  Prompting hardware biometric sensor...
                </span>
              )}
              {scanState === 'success' && verifiedUser && (
                <div className="text-emerald-700 text-xs font-bold flex flex-col items-center">
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Biometric Identity Verified!
                  </span>
                  <span className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                    Unlocking {verifiedUser.role === 'hod' ? 'HOD Control Center' : 'Faculty Portal'} for {verifiedUser.name}...
                  </span>
                </div>
              )}
              {scanState === 'unauthorized' && (
                <div className="text-rose-600 text-xs font-bold max-w-[280px] text-center leading-snug">
                  <p>{errorMessage || 'Access Denied: Biometric verification rejected.'}</p>
                </div>
              )}
              {scanState === 'idle' && (
                <span className="text-slate-500 text-xs font-medium">
                  Tap sensor circle to initiate biometric unlock
                </span>
              )}
            </div>

            {/* Retry Button */}
            {scanState === 'unauthorized' && (
              <button
                type="button"
                onClick={handleBiometricUnlock}
                className="mt-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-2xs"
              >
                Scan Biometric Again
              </button>
            )}

          </div>
        )}

        {/* Security Notice Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            <span>FIDO2 / WebAuthn</span>
          </div>
          <span className="font-bold text-emerald-700 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Server Cryptographic Verified
          </span>
        </div>

      </div>
    </div>
  );
};
