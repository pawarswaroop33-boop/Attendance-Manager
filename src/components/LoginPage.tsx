import React, { useState } from 'react';
import { 
  GraduationCap, 
  ShieldCheck, 
  UserCheck, 
  KeyRound, 
  Hash, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AuthUser, Teacher, SystemSettings } from '../types';

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
  const [activePortal, setActivePortal] = useState<'hod' | 'teacher'>('hod');

  // HOD Form State
  const [hodPasscode, setHodPasscode] = useState('');
  const [hodError, setHodError] = useState('');

  // Teacher Form State
  const [teacherCode, setTeacherCode] = useState('');
  const [teacherPasscode, setTeacherPasscode] = useState('');
  const [teacherError, setTeacherError] = useState('');

  // Handle HOD Login
  const handleHodLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setHodError('');

    if (!hodPasscode.trim()) {
      setHodError('Please enter the HOD security passcode');
      return;
    }

    if (hodPasscode.trim() === settings.hodPasscode) {
      onLoginSuccess({
        role: 'hod',
        id: 'hod-1',
        name: settings.hodName,
        department: settings.departmentName,
        email: 'hod.comp@dypatil.edu'
      });
    } else {
      setHodError(`Incorrect HOD Passcode. (Default demo passcode: ${settings.hodPasscode})`);
    }
  };

  // Handle Teacher Login
  const handleTeacherLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError('');

    if (!teacherCode.trim() || !teacherPasscode.trim()) {
      setTeacherError('Please enter both your unique Teacher Code and Passcode');
      return;
    }

    const matchedTeacher = teachers.find(
      t => t.uniqueCode.toUpperCase() === teacherCode.trim().toUpperCase()
    );

    if (!matchedTeacher) {
      setTeacherError(`Invalid Teacher Code. Please contact HOD to get your unique code.`);
      return;
    }

    if (matchedTeacher.passcode !== teacherPasscode.trim()) {
      setTeacherError(`Incorrect Passcode for teacher code ${teacherCode}.`);
      return;
    }

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
  };

  // Clear Form Handlers
  const handleClearHodForm = () => {
    setHodPasscode('');
    setHodError('');
  };

  const handleClearTeacherForm = () => {
    setTeacherCode('');
    setTeacherPasscode('');
    setTeacherError('');
  };

  // Quick Demo Auto-fill
  const fillDemoHod = () => {
    setHodPasscode(settings.hodPasscode);
    setHodError('');
  };

  const fillDemoTeacher = (t: Teacher) => {
    setTeacherCode(t.uniqueCode);
    setTeacherPasscode(t.passcode);
    setTeacherError('');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-sky-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Banner / Emblems */}
      <header className="relative z-10 max-w-5xl mx-auto w-full text-center pt-2 pb-4">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-slate-300 shadow-xs mb-3">
          <Building2 className="w-3.5 h-3.5 text-sky-400" />
          <span>Accredited Academic Attendance & ERP Cloud System</span>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="relative z-10 max-w-xl mx-auto w-full my-auto">
        
        {/* COLLEGE NAME IN THE EXACT CENTER */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20 text-white mb-2">
            <GraduationCap className="w-9 h-9 stroke-[2.2]" />
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white uppercase drop-shadow-xs">
            {settings.collegeName}
          </h1>

          <p className="text-xs sm:text-sm font-semibold text-slate-400 tracking-wide">
            {settings.departmentName} &bull; Smart Faculty Attendance Portal
          </p>
        </div>

        {/* Portal Selection Tabs (HOD vs Teacher) */}
        <div className="bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700 flex gap-1.5 mb-5 shadow-inner">
          <button
            id="tab-hod-login"
            type="button"
            onClick={() => setActivePortal('hod')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activePortal === 'hod'
                ? 'bg-slate-900 text-white border border-slate-600 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>HOD Portal</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Admin
            </span>
          </button>

          <button
            id="tab-teacher-login"
            type="button"
            onClick={() => setActivePortal('teacher')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activePortal === 'teacher'
                ? 'bg-slate-900 text-white border border-slate-600 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Teacher Portal</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Faculty
            </span>
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/90 p-5 sm:p-7 shadow-xl">
          
          {/* SECTION 1: HOD LOGIN */}
          {activePortal === 'hod' && (
            <form onSubmit={handleHodLogin} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">Head of Department Login</h2>
                    <p className="text-xs text-slate-400">Full system governance, timetable & campus analytics</p>
                  </div>
                </div>

                {/* Clear All Button */}
                <button
                  type="button"
                  onClick={handleClearHodForm}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-slate-700/40"
                  title="Clear all fields"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear all</span>
                </button>
              </div>

              {hodError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{hodError}</span>
                </div>
              )}

              {/* Passcode Field */}
              <div className="space-y-1.5">
                <label htmlFor="hod-passcode" className="block text-xs font-bold text-slate-300">
                  HOD Security Passcode
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="hod-passcode"
                    type="password"
                    value={hodPasscode}
                    onChange={(e) => setHodPasscode(e.target.value)}
                    placeholder="Enter HOD security passcode..."
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Quick Demo Credentials Helper */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Demo Passcode: <code className="text-amber-300 font-mono font-bold">{settings.hodPasscode}</code>
                </span>
                <button
                  type="button"
                  onClick={fillDemoHod}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                >
                  Fill Code
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2.5">
                <button
                  id="button-login-hod"
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm py-3 px-5 rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>Authorize & Enter HOD Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* SECTION 2: TEACHER LOGIN */}
          {activePortal === 'teacher' && (
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">Faculty / Teacher Login</h2>
                    <p className="text-xs text-slate-400">Mark lecture attendance, student records & defaulter alerts</p>
                  </div>
                </div>

                {/* Clear All Button */}
                <button
                  type="button"
                  onClick={handleClearTeacherForm}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-slate-700/40"
                  title="Clear all fields"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear all</span>
                </button>
              </div>

              {teacherError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{teacherError}</span>
                </div>
              )}

              {/* Unique Teacher Code Field */}
              <div className="space-y-1.5">
                <label htmlFor="teacher-unique-code" className="block text-xs font-bold text-slate-300">
                  Unique Teacher Code (Assigned by HOD)
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="teacher-unique-code"
                    type="text"
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TEACH101"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono uppercase"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Passcode Field */}
              <div className="space-y-1.5">
                <label htmlFor="teacher-passcode" className="block text-xs font-bold text-slate-300">
                  Teacher Passcode
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="teacher-passcode"
                    type="password"
                    value={teacherPasscode}
                    onChange={(e) => setTeacherPasscode(e.target.value)}
                    placeholder="Enter your personal passcode..."
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Quick Demo Faculty Profiles (1-click fill) */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Quick Demo Faculty Codes:
                  </span>
                  <span className="text-[11px] text-slate-500">Pass: teach123</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {teachers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => fillDemoTeacher(t)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-emerald-300 font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>{t.uniqueCode} ({t.name.split(' ')[1] || t.name})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2.5">
                <button
                  id="button-login-teacher"
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-bold text-sm py-3 px-5 rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>Sign In as Faculty</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full text-center py-3 text-xs text-slate-500 border-t border-slate-800/80">
        <p>&copy; {new Date().getFullYear()} {settings.collegeName}. All rights reserved &bull; Cloud ERP System</p>
      </footer>
    </div>
  );
};
