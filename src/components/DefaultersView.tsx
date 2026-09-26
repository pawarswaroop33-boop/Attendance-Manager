import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Download, 
  Calendar, 
  CalendarCheck,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  Share2,
  PhoneCall,
  UserCheck,
  Lock,
  Filter
} from 'lucide-react';
import { Student, ClassGroup, AttendanceSession, SystemSettings, AuthUser, TimetableSlot } from '../types';
import { getDayOfWeek, formatDateShort, formatDateWithDay, getSessionStats } from '../utils/dateUtils';
import { AttendanceCalendar } from './AttendanceCalendar';
import { isSessionBelongsToTeacher } from '../utils/teacherFilter';

interface DefaultersViewProps {
  students: Student[];
  classes: ClassGroup[];
  sessions: AttendanceSession[];
  settings: SystemSettings;
  onUpdateThreshold: (newThreshold: number) => void;
  userRole: 'hod' | 'teacher';
  currentUser?: AuthUser;
  timetable?: TimetableSlot[];
  onNavigateToSession?: (classId: string, date: string, lectureSlotId?: string) => void;
  onOpenWhatsAppModal?: () => void;
  onClearDateAttendance?: (dateStr: string) => void;
  onClearSession?: (sessionId: string) => void;
}

export const DefaultersView: React.FC<DefaultersViewProps> = ({
  students,
  classes,
  sessions,
  settings,
  onUpdateThreshold,
  userRole,
  currentUser,
  timetable,
  onNavigateToSession,
  onOpenWhatsAppModal,
  onClearDateAttendance,
  onClearSession
}) => {
  const [threshold, setThreshold] = useState<number>(settings.defaulterThreshold || 50);
  
  // Date selected on calendar: null on initial load so no attendance is displayed until clicked
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [hodTeacherFilter, setHodTeacherFilter] = useState<string>('all');
  
  // Defaulter search query
  const [defaulterSearchQuery, setDefaulterSearchQuery] = useState('');
  const [missingPhoneWarning, setMissingPhoneWarning] = useState<string | null>(null);
  const [sentAlerts, setSentAlerts] = useState<Record<string, boolean>>({});

  // Unique faculty list for HOD inspection
  const uniqueFacultyList = useMemo(() => {
    const facultyMap = new Map<string, string>();
    sessions.forEach(s => {
      if (s.teacherName) {
        facultyMap.set(s.teacherId || s.teacherName, s.teacherName);
      }
    });
    return Array.from(facultyMap.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  // Scoped sessions: if teacher, strictly their own sessions; if HOD, all or filtered by selected teacher
  const scopedSessions = useMemo(() => {
    if (currentUser?.role === 'teacher') {
      return sessions.filter(s => isSessionBelongsToTeacher(s, currentUser, timetable));
    }
    if (userRole === 'hod' && hodTeacherFilter !== 'all') {
      return sessions.filter(s => 
        (s.teacherId && s.teacherId === hodTeacherFilter) ||
        (s.teacherName && s.teacherName.toLowerCase().includes(hodTeacherFilter.toLowerCase()))
      );
    }
    return sessions;
  }, [sessions, currentUser, timetable, userRole, hodTeacherFilter]);

  // 1. Process Taken Attendance Sessions
  const processedSessions = useMemo(() => {
    return scopedSessions.map(session => {
      const cls = classes.find(c => c.id === session.classId) || classes[0];
      const classStudents = students.filter(s => cls?.studentIds?.includes(s.id) || false);
      const sessionDay = session.dayOfWeek || getDayOfWeek(session.date);
      const stats = getSessionStats(session, classStudents.length > 0 ? classStudents : students);

      return {
        session,
        cls,
        sessionDay,
        stats,
        formattedDate: formatDateShort(session.date),
        displayDateWithDay: formatDateWithDay(session.date, sessionDay)
      };
    }).sort((a, b) => {
      // Sort newest first by date and timestamp
      const dateCmp = b.session.date.localeCompare(a.session.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.session.lastUpdated || '').localeCompare(a.session.lastUpdated || '');
    });
  }, [scopedSessions, classes, students]);

  // 2. Compute Defaulter Student Attendance across scoped sessions
  const studentStats = useMemo(() => {
    return students.map(student => {
      const studentClasses = classes.filter(c => c.studentIds.includes(student.id));
      const primaryClass = studentClasses[0] || classes[0];

      const relevantSessions = scopedSessions.filter(s => 
        studentClasses.some(c => c.id === s.classId)
      );

      let totalLectures = 0;
      let attendedLectures = 0;

      relevantSessions.forEach(session => {
        const record = session.records[student.id];
        if (record && record.status !== 'unmarked') {
          totalLectures++;
          if (record.status === 'present') {
            attendedLectures += 1;
          } else if (record.status === 'late') {
            attendedLectures += 0.5;
          }
        }
      });

      const percentage = totalLectures > 0 ? (attendedLectures / totalLectures) * 100 : 100;
      const isDefaulter = percentage < threshold;

      return {
        student,
        primaryClass,
        totalLectures,
        attendedLectures,
        percentage: Number(percentage.toFixed(1)),
        isDefaulter,
        remarks: student.remarks || (isDefaulter ? 'Attendance below minimum campus requirement' : 'Regular')
      };
    });
  }, [students, classes, scopedSessions, threshold]);

  // Filtered defaulter list
  const defaultersList = useMemo(() => {
    return studentStats.filter(item => {
      if (!item.isDefaulter) return false;
      if (selectedClassFilter !== 'all' && item.primaryClass.id !== selectedClassFilter) return false;
      if (defaulterSearchQuery.trim()) {
        const query = defaulterSearchQuery.toLowerCase();
        const matchesName = item.student.name.toLowerCase().includes(query);
        const matchesRoll = item.student.rollNo.toLowerCase().includes(query);
        const matchesParent = (item.student.parentPhone || '').includes(query);
        if (!matchesName && !matchesRoll && !matchesParent) return false;
      }
      return true;
    }).sort((a, b) => a.percentage - b.percentage);
  }, [studentStats, selectedClassFilter, defaulterSearchQuery]);

  // Overall Campus Stats
  const campusSummary = useMemo(() => {
    const totalSessions = processedSessions.length;
    let totalPresentMarks = 0;
    let totalAbsentMarks = 0;
    let totalRecords = 0;

    processedSessions.forEach(ps => {
      totalPresentMarks += ps.stats.presentCount;
      totalAbsentMarks += ps.stats.absentCount;
      totalRecords += ps.stats.total;
    });

    const avgAttendance = totalRecords > 0 ? Math.round((totalPresentMarks / totalRecords) * 100) : 0;

    return {
      totalSessions,
      totalPresentMarks,
      totalAbsentMarks,
      avgAttendance,
      defaultersCount: defaultersList.length
    };
  }, [processedSessions, defaultersList]);

  // Handle threshold change
  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    onUpdateThreshold(val);
  };

  // WhatsApp Alert for Absent Student on specific Date & Lecture
  const sendAbsentParentAlert = (student: Student, session: AttendanceSession, sessionDay: string) => {
    const parentPhone = student.parentPhone?.replace(/\D/g, '') || '';
    if (!parentPhone) {
      setMissingPhoneWarning(`Parent contact phone number is not available for ${student.name}. Please edit student details to add a phone number.`);
      setTimeout(() => setMissingPhoneWarning(null), 5000);
      return;
    }
    setMissingPhoneWarning(null);

    const message = 
      `🚨 *DAILY ABSENT NOTICE - ${settings.collegeName}*\n\n` +
      `Dear Parent / Guardian,\n` +
      `This is to inform you that your ward:\n\n` +
      `👤 *Student:* ${student.name}\n` +
      `📋 *Roll Number:* ${student.rollNo}\n` +
      `📅 *Date:* ${formatDateShort(session.date)} (${sessionDay})\n` +
      `⏰ *Lecture:* ${session.timeSlot || session.sessionName}\n` +
      `📚 *Subject:* ${session.subject || 'Academic Lecture'}\n` +
      `👨‍🏫 *Faculty:* ${session.teacherName}\n` +
      `⚠️ *Status:* ABSENT\n\n` +
      `Please ensure regular attendance for academic compliance.\n\n` +
      `- *${settings.departmentName}*\n` +
      `${settings.collegeName}`;

    const formattedPhone = parentPhone.length === 10 ? `91${parentPhone}` : parentPhone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Defaulter WhatsApp Warning
  const createWhatsAppWarning = (item: typeof studentStats[0]) => {
    const parentPhone = item.student.parentPhone?.replace(/\D/g, '') || '';
    if (!parentPhone) {
      setMissingPhoneWarning(`Parent contact phone number is not available for ${item.student.name}. Please edit student details to add a phone number.`);
      setTimeout(() => setMissingPhoneWarning(null), 5000);
      return;
    }
    setMissingPhoneWarning(null);

    const message = 
      `🚨 *ACADEMIC ATTENDANCE ALERT - ${settings.collegeName}*\n\n` +
      `Dear Parent / Guardian,\n` +
      `This is to notify you regarding the attendance of your ward:\n\n` +
      `👤 *Student Name:* ${item.student.name}\n` +
      `📋 *Roll Number:* ${item.student.rollNo}\n` +
      `🏫 *Class/Div:* ${item.primaryClass.name}\n` +
      `📊 *Total Lectures Conducted:* ${item.totalLectures}\n` +
      `✅ *Lectures Attended:* ${item.attendedLectures}\n` +
      `⚠️ *Current Attendance:* ${item.percentage}%\n` +
      `🎯 *Mandatory Minimum Threshold:* ${threshold}%\n\n` +
      `⚠️ *Status:* Defaulter / Low Attendance\n` +
      `*Remark:* ${item.remarks}\n\n` +
      `Kindly ensure your ward attends upcoming lectures regularly to avoid being debarred from term-end exams.\n\n` +
      `- *Faculty In-Charge & HOD*\n` +
      `${settings.departmentName}\n` +
      `${settings.collegeName}`;

    const formattedPhone = parentPhone.length === 10 ? `91${parentPhone}` : parentPhone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    setSentAlerts(prev => ({ ...prev, [item.student.id]: true }));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Export Single Session to CSV
  const handleExportSessionCSV = (session: AttendanceSession, sessionDay: string) => {
    const cls = classes.find(c => c.id === session.classId) || classes[0];
    const classStudents = students.filter(s => cls?.studentIds?.includes(s.id) || false);
    const targetStudents = classStudents.length > 0 ? classStudents : students;

    const headers = ['Roll No', 'Student Name', 'Status', 'Date', 'Day', 'Subject', 'Time Slot', 'Teacher', 'Parent Phone'];
    const rows = targetStudents.map(st => {
      const rec = session.records[st.id];
      const status = rec?.status || 'unmarked';
      return [
        st.rollNo,
        `"${st.name}"`,
        status.toUpperCase(),
        session.date,
        sessionDay,
        `"${session.subject || 'Lecture'}"`,
        `"${session.timeSlot || ''}"`,
        `"${session.teacherName || ''}"`,
        `"${st.parentPhone || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${session.date}_${sessionDay}_${session.subject || 'Lecture'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Defaulters to CSV
  const handleExportDefaultersCSV = () => {
    const headers = ['Roll No', 'Student Name', 'Class', 'Total Lectures', 'Attended', 'Attendance %', 'Parent Name', 'Parent Contact', 'Remarks'];
    const rows = defaultersList.map(item => [
      item.student.rollNo,
      `"${item.student.name}"`,
      `"${item.primaryClass.name}"`,
      item.totalLectures,
      item.attendedLectures,
      `${item.percentage}%`,
      `"${item.student.parentName || 'Guardian'}"`,
      `"${item.student.parentPhone || ''}"`,
      `"${item.remarks}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DYPATIL_Defaulters_List_${threshold}percent_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-x-hidden">
      
      {/* Missing Parent Phone Warning Notice */}
      {missingPhoneWarning && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-semibold animate-fadeIn shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{missingPhoneWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setMissingPhoneWarning(null)}
            className="text-amber-600 hover:text-amber-800 font-bold px-2 py-1 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                <CalendarCheck className="w-3 h-3 text-emerald-400" />
                {currentUser?.role === 'teacher' ? 'Faculty Personal Log' : 'Permanent Cloud Storage & Roster'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {settings.collegeName}
              </span>
              {currentUser?.role === 'teacher' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  <Lock className="w-2.5 h-2.5" />
                  Restricted to your sessions
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 tracking-tight">
              <span>
                {currentUser?.role === 'teacher' 
                  ? `Attendance Log & Defaulters (${currentUser.name})`
                  : 'Attendance Log & Defaulters'}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {currentUser?.role === 'teacher'
                ? `Permanent record of all attendance sessions and defaulter rates for lectures conducted by ${currentUser.name}.`
                : 'Permanent record of all taken attendance sessions sorted by date, day, subject, faculty, present, and absent students — with the academic defaulters list below.'}
            </p>
          </div>

          {/* Quick Jump Buttons & HOD Faculty Filter */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {userRole === 'hod' && uniqueFacultyList.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-xl text-xs text-slate-200">
                <Filter className="w-3.5 h-3.5 text-sky-400" />
                <select
                  value={hodTeacherFilter}
                  onChange={(e) => setHodTeacherFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white focus:outline-hidden cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">All Faculty Members</option>
                  {uniqueFacultyList.map(f => (
                    <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <a
              href="#taken-attendance-section"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-600 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Taken Sessions ({processedSessions.length})</span>
            </a>
            <a
              href="#defaulters-section"
              className="px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-200" />
              <span>Defaulters List ({defaultersList.length})</span>
            </a>
          </div>
        </div>

        {/* 4 Summary Stat Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-700/80">
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Sessions Conducted</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-white">{campusSummary.totalSessions}</span>
              <span className="text-xs text-slate-400 font-medium">lectures</span>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Average Attendance</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-emerald-400">{campusSummary.avgAttendance}%</span>
              <span className="text-xs text-slate-400 font-medium">overall</span>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Total Present / Absent</span>
            <div className="flex items-baseline gap-2 text-xs font-bold">
              <span className="text-emerald-400">{campusSummary.totalPresentMarks} P</span>
              <span className="text-slate-500">•</span>
              <span className="text-rose-400">{campusSummary.totalAbsentMarks} A</span>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Defaulters (&lt;{threshold}%)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-rose-400">{campusSummary.defaultersCount}</span>
              <span className="text-xs text-slate-400 font-medium">students</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: TAKEN ATTENDANCE REGISTER & CALENDAR (Date, Day, Present, Absent) */}
      {/* ========================================================================= */}
      <div id="taken-attendance-section" className="space-y-4">
        
        {/* Section Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Taken Attendance Calendar
              </h2>
              <p className="text-xs text-slate-500">
                {currentUser?.role === 'teacher'
                  ? `Interactive monthly calendar showing attendance for lectures conducted by ${currentUser.name}. Click any date to view lecture details.`
                  : 'Interactive monthly calendar of taken attendance. Click any date to view conducted lectures and student attendance.'}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Calendar Component */}
        <AttendanceCalendar
          sessions={scopedSessions}
          classes={classes}
          students={students}
          settings={settings}
          selectedDate={calendarSelectedDate}
          onSelectDate={(dateStr) => setCalendarSelectedDate(dateStr)}
          onNavigateToSession={currentUser?.role === 'teacher' ? onNavigateToSession : undefined}
          onExportSessionCSV={handleExportSessionCSV}
          sendAbsentParentAlert={sendAbsentParentAlert}
          onClearDateAttendance={onClearDateAttendance}
          onClearSession={onClearSession}
          currentUser={currentUser}
          timetable={timetable}
        />

      </div>

      {/* ========================================================================= */}
      {/* SECTION 2 (BOTTOM): DEFAULTER STUDENTS (< {threshold}% Overall Attendance)  */}
      {/* ========================================================================= */}
      <div id="defaulters-section" className="space-y-4 pt-6 border-t-2 border-slate-200">
        
        {/* Defaulter Configuration Card */}
        <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rose-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Academic Defaulters List (&lt; {threshold}% Attendance)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Students whose cumulative attendance across all lectures is below the cutoff threshold
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Percentage Presets */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Threshold:</span>
              {[50, 60, 65, 75].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleThresholdChange(val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    threshold === val
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Slider & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="defaulter-threshold-range" className="font-bold text-slate-700">
                  Cutoff Slider:
                </label>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  &lt; {threshold}% Attendance
                </span>
              </div>
              <input
                id="defaulter-threshold-range"
                type="range"
                min="30"
                max="90"
                step="5"
                value={threshold}
                onChange={(e) => handleThresholdChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>30%</span>
                <span>50% (Standard)</span>
                <span>75% (Mandatory)</span>
                <span>90%</span>
              </div>
            </div>

            {/* Export Defaulters CSV Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleExportDefaultersCSV}
                disabled={defaultersList.length === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Defaulters CSV</span>
              </button>
            </div>
          </div>

          {/* Defaulter Search Input */}
          <div className="pt-2 border-t border-slate-100">
            <div className="relative max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={defaulterSearchQuery}
                onChange={(e) => setDefaulterSearchQuery(e.target.value)}
                placeholder="Search defaulters by name or roll number..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Defaulters Table / List */}
        {defaultersList.length === 0 ? (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-bold text-emerald-950">No Defaulters Found!</h3>
            <p className="text-xs text-emerald-700 max-w-md mx-auto">
              All students meet or exceed the {threshold}% minimum attendance requirement based on recorded sessions.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-rose-50/60 border-b border-rose-200 flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900">
                {defaultersList.length} Students Flagged as Defaulters
              </span>
              <span className="text-[11px] text-rose-700 font-medium">
                Action: Send WhatsApp warnings to parents
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {defaultersList.map((item) => {
                const isSent = sentAlerts[item.student.id];

                return (
                  <div
                    key={item.student.id}
                    className="p-4 hover:bg-rose-50/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        #{item.student.rollNo}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                            {item.student.name}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold shrink-0">
                            {item.primaryClass.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Attended: <strong>{item.attendedLectures} / {item.totalLectures}</strong></span>
                          <span>&bull;</span>
                          <span>Parent: {item.student.parentPhone || 'No phone'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Attendance Percentage & WhatsApp Action */}
                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      
                      {/* Attendance Percentage Badge */}
                      <div className="text-right">
                        <span className="text-base sm:text-lg font-black text-rose-600 block">
                          {item.percentage}%
                        </span>
                        <span className="text-[10px] text-rose-700 font-bold block uppercase tracking-wider">
                          Defaulter
                        </span>
                      </div>

                      {/* WhatsApp Parent Alert Button */}
                      <button
                        type="button"
                        onClick={() => createWhatsAppWarning(item)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                          isSent
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-[#25D366] hover:bg-[#1faa4f] text-white active:scale-95'
                        }`}
                        title="Send Official Defaulter Warning Notice via WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{isSent ? 'Sent ✓' : 'Alert Parent'}</span>
                      </button>

                      {/* Direct Call Button */}
                      {item.student.parentPhone && (
                        <a
                          href={`tel:${item.student.parentPhone}`}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                          title="Call Parent Phone"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
