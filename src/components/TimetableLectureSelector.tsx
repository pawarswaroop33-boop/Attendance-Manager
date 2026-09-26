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
  UserCheck
} from 'lucide-react';
import { TimetableSlot, AttendanceSession, DayOfWeek, AuthUser } from '../types';
import { isSlotBelongsToTeacher } from '../utils/teacherFilter';

interface TimetableLectureSelectorProps {
  timetable: TimetableSlot[];
  sessions: AttendanceSession[];
  currentUser: AuthUser;
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  onSelectLecture: (slot: TimetableSlot, date: string) => void;
  activeLectureSlotId?: string;
}

const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TimetableLectureSelector: React.FC<TimetableLectureSelectorProps> = ({
  timetable,
  sessions,
  currentUser,
  selectedDate,
  onDateChange,
  onSelectLecture,
  activeLectureSlotId
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
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
      
      {/* Header bar: Date picker, Day tabs, and Scope Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Interactive Timetable & Lecture Schedule
              </h2>
              {currentUser.role === 'teacher' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  <Lock className="w-2.5 h-2.5" />
                  Your Assigned Lectures Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {currentUser.role === 'teacher' 
                ? `Showing exclusively lectures scheduled for ${currentUser.name}. Click any slot to tick attendance.`
                : 'Select any lecture slot to immediately tick attendance.'}
            </p>
          </div>
        </div>

        {/* Date Selector & Scope Info */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
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
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs">
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
          )}
        </div>
      </div>

      {/* Day of Week Selector Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
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
                // If clicked a day different from current date's day, adjust date to that day in the current week
                const today = new Date(selectedDate);
                const currentDayIndex = today.getDay() || 7; // 1-7
                const targetDayIndex = DAYS_OF_WEEK.indexOf(day) + 1;
                const diff = targetDayIndex - currentDayIndex;
                const newDate = new Date(today);
                newDate.setDate(today.getDate() + diff);
                onDateChange(newDate.toISOString().slice(0, 10));
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span>{day}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
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
        <div className="p-8 text-center bg-amber-50/60 rounded-2xl border border-amber-200 text-slate-700 space-y-2 max-w-xl mx-auto my-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
              No Lectures
            </span>
            <h3 className="text-base font-extrabold text-slate-900">
              There is no lecture today ({currentDayOfWeek})
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {currentUser.role === 'teacher' 
                ? `No lectures are scheduled for ${currentUser.name} on ${currentDayOfWeek}. Faculty can only take attendance on days with scheduled lectures.` 
                : `No lectures are scheduled on ${currentDayOfWeek}.`}
            </p>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            {currentUser.role === 'teacher'
              ? 'Click on your scheduled lecture days above to select a lecture and tick attendance.'
              : 'Lectures can be added from the HOD Control Center.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {daySlots.map(slot => {
            const { isMarked, count, total } = getSlotSessionStatus(slot);
            const isSelectedSlot = activeLectureSlotId === slot.id;

            return (
              <div
                key={slot.id}
                onClick={() => onSelectLecture(slot, selectedDate)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                  isSelectedSlot
                    ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/80 bg-white shadow-xs'
                }`}
              >
                {/* Top: Time badge & Marked status */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold text-xs">
                    <Clock className="w-3 h-3 text-sky-600" />
                    <span>{slot.timeSlotLabel}</span>
                  </span>

                  {isMarked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{count}/{total} Marked</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>Ready to Tick</span>
                    </span>
                  )}
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
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{slot.roomName}</span>
                    </span>

                    <span className="flex items-center gap-1 truncate font-medium text-slate-700">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{slot.teacherName.split(' ')[1] || slot.teacherName}</span>
                    </span>
                  </div>
                </div>

                {/* CTA Hover Footer */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-600 group-hover:text-sky-800">
                  <span>Tick Attendance Now</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
