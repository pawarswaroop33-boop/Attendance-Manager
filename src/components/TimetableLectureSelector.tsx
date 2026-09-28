import React, { useState } from 'react';
import { 
  Clock, 
  Calendar, 
  BookOpen, 
  MapPin, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Filter, 
  CalendarDays, 
  Sparkles, 
  Lock, 
  UserCheck,
  Edit3,
  Trash2,
  Plus,
  Save,
  X
} from 'lucide-react';
import { TimetableSlot, AttendanceSession, DayOfWeek, AuthUser, Teacher, Classroom, ClassGroup } from '../types';
import { isSlotBelongsToTeacher } from '../utils/teacherFilter';
import { isPastDate, isFutureDate, getTodayDateStr } from '../utils/dateUtils';

interface TimetableLectureSelectorProps {
  timetable: TimetableSlot[];
  sessions: AttendanceSession[];
  currentUser: AuthUser;
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  onSelectLecture: (slot: TimetableSlot, date: string) => void;
  activeLectureSlotId?: string;
  teachers?: Teacher[];
  classrooms?: Classroom[];
  classes?: ClassGroup[];
  onUpdateTimetableSlot?: (slot: TimetableSlot) => void;
  onAddTimetableSlot?: (slot: TimetableSlot) => void;
  onDeleteTimetableSlot?: (id: string) => void;
}

const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TimetableLectureSelector: React.FC<TimetableLectureSelectorProps> = ({
  timetable,
  sessions,
  currentUser,
  selectedDate,
  onDateChange,
  onSelectLecture,
  activeLectureSlotId,
  teachers = [],
  classrooms = [],
  classes = [],
  onUpdateTimetableSlot,
  onAddTimetableSlot,
  onDeleteTimetableSlot
}) => {
  // Determine day of week from selectedDate
  const getDayOfWeek = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayIndex = d.getDay(); // 0 is Sunday
    if (dayIndex === 0) return 'Sunday';
    return DAYS_OF_WEEK[dayIndex - 1];
  };

  const currentDayOfWeek = getDayOfWeek(selectedDate);
  const [hodSelectedTeacherFilter, setHodSelectedTeacherFilter] = useState<string>('all');

  // HOD In-Place Slot Editing Modal State
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [slotDay, setSlotDay] = useState<DayOfWeek>('Monday');
  const [slotStartTime, setSlotStartTime] = useState('08:00 AM');
  const [slotEndTime, setSlotEndTime] = useState('09:00 AM');
  const [slotSubject, setSlotSubject] = useState('');
  const [slotClassId, setSlotClassId] = useState('');
  const [slotTeacherId, setSlotTeacherId] = useState('');
  const [slotRoomId, setSlotRoomId] = useState('');

  const handleOpenEditSlot = (slot: TimetableSlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSlot(slot);
    setSlotDay(slot.dayOfWeek);
    setSlotStartTime(slot.startTime);
    setSlotEndTime(slot.endTime);
    setSlotSubject(slot.subject);
    setSlotClassId(slot.classId || classes[0]?.id || '');
    setSlotTeacherId(slot.teacherId || teachers[0]?.id || '');
    setSlotRoomId(slot.roomId || classrooms[0]?.id || '');
    setShowEditModal(true);
  };

  const handleOpenAddSlot = () => {
    setEditingSlot(null);
    setSlotDay((currentDayOfWeek === 'Sunday' ? 'Monday' : currentDayOfWeek) as DayOfWeek);
    setSlotStartTime('08:00 AM');
    setSlotEndTime('09:00 AM');
    setSlotSubject('');
    setSlotClassId(classes[0]?.id || '');
    setSlotTeacherId(teachers[0]?.id || '');
    setSlotRoomId(classrooms[0]?.id || '');
    setShowEditModal(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotSubject.trim()) return;

    const selectedClass = classes.find(c => c.id === slotClassId);
    const selectedTeacher = teachers.find(t => t.id === slotTeacherId);
    const selectedRoom = classrooms.find(r => r.id === slotRoomId);

    if (editingSlot) {
      const updatedSlot: TimetableSlot = {
        ...editingSlot,
        dayOfWeek: slotDay,
        startTime: slotStartTime,
        endTime: slotEndTime,
        timeSlotLabel: `${slotStartTime} - ${slotEndTime}`,
        subject: slotSubject.trim(),
        classId: slotClassId,
        className: selectedClass?.name || editingSlot.className,
        teacherId: slotTeacherId,
        teacherName: selectedTeacher?.name || editingSlot.teacherName,
        roomId: slotRoomId,
        roomName: selectedRoom?.name || editingSlot.roomName
      };

      if (onUpdateTimetableSlot) {
        onUpdateTimetableSlot(updatedSlot);
      }
    } else {
      const newSlot: TimetableSlot = {
        id: `slot-${Date.now()}`,
        dayOfWeek: slotDay,
        startTime: slotStartTime,
        endTime: slotEndTime,
        timeSlotLabel: `${slotStartTime} - ${slotEndTime}`,
        subject: slotSubject.trim(),
        classId: slotClassId,
        className: selectedClass?.name || 'Engineering Class',
        teacherId: slotTeacherId,
        teacherName: selectedTeacher?.name || 'Faculty Member',
        roomId: slotRoomId,
        roomName: selectedRoom?.name || 'Classroom'
      };

      if (onAddTimetableSlot) {
        onAddTimetableSlot(newSlot);
      }
    }

    setShowEditModal(false);
    setEditingSlot(null);
  };

  // Filter slots for current day and user scope
  const daySlots = timetable
    .filter(slot => slot.dayOfWeek === currentDayOfWeek)
    .filter(slot => {
      // If logged in as specific teacher: STRICTLY show only their lectures
      if (currentUser.role === 'teacher') {
        return isSlotBelongsToTeacher(slot, currentUser);
      }
      // If HOD: allow filtering by teacher or showing all
      if (currentUser.role === 'hod' && hodSelectedTeacherFilter !== 'all') {
        return slot.teacherId === hodSelectedTeacherFilter || 
               slot.teacherName.toLowerCase().includes(hodSelectedTeacherFilter.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Extract list of unique teachers for HOD filter
  const uniqueTeachers = Array.from(
    new Set(timetable.map(s => JSON.stringify({ id: s.teacherId, name: s.teacherName })))
  ).map(str => JSON.parse(str) as { id: string; name: string });

  // Check if a slot already has an attendance session marked
  const getSlotSessionStatus = (slot: TimetableSlot) => {
    const session = sessions.find(s => 
      s.classId === slot.classId && 
      s.date === selectedDate && 
      (s.lectureSlotId === slot.id || s.timeSlot === slot.timeSlotLabel || s.sessionName.includes(slot.timeSlotLabel))
    );

    if (!session) {
      return { isMarked: false, count: 0, total: 0 };
    }

    const records = Object.values(session?.records || {});
    const markedCount = records.filter(r => r.status === 'present').length;
    return { isMarked: true, count: markedCount, total: records.length };
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-sm space-y-4">
      
      {/* Header bar: Date picker, Day tabs, and Scope Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200">
            <Clock className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900">
                Interactive Timetable & Lecture Schedule
              </h2>
              {currentUser.role === 'teacher' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200">
                  <Lock className="w-2.5 h-2.5" />
                  Your Assigned Lectures
                </span>
              )}
              {currentUser.role === 'hod' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-300">
                  HOD Manager Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {currentUser.role === 'teacher' 
                ? `Showing exclusively lectures scheduled for ${currentUser.name}. Click any slot to tick attendance.`
                : 'Select any lecture slot to review or click Edit to re-allocate faculty, room, and timings.'}
            </p>
          </div>
        </div>

        {/* Date Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              id="lecture-schedule-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            />
          </div>

          {/* Teacher Badge or HOD Filter */}
          {currentUser.role === 'teacher' ? (
            <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{currentUser.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={hodSelectedTeacherFilter}
                  onChange={(e) => setHodSelectedTeacherFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Faculty Lectures</option>
                  {uniqueTeachers.map(t => (
                    <option key={t.id || t.name} value={t.id || t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {onAddTimetableSlot && (
                <button
                  type="button"
                  onClick={handleOpenAddSlot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-2xs cursor-pointer transition-all active:scale-95"
                  title="Schedule a new lecture into timetable"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Lecture</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Day of Week Selector Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {DAYS_OF_WEEK.map(day => {
          const isSelected = day === currentDayOfWeek;
          const slotsCount = timetable.filter(s => {
            if (s.dayOfWeek !== day) return false;
            if (currentUser.role === 'teacher') return isSlotBelongsToTeacher(s, currentUser);
            if (currentUser.role === 'hod' && hodSelectedTeacherFilter !== 'all') {
              return s.teacherId === hodSelectedTeacherFilter || s.teacherName.toLowerCase().includes(hodSelectedTeacherFilter.toLowerCase());
            }
            return true;
          }).length;

          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                const today = new Date(selectedDate);
                const currentDayIndex = today.getDay() || 7; // 1-7
                const targetDayIndex = DAYS_OF_WEEK.indexOf(day) + 1;
                const diff = targetDayIndex - currentDayIndex;
                const newDate = new Date(today);
                newDate.setDate(today.getDate() + diff);
                onDateChange(newDate.toISOString().slice(0, 10));
              }}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 select-none ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span>{day}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isSelected ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
              }`}>
                {slotsCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slots List */}
      {daySlots.length === 0 ? (
        <div className="p-8 text-center bg-amber-50/60 rounded-3xl border border-amber-200 text-slate-700 space-y-3 max-w-xl mx-auto my-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border border-amber-200">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
              No Lectures
            </span>
            <h3 className="text-base font-extrabold text-slate-900">
              There is no lecture scheduled on {currentDayOfWeek}
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {currentUser.role === 'teacher' 
                ? `No lectures are scheduled for ${currentUser.name} on ${currentDayOfWeek}. Faculty can take attendance on days with scheduled lectures.` 
                : `No lectures are scheduled on ${currentDayOfWeek}.`}
            </p>
          </div>
          {currentUser.role === 'hod' && onAddTimetableSlot && (
            <button
              type="button"
              onClick={handleOpenAddSlot}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Lecture for {currentDayOfWeek}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {daySlots.map(slot => {
            const { isMarked, count, total } = getSlotSessionStatus(slot);
            const isSelectedSlot = activeLectureSlotId === slot.id;

            return (
              <div
                key={slot.id}
                onClick={() => onSelectLecture(slot, selectedDate)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                  isSelectedSlot
                    ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 shadow-md'
                    : 'border-slate-200 hover:border-sky-300 hover:bg-slate-50/80 bg-white shadow-xs'
                }`}
              >
                {/* Top: Time badge, Edit (HOD) & Marked status */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-xs border border-slate-200">
                    <Clock className="w-3 h-3 text-sky-600" />
                    <span>{slot.timeSlotLabel}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* HOD Quick Edit Button */}
                    {currentUser.role === 'hod' && (
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditSlot(slot, e)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
                          title="Edit lecture details, time & assigned faculty"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteTimetableSlot && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTimetableSlot(slot.id);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
                            title="Remove lecture from timetable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {isMarked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-bold border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{count}/{total} Marked</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-bold border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Ready to Tick</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Subject Name */}
                <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-1">
                  {slot.subject}
                </h3>

                {/* Details: Class & Room */}
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{slot.className}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{slot.roomName}</span>
                    </span>

                    <span className="flex items-center gap-1 truncate font-medium text-slate-700">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{slot.teacherName}</span>
                    </span>
                  </div>
                </div>

                {/* CTA Hover Footer */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-600 group-hover:text-sky-800">
                  <span>{isMarked ? 'View Recorded Attendance' : 'Tick Attendance Now'}</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HOD IN-PLACE EDIT / SCHEDULE LECTURE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Clock className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingSlot ? 'Edit Timetable Lecture' : 'Schedule Lecture Hour'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingSlot ? `Editing ${editingSlot.subject} (${editingSlot.timeSlotLabel})` : 'Allocate subject, faculty, class, and room for a time slot'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Day of Week *</label>
                  <select
                    value={slotDay}
                    onChange={(e) => setSlotDay(e.target.value as DayOfWeek)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Subject Name *</label>
                  <input
                    type="text"
                    value={slotSubject}
                    onChange={(e) => setSlotSubject(e.target.value)}
                    placeholder="e.g. Cyber Security"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                    required
                  />
                  {/* Selected Faculty's Respected Subjects */}
                  {(() => {
                    const selTeacher = teachers.find(t => t.id === slotTeacherId);
                    if (!selTeacher || !selTeacher.subjects || selTeacher.subjects.length === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-[10px] text-slate-500 font-medium">Faculty Subjects:</span>
                        {selTeacher.subjects.map((sub, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSlotSubject(sub)}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border cursor-pointer transition-all ${
                              slotSubject.toLowerCase() === sub.toLowerCase()
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Start Time & End Time */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Start Time</label>
                    <input
                      type="text"
                      value={slotStartTime}
                      onChange={(e) => setSlotStartTime(e.target.value)}
                      placeholder="08:00 AM"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">End Time</label>
                    <input
                      type="text"
                      value={slotEndTime}
                      onChange={(e) => setSlotEndTime(e.target.value)}
                      placeholder="09:00 AM"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>
                </div>

                {/* Quick time slot presets */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {[
                    ['08:00 AM', '09:00 AM'],
                    ['09:00 AM', '10:00 AM'],
                    ['10:15 AM', '11:15 AM'],
                    ['11:15 AM', '12:15 PM'],
                    ['01:00 PM', '02:00 PM'],
                    ['02:00 PM', '03:00 PM'],
                    ['03:00 PM', '04:00 PM']
                  ].map(([st, et]) => (
                    <button
                      key={`${st}-${et}`}
                      type="button"
                      onClick={() => {
                        setSlotStartTime(st);
                        setSlotEndTime(et);
                      }}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border cursor-pointer ${
                        slotStartTime === st && slotEndTime === et
                          ? 'bg-sky-600 text-white border-sky-600 font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {st.slice(0, 5)} - {et.slice(0, 5)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Class / Division</label>
                  <select
                    value={slotClassId}
                    onChange={(e) => setSlotClassId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Assigned Faculty</label>
                  <select
                    value={slotTeacherId}
                    onChange={(e) => {
                      const tId = e.target.value;
                      setSlotTeacherId(tId);
                      const tObj = teachers.find(t => t.id === tId);
                      if (tObj && tObj.subjects && tObj.subjects.length > 0 && !slotSubject) {
                        setSlotSubject(tObj.subjects[0]);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.uniqueCode})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Classroom / Lab</label>
                  <select
                    value={slotRoomId}
                    onChange={(e) => setSlotRoomId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                  >
                    {classrooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.building})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingSlot ? 'Save Timetable Changes' : 'Schedule Lecture'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
