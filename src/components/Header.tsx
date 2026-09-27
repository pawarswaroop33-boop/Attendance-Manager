import React, { useRef, useState, useLayoutEffect } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  LogOut, 
  Cloud, 
  GraduationCap, 
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { ClassGroup, AuthUser, SystemSettings } from '../types';
import { DYPatilLogo } from './DYPatilLogo';

export type AppTab = 'dashboard' | 'timetable' | 'defaulters' | 'analytics' | 'students' | 'hod';

interface HeaderProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  classes: ClassGroup[];
  selectedClassId: string;
  onClassChange: (classId: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenWhatsApp: () => void;
  onOpenImportModal: () => void;
  savedIndicator: boolean;
  totalPresent: number;
  totalStudents: number;
  currentUser: AuthUser;
  onLogout: () => void;
  settings: SystemSettings;
  defaultersCount: number;
  cloudSyncing: boolean;
  isQuotaExhausted?: boolean;
  onForceSync?: () => void;
  activeDbProvider?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  classes,
  selectedClassId,
  onClassChange,
  selectedDate,
  onDateChange,
  onOpenImportModal,
  savedIndicator,
  totalPresent,
  totalStudents,
  currentUser,
  onLogout,
  settings,
  defaultersCount,
  cloudSyncing,
  isQuotaExhausted,
  onForceSync,
  activeDbProvider = 'Supabase'
}) => {
  const currentClass = classes.find(c => c.id === selectedClassId) || classes[0];

  const navRef = useRef<HTMLElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; height: number; top: number; opacity: number }>({
    left: 0,
    width: 0,
    height: 0,
    top: 0,
    opacity: 0,
  });

  const syncPillToElement = (btn: HTMLElement | null) => {
    if (!btn || !navRef.current) return;
    setPillStyle({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
      height: btn.offsetHeight,
      top: btn.offsetTop,
      opacity: 1,
    });
  };

  useLayoutEffect(() => {
    const updatePill = () => {
      if (!navRef.current) return;
      const activeBtn = navRef.current.querySelector<HTMLButtonElement>(`[data-tab-id="${currentTab}"]`);
      syncPillToElement(activeBtn);
    };

    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [currentTab, currentUser.role]);

  const handleTabSelect = (tab: AppTab, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e?.currentTarget) {
      syncPillToElement(e.currentTarget);
    }
    onTabChange(tab);
  };

  const handleSetToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    onDateChange(`${yyyy}-${mm}-${dd}`);
  };

  const attendancePercent = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
  const totalAbsent = Math.max(0, totalStudents - totalPresent);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className={`mx-auto px-3 sm:px-6 lg:px-8 pb-3 sm:pb-3.5 pt-1.5 transition-all duration-200 ${
        currentTab === 'hod' ? 'max-w-[1680px]' : 'max-w-7xl'
      }`}>
        
        {/* Top Header Row: Identity & Quick Actions */}
        <div className="py-2 sm:py-2.5 flex items-center justify-between gap-2">
          
          {/* Brand / Campus Identity */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <DYPatilLogo variant="emblem" className="w-8 h-9 sm:w-9 sm:h-10 shrink-0 drop-shadow-xs" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-tight">
                  {settings.collegeName}
                </h1>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                  currentUser.role === 'hod' 
                    ? 'bg-amber-100 text-amber-900' 
                    : 'bg-emerald-100 text-emerald-900'
                }`}>
                  {currentUser.role === 'hod' ? 'HOD' : currentUser.uniqueCode || 'Faculty'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate leading-tight">
                {currentUser.name} &bull; {settings.departmentName}
              </p>
            </div>
          </div>

          {/* Right Header Controls: Cloud Status & Sign Out */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onForceSync}
              disabled={cloudSyncing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer border btn-tactile ${
                isQuotaExhausted
                  ? 'bg-gradient-to-b from-amber-50 to-amber-100/70 text-amber-900 border-amber-300 shadow-xs'
                  : 'bg-gradient-to-b from-emerald-50 to-emerald-100/70 text-emerald-900 border-emerald-300 shadow-xs'
              }`}
              title={`Active Cloud Database: ${activeDbProvider}. Click to instantly force push/sync data to cloud.`}
            >
              <Cloud className={`w-3.5 h-3.5 ${cloudSyncing ? 'animate-pulse text-sky-600' : 'text-emerald-600'}`} />
              <span>
                {cloudSyncing ? 'Syncing...' : activeDbProvider}
              </span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-rose-600 bg-gradient-to-b from-white to-slate-100 hover:to-rose-50 px-3 py-1.5 rounded-xl border border-slate-200/90 hover:border-rose-300 shadow-xs transition-all cursor-pointer min-h-[34px] btn-tactile"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Secondary Header Row: Class, Date, and Live Stats */}
        <div className="pb-2.5 pt-0.5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          
          {/* Class Selector Dropdown */}
          <div className="sm:col-span-4 relative">
            <select
              id="class-selector"
              value={selectedClassId}
              onChange={(e) => onClassChange(e.target.value)}
              className="w-full appearance-none bg-gradient-to-b from-white to-slate-50 hover:to-slate-100/80 text-slate-900 text-xs sm:text-sm font-bold pl-3.5 pr-8 py-2 rounded-xl border border-slate-300/90 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)] transition-all truncate"
            >
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Date Picker & Today Button */}
          <div className="sm:col-span-4 flex items-center gap-2 bg-gradient-to-b from-white to-slate-50 border border-slate-300/90 rounded-xl px-3 py-1 text-xs text-slate-700 min-h-[38px] shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)] focus-within:ring-2 focus-within:ring-slate-900 transition-all">
            <Calendar className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <input
              id="attendance-date"
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={handleSetToday}
              className="text-[10px] font-black text-slate-800 hover:text-slate-950 bg-gradient-to-b from-white to-slate-100 hover:to-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 shadow-xs active:translate-y-0.5 active:shadow-inner transition-all cursor-pointer shrink-0"
            >
              Today
            </button>
          </div>

          {/* Live Attendance Stats */}
          <div className="sm:col-span-4 flex items-center justify-between sm:justify-end gap-2.5 text-xs px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] min-h-[38px]">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span className={`w-2 h-2 rounded-full ${savedIndicator ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              <span className="text-[11px] font-semibold">{savedIndicator ? 'Saved' : 'Ready'}</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-xs">
              <span className="text-emerald-700">{totalPresent} P</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-rose-700">{totalAbsent} A</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-900 text-white shadow-xs shrink-0">
                {attendancePercent}%
              </span>
            </div>
          </div>

        </div>

        {/* Navigation Tabs Bar - Smooth animated segmented track with glassmorphism sliding 3D pill */}
        <nav 
          ref={navRef}
          className="nav-glass-track relative flex items-center gap-1 sm:gap-1.5 mt-2 mb-0.5 overflow-x-auto no-scrollbar w-full max-w-full scroll-smooth bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 shadow-[inset_0_2px_5px_rgba(0,0,0,0.05),0_1px_0_rgba(255,255,255,0.9)]"
        >
          {/* Animated Sliding Glassmorphism 3D Pill Indicator */}
          <div
            style={{
              transform: `translate3d(${pillStyle.left}px, ${pillStyle.top}px, 0)`,
              width: `${pillStyle.width}px`,
              height: `${pillStyle.height}px`,
              opacity: pillStyle.opacity,
            }}
            className={`absolute top-0 left-0 rounded-xl transition-all duration-200 ease-[cubic-bezier(0.2,0.9,0.3,1)] pointer-events-none will-change-transform ${
              currentTab === 'hod'
                ? 'pill-glassmorphism-amber'
                : 'pill-glassmorphism'
            }`}
          />
          
          {/* HOD Center Tab (Only for HOD - Main Hub) */}
          {currentUser.role === 'hod' && (
            <button
              id="tab-hod"
              data-tab-id="hod"
              type="button"
              onClick={(e) => handleTabSelect('hod', e)}
              className={`group relative z-10 flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] select-none outline-none focus:outline-none focus:ring-0 ${
                currentTab === 'hod'
                  ? 'nav-tab-btn-active text-amber-950 font-bold'
                  : 'nav-tab-btn text-amber-900/80 hover:text-amber-950'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 transition-transform duration-200 ${currentTab === 'hod' ? 'text-amber-950 scale-105' : 'text-amber-700 group-hover:scale-110'}`} />
              <span>HOD Center</span>
            </button>
          )}

          {/* Teacher Attendance Tab (ONLY for Faculty/Teachers) */}
          {currentUser.role === 'teacher' && (
            <button
              id="tab-dashboard"
              data-tab-id="dashboard"
              type="button"
              onClick={(e) => handleTabSelect('dashboard', e)}
              className={`group relative z-10 flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] select-none outline-none focus:outline-none focus:ring-0 ${
                currentTab === 'dashboard'
                  ? 'nav-tab-btn-active text-slate-900 font-bold'
                  : 'nav-tab-btn text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className={`w-3.5 h-3.5 transition-transform duration-200 ${currentTab === 'dashboard' ? 'text-emerald-600 scale-105' : 'text-slate-400 group-hover:text-emerald-600 group-hover:scale-110'}`} />
              <span>Take Attendance</span>
            </button>
          )}

          {/* Attendance Log Tab */}
          <button
            id="tab-defaulters"
            data-tab-id="defaulters"
            type="button"
            onClick={(e) => handleTabSelect('defaulters', e)}
            className={`group relative z-10 flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] select-none outline-none focus:outline-none focus:ring-0 ${
              currentTab === 'defaulters'
                ? 'nav-tab-btn-active text-slate-900 font-bold'
                : 'nav-tab-btn text-slate-600 hover:text-slate-900'
            }`}
            title="Attendance Log & Defaulters Register"
          >
            <ClipboardList className={`w-3.5 h-3.5 transition-transform duration-200 ${currentTab === 'defaulters' ? 'text-emerald-600 scale-105' : 'text-slate-400 group-hover:text-emerald-600 group-hover:scale-110'}`} />
            <span>Attendance Log</span>
            {defaultersCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all duration-200 ${
                currentTab === 'defaulters' ? 'bg-rose-500 text-white shadow-xs' : 'bg-rose-100 text-rose-700 group-hover:bg-rose-200/80'
              }`}>
                {defaultersCount}
              </span>
            )}
          </button>

          {/* Timetable Tab */}
          <button
            id="tab-timetable"
            data-tab-id="timetable"
            type="button"
            onClick={(e) => handleTabSelect('timetable', e)}
            className={`group relative z-10 flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] select-none outline-none focus:outline-none focus:ring-0 ${
              currentTab === 'timetable'
                ? 'nav-tab-btn-active text-slate-900 font-bold'
                : 'nav-tab-btn text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 transition-transform duration-200 ${currentTab === 'timetable' ? 'text-sky-600 scale-105' : 'text-slate-400 group-hover:text-sky-600 group-hover:scale-110'}`} />
            <span>Timetable</span>
          </button>

          {/* Students Roster Tab */}
          <button
            id="tab-students"
            data-tab-id="students"
            type="button"
            onClick={(e) => handleTabSelect('students', e)}
            className={`group relative z-10 flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] select-none outline-none focus:outline-none focus:ring-0 ${
              currentTab === 'students'
                ? 'nav-tab-btn-active text-slate-900 font-bold'
                : 'nav-tab-btn text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className={`w-3.5 h-3.5 transition-transform duration-200 ${currentTab === 'students' ? 'text-indigo-600 scale-105' : 'text-slate-400 group-hover:text-indigo-600 group-hover:scale-110'}`} />
            <span>Students</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all duration-200 ${
              currentTab === 'students' ? 'bg-slate-200/90 text-slate-800 border border-slate-300/80 shadow-xs' : 'bg-slate-200/60 text-slate-600 group-hover:bg-slate-200'
            }`}>
              {currentClass.studentIds.length}
            </span>
          </button>

          {/* Analytics Tab */}
          <button
            id="tab-analytics"
            data-tab-id="analytics"
            type="button"
            onClick={(e) => handleTabSelect('analytics', e)}
            className={`group relative z-10 flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] select-none outline-none focus:outline-none focus:ring-0 ${
              currentTab === 'analytics'
                ? 'nav-tab-btn-active text-slate-900 font-bold'
                : 'nav-tab-btn text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className={`w-3.5 h-3.5 transition-transform duration-200 ${currentTab === 'analytics' ? 'text-emerald-600 scale-105' : 'text-slate-400 group-hover:text-emerald-600 group-hover:scale-110'}`} />
            <span>Analytics</span>
          </button>

          {currentUser.role === 'hod' && (
            <button
              id="open-scanner-button"
              type="button"
              onClick={onOpenImportModal}
              className="relative z-10 flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-gradient-to-b from-emerald-100 to-emerald-200 hover:to-emerald-300 border border-emerald-400/80 px-3.5 py-2 rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer shrink-0 min-h-[38px] btn-tactile"
              title="Import Excel or PDF student roster"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
              <span>Scan List</span>
            </button>
          )}
        </nav>

      </div>
    </header>
  );
};
