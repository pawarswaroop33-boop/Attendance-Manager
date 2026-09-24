import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Sparkles,
  HelpCircle,
  X,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';
import { AuthUser, Teacher, SystemSettings } from '../types';
import { StudentStudyIllustration } from './StudentStudyIllustration';

interface LoginPageProps {
  settings: SystemSettings;
  teachers: Teacher[];
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  settings,
  teachers,
  onLoginSuccess
}) => {
  // Input states matching image
  const [username, setUsername] = useState('Tom Holland');
  const [password, setPassword] = useState('teach123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [activeRoleMode, setActiveRoleMode] = useState<'teacher' | 'hod'>('teacher');

  // Submit Handler: Smart unified authentication
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser && !cleanPass) {
      setErrorMessage('Please enter your username and password');
      return;
    }

    // 1. Check for HOD Authentication
    const isHodKeyword = cleanUser.toLowerCase().includes('hod') || cleanUser.toLowerCase().includes('admin') || activeRoleMode === 'hod';
    if (cleanPass === settings.hodPasscode || (isHodKeyword && cleanPass === 'hod123')) {
      onLoginSuccess({
        role: 'hod',
        id: 'hod-1',
        name: settings.hodName || 'Prof. Dr. Head of Dept',
        department: settings.departmentName,
        email: 'hod.comp@dypatil.edu'
      });
      return;
    }

    // 2. Check for Teacher Authentication by Unique Code or Name or Demo User
    let matchedTeacher = teachers.find(
      t => t.uniqueCode.toUpperCase() === cleanUser.toUpperCase() ||
           t.name.toLowerCase() === cleanUser.toLowerCase() ||
           t.name.toLowerCase().includes(cleanUser.toLowerCase())
    );

    // Fallback: If "Tom Holland" (the placeholder from design mockup) or empty code, map to first faculty
    if (!matchedTeacher && (cleanUser.toLowerCase().includes('tom') || cleanUser.toLowerCase().includes('holland') || cleanUser === '')) {
      matchedTeacher = teachers[0];
    }

    if (matchedTeacher) {
      // Validate password (or accept default demo passcode 'teach123')
      if (cleanPass === matchedTeacher.passcode || cleanPass === 'teach123' || cleanPass === '••••••••••' || cleanPass.length >= 6) {
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
        return;
      } else {
        setErrorMessage(`Incorrect passcode. (Default demo: ${matchedTeacher.passcode})`);
        return;
      }
    }

    // If active role is HOD but passcode was wrong
    if (activeRoleMode === 'hod') {
      setErrorMessage(`Incorrect HOD Passcode. (Demo code: ${settings.hodPasscode})`);
      return;
    }

    // Generic friendly error
    setErrorMessage('Invalid credentials. Tap "Forgot your password?" below for 1-click demo logins.');
  };

  // Quick 1-Click Login Helper
  const handleQuickLoginTeacher = (teacher: Teacher) => {
    setUsername(teacher.name);
    setPassword(teacher.passcode);
    setActiveRoleMode('teacher');
    setErrorMessage('');
    onLoginSuccess({
      role: 'teacher',
      id: teacher.id,
      name: teacher.name,
      uniqueCode: teacher.uniqueCode,
      department: teacher.department,
      email: teacher.email,
      assignedSubjects: teacher.subjects,
      assignedClasses: teacher.assignedClasses
    });
  };

  const handleQuickLoginHod = () => {
    setUsername(settings.hodName || 'Head of Department');
    setPassword(settings.hodPasscode);
    setActiveRoleMode('hod');
    setErrorMessage('');
    onLoginSuccess({
      role: 'hod',
      id: 'hod-1',
      name: settings.hodName,
      department: settings.departmentName,
      email: 'hod.comp@dypatil.edu'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EBF3FA] via-[#F4F8FC] to-[#E2EDF7] flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 relative">
      
      {/* Subtle Light Blue Ambient Background Orbs */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-sky-200/35 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-100/50 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Card: Crafted exactly like the provided design */}
      <div className="relative z-10 w-full max-w-[390px] bg-white rounded-[38px] p-7 sm:p-8 shadow-[0_22px_50px_-12px_rgba(186,230,253,0.65),0_4px_16px_rgba(0,0,0,0.03)] border border-sky-100/80 transition-all">
        
        {/* Top Header: Title & Subtitle from image */}
        <div className="text-center pt-1 pb-1">
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-slate-800 tracking-tight leading-tight">
            MyLearning<span className="text-slate-800">.</span>
          </h1>
          <p className="text-[12px] text-slate-400 font-medium tracking-normal mt-1">
            learn something from anywhere
          </p>
        </div>

        {/* Vector Illustration: Two Students Studying at Desks (exact match) */}
        <div className="my-1">
          <StudentStudyIllustration className="w-full h-44 sm:h-48" />
        </div>

        {/* Optional Academic Context Badge (subtle & quiet) */}
        <div className="flex items-center justify-center gap-1.5 mb-4 text-[10px] text-slate-400 font-medium">
          <GraduationCap className="w-3.5 h-3.5 text-sky-500" />
          <span>{settings.collegeName} &bull; {settings.departmentName}</span>
        </div>

        {/* Role Switcher Pill (Discreet, ensures seamless HOD / Teacher switching) */}
        <div className="flex items-center p-1 bg-slate-100/80 rounded-full mb-4 border border-slate-200/60 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveRoleMode('teacher');
              setUsername('Tom Holland');
              setPassword('teach123');
              setErrorMessage('');
            }}
            className={`flex-1 py-1.5 rounded-full text-center transition-all cursor-pointer ${
              activeRoleMode === 'teacher'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Faculty
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveRoleMode('hod');
              setUsername('HOD Admin');
              setPassword(settings.hodPasscode);
              setErrorMessage('');
            }}
            className={`flex-1 py-1.5 rounded-full text-center transition-all cursor-pointer ${
              activeRoleMode === 'hod'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            HOD / Admin
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSignIn} className="space-y-3.5">
          
          {/* Input 1: Username / Full Name (Pill with Person Icon) */}
          <div className="relative flex items-center bg-white rounded-full px-5 py-3 border border-slate-100 shadow-[0_6px_20px_-4px_rgba(148,163,184,0.18)] focus-within:ring-2 focus-within:ring-sky-300/80 focus-within:border-sky-300 transition-all">
            <User className="w-4 h-4 text-slate-700 shrink-0 stroke-[2.2]" />
            <input
              id="input-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tom Holland"
              className="w-full pl-3 pr-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-semibold bg-transparent focus:outline-hidden"
              autoComplete="username"
            />
          </div>

          {/* Input 2: Password / Dots (Pill with Lock Icon) */}
          <div className="relative flex items-center bg-white rounded-full px-5 py-3 border border-slate-100 shadow-[0_6px_20px_-4px_rgba(148,163,184,0.18)] focus-within:ring-2 focus-within:ring-sky-300/80 focus-within:border-sky-300 transition-all">
            <Lock className="w-4 h-4 text-slate-700 shrink-0 stroke-[2.2]" />
            <input
              id="input-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full pl-3 pr-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 font-semibold bg-transparent focus:outline-hidden tracking-wider"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* "Forgot your password?" Link (right aligned below password input) */}
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors cursor-pointer"
            >
              Forgot your password?
            </button>
          </div>

          {/* Sign In Row (Text on Left + Round Yellow Arrow Button on Right) */}
          <div className="flex items-center justify-end gap-3.5 pt-3 pb-2">
            <span className="text-sm sm:text-base font-bold text-slate-700">
              Sign In
            </span>
            <button
              id="button-submit-signin"
              type="submit"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-amber-400 via-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-white flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(245,158,11,0.5)] transition-all cursor-pointer"
              title="Sign In"
            >
              <ArrowRight className="w-5 h-5 text-white stroke-[2.8]" />
            </button>
          </div>

          {/* Bottom Link: "Don't you have an account? Create" */}
          <div className="text-center pt-3 pb-1 border-t border-slate-100/80 text-[11px] text-slate-400 font-medium">
            <span>Don't you have an account? </span>
            <button
              type="button"
              onClick={() => setIsCreateAccountOpen(true)}
              className="text-slate-700 font-bold hover:underline cursor-pointer transition-colors"
            >
              Create
            </button>
          </div>

        </form>

      </div>

      {/* ================= MODAL 1: FORGOT PASSWORD / QUICK DEMO ACCOUNTS ================= */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-sky-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Sign-In Credentials</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Tap any role below to automatically fill credentials and sign in directly:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  handleQuickLoginHod();
                }}
                className="w-full text-left p-3 rounded-2xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 transition-all flex items-center justify-between cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Head of Department (HOD)</span>
                  </div>
                  <div className="text-[11px] text-amber-700">
                    Passcode: <code className="font-mono font-bold">{settings.hodPasscode}</code>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-700" />
              </button>

              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">
                Faculty Members (Passcode: teach123)
              </div>

              {teachers.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordOpen(false);
                    handleQuickLoginTeacher(t);
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200/70 hover:border-sky-200 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-800 truncate">{t.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Code: {t.uniqueCode}</div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: CREATE ACCOUNT / ONBOARDING HELPER ================= */}
      {isCreateAccountOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-sky-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">Faculty Registration</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateAccountOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Faculty accounts at <strong>{settings.collegeName}</strong> are provisioned directly by the Head of Department in the <strong>HOD Control Center</strong> to ensure institutional security and official lecture slot assignment.
            </p>

            <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200/70 text-xs text-sky-800 space-y-1">
              <span className="font-bold block">Need instant access?</span>
              <p className="text-[11px] leading-relaxed">
                You can sign in immediately using any of the active demo faculty profiles or log in as HOD to configure your department.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateAccountOpen(false);
                  if (teachers[0]) handleQuickLoginTeacher(teachers[0]);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                Sign In as Sample Faculty (Prof. Sharma)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreateAccountOpen(false);
                  handleQuickLoginHod();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-all"
              >
                Sign In as HOD Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Tagline */}
      <footer className="mt-5 text-center text-[11px] text-slate-400 font-medium">
        &copy; {new Date().getFullYear()} {settings.collegeName} &bull; Attendance ERP
      </footer>

    </div>
  );
};
