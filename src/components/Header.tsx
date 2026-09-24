import React from 'react';
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
        
        {/* Top Header Row: Identity & Quick Actions */}
        <div className="py-2 sm:py-3 flex items-center justify-between gap-2">
          
          {/* Brand / Campus Identity */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
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
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                isQuotaExhausted
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 active:scale-95'
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
              className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer min-h-[34px]"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Secondary Header Row: Class, Date, and Live Stats */}
        <div className="pb-2.5 pt-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          
          {/* Class Selector Dropdown */}
          <div className="sm:col-span-4 relative">
            <select
              id="class-selector"
              value={selectedClassId}
              onChange={(e) => onClassChange(e.target.value)}
              className="w-full appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-900 text-xs sm:text-sm font-semibold pl-3 pr-8 py-2 rounded-xl border border-slate-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-all truncate"
            >
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Date Picker & Today Button */}
          <div className="sm:col-span-4 flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 min-h-[38px]">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              id="attendance-date"
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={handleSetToday}
              className="text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-2 py-1 rounded-md border border-slate-200 transition-colors cursor-pointer shrink-0"
            >
              Today
            </button>
          </div>

          {/* Live Attendance Stats */}
          <div className="sm:col-span-4 flex items-center justify-between sm:justify-end gap-2 text-xs px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[38px]">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span className={`w-2 h-2 rounded-full ${savedIndicator ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              <span className="text-[11px] font-semibold">{savedIndicator ? 'Saved' : 'Ready'}</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-xs">
              <span className="text-emerald-700">{totalPresent} P</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-rose-700">{totalAbsent} A</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-900 text-white shrink-0">
                {attendancePercent}%
              </span>
            </div>
          </div>

        </div>

        {/* Navigation Tabs Bar - Clean swipeable tabs */}
        <nav className="flex items-center gap-1 sm:gap-1.5 border-t border-slate-100 pt-1.5 pb-2 overflow-x-auto no-scrollbar w-full max-w-full scroll-smooth">
          
          <button
            id="tab-dashboard"
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
              currentTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Attendance</span>
          </button>

          <button
            id="tab-timetable"
            type="button"
            onClick={() => onTabChange('timetable')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
              currentTab === 'timetable'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span>Timetable</span>
          </button>

          <button
            id="tab-defaulters"
            type="button"
            onClick={() => onTabChange('defaulters')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
              currentTab === 'defaulters'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200'
            }`}
            title="Attendance Log & Defaulters Register"
          >
            <ClipboardList className={`w-3.5 h-3.5 ${currentTab === 'defaulters' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Attendance Log</span>
            {defaultersCount > 0 && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                currentTab === 'defaulters' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
              }`}>
                {defaultersCount}
              </span>
            )}
          </button>

          <button
            id="tab-analytics"
            type="button"
            onClick={() => onTabChange('analytics')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
              currentTab === 'analytics'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>

          <button
            id="tab-students"
            type="button"
            onClick={() => onTabChange('students')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
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

          {currentUser.role === 'hod' && (
            <button
              id="tab-hod"
              type="button"
              onClick={() => onTabChange('hod')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 min-h-[38px] ${
                currentTab === 'hod'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>HOD Center</span>
            </button>
          )}

          <button
            id="open-scanner-button"
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-2 rounded-xl transition-colors cursor-pointer shrink-0 min-h-[38px]"
            title="Import Excel or PDF student roster"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Scan List</span>
          </button>

        </nav>

      </div>
    </header>
  );
};
