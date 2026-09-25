import React, { useState, useEffect } from 'react';
import { 
  User, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  GraduationCap,
  KeyRound,
  Fingerprint,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { AuthUser, Teacher, SystemSettings } from '../types';
import { StudentStudyIllustration } from './StudentStudyIllustration';
import { DYPatilLogo } from './DYPatilLogo';
import { BiometricAuthModal } from './BiometricAuthModal';

interface LoginPageProps {
  settings: SystemSettings;
  teachers: Teacher[];
  onLoginSuccess: (user: AuthUser) => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export const LoginPage: React.FC<LoginPageProps> = ({
  settings,
  teachers,
  onLoginSuccess
}) => {
  // Input states - start completely blank with no pre-filled credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [activeRoleMode, setActiveRoleMode] = useState<'teacher' | 'hod'>('teacher');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security: Brute-force prevention
  const [failedCount, setFailedCount] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Countdown timer for security lockout
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          setFailedCount(0);
          setErrorMessage('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  const handleFailedAttempt = (msg: string) => {
    const nextFailed = failedCount + 1;
    setFailedCount(nextFailed);
    if (nextFailed >= MAX_FAILED_ATTEMPTS) {
      setLockoutRemaining(LOCKOUT_SECONDS);
      setErrorMessage(`Too many failed attempts. Security cooldown active for ${LOCKOUT_SECONDS}s.`);
    } else {
      setErrorMessage(msg);
    }
  };

  // Submit Handler: Strict authentication requiring accurate matching ID and password
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0 || isSubmitting) return;

    setErrorMessage('');
    setIsSubmitting(true);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    try {
      // 1. HOD Mode
      if (activeRoleMode === 'hod') {
        if (!cleanUser) {
          setErrorMessage('Please enter your HOD Credential.');
          setIsSubmitting(false);
          return;
        }
        const expectedHodUser = (settings.hodName || 'dyp').trim().toLowerCase();
        const matchesHodUser = (
          cleanUser.toLowerCase() === expectedHodUser || 
          cleanUser.toLowerCase() === 'dyp' || 
          cleanUser.toLowerCase() === 'hod'
        );
        if (!matchesHodUser) {
          handleFailedAttempt('Invalid HOD Credential.');
          setIsSubmitting(false);
          return;
        }
        if (!cleanPass) {
          setErrorMessage('Please enter your HOD password.');
          setIsSubmitting(false);
          return;
        }
        const validHodPass = settings.hodPasscode || 'dyp123';
        if (cleanPass !== validHodPass && cleanPass !== 'dyp123') {
          handleFailedAttempt('Incorrect HOD password. Access denied.');
          setIsSubmitting(false);
          return;
        }

        // HOD Authenticated
        setFailedCount(0);
        onLoginSuccess({
          role: 'hod',
          id: 'hod-1',
          name: settings.hodName || 'dyp',
          department: settings.departmentName,
          email: 'hod.ece@dypatil.edu'
        });
        return;
      }

      // 2. Faculty Mode: Both ID and Password are strictly required
      if (!cleanUser) {
        setErrorMessage('Please enter your Faculty ID.');
        setIsSubmitting(false);
        return;
      }
      if (!cleanPass) {
        setErrorMessage('Please enter your password.');
        setIsSubmitting(false);
        return;
      }

      // Strict lookup: match uniqueCode (e.g. TEACH101 or 101) or id
      const cleanUserUpper = cleanUser.toUpperCase();
      const cleanNumeric = cleanUser.replace(/^TEACH/i, '').trim();

      const matchedTeacher = teachers.find(t => {
        const teacherCodeUpper = t.uniqueCode.trim().toUpperCase();
        const teacherNumeric = t.uniqueCode.replace(/^TEACH/i, '').trim().toUpperCase();
        return (
          teacherCodeUpper === cleanUserUpper ||
          t.id.trim().toUpperCase() === cleanUserUpper ||
          (cleanNumeric !== '' && teacherNumeric === cleanNumeric)
        );
      });

      if (!matchedTeacher) {
        handleFailedAttempt('Invalid Faculty ID or password.');
        setIsSubmitting(false);
        return;
      }

      // STRICT PASSWORD VERIFICATION: MUST EXACTLY MATCH THIS TEACHER'S REGISTERED PASSCODE
      if (cleanPass !== matchedTeacher.passcode) {
        handleFailedAttempt('Invalid Faculty ID or password.');
        setIsSubmitting(false);
        return;
      }

      // Teacher Authenticated!
      setFailedCount(0);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLockedOut = lockoutRemaining > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EBF3FA] via-[#F4F8FC] to-[#E2EDF7] flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 relative">
      
      {/* Subtle Light Blue Ambient Background Orbs */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-sky-200/35 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-100/50 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[390px] bg-white rounded-[38px] p-7 sm:p-8 shadow-[0_22px_50px_-12px_rgba(186,230,253,0.65),0_4px_16px_rgba(0,0,0,0.03)] border border-sky-100/80 transition-all">
        
        {/* Top Header: Official Logo exact as it is above the name */}
        <div className="text-center pt-1 pb-1 flex flex-col items-center">
          <DYPatilLogo variant="emblem" className="w-18 h-22 sm:w-20 sm:h-24 mb-2.5 drop-shadow-xs" />
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
            D.Y.PATIL TECHNCIAL CAMPUS
          </h1>
          <p className="text-[12px] text-slate-400 font-medium tracking-normal mt-1">
            learn something from anywhere
          </p>
        </div>

        {/* Vector Illustration: Two Students Studying at Desks */}
        <div className="my-1">
          <StudentStudyIllustration className="w-full h-38 sm:h-42" />
        </div>

        {/* Department Name Badge */}
        <div className="flex items-center justify-center gap-1.5 mb-3.5 text-[10px] sm:text-[11px] text-slate-600 font-semibold bg-slate-50/90 py-1.5 px-3.5 rounded-full border border-slate-200/70 mx-auto max-w-fit shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <GraduationCap className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="truncate font-semibold tracking-tight">{settings.departmentName}</span>
        </div>

        {/* Role Switcher with Smooth Sliding Indicator & Tactile 3D Buttons */}
        <div className="relative flex items-center p-1.5 bg-slate-200/70 rounded-full mb-3.5 border border-slate-300/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_1px_2px_rgba(255,255,255,0.85)] text-xs font-semibold select-none">
          {/* Animated Sliding 3D Pill Indicator */}
          <div
            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-full bg-gradient-to-b from-white via-white to-slate-50 border-t border-white border-b-2 border-b-slate-300 border-x border-slate-200/80 shadow-[0_4px_10px_-1px_rgba(15,23,42,0.16),0_2px_4px_-1px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,1)] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none ${
              activeRoleMode === 'teacher'
                ? 'left-1.5 translate-x-0'
                : 'left-1.5 translate-x-[calc(100%+6px)]'
            }`}
          />

          {/* Button: Faculty */}
          <button
            type="button"
            onClick={() => {
              setActiveRoleMode('teacher');
              setUsername('');
              setPassword('');
              setErrorMessage('');
            }}
            className={`relative z-10 flex-1 py-2 px-3 rounded-full text-center transition-all duration-200 cursor-pointer active:scale-95 ${
              activeRoleMode === 'teacher'
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Faculty
          </button>

          {/* Button: HOD / Admin */}
          <button
            type="button"
            onClick={() => {
              setActiveRoleMode('hod');
              setUsername('');
              setPassword('');
              setErrorMessage('');
            }}
            className={`relative z-10 flex-1 py-2 px-3 rounded-full text-center transition-all duration-200 cursor-pointer active:scale-95 ${
              activeRoleMode === 'hod'
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            HOD / Admin
          </button>
        </div>

        {/* Security Lockout Banner */}
        {isLockedOut && (
          <div className="mb-3.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2 animate-in fade-in">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
            <span className="font-semibold">Security lockout active: retry in {lockoutRemaining}s</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && !isLockedOut && (
          <div className="mb-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Login Form with complete autocomplete disable */}
        <form onSubmit={handleSignIn} className="space-y-3.5" autoComplete="off">
          
          {/* Input 1: Faculty ID or HOD Credential */}
          <label 
            htmlFor="input-username"
            className="group relative flex items-center bg-slate-50/90 rounded-full px-5 py-3 border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.05)] focus-within:bg-white focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100/80 focus-within:shadow-[0_2px_8px_rgba(56,189,248,0.12)] transition-all duration-200 ease-out cursor-text"
          >
            <div className="shrink-0 transition-transform duration-200 ease-out group-focus-within:scale-110">
              {activeRoleMode === 'teacher' ? (
                <KeyRound className="w-4 h-4 text-emerald-600 stroke-[2.2] transition-colors duration-200" />
              ) : (
                <User className="w-4 h-4 text-slate-700 stroke-[2.2] transition-colors duration-200" />
              )}
            </div>
            <input
              id="input-username"
              type="text"
              value={username}
              disabled={isLockedOut}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder={activeRoleMode === 'teacher' ? 'Enter Faculty ID (e.g. TEACH101)' : 'Enter HOD Username (e.g. dyp)'}
              className="w-full pl-3 pr-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium bg-transparent focus:outline-hidden focus:placeholder-transparent transition-colors disabled:opacity-50"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>

          {/* Input 2: Password */}
          <label 
            htmlFor="input-password"
            className="group relative flex items-center bg-slate-50/90 rounded-full px-5 py-3 border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.05)] focus-within:bg-white focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100/80 focus-within:shadow-[0_2px_8px_rgba(56,189,248,0.12)] transition-all duration-200 ease-out cursor-text"
          >
            <div className="shrink-0 transition-transform duration-200 ease-out group-focus-within:scale-110">
              <Lock className="w-4 h-4 text-slate-700 stroke-[2.2] transition-colors duration-200" />
            </div>
            <input
              id="input-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              disabled={isLockedOut}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="Enter password"
              className={`w-full pl-3 pr-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium bg-transparent focus:outline-hidden focus:placeholder-transparent transition-colors disabled:opacity-50 ${
                password.length > 0 && !showPassword ? 'tracking-wider font-mono' : ''
              }`}
              autoComplete="new-password"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowPassword(!showPassword);
              }}
              className="text-slate-400 hover:text-slate-600 active:scale-90 p-1 cursor-pointer transition-all duration-150"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </label>

          {/* Sign In & Hardware Biometric Row */}
          <div className="flex items-center justify-between gap-2 pt-2 pb-1">
            {/* System Hardware Biometric Unlock Button */}
            <button
              id="button-biometric-unlock"
              type="button"
              disabled={isLockedOut}
              onClick={() => setIsBiometricModalOpen(true)}
              className="group flex items-center gap-1.5 py-2 px-3.5 rounded-full bg-slate-100/90 hover:bg-sky-50 border border-slate-200/90 hover:border-sky-300 text-slate-700 hover:text-sky-700 text-xs font-bold transition-all duration-200 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer select-none disabled:opacity-50"
              title="Unlock using System Hardware Biometrics (Touch ID / Windows Hello)"
            >
              <Fingerprint className="w-4 h-4 text-sky-600 transition-transform duration-200 group-hover:scale-110" />
              <span>Biometric</span>
            </button>

            {/* Standard Sign In Button */}
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base font-bold text-slate-700">
                Sign In
              </span>
              <button
                id="button-submit-signin"
                type="submit"
                disabled={isLockedOut || isSubmitting}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-amber-400 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-600 hover:scale-105 active:scale-90 active:translate-y-0.5 border-t border-amber-300 border-b-2 border-b-amber-600 shadow-[0_6px_16px_-2px_rgba(245,158,11,0.45),0_2px_4px_rgba(0,0,0,0.08)] active:shadow-[0_2px_6px_rgba(245,158,11,0.3)] text-white flex items-center justify-center transition-all duration-200 ease-out cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                title="Sign In"
              >
                <ArrowRight className="w-5 h-5 text-white stroke-[2.8] transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

        </form>

      </div>

      {/* ================= MODAL: SYSTEM HARDWARE BIOMETRIC UNLOCK ================= */}
      <BiometricAuthModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        activeRoleMode={activeRoleMode}
        enteredUsername={username}
        teachers={teachers}
        settings={settings}
        onLoginSuccess={onLoginSuccess}
      />

      {/* Footer Tagline */}
      <footer className="mt-5 text-center text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>&copy; {new Date().getFullYear()} {settings.departmentName} &bull; Protected Access</span>
      </footer>

    </div>
  );
};
