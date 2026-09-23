import React from 'react';
import { 
  Calendar, 
  ChevronDown, 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  Share2, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  LogOut,
  CloudCheck,
  Cloud,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import { ClassGroup, AuthUser, SystemSettings } from '../types';

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
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  classes,
  selectedClassId,
  onClassChange,
  selectedDate,
  onDateChange,
  onOpenWhatsApp,
  onOpenImportModal,
  savedIndicator,
  totalPresent,
  totalStudents,
  currentUser,
  onLogout,
  settings,
  defaultersCount,
  cloudSyncing,
  isQuotaExhausted
}) => {
  const currentClass = classes.find(c => c.id === selectedClassId) || classes[0];

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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Main Header Bar */}
        <div className="py-2 sm:py-3 space-y-2.5 sm:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
          
          {/* Brand & Campus Identity */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <GraduationCap className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-xs sm:text-base font-extrabold text-slate-900 tracking-tight leading-none uppercase truncate">
                    {settings.collegeName}
                  </h1>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    currentUser.role === 'hod' 
                      ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {currentUser.role === 'hod' ? 'HOD Admin' : `Faculty (${currentUser.uniqueCode})`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  {currentUser.name} &bull; {settings.departmentName}
                </p>
              </div>
            </div>

            {/* Right Top Mobile / Compact Actions: Cloud Sync & Logout */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Cloud Sync Status Indicator */}
              <div 
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                  isQuotaExhausted
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
                title={
                  isQuotaExhausted
                    ? 'Firebase daily write quota reached - All campus attendance is safely preserved locally in browser'
                    : 'Google Cloud Firebase Firestore Persistence Active'
                }
              >
                <Cloud className={`w-3.5 h-3.5 ${isQuotaExhausted ? 'text-amber-600' : 'text-emerald-600'} ${cloudSyncing ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">
                  {isQuotaExhausted ? 'Local Storage (Quota Limit)' : (cloudSyncing ? 'Syncing...' : 'Firebase Cloud')}
                </span>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
                title="Sign out to Login Screen"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Selectors Grid: Class, Date, and Live Stats */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-wrap md:flex-nowrap">
            
            {/* Class & Date Controls */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              {/* Class Dropdown */}
              <div className="relative flex-1 sm:w-48">
                <select
                  id="class-selector"
                  value={selectedClassId}
                  onChange={(e) => onClassChange(e.target.value)}
                  className="w-full appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-900 text-xs sm:text-sm font-semibold pl-3 pr-7 py-2 rounded-xl border border-slate-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-all truncate"
                >
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Date Selector */}
              <div className="flex items-center justify-between sm:justify-start gap-1 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <input
                  id="attendance-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="bg-transparent text-[11px] sm:text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer w-full min-w-0"
                />
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-200 transition-colors cursor-pointer shrink-0"
                  title="Jump to today"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Live Count Pill */}
            <div className="flex items-center justify-between sm:justify-start gap-2 text-xs px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${savedIndicator ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                <span className="font-semibold text-slate-700">
                  {savedIndicator ? 'Saved' : 'Ready'}
                </span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-emerald-700">
                {totalPresent} Present
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="font-bold text-rose-700">
                {totalAbsent} Absent
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-900 text-white shrink-0">
                {attendancePercent}%
              </span>
            </div>

          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 border-t border-slate-100 pt-1.5 pb-2 overflow-x-auto no-scrollbar">
          
          {/* Tab 1: Attendance Roster */}
          <button
            id="tab-dashboard"
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              currentTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Mark Attendance</span>
          </button>

          {/* Tab 2: Timetable & Lecture Schedule (Req 11, 13) */}
          <button
            id="tab-timetable"
            type="button"
            onClick={() => onTabChange('timetable')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              currentTab === 'timetable'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span>Timetable & Lectures</span>
          </button>

          {/* Tab 3: Defaulter List & Parent Alerts (Req 15, 16) */}
          <button
            id="tab-defaulters"
            type="button"
            onClick={() => onTabChange('defaulters')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              currentTab === 'defaulters'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Defaulters</span>
            {defaultersCount > 0 && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                currentTab === 'defaulters' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
              }`}>
                {defaultersCount}
              </span>
            )}
          </button>

          {/* Tab 4: Analytics */}
          <button
            id="tab-analytics"
            type="button"
            onClick={() => onTabChange('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              currentTab === 'analytics'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Campus Analytics</span>
          </button>

          {/* Tab 5: Students Roster (Req 10) */}
          <button
            id="tab-students"
            type="button"
            onClick={() => onTabChange('students')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              currentTab === 'students'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Students</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
              currentTab === 'students' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
            }`}>
              {currentClass.studentIds.length}
            </span>
          </button>

          {/* Tab 6: HOD Control Center (Req 8, 9) */}
          {currentUser.role === 'hod' && (
            <button
              id="tab-hod"
              type="button"
              onClick={() => onTabChange('hod')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                currentTab === 'hod'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>HOD Control Center</span>
            </button>
          )}

          {/* Excel / PDF Scanner Button */}
          <button
            id="open-scanner-button"
            type="button"
            onClick={onOpenImportModal}
            className="ml-auto flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
            title="Import Excel or PDF student list"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Scan Excel / PDF</span>
          </button>

        </div>

      </div>
    </header>
  );
};
