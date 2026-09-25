import React, { useState, useMemo } from 'react';
import { 
  Check, 
  X, 
  Clock, 
  Search, 
  CheckSquare, 
  Square, 
  Share2, 
  MessageSquare, 
  Edit3, 
  Phone, 
  FileText, 
  UserCheck, 
  UserX, 
  Sparkles, 
  Save, 
  CalendarCheck, 
  CheckCircle2, 
  ArrowRight,
  CalendarOff,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Layers,
  MapPin,
  Calendar as CalendarIcon,
  User,
  GraduationCap,
  Fingerprint,
  Hash,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AttendanceSession, ClassGroup, Student, AttendanceStatus, AuthUser, TimetableSlot } from '../types';
import { generateParentAlertMessage, shareToWhatsApp } from '../utils/whatsapp';
import { formatDateWithDay, formatDateShort, getDayOfWeek } from '../utils/dateUtils';
import { getNextLectureDateForUser } from '../utils/teacherFilter';
import { biometricService } from '../services/biometricService';

interface LiveDashboardProps {
  session: AttendanceSession;
  currentClass: ClassGroup;
  allStudents: Student[];
  onUpdateRecord: (studentId: string, status: AttendanceStatus, note?: string) => void;
  onBatchUpdate: (status: AttendanceStatus) => void;
  onInvertSelection?: () => void;
  onUpdateSessionRemarks: (remarks: string) => void;
  onOpenWhatsApp: () => void;
  onSaveAttendancePermanently?: () => void;
  onNavigateToRegister?: () => void;
  currentUser?: AuthUser;
  timetable?: TimetableSlot[];
  selectedDate: string;
  hasLectureOnDate?: boolean;
  dayLectures?: TimetableSlot[];
  activeLectureSlotId?: string;
  activeSlot?: TimetableSlot;
  onSelectLectureSlot?: (slotId: string) => void;
  onNavigateToTimetable?: () => void;
  onSelectDate?: (date: string) => void;
  onOpenBiometrics?: () => void;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({
  session,
  currentClass,
  allStudents,
  onUpdateRecord,
  onBatchUpdate,
  onInvertSelection,
  onUpdateSessionRemarks,
  onOpenWhatsApp,
  onSaveAttendancePermanently,
  onNavigateToRegister,
  currentUser,
  timetable = [],
  selectedDate,
  hasLectureOnDate = true,
  dayLectures = [],
  activeLectureSlotId,
  activeSlot,
  onSelectLectureSlot,
  onNavigateToTimetable,
  onSelectDate,
  onOpenBiometrics
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'unmarked'>('all');
  const [activeNoteStudentId, setActiveNoteStudentId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [attendanceMode, setAttendanceMode] = useState<'normal' | 'manual-roll'>('normal');
  const [manualRollInput, setManualRollInput] = useState('');
  const [rollFeedback, setRollFeedback] = useState<{ message: string; type: 'success' | 'error'; student?: Student } | null>(null);

  // Check if current faculty has enrolled their biometric on this browser
  const isTeacherBiometricEnrolled = useMemo(() => {
    if (!currentUser) return false;
    return (
      (currentUser.uniqueCode && biometricService.isUserEnrolled(currentUser.uniqueCode)) ||
      biometricService.isUserEnrolled(currentUser.id) ||
      biometricService.isUserEnrolled(currentUser.name)
    );
  }, [currentUser]);

  const dayOfWeek = getDayOfWeek(selectedDate);
  const nextLectureDate = useMemo(() => {
    return getNextLectureDateForUser(selectedDate, currentUser, timetable, currentClass?.id);
  }, [selectedDate, currentUser, timetable, currentClass?.id]);

  // Resolve the active lecture with proper timing and details
  const currentLecture = useMemo(() => {
    if (activeSlot) return activeSlot;
    if (activeLectureSlotId && timetable.length > 0) {
      const found = timetable.find(s => s.id === activeLectureSlotId);
      if (found) return found;
    }
    if (dayLectures.length > 0) {
      return dayLectures[0];
    }
    return undefined;
  }, [activeSlot, activeLectureSlotId, timetable, dayLectures]);

  // Class students
  const classStudents = useMemo(() => {
    return allStudents.filter(s => currentClass.studentIds.includes(s.id));
  }, [allStudents, currentClass]);

  // Real-time calculation of counts
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let unmarked = 0;

    classStudents.forEach(st => {
      const rec = session.records[st.id];
      const status = rec?.status || 'unmarked';
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
      else if (status === 'excused') excused++;
      else unmarked++;
    });

    const total = classStudents.length;
    const presentRate = total > 0 ? Math.round((present / total) * 100) : 0;
    const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0;
    const lateRate = total > 0 ? Math.round((late / total) * 100) : 0;

    return { total, present, absent, late, excused, unmarked, presentRate, absentRate, lateRate };
  }, [classStudents, session.records]);

  // Filter students based on search and status
  const filteredStudents = useMemo(() => {
    return classStudents.filter(st => {
      const rec = session.records[st.id];
      const status = rec?.status || 'unmarked';

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = st.name.toLowerCase().includes(query);
        const matchesRoll = st.rollNo.toLowerCase().includes(query);
        const matchesParent = st.parentName?.toLowerCase().includes(query) || false;
        return matchesName || matchesRoll || matchesParent;
      }

      return true;
    });
  }, [classStudents, session.records, statusFilter, searchQuery]);

  // Tapping student row toggles attendance (unmarked -> present -> absent -> present)
  const handleTogglePresent = (studentId: string) => {
    const currentRec = session.records[studentId];
    const currentStatus = currentRec?.status || 'unmarked';
    let nextStatus: AttendanceStatus = 'present';
    if (currentStatus === 'present') {
      nextStatus = 'absent';
    } else if (currentStatus === 'absent') {
      nextStatus = 'present';
    } else {
      nextStatus = 'present';
    }
    onUpdateRecord(studentId, nextStatus, currentRec?.note);

    if (nextStatus === 'present' && stats.present + 1 === stats.total && stats.total > 0) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
  };

  const handleSetStatus = (studentId: string, status: AttendanceStatus, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentRec = session.records[studentId];
    const currentStatus = currentRec?.status || 'unmarked';
    // If clicking the active status, toggle back to unmarked (blank)
    const nextStatus: AttendanceStatus = currentStatus === status ? 'unmarked' : status;
    onUpdateRecord(studentId, nextStatus, currentRec?.note);
  };

  const handleOpenNoteModal = (studentId: string, currentNote?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveNoteStudentId(studentId);
    setNoteText(currentNote || '');
  };

  const handleSaveNote = () => {
    if (activeNoteStudentId) {
      const currentRec = session.records[activeNoteStudentId];
      const status = currentRec?.status || 'unmarked';
      onUpdateRecord(activeNoteStudentId, status, noteText.trim() ? noteText.trim() : undefined);
      setActiveNoteStudentId(null);
      setNoteText('');
    }
  };

  const handleSendParentWhatsApp = (student: Student, status: AttendanceStatus, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const msg = generateParentAlertMessage(student, status, session.date, currentClass);
    shareToWhatsApp(msg, student.parentPhone);
  };

  const handleMarkAllPresentWithFeedback = () => {
    onBatchUpdate('present');
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const handleClearAll = () => {
    setStatusFilter('all');
    onBatchUpdate('unmarked');
  };

  // Sorted students in numerical roll-number order
  const sortedClassStudents = useMemo(() => {
    return [...classStudents].sort((a, b) => {
      const numA = parseInt(a.rollNo.replace(/\D/g, ''), 10);
      const numB = parseInt(b.rollNo.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
    });
  }, [classStudents]);

  // Helper to match student by roll number
  const findStudentByRoll = (query: string): Student | undefined => {
    const clean = query.trim().replace(/^#/, '');
    if (!clean) return undefined;
    return classStudents.find(s => {
      const sRoll = s.rollNo.trim().replace(/^#/, '');
      if (sRoll.toLowerCase() === clean.toLowerCase()) return true;
      const num1 = parseInt(sRoll, 10);
      const num2 = parseInt(clean, 10);
      if (!isNaN(num1) && !isNaN(num2) && num1 === num2) return true;
      return false;
    });
  };

  // Rapid roll number submit handler (supports single, comma-separated, and range e.g. 1-10)
  const handleMarkRollNumbers = (e?: React.FormEvent) => {
    e?.preventDefault();
    const rawTokens = manualRollInput.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
    if (rawTokens.length === 0) return;

    let markedCount = 0;
    let lastStudent: Student | undefined;
    const errors: string[] = [];

    // Expand ranges like "1-5" or single tokens
    const expandedTokens: string[] = [];
    rawTokens.forEach(tok => {
      if (tok.includes('-')) {
        const parts = tok.split('-');
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end) && start <= end && end - start < 100) {
          for (let i = start; i <= end; i++) {
            expandedTokens.push(String(i));
          }
        } else {
          expandedTokens.push(tok);
        }
      } else {
        expandedTokens.push(tok);
      }
    });

    const enteredStudentIds = new Set<string>();
    expandedTokens.forEach(tok => {
      const student = findStudentByRoll(tok);
      if (student) {
        onUpdateRecord(student.id, 'present');
        markedCount++;
        lastStudent = student;
        enteredStudentIds.add(student.id);
      } else {
        errors.push(tok);
      }
    });

    // Automatically mark all un-entered students as absent
    classStudents.forEach(st => {
      if (!enteredStudentIds.has(st.id) && session.records[st.id]?.status !== 'present') {
        if (session.records[st.id]?.status !== 'absent') {
          onUpdateRecord(st.id, 'absent');
        }
      }
    });

    if (markedCount > 0) {
      if (lastStudent && markedCount === 1) {
        setRollFeedback({
          message: `Roll #${lastStudent.rollNo} (${lastStudent.name}) marked Present & saved! (Un-entered students marked Absent)`,
          type: 'success',
          student: lastStudent
        });
      } else {
        setRollFeedback({
          message: `Marked ${markedCount} student(s) as Present & saved! (Un-entered students marked Absent)`,
          type: 'success',
          student: lastStudent
        });
      }
      setManualRollInput('');

      if (stats.present + markedCount >= stats.total && stats.total > 0) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.7 }
        });
      }
    } else if (errors.length > 0) {
      setRollFeedback({
        message: `Roll number(s) not found in ${currentClass.name}: ${errors.join(', ')}`,
        type: 'error'
      });
    }
  };

  // Switch to Manual Roll mode and automatically mark un-entered students as Absent
  const handleSwitchToManualRoll = () => {
    setAttendanceMode('manual-roll');
    classStudents.forEach(st => {
      const rec = session.records[st.id];
      if (!rec || rec.status === 'unmarked') {
        onUpdateRecord(st.id, 'absent');
      }
    });
  };

  // Toggle roll number from 1-tap chip grid
  const handleToggleRollChip = (student: Student) => {
    const currentRec = session.records[student.id];
    const currentStatus = currentRec?.status || 'absent';
    const nextStatus: AttendanceStatus = currentStatus === 'present' ? 'absent' : 'present';
    onUpdateRecord(student.id, nextStatus, currentRec?.note);

    // Ensure all other un-entered students are marked absent automatically
    classStudents.forEach(st => {
      if (st.id !== student.id) {
        const rec = session.records[st.id];
        if (!rec || rec.status === 'unmarked') {
          onUpdateRecord(st.id, 'absent');
        }
      }
    });

    if (nextStatus === 'present') {
      setRollFeedback({
        message: `Roll #${student.rollNo} (${student.name}) marked Present & saved!`,
        type: 'success',
        student
      });
    } else {
      setRollFeedback({
        message: `Roll #${student.rollNo} (${student.name}) marked Absent & saved!`,
        type: 'success',
        student
      });
    }
  };

  // Mark all remaining blank students as Absent
  const handleMarkRemainingAbsent = () => {
    let count = 0;
    classStudents.forEach(st => {
      const rec = session.records[st.id];
      if (!rec || rec.status === 'unmarked') {
        onUpdateRecord(st.id, 'absent');
        count++;
      }
    });
    setRollFeedback({
      message: `Marked remaining ${count} unmarked students as Absent & saved!`,
      type: 'success'
    });
  };

  // =========================================================================
  // CASE 1: NO LECTURE ON THIS DATE (Requirement: "if i click on date and if
  // there is lecture on that day then only teacher should be able to take
  // attendance otherwise there is no lecture tody")
  // =========================================================================
  if (!hasLectureOnDate) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border-2 border-amber-200/90 p-8 sm:p-12 text-center space-y-6 shadow-sm max-w-2xl mx-auto my-6">
          <div className="w-18 h-18 rounded-3xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
            <CalendarOff className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>No Lecture Today</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              There is no lecture today
            </h2>

            <p className="text-sm font-semibold text-slate-700">
              {formatDateWithDay(selectedDate, dayOfWeek)}
            </p>

            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed pt-1">
              {currentUser?.role === 'teacher'
                ? `According to the academic timetable, you (${currentUser.name}) do not have any scheduled lectures on ${dayOfWeek}. Faculty can only take attendance on days when their lectures are scheduled.`
                : `No academic lectures are scheduled for ${currentClass.name} on ${dayOfWeek}. Attendance cannot be marked on non-lecture days.`}
            </p>
          </div>

          {/* Quick Jump Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onNavigateToTimetable && (
              <button
                type="button"
                onClick={onNavigateToTimetable}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Clock className="w-4 h-4 text-sky-400" />
                <span>View Full Weekly Timetable</span>
              </button>
            )}

            {nextLectureDate && onSelectDate && (
              <button
                type="button"
                onClick={() => onSelectDate(nextLectureDate.dateStr)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>Go to Next Lecture: {formatDateShort(nextLectureDate.dateStr)} ({nextLectureDate.dayOfWeek})</span>
              </button>
            )}

            {onSelectDate && (
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const yyyy = today.getFullYear();
                  const mm = String(today.getMonth() + 1).padStart(2, '0');
                  const dd = String(today.getDate()).padStart(2, '0');
                  onSelectDate(`${yyyy}-${mm}-${dd}`);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Jump to Today
              </button>
            )}

            {currentUser?.role === 'teacher' && onOpenBiometrics && (
              <button
                type="button"
                onClick={onOpenBiometrics}
                className="px-3.5 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Manage personal biometric fingerprint"
              >
                <Fingerprint className="w-4 h-4 text-sky-600" />
                <span>{isTeacherBiometricEnrolled ? 'Biometric ID Active' : 'Enroll My Fingerprint'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // CASE 2: LECTURE SCHEDULED ON THIS DATE - TAKE ATTENDANCE
  // ALL STUDENTS ARE BY DEFAULT PRESENT
  // =========================================================================
  return (
    <div className="space-y-2 sm:space-y-2.5">
      
      {/* ========================================================================= */}
      {/* REFINED LECTURE HERO CARD: Light Gradient with Flowing Wave Design */}
      {/* ========================================================================= */}
      {currentLecture && (
        <div className="bg-gradient-to-r from-sky-50 via-white to-blue-50/80 rounded-2xl px-4 py-3.5 sm:py-4 text-slate-800 shadow-xs border border-sky-200/80 relative overflow-hidden">
          {/* Elegant Multi-layered Wave Accent Design */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg
              className="absolute -bottom-1 left-0 right-0 w-full h-24 opacity-60"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0,32L48,42.7C96,53,192,75,288,80C384,85,480,75,576,64C672,53,768,43,864,48C960,53,1056,75,1152,80C1248,85,1344,75,1392,69.3L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
                fill="url(#wave-gradient-1)"
              />
              <path
                d="M0,64L60,58.7C120,53,240,43,360,48C480,53,600,75,720,80C840,85,960,75,1080,64C1200,53,1320,43,1380,37.3L1440,32L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z"
                fill="url(#wave-gradient-2)"
              />
              <defs>
                <linearGradient id="wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#e0e7ff" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id="wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.65" />
                  <stop offset="50%" stopColor="#dbeafe" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#ede9fe" stopOpacity="0.55" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-2">
            
            {/* Top Row Badges: Timing, Date & Day, Live Status (Centered) */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              {/* Timing Badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-xs text-sky-800 border border-sky-200 text-xs font-mono font-bold shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>{currentLecture.timeSlotLabel}</span>
              </span>

              {/* Date & Day Badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-xs text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs">
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{formatDateWithDay(selectedDate, dayOfWeek)}</span>
              </span>

              {/* Roster Attendance Badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold font-mono shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{stats.present}/{stats.total} Present</span>
              </span>
            </div>

            {/* Subject Title (Centered & Prominent) */}
            <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-600 shrink-0" />
              <span>{currentLecture.subject}</span>
            </h2>

            {/* Details Meta Row: Faculty, Room, Class, Biometric (Centered) */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-600 font-medium pt-0.5">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Faculty: <strong className="text-slate-900 font-bold">{currentLecture.teacherName}</strong></span>
              </span>

              <span className="text-slate-300 hidden sm:inline">&bull;</span>

              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Room: <strong className="text-slate-900 font-bold">{currentLecture.roomName}</strong></span>
              </span>

              <span className="text-slate-300 hidden sm:inline">&bull;</span>

              <span className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Class: <strong className="text-slate-900 font-bold">{currentLecture.className || currentClass.name}</strong></span>
              </span>

              {/* Biometric Button */}
              {currentUser?.role === 'teacher' && onOpenBiometrics && (
                <>
                  <span className="text-slate-300 hidden sm:inline">&bull;</span>
                  <button
                    type="button"
                    onClick={onOpenBiometrics}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 shadow-2xs ${
                      isTeacherBiometricEnrolled
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    }`}
                    title="Biometric Fingerprint Authentication"
                  >
                    <Fingerprint className="w-3.5 h-3.5 text-sky-600" />
                    <span>{isTeacherBiometricEnrolled ? 'Biometric ID Active' : 'Enroll Fingerprint'}</span>
                  </button>
                </>
              )}
            </div>

            {/* Multiple Lecture Slots Switcher (if teacher has >1 lecture today) */}
            {dayLectures.length > 1 && onSelectLectureSlot && (
              <div className="pt-2 mt-1 border-t border-slate-200/80 w-full flex items-center justify-center gap-2 flex-wrap text-xs">
                <span className="text-slate-500 font-semibold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-sky-600" />
                  <span>Other Slots Today:</span>
                </span>
                {dayLectures.map(slot => {
                  const isSelected = (currentLecture?.id === slot.id);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => onSelectLectureSlot(slot.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow-xs font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span className="font-mono">{slot.timeSlotLabel}</span>
                      <span className="opacity-40">&bull;</span>
                      <span className="truncate max-w-[140px]">{slot.subject}</span>
                    </button>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Dynamic Roll Call Guide Banner - Compact & Refined */}
      {stats.unmarked > 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded-md bg-slate-800 text-white flex items-center justify-center shrink-0 text-xs">
              <UserCheck className="w-3 h-3" />
            </span>
            <span className="text-xs font-bold text-slate-900 truncate">
              Roll Call:
            </span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              {stats.unmarked} of {stats.total} Unmarked
            </span>
            <span className="text-[11px] text-slate-500 hidden md:inline truncate">
              Tap row or enter roll numbers to record attendance.
            </span>
          </div>

          <button
            type="button"
            onClick={handleMarkAllPresentWithFeedback}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1 self-end sm:self-auto shrink-0"
          >
            <CheckSquare className="w-3 h-3" />
            <span>Mark All Present</span>
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 border border-emerald-300/80 rounded-xl px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-emerald-950">
                Attendance Recorded & Completed:
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 font-mono">
                {stats.present} Present &bull; {stats.absent} Absent
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-300 text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 self-end sm:self-auto shrink-0"
          >
            <X className="w-3 h-3 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>
      )}
      
      {/* Compact 4 Metric Cards Strip - Reduces vertical scroll */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        
        {/* Total Students */}
        <div className="bg-white px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 block leading-tight">Total Students</span>
            <span className="text-base sm:text-lg font-black text-slate-900 leading-tight">{stats.total}</span>
          </div>
          <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <UserCheck className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Present Students */}
        <div className="bg-white px-3 py-1.5 sm:py-2 rounded-xl border border-emerald-300 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 flex items-center gap-1 leading-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span>Present</span>
            </span>
            <div className="flex items-baseline gap-1 leading-tight">
              <span className="text-base sm:text-lg font-black text-emerald-700">{stats.present}</span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1 rounded">{stats.presentRate}%</span>
            </div>
          </div>
          <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        </div>

        {/* Absent Students */}
        <div className="bg-white px-3 py-1.5 sm:py-2 rounded-xl border border-rose-300 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-800 block leading-tight">Absent</span>
            <div className="flex items-baseline gap-1 leading-tight">
              <span className="text-base sm:text-lg font-black text-rose-700">{stats.absent}</span>
              <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1 rounded">{stats.absentRate}%</span>
            </div>
          </div>
          <span className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800 shrink-0">
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        </div>

        {/* Late / Excused / Blank */}
        <div className="bg-white px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 block leading-tight">Late / Blank</span>
            <div className="flex items-baseline gap-1 leading-tight">
              <span className="text-base sm:text-lg font-black text-slate-800">{stats.late + stats.excused}</span>
              {stats.unmarked > 0 && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1 rounded">{stats.unmarked} blank</span>
              )}
            </div>
          </div>
          <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </span>
        </div>

      </div>

      {/* 100% Attendance Notification Banner - Compact */}
      {stats.present === stats.total && stats.total > 0 && (
        <div className="bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-white">Full Attendance Today ({stats.total} students Present)</span>
          </div>
          <button
            type="button"
            onClick={onOpenWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Share2 className="w-3 h-3" />
            <span>Share WhatsApp</span>
          </button>
        </div>
      )}

      {/* Attendance Mode Switcher: Styled identically to Teacher/HOD 3D sliding button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">Attendance Taking Method</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {stats.present} Present &bull; {stats.absent} Absent &bull; {stats.unmarked} Unmarked
            </span>
          </div>
        </div>

        {/* Tactile 3D Sliding Switcher */}
        <div className="relative flex items-center p-1.5 bg-slate-200/70 rounded-full border border-slate-300/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_1px_2px_rgba(255,255,255,0.85)] text-xs font-semibold select-none w-full sm:w-80 shrink-0">
          <div
            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-full bg-gradient-to-b from-white via-white to-slate-50 border-t border-white border-b-2 border-b-slate-300 border-x border-slate-200/80 shadow-[0_4px_10px_-1px_rgba(15,23,42,0.16),0_2px_4px_-1px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,1)] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none ${
              attendanceMode === 'normal'
                ? 'left-1.5 translate-x-0'
                : 'left-1.5 translate-x-[calc(100%+6px)]'
            }`}
          />

          <button
            type="button"
            onClick={() => setAttendanceMode('normal')}
            className={`relative z-10 flex-1 py-2 px-3 rounded-full text-center transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
              attendanceMode === 'normal'
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Normal Roster</span>
          </button>

          <button
            type="button"
            onClick={handleSwitchToManualRoll}
            className={`relative z-10 flex-1 py-2 px-3 rounded-full text-center transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
              attendanceMode === 'manual-roll'
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Hash className="w-3.5 h-3.5 text-sky-600" />
            <span>Roll No. Entry</span>
          </button>
        </div>
      </div>

      {attendanceMode === 'normal' ? (
        <>
          {/* Control Bar: Search & Full-Word Filter Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          
          {/* Search Field */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="search-students"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or roll number..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Status Tabs (Full Words) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-stretch md:self-auto overflow-x-auto no-scrollbar">
            <button
              id="filter-all"
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({classStudents.length})
            </button>
            <button
              id="filter-present"
              type="button"
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'present'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              Present ({stats.present})
            </button>
            <button
              id="filter-absent"
              type="button"
              onClick={() => setStatusFilter('absent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'absent'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-800 hover:bg-rose-50'
              }`}
            >
              Absent ({stats.absent})
            </button>
            <button
              id="filter-late"
              type="button"
              onClick={() => setStatusFilter('late')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'late'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              Late ({stats.late})
            </button>
            {stats.unmarked > 0 && (
              <button
                id="filter-unmarked"
                type="button"
                onClick={() => setStatusFilter('unmarked')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === 'unmarked'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Blank ({stats.unmarked})
              </button>
            )}
          </div>
        </div>

        {/* Quick Batch Actions & Permanent Save Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500">Quick Actions:</span>
            
            <div className="grid grid-cols-3 sm:flex gap-1.5 sm:gap-2 w-full sm:w-auto">
              <button
                id="action-mark-all-present"
                type="button"
                onClick={handleMarkAllPresentWithFeedback}
                className="flex items-center justify-center gap-1 sm:gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-2 py-2 rounded-xl transition-colors cursor-pointer min-h-[40px] text-center"
                title="Mark all students as Present"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">All Present</span>
              </button>

              <button
                id="action-mark-all-absent"
                type="button"
                onClick={() => onBatchUpdate('absent')}
                className="flex items-center justify-center gap-1 sm:gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold px-2 py-2 rounded-xl transition-colors cursor-pointer min-h-[40px] text-center"
                title="Mark all students as Absent"
              >
                <Square className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="truncate">All Absent</span>
              </button>

              <button
                id="action-clear-all-blank"
                type="button"
                onClick={handleClearAll}
                className="flex items-center justify-center gap-1 sm:gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2 py-2 rounded-xl transition-colors cursor-pointer min-h-[40px] text-center"
                title="Clear all selections and reset roster"
              >
                <X className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">Clear All</span>
              </button>
            </div>
          </div>

          {/* Save Permanently Button in Action Bar */}
          {onSaveAttendancePermanently && (
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
              <button
                id="btn-save-attendance-permanently"
                type="button"
                onClick={onSaveAttendancePermanently}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                title="Save attendance permanently with Date, Day, Present and Absent list"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Attendance Permanently</span>
              </button>

              {onNavigateToRegister && (
                <button
                  type="button"
                  onClick={onNavigateToRegister}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer"
                  title="View taken records and defaulters list"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-slate-600" />
                  <span>Attendance Log</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Student Roll Call: Tactile Checkbox + Full Words (Present / Absent / Late) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table/List Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">Student Roll Call</h3>
            <p className="text-[11px] text-slate-500">
              Tap row or tap Present / Absent / Late to record attendance
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200">
            {filteredStudents.length} of {classStudents.length} students
          </span>
        </div>

        {/* Empty state */}
        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center">
            <UserX className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No students found matching your filter</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting the search box or selecting &quot;All Students&quot;.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredStudents.map((student) => {
              const rec = session.records[student.id];
              const status: AttendanceStatus = rec?.status || 'unmarked';
              const isPresent = status === 'present';
              const isAbsent = status === 'absent';
              const isLate = status === 'late';
              const isBlank = status === 'unmarked';

              return (
                <div
                  key={student.id}
                  id={`student-row-${student.id}`}
                  onClick={() => handleTogglePresent(student.id)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 sm:py-3.5 gap-2.5 transition-colors cursor-pointer select-none ${
                    isPresent
                      ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
                      : isAbsent
                      ? 'bg-rose-50/30 hover:bg-rose-50/50'
                      : isLate
                      ? 'bg-slate-100/60 hover:bg-slate-100/90'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Left: Roll No + Student Details */}
                  <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
                    
                    {/* Roll Badge */}
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      #{student.rollNo}
                    </span>

                    {/* Single unified avatar */}
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>

                    {/* Student Name & Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs sm:text-sm font-bold truncate ${isPresent ? 'text-slate-900' : 'text-slate-800'}`}>
                          {student.name}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 shrink-0">
                          {student.gender}
                        </span>
                        {isBlank && (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                            Blank
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap mt-0.5">
                        {student.parentName && (
                          <span className="truncate">Parent: {student.parentName}</span>
                        )}
                        {rec?.note && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            <FileText className="w-3 h-3 text-slate-500" />
                            <span className="truncate max-w-[120px] sm:max-w-xs">{rec.note}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Attendance Toggle Buttons & Actions */}
                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1.5 pt-1.5 sm:pt-0 border-t border-slate-100 sm:border-0" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Status Switcher */}
                    <div className="flex-1 sm:flex-initial flex items-center rounded-xl p-0.5 bg-slate-100 border border-slate-200 text-xs">
                      
                      {/* Button: Present */}
                      <button
                        type="button"
                        onClick={(e) => handleSetStatus(student.id, 'present', e)}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-lg font-bold transition-all cursor-pointer min-h-[38px] ${
                          isPresent 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-emerald-700 hover:bg-white/60'
                        }`}
                        title={isPresent ? 'Click to deselect (make blank)' : 'Mark Present'}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Present</span>
                      </button>

                      {/* Button: Absent */}
                      <button
                        type="button"
                        onClick={(e) => handleSetStatus(student.id, 'absent', e)}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-lg font-bold transition-all cursor-pointer min-h-[38px] ${
                          isAbsent 
                            ? 'bg-rose-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-rose-700 hover:bg-white/60'
                        }`}
                        title={isAbsent ? 'Click to deselect (make blank)' : 'Mark Absent'}
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Absent</span>
                      </button>

                      {/* Button: Late */}
                      <button
                        type="button"
                        onClick={(e) => handleSetStatus(student.id, 'late', e)}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2 sm:px-2.5 py-2 rounded-lg font-bold transition-all cursor-pointer min-h-[38px] ${
                          isLate 
                            ? 'bg-slate-800 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                        title={isLate ? 'Click to deselect (make blank)' : 'Mark Late'}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Late</span>
                      </button>
                    </div>

                    {/* Note Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenNoteModal(student.id, rec?.note, e)}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center ${
                        rec?.note 
                          ? 'bg-slate-100 border-slate-300 text-slate-800' 
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                      title={rec?.note ? `Note: ${rec.note}` : 'Add note/reason'}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* WhatsApp Notice for Absent Students */}
                    {isAbsent && student.parentPhone && (
                      <button
                        type="button"
                        onClick={(e) => handleSendParentWhatsApp(student, 'absent', e)}
                        className="flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 min-h-[38px]"
                        title={`Alert parent on WhatsApp: ${student.parentPhone}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Share Attendance WhatsApp Button at the End of Student List */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            <span className="font-bold text-slate-700">{filteredStudents.length}</span> students in list &bull;{' '}
            <span className="text-emerald-700 font-bold">{stats.present} Present</span>,{' '}
            <span className="text-rose-700 font-bold">{stats.absent} Absent</span>
            {stats.late > 0 && <span className="text-amber-700 font-bold">, {stats.late} Late</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {onSaveAttendancePermanently && (
              <button
                id="btn-save-attendance-permanently-footer"
                type="button"
                onClick={onSaveAttendancePermanently}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>Save Attendance Permanently</span>
              </button>
            )}
            <button
              id="share-whatsapp-button-roster"
              type="button"
              onClick={onOpenWhatsApp}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1faa4f] active:scale-95 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
      </>
      ) : (
        /* =========================================================================
           MANUAL ROLL NUMBER ENTRY CONSOLE (Streamlined, no duplicate roster)
           ========================================================================= */
        <div className="max-w-2xl mx-auto w-full space-y-3">
          
          {/* Input & Callout Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-sky-600" />
                  <span>Enter Roll Number</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Type roll numbers of present students & press Enter. Un-entered students are marked Absent automatically.
                </p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                {currentClass.name}
              </span>
            </div>

            {/* Form Input */}
            <form onSubmit={handleMarkRollNumbers} className="space-y-3">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">
                  #
                </span>
                <input
                  type="text"
                  value={manualRollInput}
                  onChange={(e) => setManualRollInput(e.target.value)}
                  placeholder="Enter Roll No (e.g. 5, 12, 14 or 1-10)..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-28 py-3 text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-hidden focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all shadow-inner"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!manualRollInput.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Mark Present</span>
                </button>
              </div>
            </form>

            {/* Feedback Alert with Direct WhatsApp Action */}
            {rollFeedback && (
              <div className={`p-3 rounded-xl border animate-fadeIn text-xs ${
                rollFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {rollFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">{rollFeedback.message}</p>
                      {rollFeedback.student && (
                        <p className="text-[11px] opacity-80 mt-0.5">
                          Parent: {rollFeedback.student.parentName || 'N/A'} &bull; Phone: {rollFeedback.student.parentPhone || 'No phone'}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRollFeedback(null)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* WhatsApp Direct Action Button */}
                {rollFeedback.student && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-200/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-emerald-800 font-semibold">Notify Parent:</span>
                    <button
                      type="button"
                      onClick={() => handleSendParentWhatsApp(rollFeedback.student!, 'present')}
                      className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1faa4f] active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
                      title="Send attendance message to parent on WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Send WhatsApp Notice</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Interactive 1-Tap Roll Number Grid */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>1-Tap Number Pad ({classStudents.length} students):</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Click chip to toggle Present / Absent</span>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-slate-50/80 rounded-xl border border-slate-200">
                {sortedClassStudents.map(student => {
                  const rec = session.records[student.id];
                  const status = rec?.status || 'absent';
                  const isPresent = status === 'present';
                  const isAbsent = status === 'absent';

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleToggleRollChip(student)}
                      title={`Roll #${student.rollNo}: ${student.name} (${status.toUpperCase()})`}
                      className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center cursor-pointer select-none active:scale-90 ${
                        isPresent
                          ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500'
                          : isAbsent
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      {student.rollNo}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions & Permanent Save Button */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                className="w-full sm:w-auto flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
                title="Reset all back to unmarked"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset</span>
              </button>

              {onSaveAttendancePermanently && (
                <button
                  type="button"
                  onClick={onSaveAttendancePermanently}
                  className="flex-1 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Attendance Permanently</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenWhatsApp}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1faa4f] active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share WhatsApp</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Class Remarks Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <label htmlFor="session-remarks" className="block text-xs font-bold text-slate-700">
          Daily Class Remarks / Homework Notice (Appears in WhatsApp summary)
        </label>
        <textarea
          id="session-remarks"
          value={session.remarks || ''}
          onChange={(e) => onUpdateSessionRemarks(e.target.value)}
          rows={2}
          placeholder="e.g. Completed Chapter 5 review exercises. Tomorrow: Physics test."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
        />
      </div>

      {/* Note Editing Modal */}
      {activeNoteStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
            <h4 className="font-bold text-sm text-slate-900 mb-1">
              Add Student Note
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              {allStudents.find(s => s.id === activeNoteStudentId)?.name}
            </p>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Medical leave, Bus delayed, Sick..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote();
                if (e.key === 'Escape') setActiveNoteStudentId(null);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveNoteStudentId(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
