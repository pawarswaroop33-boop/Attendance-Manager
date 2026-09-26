import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  UserCheck,
  UserX,
  Share2,
  Download,
  Edit3,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Sparkles,
  Layers,
  ArrowRight,
  X,
  CalendarOff,
  Lock,
  Trash2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { Student, ClassGroup, AttendanceSession, SystemSettings, AuthUser, TimetableSlot, Holiday } from '../types';
import {
  formatDateShort,
  formatDateWithDay,
  getDayOfWeek,
  getSessionStats,
  MONTH_NAMES,
  DAYS_SHORT,
  getCalendarMonthGrid,
  parseDateKey,
  formatDateKey,
  isLegacyDummySession,
  getHolidayForDate
} from '../utils/dateUtils';
import { getLecturesForDateAndUser } from '../utils/teacherFilter';

interface AttendanceCalendarProps {
  sessions: AttendanceSession[];
  classes: ClassGroup[];
  students: Student[];
  settings: SystemSettings;
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
  onNavigateToSession?: (classId: string, date: string, lectureSlotId?: string) => void;
  onExportSessionCSV: (session: AttendanceSession, sessionDay: string) => void;
  sendAbsentParentAlert: (student: Student, session: AttendanceSession, sessionDay: string) => void;
  onClearDateAttendance?: (dateStr: string) => void;
  onClearSession?: (sessionId: string) => void;
  currentUser?: AuthUser;
  timetable?: TimetableSlot[];
  holidays?: Holiday[];
  onDeclareHoliday?: (dateStr: string, title: string) => void;
  onRemoveHoliday?: (dateStr: string) => void;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  sessions,
  classes,
  students,
  settings,
  selectedDate,
  onSelectDate,
  onNavigateToSession,
  onExportSessionCSV,
  sendAbsentParentAlert,
  onClearDateAttendance,
  onClearSession,
  currentUser,
  timetable = [],
  holidays = [],
  onDeclareHoliday,
  onRemoveHoliday
}) => {
  const [isDeclareHolidayModalOpen, setIsDeclareHolidayModalOpen] = useState(false);
  const [holidayTitleInput, setHolidayTitleInput] = useState('');

  // Map of declared holidays by date string (YYYY-MM-DD)
  const holidaysMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    (holidays || []).forEach(h => {
      if (h.date) map.set(h.date, h);
    });
    return map;
  }, [holidays]);
  // Parse initial view year and month from selectedDate, or latest session date, or today
  const initialParsed = useMemo(() => {
    if (selectedDate) return parseDateKey(selectedDate);
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
      return parseDateKey(sorted[0].date);
    }
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth(), day: now.getDate() };
  }, []);

  const [viewYear, setViewYear] = useState<number>(initialParsed.year);
  const [viewMonth, setViewMonth] = useState<number>(initialParsed.monthIndex);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  // Modal confirmation states for clearing attendance
  const [confirmClearDate, setConfirmClearDate] = useState<string | null>(null);
  const [confirmClearSessionId, setConfirmClearSessionId] = useState<string | null>(null);

  // Expanded lecture card for viewing roster
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionRosterTab, setSessionRosterTab] = useState<'absent' | 'present' | 'all'>('absent');

  // Filter sessions by class and strip dummy/mock sessions
  const classFilteredSessions = useMemo(() => {
    const clean = sessions.filter(s => !isLegacyDummySession(s));
    if (selectedClassFilter === 'all') return clean;
    return clean.filter(s => s.classId === selectedClassFilter);
  }, [sessions, selectedClassFilter]);

  // Group sessions by date string (YYYY-MM-DD)
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, AttendanceSession[]>();
    classFilteredSessions.forEach(session => {
      const existing = map.get(session.date) || [];
      existing.push(session);
      map.set(session.date, existing);
    });
    return map;
  }, [classFilteredSessions]);

  // Calculate daily summary metrics for each date
  const dateSummaries = useMemo(() => {
    const summaryMap = new Map<string, {
      count: number;
      totalEnrolled: number;
      totalPresent: number;
      totalAbsent: number;
      avgAttendanceRate: number;
    }>();

    sessionsByDate.forEach((dateSessions, dateKey) => {
      let totalEnrolled = 0;
      let totalPresent = 0;
      let totalAbsent = 0;

      dateSessions.forEach(session => {
        const cls = classes.find(c => c.id === session.classId) || classes[0];
        const classStudents = students.filter(s => cls?.studentIds?.includes(s.id) || false);
        const stats = getSessionStats(session, classStudents.length > 0 ? classStudents : students);

        totalEnrolled += stats.total;
        totalPresent += stats.presentCount;
        totalAbsent += stats.absentCount;
      });

      const avgAttendanceRate = totalEnrolled > 0
        ? Math.round((totalPresent / totalEnrolled) * 100)
        : 0;

      summaryMap.set(dateKey, {
        count: dateSessions.length,
        totalEnrolled,
        totalPresent,
        totalAbsent,
        avgAttendanceRate
      });
    });

    return summaryMap;
  }, [sessionsByDate, classes, students]);

  // All dates that have recorded sessions (sorted newest first)
  const recordedDatesList = useMemo(() => {
    return Array.from(sessionsByDate.keys()).sort((a, b) => b.localeCompare(a));
  }, [sessionsByDate]);

  // Calendar month cells for viewYear and viewMonth
  const calendarCells = useMemo(() => {
    return getCalendarMonthGrid(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  // Handle month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(prev => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(prev => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    const todayStr = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onSelectDate(todayStr);
  };

  // Sessions for the currently selected date
  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    const list = sessionsByDate.get(selectedDate) || [];
    return list.sort((a, b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''));
  }, [sessionsByDate, selectedDate]);

  // Selected date summary metrics
  const selectedDateSummary = useMemo(() => {
    if (!selectedDate) return null;
    return dateSummaries.get(selectedDate);
  }, [dateSummaries, selectedDate]);

  const selectedDateDayOfWeek = useMemo(() => {
    if (!selectedDate) return '';
    return getDayOfWeek(selectedDate);
  }, [selectedDate]);

  const selectedDateHoliday = useMemo(() => {
    if (!selectedDate) return null;
    return getHolidayForDate(selectedDate, holidays);
  }, [selectedDate, holidays]);

  // Scheduled timetable lectures for selectedDate
  const scheduledLecturesForSelectedDate = useMemo(() => {
    if (!selectedDate || !timetable || timetable.length === 0) return [];
    return getLecturesForDateAndUser(
      selectedDate,
      currentUser,
      timetable,
      selectedClassFilter === 'all' ? undefined : selectedClassFilter
    );
  }, [selectedDate, currentUser, timetable, selectedClassFilter]);

  const hasScheduledLectureOnSelectedDate = scheduledLecturesForSelectedDate.length > 0;

  return (
    <div className="space-y-6">
      
      {/* 3D Tactile Calendar Container */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.07),0_2px_6px_rgba(0,0,0,0.03)] overflow-hidden transition-all duration-300 w-full max-w-full min-w-0">
        
        {/* Calendar Header Bar with 3D Depth & Controls */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Month & Year Title with Navigation Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-gradient-to-b from-white to-slate-50 border border-slate-300/90 rounded-2xl p-1 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-100 active:scale-90 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-sm sm:text-base font-extrabold text-slate-900 px-3 min-w-[150px] text-center select-none font-mono">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-100 active:scale-90 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Jump to Today Button */}
              <button
                type="button"
                onClick={handleJumpToToday}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-white to-slate-100 hover:to-slate-200 text-slate-800 text-xs font-black transition-all active:scale-95 active:translate-y-0.5 cursor-pointer shadow-xs border border-slate-300 btn-tactile"
              >
                Today
              </button>

              {currentUser?.role === 'teacher' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold shadow-2xs">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Faculty: {currentUser.name}</span>
                </span>
              )}

              {/* Quick Jump Dropdown for dates with attendance */}
              {recordedDatesList.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-bold">Quick Jump:</span>
                  <select
                    value={selectedDate && recordedDatesList.includes(selectedDate) ? selectedDate : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const target = e.target.value;
                        const parsed = parseDateKey(target);
                        setViewYear(parsed.year);
                        setViewMonth(parsed.monthIndex);
                        onSelectDate(target);
                      } else {
                        onSelectDate(null);
                      }
                    }}
                    className="bg-gradient-to-b from-white to-slate-50 border border-slate-300/90 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)]"
                  >
                    <option value="">Recorded Dates ({recordedDatesList.length})</option>
                    {recordedDatesList.map(dateStr => (
                      <option key={dateStr} value={dateStr}>
                        {formatDateWithDay(dateStr)} ({sessionsByDate.get(dateStr)?.length} lectures)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Right Controls: Class Division Filter & Visual Legend */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Class Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Class:</span>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="bg-gradient-to-b from-white to-slate-50 border border-slate-300/90 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)]"
                >
                  <option value="all">All Academic Classes</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Attendance Indicator Legend */}
              <div className="hidden xl:flex items-center gap-3 pl-3 border-l border-slate-200 text-[11px] font-semibold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                  <span>&ge;75% Attendance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shadow-xs" />
                  <span>50-74%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs" />
                  <span>&lt;50%</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Tactile Texture Calendar Grid Body */}
        <div className="p-2 sm:p-5 texture-dot-grid bg-slate-100/60 rounded-2xl border border-slate-200/80 shadow-[inset_0_2px_6px_rgba(0,0,0,0.04)] overflow-x-hidden w-full max-w-full min-w-0">
          
          {/* Weekday Header Columns */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center mb-2 w-full min-w-0">
            {DAYS_SHORT.map((day, idx) => {
              const isWeekend = idx === 0 || idx === 6;
              return (
                <div
                  key={day}
                  className={`py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider truncate ${
                    isWeekend ? 'text-slate-400' : 'text-slate-700'
                  }`}
                >
                  <span className="sm:hidden">{day.slice(0, 2)}</span>
                  <span className="hidden sm:inline">{day}</span>
                </div>
              );
            })}
          </div>

          {/* Calendar 35/42 Cell Grid with Smooth Embedded 3D Depth */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full min-w-0">
            {calendarCells.map((cell) => {
              const summary = dateSummaries.get(cell.dateStr);
              const hasLectures = summary && summary.count > 0;
              const cellHoliday = getHolidayForDate(cell.dateStr, holidays);
              const isSelected = selectedDate !== null && cell.dateStr === selectedDate;
              const isToday = cell.isToday;

              // Color indicator based on attendance rate
              let badgeBg = 'bg-slate-100 text-slate-700 border border-slate-200/60';
              if (hasLectures) {
                if (summary.avgAttendanceRate >= 75) {
                  badgeBg = 'bg-emerald-50 text-emerald-850 border border-emerald-200';
                } else if (summary.avgAttendanceRate >= 50) {
                  badgeBg = 'bg-amber-50 text-amber-850 border border-amber-200';
                } else {
                  badgeBg = 'bg-rose-50 text-rose-850 border border-rose-200';
                }
              }

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => onSelectDate(isSelected ? null : cell.dateStr)}
                  className={`relative min-h-[58px] sm:min-h-[82px] w-full min-w-0 p-1 sm:p-2 rounded-xl sm:rounded-2xl text-left day-cell-3d cursor-pointer flex flex-col justify-between overflow-hidden transition-all duration-200 select-none focus:outline-none focus:outline-hidden ${
                    isSelected
                      ? 'bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900 border-2 border-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_4px_14px_-1px_rgba(15,23,42,0.18)] -translate-y-0.5 z-10'
                      : hasLectures
                        ? 'bg-gradient-to-b from-white via-slate-50/70 to-slate-100/50 text-slate-900 border border-slate-300/90 shadow-[0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] hover:border-slate-400 hover:shadow-[0_3px_8px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner'
                        : cell.isCurrentMonth
                          ? 'bg-gradient-to-b from-white via-white to-slate-50/60 text-slate-800 border border-slate-300/80 shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-slate-400/90 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner'
                          : 'bg-slate-100/40 text-slate-400 border border-slate-200/50 hover:bg-slate-100/70'
                  }`}
                >
                  {/* Top row: Day Number & Today indicator */}
                  <div className="flex items-center justify-between gap-0.5 w-full min-w-0">
                    <span
                      className={`text-xs sm:text-sm font-black font-mono transition-colors shrink-0 ${
                        isSelected
                          ? 'text-slate-950 font-extrabold'
                          : isToday
                            ? 'text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded-md'
                            : cell.isCurrentMonth
                              ? 'text-slate-900'
                              : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Today Pill */}
                    {isToday && (
                      <span
                        className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1 py-0.2 rounded shrink-0 leading-none ${
                          isSelected ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <span className="hidden sm:inline">Today</span>
                        <span className="sm:hidden">●</span>
                      </span>
                    )}
                  </div>

                  {/* Bottom: Dedicated Attendance Badge or Holiday Badge with ZERO overflow */}
                  {cellHoliday ? (
                    <div className="mt-auto w-full min-w-0 pt-0.5 sm:pt-1">
                      <div
                        className={`w-full px-1 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-center flex flex-col items-center justify-center transition-all overflow-hidden ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 font-black shadow-xs border border-amber-300'
                            : 'bg-amber-100/90 text-amber-900 border border-amber-300 shadow-2xs font-bold'
                        }`}
                        title={`Declared Holiday: ${cellHoliday.title}`}
                      >
                        <span className="font-mono font-black text-[9px] sm:text-[10px] tracking-tight text-center leading-tight truncate w-full block">
                          🏖️ HOLIDAY
                        </span>
                        <span className="text-[7.5px] sm:text-[8.5px] font-extrabold text-center leading-tight truncate w-full block opacity-90">
                          {cellHoliday.title}
                        </span>
                      </div>
                    </div>
                  ) : hasLectures ? (
                    <div className="mt-auto w-full min-w-0 pt-0.5 sm:pt-1">
                      <div
                        className={`w-full px-1 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-center flex flex-col items-center justify-center transition-all overflow-hidden ${
                          isSelected
                            ? 'bg-slate-900 text-white font-bold border border-slate-800 shadow-2xs'
                            : badgeBg
                        }`}
                        title={`${summary.count} lecture(s) - ${summary.avgAttendanceRate}% attendance (${summary.totalPresent} Present, ${summary.totalAbsent} Absent)`}
                      >
                        {/* Attendance Percentage: Centered, strictly bounded, responsive font */}
                        <span className="font-mono font-black text-[9.5px] sm:text-xs tracking-tight text-center leading-tight truncate w-full block">
                          {summary.avgAttendanceRate}%
                        </span>
                        {/* Lecture count: Small subtext directly below percentage */}
                        <span className={`text-[7.5px] sm:text-[8.5px] font-bold text-center leading-tight truncate w-full block ${
                          isSelected ? 'text-slate-200' : 'opacity-75'
                        }`}>
                          <span className="sm:hidden">{summary.count}L</span>
                          <span className="hidden sm:inline">{summary.count} {summary.count === 1 ? 'Lec' : 'Lecs'}</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-1 sm:h-2" />
                  )}

                  {/* Active selection subtle accent indicator */}
                  {isSelected && (
                    <div className="absolute bottom-0 left-1.5 right-1.5 h-0.5 bg-slate-800 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION: SELECTED DATE LECTURE & ATTENDANCE INSPECTOR (3D Animated Card) */}
      {/* Visible IF AND ONLY IF a date was clicked by the user */}
      {/* ========================================================================= */}
      {selectedDate ? (
        <div className="animate-gentle-pop space-y-4">
          
          {/* Selected Date Header Strip */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4 card-3d">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                  <CalendarIcon className="w-3 h-3 text-emerald-400" />
                  Selected Date Attendance
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {settings.collegeName}
                </span>
              </div>
              
              <h2 className="text-lg sm:text-xl font-extrabold flex items-center gap-2 text-white">
                <span>{formatDateWithDay(selectedDate, selectedDateDayOfWeek)}</span>
              </h2>
              <p className="text-xs text-slate-300">
                {selectedDateSessions.length > 0
                  ? `Showing ${selectedDateSessions.length} recorded lecture${selectedDateSessions.length > 1 ? 's' : ''} and student attendance roster for this date.`
                  : `No attendance records exist for this date yet. You can click "Mark Attendance" below to take attendance.`}
              </p>
            </div>

            {/* Quick Date Stats & Action */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Declare as Holiday Button */}
              {(!selectedDateHoliday || selectedDateHoliday.declaredBy === 'System Default') && onDeclareHoliday && (
                <button
                  type="button"
                  onClick={() => {
                    setHolidayTitleInput(selectedDateHoliday?.declaredBy === 'System Default' ? selectedDateHoliday.title : '');
                    setIsDeclareHolidayModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-black transition-all border border-amber-400/50 shadow-xs active:scale-95 active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
                  title="Declare this date as an official holiday or edit holiday title"
                >
                  <span>🏖️</span>
                  <span>{selectedDateHoliday?.declaredBy === 'System Default' ? 'Custom Holiday Title' : 'Declare as Holiday'}</span>
                </button>
              )}

              {selectedDateSummary ? (
                <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3.5 py-2 rounded-xl shadow-xs">
                  <div className="text-right pr-2 border-r border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Attendance</span>
                    <span className="text-base font-extrabold text-emerald-400 font-mono">
                      {selectedDateSummary.avgAttendanceRate}%
                    </span>
                  </div>
                  <div className="text-xs font-semibold pl-1 space-y-0.5">
                    <div className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{selectedDateSummary.totalPresent} Present</span>
                    </div>
                    <div className="text-rose-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      <span>{selectedDateSummary.totalAbsent} Absent</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* HOD Specific Action: Clear Attendance for this Date */}
              {currentUser?.role === 'hod' && selectedDateSessions.length > 0 && onClearDateAttendance && (
                <button
                  type="button"
                  onClick={() => setConfirmClearDate(selectedDate)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-rose-500/20 to-rose-600/30 hover:to-rose-600/40 text-rose-200 hover:text-white border border-rose-500/50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 active:translate-y-0.5"
                  title="Clear all attendance records for this date"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear Attendance for Date</span>
                </button>
              )}

              {/* Teacher Specific Action: Take Attendance (HOD cannot take attendance) */}
              {currentUser?.role === 'teacher' && (
                hasScheduledLectureOnSelectedDate ? (
                  onNavigateToSession && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetSlot = scheduledLecturesForSelectedDate[0];
                        onNavigateToSession(targetSlot?.classId || classes[0]?.id || '', selectedDate, targetSlot?.id);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-95 active:translate-y-0.5 text-white text-xs font-black transition-all shadow-[0_3px_10px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] border border-emerald-400/40 flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Take Attendance</span>
                    </button>
                  )
                ) : (
                  <div className="px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>No Lecture Today</span>
                  </div>
                )
              )}

              {/* Close / Deselect Button */}
              <button
                type="button"
                onClick={() => onSelectDate(null)}
                className="px-3 py-2 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700/90 cursor-pointer flex items-center gap-1.5 shadow-xs active:translate-y-0.5"
                title="Close date inspection"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* Official Declared Holiday Banner */}
          {selectedDateHoliday && (
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-3d animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner shrink-0">
                  🏖️
                </div>
                <div className="space-y-0.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-amber-100 text-[10px] font-black uppercase tracking-wider">
                    Official Declared Holiday
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {selectedDateHoliday.title}
                  </h3>
                  <p className="text-xs text-amber-100">
                    Date: {formatDateWithDay(selectedDate, selectedDateDayOfWeek)}
                    {selectedDateHoliday.declaredBy ? ` • Declared by ${selectedDateHoliday.declaredBy}` : ''}
                  </p>
                </div>
              </div>

              {onRemoveHoliday && selectedDateHoliday.declaredBy !== 'System Default' && (
                <button
                  type="button"
                  onClick={() => onRemoveHoliday(selectedDate)}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 text-xs font-black transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0 border border-rose-200"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Remove Custom Holiday Override</span>
                </button>
              )}
            </div>
          )}

        {/* Selected Date Lectures Listing */}
        {selectedDateSessions.length === 0 ? (
          !hasScheduledLectureOnSelectedDate ? (
            /* There is no lecture today */
            <div className="bg-white rounded-3xl border-2 border-amber-200 p-8 sm:p-10 text-center space-y-3 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto shadow-inner border border-amber-200">
                <CalendarOff className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
                  Non-Lecture Day
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  There is no lecture today
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  {currentUser?.role === 'teacher'
                    ? `No lectures are scheduled for ${currentUser.name} on ${formatDateWithDay(selectedDate, selectedDateDayOfWeek)}. Faculty can only take attendance on days when their lectures are scheduled in the timetable.`
                    : `No lectures are scheduled on ${formatDateWithDay(selectedDate, selectedDateDayOfWeek)}. Attendance cannot be recorded on non-lecture days.`}
                </p>
              </div>
            </div>
          ) : (
            /* Scheduled slots ready to take attendance (Teachers only) */
            <div className="bg-white rounded-3xl border border-dashed border-sky-300 p-6 sm:p-8 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center mx-auto shadow-inner border border-sky-200">
                <BookOpen className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  Scheduled Lectures for {formatDateWithDay(selectedDate, selectedDateDayOfWeek)}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  {currentUser?.role === 'teacher'
                    ? 'Click below to take attendance for this scheduled lecture.'
                    : 'Faculty members will take attendance for their respective scheduled lectures.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto pt-2 text-left">
                {scheduledLecturesForSelectedDate.map(slot => (
                  <div key={slot.id} className="p-3.5 bg-slate-50 hover:bg-sky-50/60 rounded-xl border border-slate-200 hover:border-sky-300 transition-all flex flex-col justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3" />
                        {slot.timeSlotLabel}
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm mt-1">{slot.subject}</h4>
                      <p className="text-[11px] text-slate-600">{slot.className} &bull; {slot.roomName} &bull; Faculty: {slot.teacherName}</p>
                    </div>
                    {currentUser?.role === 'teacher' && onNavigateToSession && (
                      <button
                        type="button"
                        onClick={() => onNavigateToSession(slot.classId, selectedDate, slot.id)}
                        className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Take Attendance</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* Detailed Lecture Cards for this Date */
          <div className="space-y-3.5">
            {selectedDateSessions.map((session) => {
              const cls = classes.find(c => c.id === session.classId) || classes[0];
              const classStudents = students.filter(s => cls?.studentIds?.includes(s.id) || false);
              const stats = getSessionStats(session, classStudents.length > 0 ? classStudents : students);
              const sessionDay = session.dayOfWeek || selectedDateDayOfWeek;
              const isExpanded = expandedSessionId === session.id;

              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                    isExpanded
                      ? 'border-slate-400 ring-2 ring-slate-900/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Main Info */}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                      
                      {/* Left: Time Slot, Subject, Class & Teacher */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Time Slot Badge */}
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 text-sky-600" />
                            <span>{session.timeSlot || session.sessionName}</span>
                          </span>

                          {/* Class / Division Badge */}
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 border border-slate-200">
                            {cls?.name || 'Class'}
                          </span>

                          {/* Permanent Saved Badge */}
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Saved Permanently</span>
                          </span>
                        </div>

                        {/* Subject & Teacher Name */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-slate-600" />
                            <span>{session.subject || 'Academic Lecture'}</span>
                          </h3>
                          <span className="text-slate-400 hidden sm:inline">&bull;</span>
                          <span className="text-xs font-semibold text-slate-600">
                            Faculty: <strong className="text-slate-800">{session.teacherName || 'Faculty In-Charge'}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Right: Metrics Pill & Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2.5 justify-between lg:justify-end">
                        
                        {/* Attendance Score Pill */}
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                          <div className="flex items-center gap-1 text-emerald-700 text-xs font-extrabold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{stats.presentCount} Present</span>
                            <span className="text-[10px] text-emerald-600 font-semibold">({stats.presentRate}%)</span>
                          </div>
                          <span className="text-slate-300">|</span>
                          <div className="flex items-center gap-1 text-rose-700 text-xs font-extrabold">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>{stats.absentCount} Absent</span>
                            <span className="text-[10px] text-rose-600 font-semibold">({stats.absentRate}%)</span>
                          </div>
                        </div>

                        {/* View Roster Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer btn-tactile ${
                            isExpanded
                              ? 'bg-slate-900 text-white shadow-[0_2px_6px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] border border-slate-950'
                              : 'bg-gradient-to-b from-white to-slate-100 hover:to-slate-200 text-slate-800 border border-slate-200 shadow-xs'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isExpanded ? 'Hide Roster' : 'View Roster'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* Export CSV */}
                        <button
                          type="button"
                          onClick={() => onExportSessionCSV(session, sessionDay)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-950 bg-gradient-to-b from-white to-slate-100 hover:to-slate-200 border border-slate-200 shadow-xs transition-all cursor-pointer btn-tactile"
                          title="Download CSV for this lecture"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">CSV</span>
                        </button>

                        {/* HOD Delete Session Option */}
                        {currentUser?.role === 'hod' && onClearSession && (
                          <button
                            type="button"
                            onClick={() => setConfirmClearSessionId(session.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-900 bg-gradient-to-b from-rose-50 to-rose-100/80 hover:to-rose-100 border border-rose-200 shadow-xs transition-all cursor-pointer btn-tactile"
                            title="Delete this lecture session"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span className="hidden sm:inline">Clear Session</span>
                          </button>
                        )}

                        {/* Teacher Edit in Live Marking View (Teachers only) */}
                        {currentUser?.role === 'teacher' && onNavigateToSession && (
                          <button
                            type="button"
                            onClick={() => onNavigateToSession(session.classId, session.date, session.lectureSlotId)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-sky-800 hover:text-sky-950 bg-gradient-to-b from-sky-50 to-sky-100/80 hover:to-sky-100 border border-sky-300 shadow-xs transition-all cursor-pointer btn-tactile"
                            title="Edit or review in Dashboard"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        )}
                      </div>

                    </div>

                    {/* Visual Progress Bar of Attendance */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2.5">
                      <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${stats.presentRate}%` }}
                          title={`${stats.presentCount} Present (${stats.presentRate}%)`}
                        />
                        <div
                          className="bg-rose-500 h-full transition-all duration-300"
                          style={{ width: `${stats.absentRate}%` }}
                          title={`${stats.absentCount} Absent (${stats.absentRate}%)`}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 shrink-0 font-mono">
                        {stats.total} Enrolled
                      </span>
                    </div>

                    {/* Remarks if any */}
                    {session.remarks && (
                      <div className="mt-2 text-xs bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-slate-600 flex items-start gap-1.5">
                        <strong className="text-slate-800 shrink-0">Lecture Remarks:</strong>
                        <span className="italic">{session.remarks}</span>
                      </div>
                    )}
                  </div>

                  {/* Expanded Student Breakdown Panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4">
                      
                      {/* Roster Tab Switcher: Absent / Present / All */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setSessionRosterTab('absent')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              sessionRosterTab === 'absent'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Absent Students ({stats.absentStudents.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSessionRosterTab('present')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              sessionRosterTab === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Present Students ({stats.presentStudents.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSessionRosterTab('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              sessionRosterTab === 'all'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            <span>All Roster ({stats.total})</span>
                          </button>
                        </div>

                        {/* Lecture Meta */}
                        <div className="text-[11px] text-slate-500 font-medium">
                          Taken for {sessionDay}, {formatDateShort(session.date)}
                        </div>
                      </div>

                      {/* Tab 1: Absent Students with WhatsApp Parent Alert */}
                      {sessionRosterTab === 'absent' && (
                        <div>
                          {stats.absentStudents.length === 0 ? (
                            <div className="bg-white rounded-xl p-6 text-center border border-slate-200 space-y-1">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                              <h4 className="text-xs font-bold text-slate-800">No Absent Students!</h4>
                              <p className="text-[11px] text-slate-500">100% full attendance recorded for this lecture.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {stats.absentStudents.map((st) => (
                                <div
                                  key={st.id}
                                  className="bg-white rounded-xl p-3 border border-rose-200/80 shadow-2xs flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                        #{st.rollNo}
                                      </span>
                                      <span className="text-xs font-bold text-slate-900 truncate block">
                                        {st.name}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 block truncate mt-0.5 font-mono">
                                      Parent: {st.parentPhone || 'No contact'}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => sendAbsentParentAlert(st, session, sessionDay)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1faa4f] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-all shadow-2xs"
                                    title="Notify parent of today's absence via WhatsApp"
                                  >
                                    <Share2 className="w-3 h-3" />
                                    <span>Notify</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tab 2: Present Students */}
                      {sessionRosterTab === 'present' && (
                        <div>
                          {stats.presentStudents.length === 0 ? (
                            <div className="bg-white rounded-xl p-6 text-center border border-slate-200 space-y-1">
                              <XCircle className="w-8 h-8 text-rose-500 mx-auto" />
                              <h4 className="text-xs font-bold text-slate-800">No Present Students</h4>
                              <p className="text-[11px] text-slate-500">All students were marked absent or unmarked.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              {stats.presentStudents.map((st) => (
                                <div
                                  key={st.id}
                                  className="bg-white rounded-xl p-2.5 border border-emerald-200/80 shadow-2xs flex items-center gap-2"
                                >
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                    #{st.rollNo}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-800 truncate">
                                    {st.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tab 3: All Roster Table */}
                      {sessionRosterTab === 'all' && (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto w-full min-w-0">
                          <table className="w-full text-left text-xs min-w-[460px]">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-2.5">Roll No</th>
                                <th className="p-2.5">Student Name</th>
                                <th className="p-2.5">Status</th>
                                <th className="p-2.5">Parent Contact</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {Object.entries(session?.records || {}).map(([stId, rec]) => {
                                const st = students.find(s => s.id === stId);
                                if (!st) return null;
                                const isPresent = rec.status === 'present';
                                return (
                                  <tr key={stId} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-mono font-bold text-slate-700">#{st.rollNo}</td>
                                    <td className="p-2.5 font-semibold text-slate-900">{st.name}</td>
                                    <td className="p-2.5">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                        isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {rec.status}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-500 font-mono">{st.parentPhone || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

      </div>
    ) : (
      /* Subtle prompt when no date is selected yet */
      <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-10 text-center space-y-3 shadow-2xs">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
          <CalendarIcon className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-800">
            Click on Any Date to View Taken Attendance
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select any day on the calendar above (such as the 25th or 27th) to inspect its conducted lectures, faculty, and detailed student attendance roster.
          </p>
        </div>
      </div>
    )}

      {/* CONFIRMATION MODAL: Clear Date Attendance (HOD) */}
      {confirmClearDate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  Clear Attendance for {formatDateWithDay(confirmClearDate)}?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to permanently clear all attendance records and lectures taken on <strong className="text-slate-900">{formatDateWithDay(confirmClearDate)}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                This will delete the attendance logs for this day across all divisions. This change will be synchronized to the cloud database.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearDate(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearDateAttendance && confirmClearDate) {
                    onClearDateAttendance(confirmClearDate);
                    setConfirmClearDate(null);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear Day's Attendance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Clear Single Session */}
      {confirmClearSessionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  Delete Lecture Session?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to permanently delete this specific lecture attendance record?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearSessionId(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearSession && confirmClearSessionId) {
                    onClearSession(confirmClearSessionId);
                    setConfirmClearSessionId(null);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DECLARE HOLIDAY */}
      {isDeclareHolidayModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-gentle-pop">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-xl shadow-inner">
                  🏖️
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Declare Official Holiday</h3>
                  <p className="text-xs text-slate-500 font-semibold">{formatDateWithDay(selectedDate)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeclareHolidayModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-extrabold text-slate-700">
                Holiday Title / Occasion
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  'Institutional Holiday',
                  'Public / Festival Holiday',
                  'College Annual Day / Event',
                  'Departmental Event',
                  'Semester Vacation'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setHolidayTitleInput(preset)}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold transition-all cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={holidayTitleInput}
                onChange={(e) => setHolidayTitleInput(e.target.value)}
                placeholder="Enter holiday title e.g. Ganesh Chaturthi"
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Declaring a holiday marks this date on the campus attendance log and notifies faculty that no regular lectures are conducted on this day.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeclareHolidayModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeclareHoliday && selectedDate) {
                    onDeclareHoliday(selectedDate, holidayTitleInput || 'Declared Official Holiday');
                  }
                  setIsDeclareHolidayModalOpen(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Declare Holiday
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
