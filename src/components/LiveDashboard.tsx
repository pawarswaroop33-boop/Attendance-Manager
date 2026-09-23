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
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AttendanceSession, ClassGroup, Student, AttendanceStatus } from '../types';
import { generateParentAlertMessage, shareToWhatsApp } from '../utils/whatsapp';

interface LiveDashboardProps {
  session: AttendanceSession;
  currentClass: ClassGroup;
  allStudents: Student[];
  onUpdateRecord: (studentId: string, status: AttendanceStatus, note?: string) => void;
  onBatchUpdate: (status: AttendanceStatus) => void;
  onInvertSelection?: () => void;
  onUpdateSessionRemarks: (remarks: string) => void;
  onOpenWhatsApp: () => void;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({
  session,
  currentClass,
  allStudents,
  onUpdateRecord,
  onBatchUpdate,
  onInvertSelection,
  onUpdateSessionRemarks,
  onOpenWhatsApp
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'unmarked'>('all');
  const [activeNoteStudentId, setActiveNoteStudentId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

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

  const handleTogglePresent = (studentId: string) => {
    const currentRec = session.records[studentId];
    const currentStatus = currentRec?.status || 'unmarked';
    const nextStatus: AttendanceStatus = currentStatus === 'present' ? 'unmarked' : 'present';
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
    // If clicking the active status, toggle back to unmarked (blank)
    const nextStatus: AttendanceStatus = currentRec?.status === status ? 'unmarked' : status;
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
      const status = currentRec?.status || 'absent';
      onUpdateRecord(activeNoteStudentId, status, noteText.trim() ? noteText.trim() : undefined);
      setActiveNoteStudentId(null);
      setNoteText('');
    }
  };

  const handleSendParentWhatsApp = (student: Student, status: AttendanceStatus, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* 4 Metric Cards - Clean & Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        
        {/* Total Students */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600 truncate">Total Students</span>
            <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {stats.total}
            </span>
            <span className="text-xs font-medium text-slate-500">enrolled</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 truncate">
            {currentClass.name}
          </div>
        </div>

        {/* Present Students */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-emerald-300 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
              <span>Present</span>
            </span>
            <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 tracking-tight">
              {stats.present}
            </span>
            <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
              {stats.presentRate}%
            </span>
          </div>
          <div className="pt-1 border-t border-emerald-100">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.presentRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Absent Students */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-rose-300 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 truncate">Absent</span>
            <span className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800 shrink-0">
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-extrabold text-rose-700 tracking-tight">
              {stats.absent}
            </span>
            <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
              {stats.absentRate}%
            </span>
          </div>
          <div className="pt-1 border-t border-rose-100">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-rose-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.absentRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Late / Excused */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold text-slate-700 truncate">Late / Excused</span>
            <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
              {stats.late + stats.excused}
            </span>
            <span className="text-xs font-semibold text-slate-500">recorded</span>
          </div>
          <div className="pt-1 border-t border-slate-100 text-[11px] text-slate-500 truncate">
            {stats.late} Late &bull; {stats.excused} Excused
          </div>
        </div>

      </div>

      {/* 100% Attendance Notification Banner */}
      {stats.present === stats.total && stats.total > 0 && (
        <div className="bg-slate-900 text-white p-3.5 sm:p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base text-white">Full Attendance Today!</h4>
              <p className="text-xs text-slate-300">All {stats.total} students are marked Present for {currentClass.name}.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenWhatsApp}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Full Attendance to WhatsApp</span>
          </button>
        </div>
      )}

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

        {/* Quick Batch Actions */}
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
                onClick={() => onBatchUpdate('unmarked')}
                className="flex items-center justify-center gap-1 sm:gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2 py-2 rounded-xl transition-colors cursor-pointer min-h-[40px] text-center"
                title="Clear all selections and reset roster"
              >
                <X className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">Clear All</span>
              </button>
            </div>
          </div>
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
          <button
            id="share-whatsapp-button-roster"
            type="button"
            onClick={onOpenWhatsApp}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1faa4f] active:scale-95 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Attendance on WhatsApp</span>
          </button>
        </div>
      </div>

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
