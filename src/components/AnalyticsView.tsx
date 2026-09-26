import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Share2, 
  MessageSquare, 
  Filter, 
  ArrowUpDown,
  Search,
  Award
} from 'lucide-react';
import { AttendanceSession, ClassGroup, Student, AuthUser, TimetableSlot } from '../types';
import { generateAnalyticsReportMessage, generateDefaulterWarningMessage, shareToWhatsApp } from '../utils/whatsapp';
import { isSessionBelongsToTeacher } from '../utils/teacherFilter';
import { isLegacyDummySession } from '../utils/dateUtils';

interface AnalyticsViewProps {
  sessions: AttendanceSession[];
  currentClass: ClassGroup;
  allStudents?: Student[];
  students?: Student[];
  onOpenWhatsApp: () => void;
  currentUser?: AuthUser;
  timetable?: TimetableSlot[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  sessions,
  currentClass,
  allStudents = [],
  students = [],
  onOpenWhatsApp,
  currentUser,
  timetable
}) => {
  const [filterThreshold, setFilterThreshold] = useState<'all' | 'defaulters' | 'stars'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'rollNo' | 'name' | 'rate'>('rate');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeDateTooltip, setActiveDateTooltip] = useState<number | null>(null);

  const rawStudents = allStudents.length > 0 ? allStudents : students;

  // Filter sessions strictly for the current class and logged-in teacher (if applicable), excluding dummy sessions
  const classSessions = useMemo(() => {
    return sessions
      .filter(s => !isLegacyDummySession(s))
      .filter(s => s.classId === currentClass.id)
      .filter(s => {
        if (currentUser?.role === 'teacher') {
          return isSessionBelongsToTeacher(s, currentUser, timetable);
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, currentClass.id, currentUser, timetable]);

  // Students belonging to current class
  const classStudents = useMemo(() => {
    return rawStudents.filter(s => currentClass.studentIds.includes(s.id));
  }, [rawStudents, currentClass]);

  // Comprehensive calculation of attendance metrics per student
  const studentStats = useMemo(() => {
    const totalSessions = classSessions.length;

    return classStudents.map(student => {
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let excusedDays = 0;

      classSessions.forEach(session => {
        const record = session?.records?.[student.id];
        const status = record?.status || 'absent';

        if (status === 'present') presentDays++;
        else if (status === 'absent') absentDays++;
        else if (status === 'late') lateDays++;
        else if (status === 'excused') excusedDays++;
      });

      // Attendance rate formula: (present + late + excused) / totalSessions
      const attended = presentDays + lateDays + excusedDays;
      const rate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 100;

      return {
        student,
        totalSessions,
        presentDays,
        absentDays,
        lateDays,
        excusedDays,
        rate
      };
    });
  }, [classSessions, classStudents]);

  // Class summary statistics
  const summaryKPIs = useMemo(() => {
    if (studentStats.length === 0 || classSessions.length === 0) {
      return { avgRate: 0, defaultersCount: 0, starsCount: 0, totalRecords: 0 };
    }

    const totalRate = studentStats.reduce((acc, s) => acc + s.rate, 0);
    const avgRate = Math.round(totalRate / studentStats.length);
    const defaultersCount = studentStats.filter(s => s.rate < 75).length;
    const starsCount = studentStats.filter(s => s.rate >= 95).length;
    const totalRecords = classSessions.length * studentStats.length;

    return { avgRate, defaultersCount, starsCount, totalRecords };
  }, [studentStats, classSessions]);

  // Trend data for past sessions
  const trendData = useMemo(() => {
    return classSessions.map(session => {
      let present = 0;
      const total = classStudents.length;

      classStudents.forEach(st => {
        const rec = session?.records?.[st.id];
        if (rec?.status === 'present' || rec?.status === 'late' || rec?.status === 'excused') {
          present++;
        }
      });

      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return {
        date: session.date,
        formattedDate: formatDateReadable(session.date),
        rate,
        present,
        total
      };
    });
  }, [classSessions, classStudents]);

  // Day of week analysis with full day names
  const dayOfWeekStats = useMemo(() => {
    const days = [
      { key: 'Mon', label: 'Monday' },
      { key: 'Tue', label: 'Tuesday' },
      { key: 'Wed', label: 'Wednesday' },
      { key: 'Thu', label: 'Thursday' },
      { key: 'Fri', label: 'Friday' },
      { key: 'Sat', label: 'Saturday' }
    ];
    const buckets: Record<string, { totalRate: number; count: number }> = {};
    days.forEach(d => { buckets[d.key] = { totalRate: 0, count: 0 }; });

    trendData.forEach(item => {
      const [y, m, d] = item.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayKey = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      if (buckets[dayKey]) {
        buckets[dayKey].totalRate += item.rate;
        buckets[dayKey].count += 1;
      }
    });

    return days.map(({ key, label }) => {
      const b = buckets[key];
      const avg = b.count > 0 ? Math.round(b.totalRate / b.count) : 0;
      return { key, label, avg, count: b.count };
    });
  }, [trendData]);

  // Filtered students in table
  const filteredStudentStats = useMemo(() => {
    return studentStats.filter(item => {
      if (filterThreshold === 'defaulters' && item.rate >= 75) return false;
      if (filterThreshold === 'stars' && item.rate < 95) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.student.name.toLowerCase().includes(query);
        const matchesRoll = item.student.rollNo.toLowerCase().includes(query);
        return matchesName || matchesRoll;
      }

      return true;
    }).sort((a, b) => {
      let diff = 0;
      if (sortField === 'rate') diff = a.rate - b.rate;
      else if (sortField === 'rollNo') diff = a.student.rollNo.localeCompare(b.student.rollNo, undefined, { numeric: true });
      else if (sortField === 'name') diff = a.student.name.localeCompare(b.student.name);

      return sortAsc ? diff : -diff;
    });
  }, [studentStats, filterThreshold, searchQuery, sortField, sortAsc]);

  const toggleSort = (field: 'rollNo' | 'name' | 'rate') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleShareAnalyticsSummary = () => {
    const defaulters = studentStats.filter(s => s.rate < 75).map(s => s.student);
    const msg = generateAnalyticsReportMessage(
      currentClass,
      summaryKPIs.avgRate,
      classSessions.length,
      defaulters
    );
    shareToWhatsApp(msg);
  };

  const handleSendDefaulterWhatsApp = (student: Student, rate: number) => {
    const msg = generateDefaulterWarningMessage(student, currentClass, rate);
    shareToWhatsApp(msg, student.parentPhone);
  };

  function formatDateReadable(dateStr: string) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner with WhatsApp Export */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Attendance Analytics & Reports
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
              {currentClass.name}
            </span>
            {currentUser?.role === 'teacher' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Faculty: {currentUser.name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track student attendance patterns, identify students requiring attention, and export records directly to WhatsApp.
          </p>
        </div>

        <button
          id="share-analytics-summary-button"
          type="button"
          onClick={handleShareAnalyticsSummary}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1faa4f] text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Share2 className="w-4 h-4" />
          <span>Share Analytics on WhatsApp</span>
        </button>
      </div>

      {/* 4 Summary Metric Cards - Compact on Mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        
        {/* Class Average */}
        <div className="bg-white p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs sm:shadow-xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] sm:text-xs font-bold text-slate-600 truncate">Class Average</span>
            <span className="w-5 h-5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 pt-0.5 sm:pt-1">
            <span className={`text-lg sm:text-3xl font-extrabold tracking-tight ${summaryKPIs.avgRate >= 80 ? 'text-emerald-700' : 'text-slate-800'}`}>
              {summaryKPIs.avgRate}%
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500">Attendance</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 pt-1 sm:pt-2 border-t border-slate-100 flex items-center gap-1.5 truncate">
            <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">Benchmark: 75% min</span>
          </div>
        </div>

        {/* Total Sessions Conducted */}
        <div className="bg-white p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs sm:shadow-xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] sm:text-xs font-bold text-slate-600 truncate">Total Sessions</span>
            <span className="w-5 h-5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 pt-0.5 sm:pt-1">
            <span className="text-lg sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {classSessions.length}
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 truncate">Days Recorded</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 pt-1 sm:pt-2 border-t border-slate-100 truncate">
            {classStudents.length} Students Enrolled
          </div>
        </div>

        {/* Defaulters (<75%) */}
        <div className="bg-white p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-rose-300 shadow-2xs sm:shadow-xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-[10px] sm:text-xs font-bold truncate">Defaulters (&lt;75%)</span>
            <span className="w-5 h-5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-rose-100 flex items-center justify-center text-rose-800 shrink-0">
              <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-1 sm:gap-2 pt-0.5 sm:pt-1">
            <span className="text-lg sm:text-3xl font-extrabold text-rose-700 tracking-tight">
              {summaryKPIs.defaultersCount}
            </span>
            <span className="text-[9px] sm:text-xs font-bold px-1 sm:px-2 py-0.2 sm:py-0.5 rounded-md sm:rounded-lg bg-rose-100 text-rose-800 whitespace-nowrap">
              Action Req.
            </span>
          </div>
          <div className="text-[10px] sm:text-xs text-rose-700 pt-1 sm:pt-2 border-t border-rose-100 truncate">
            Below 75% threshold
          </div>
        </div>

        {/* High Attendance (>=95%) */}
        <div className="bg-white p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-emerald-300 shadow-2xs sm:shadow-xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[10px] sm:text-xs font-bold truncate">Stars (&ge;95%)</span>
            <span className="w-5 h-5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <Award className="w-3 h-3 sm:w-4 sm:h-4" />
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-1 sm:gap-2 pt-0.5 sm:pt-1">
            <span className="text-lg sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
              {summaryKPIs.starsCount}
            </span>
            <span className="text-[9px] sm:text-xs font-bold px-1 sm:px-2 py-0.2 sm:py-0.5 rounded-md sm:rounded-lg bg-emerald-100 text-emerald-800 whitespace-nowrap">
              High Attendance
            </span>
          </div>
          <div className="text-[10px] sm:text-xs text-emerald-800 pt-1 sm:pt-2 border-t border-emerald-100 truncate">
            Eligible for recognition
          </div>
        </div>

      </div>

      {/* Visual Charts Grid: 14-Day Attendance Trend & Day-of-Week Pattern */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Trend Line Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attendance Rate Trend</h3>
              <p className="text-xs text-slate-500">Daily attendance percentage across recorded sessions</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                Daily Attendance
              </span>
              <span className="flex items-center gap-1.5 text-rose-700 font-bold whitespace-nowrap">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500 shrink-0"></span>
                75% Minimum
              </span>
            </div>
          </div>

          {/* SVG Trend Chart */}
          <div className="h-56 w-full pt-4 relative select-none">
            {trendData.length > 0 ? (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference lines */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="140" x2="500" y2="140" stroke="#f1f5f9" strokeWidth="1" />

                {/* 75% benchmark line */}
                <line 
                  x1="0" 
                  y1={20 + (100 - 75) * 1.2} 
                  x2="500" 
                  y2={20 + (100 - 75) * 1.2} 
                  stroke="#dc2626" 
                  strokeWidth="1.5" 
                  strokeDasharray="4 4" 
                />

                {(() => {
                  const points = trendData.map((d, i) => {
                    const x = trendData.length > 1 ? (i / (trendData.length - 1)) * 500 : 250;
                    const y = 20 + (100 - d.rate) * 1.2;
                    return `${x},${y}`;
                  }).join(' ');

                  const areaPoints = `0,140 ${points} 500,140`;

                  return (
                    <>
                      <polygon points={areaPoints} fill="url(#trendGradient)" />
                      <polyline
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.5"
                        points={points}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {trendData.map((d, i) => {
                        const x = trendData.length > 1 ? (i / (trendData.length - 1)) * 500 : 250;
                        const y = 20 + (100 - d.rate) * 1.2;
                        const isHovered = activeDateTooltip === i;

                        return (
                          <g key={i} className="cursor-pointer" onMouseEnter={() => setActiveDateTooltip(i)}>
                            <circle
                              cx={x}
                              cy={y}
                              r={isHovered ? 5.5 : 3.5}
                              className={`transition-all ${
                                d.rate >= 75 ? 'fill-emerald-600 stroke-white' : 'fill-rose-600 stroke-white'
                              }`}
                              strokeWidth="2"
                            />
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No session records yet
              </div>
            )}

            {/* Hover Tooltip */}
            {activeDateTooltip !== null && trendData[activeDateTooltip] && (
              <div className="absolute top-2 right-2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-xl shadow-lg pointer-events-none flex items-center gap-2">
                <span className="font-semibold">{trendData[activeDateTooltip].formattedDate}:</span>
                <span className="font-bold text-emerald-400">{trendData[activeDateTooltip].rate}%</span>
                <span className="text-slate-300">({trendData[activeDateTooltip].present} Present / {trendData[activeDateTooltip].total} Total)</span>
              </div>
            )}
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
            <span>First: {trendData[0]?.formattedDate || 'Start'}</span>
            <span>Latest: {trendData[trendData.length - 1]?.formattedDate || 'Today'}</span>
          </div>
        </div>

        {/* Day-of-the-Week Breakdown (4 cols) with FULL Words */}
        <div className="lg:col-span-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Day-of-Week Patterns</h3>
            <p className="text-xs text-slate-500">Average attendance breakdown by day of the week</p>
          </div>

          <div className="space-y-2.5 my-2">
            {dayOfWeekStats.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">({item.count} classes)</span>
                    <span className={`font-bold ${item.avg >= 85 ? 'text-emerald-700' : item.avg >= 75 ? 'text-slate-800' : 'text-rose-700'}`}>
                      {item.avg}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.avg >= 85 ? 'bg-emerald-600' : item.avg >= 75 ? 'bg-slate-700' : 'bg-rose-600'
                    }`}
                    style={{ width: `${item.avg}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Minimum standard: 75%</span>
            <span className="font-semibold text-slate-700">{summaryKPIs.totalRecords} total entries</span>
          </div>
        </div>

      </div>

      {/* Student Attendance Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Controls */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Student Attendance Breakdown</h3>
            <p className="text-xs text-slate-500">Cumulative record for {currentClass.name}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search within table */}
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or roll..."
                className="w-full sm:w-56 bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Filter by Threshold Tabs with Full Words */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto no-scrollbar max-w-full shrink-0">
              <button
                type="button"
                onClick={() => setFilterThreshold('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 text-xs ${
                  filterThreshold === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Students
              </button>
              <button
                type="button"
                onClick={() => setFilterThreshold('defaulters')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 text-xs ${
                  filterThreshold === 'defaulters' ? 'bg-rose-600 text-white' : 'text-rose-800 hover:bg-rose-50'
                }`}
              >
                Defaulters (&lt;75%)
              </button>
              <button
                type="button"
                onClick={() => setFilterThreshold('stars')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 text-xs ${
                  filterThreshold === 'stars' ? 'bg-emerald-600 text-white' : 'text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                Stars (&ge;95%)
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Student Cards (Visible on screens < 768px) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredStudentStats.length === 0 ? (
            <div className="py-10 text-center text-slate-500 font-medium text-xs">
              No students match your filter criteria.
            </div>
          ) : (
            filteredStudentStats.map(({ student, presentDays, absentDays, lateDays, rate, totalSessions }) => {
              const isDefaulter = totalSessions > 0 && rate < 75;
              const isStar = totalSessions > 0 && rate >= 95;

              return (
                <div key={student.id} className="p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                        #{student.rollNo}
                      </span>
                      <div className="w-7 h-7 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {student.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 truncate block">{student.name}</span>
                        {student.parentName && (
                          <span className="text-[11px] text-slate-400 truncate block">Parent: {student.parentName}</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isDefaulter ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Critical</span>
                        </span>
                      ) : isStar ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 whitespace-nowrap">
                          <Award className="w-3 h-3" />
                          <span>High</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 whitespace-nowrap">
                          <CheckCircle className="w-3 h-3 text-slate-500" />
                          <span>Regular</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attendance Rate Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Attendance Rate</span>
                      <span className={`font-bold ${isDefaulter ? 'text-rose-700' : isStar ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {totalSessions > 0 ? `${rate}%` : 'No sessions'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isDefaulter ? 'bg-rose-600' : isStar ? 'bg-emerald-600' : 'bg-slate-700'
                        }`}
                        style={{ width: `${totalSessions > 0 ? rate : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Counts Row & Defaulter Action */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {presentDays}/{totalSessions} Present
                      </span>
                      <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        {absentDays} Absent
                      </span>
                      {lateDays > 0 && (
                        <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {lateDays} Late
                        </span>
                      )}
                    </div>

                    {isDefaulter && student.parentPhone && (
                      <button
                        type="button"
                        onClick={() => handleSendDefaulterWhatsApp(student, rate)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] transition-colors cursor-pointer shrink-0"
                      >
                        <MessageSquare className="w-3 h-3 text-[#25D366]" />
                        <span>Alert Parent</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (Hidden on screens < 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('rollNo')}>
                  <div className="flex items-center gap-1">
                    <span>Roll Number</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1">
                    <span>Student Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Present Days</th>
                <th className="py-3.5 px-4">Absent Days</th>
                <th className="py-3.5 px-4">Late Days</th>
                <th className="py-3.5 px-4 w-48 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('rate')}>
                  <div className="flex items-center gap-1">
                    <span>Attendance Rate</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Attendance Status</th>
                <th className="py-3.5 px-4 text-right">Parent Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudentStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500 font-medium">
                    No students match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudentStats.map(({ student, presentDays, absentDays, lateDays, rate, totalSessions }) => {
                  const isDefaulter = totalSessions > 0 && rate < 75;
                  const isStar = totalSessions > 0 && rate >= 95;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">#{student.rollNo}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {student.name.slice(0, 1)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">{student.name}</span>
                            {student.parentName && (
                              <span className="block text-[11px] text-slate-400">Parent: {student.parentName}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">{presentDays} / {totalSessions}</td>
                      <td className="py-3.5 px-4 font-bold text-rose-700">{absentDays}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600">{lateDays}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isDefaulter ? 'bg-rose-600' : isStar ? 'bg-emerald-600' : 'bg-slate-700'
                              }`}
                              style={{ width: `${totalSessions > 0 ? rate : 0}%` }}
                            ></div>
                          </div>
                          <span className={`font-bold text-xs ${
                            isDefaulter ? 'text-rose-700' : isStar ? 'text-emerald-700' : 'text-slate-800'
                          }`}>
                            {totalSessions > 0 ? `${rate}%` : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isDefaulter ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Critical Attendance</span>
                          </span>
                        ) : isStar ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">
                            <Award className="w-3 h-3" />
                            <span>High Attendance</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                            <CheckCircle className="w-3 h-3 text-slate-500" />
                            <span>Regular Attendance</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isDefaulter && student.parentPhone ? (
                          <button
                            type="button"
                            onClick={() => handleSendDefaulterWhatsApp(student, rate)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] transition-colors cursor-pointer"
                            title="Send Attendance Warning to Parent"
                          >
                            <MessageSquare className="w-3 h-3 text-[#25D366]" />
                            <span>Alert Parent</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
