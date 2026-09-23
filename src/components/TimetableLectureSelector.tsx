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
  Sparkles
} from 'lucide-react';
import { TimetableSlot, AttendanceSession, DayOfWeek, AuthUser } from '../types';

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
  const getDayOfWeek = (dateStr: string): DayOfWeek => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayIndex = d.getDay(); // 0 is Sunday
    if (dayIndex === 0) return 'Monday'; // Default to Monday if Sunday picked
    return DAYS_OF_WEEK[dayIndex - 1];
  };

  const currentDayOfWeek = getDayOfWeek(selectedDate);
  const [filterMyLecturesOnly, setFilterMyLecturesOnly] = useState(currentUser.role === 'teacher');

  // Filter slots for current day
  const daySlots = timetable
    .filter(slot => slot.dayOfWeek === currentDayOfWeek)
    .filter(slot => {
      if (currentUser.role === 'teacher' && filterMyLecturesOnly) {
        return slot.teacherName.toLowerCase().includes(currentUser.name.toLowerCase()) ||
               (currentUser.assignedSubjects && currentUser.assignedSubjects.includes(slot.subject));
      }
      return true;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

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

    const records = Object.values(session.records);
    const markedCount = records.filter(r => r.status === 'present').length;
    return { isMarked: true, count: markedCount, total: records.length };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
      
      {/* Header bar: Date picker, Day tabs, and Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Interactive Timetable & Lecture Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Select any lecture slot (e.g. 08:00 AM - 09:00 AM) to immediately tick attendance
            </p>
          </div>
        </div>

        {/* Date Selector & My Lectures Filter */}
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

          {currentUser.role === 'teacher' && (
            <button
              type="button"
              onClick={() => setFilterMyLecturesOnly(!filterMyLecturesOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                filterMyLecturesOnly 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>{filterMyLecturesOnly ? 'My Lectures Only' : 'All Lectures'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Day of Week Selector Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
        {DAYS_OF_WEEK.map(day => {
          const isSelected = day === currentDayOfWeek;
          const slotsCount = timetable.filter(s => s.dayOfWeek === day).length;

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
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 space-y-1">
          <CalendarDays className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700">No lectures scheduled for {currentDayOfWeek}</p>
          <p className="text-[11px] text-slate-500">HOD can add new slots from the HOD Control Center.</p>
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
