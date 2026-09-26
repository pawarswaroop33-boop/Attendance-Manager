import { AttendanceSession, Student } from '../types';

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const;

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const;

/**
 * Returns formatted YYYY-MM-DD string with 0-padded month and day
 */
export const formatDateKey = (year: number, monthIndex: number, day: number): string => {
  const yyyy = String(year);
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Parses YYYY-MM-DD to year, monthIndex (0-11), and day (1-31)
 */
export const isLegacyDummySession = (session: any): boolean => {
  if (!session || typeof session !== 'object') return false;
  // If explicitly flagged as registered/real by user actions, never treat as dummy
  if (session.isRegistered === true || session.isRealSession === true) {
    return false;
  }
  const remarks = String(session.remarks || '');
  // Specifically matches old mock auto-generator remarks template
  if (remarks.startsWith('Conducted lecture on') && remarks.includes('for Electronics and Computer Engineering.')) {
    return true;
  }
  return false;
};

export const parseDateKey = (dateStr: string): { year: number; monthIndex: number; day: number } => {
  if (!dateStr) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth(), day: now.getDate() };
  }
  const parts = dateStr.split('-').map(Number);
  return {
    year: parts[0] || new Date().getFullYear(),
    monthIndex: (parts[1] || 1) - 1,
    day: parts[2] || 1
  };
};

export interface CalendarDayCell {
  dateStr: string;
  dayNumber: number;
  monthIndex: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: string;
}

/**
 * Generates the full 35 or 42 grid cells for a given month and year
 */
export const getCalendarMonthGrid = (year: number, monthIndex: number): CalendarDayCell[] => {
  const today = new Date();
  const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const firstDayOfMonth = new Date(year, monthIndex, 1).getDay(); // 0 is Sunday
  const daysInCurrentMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarDayCell[] = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthIdx = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    const dateStr = formatDateKey(prevYear, prevMonthIdx, day);
    const dayOfWeek = DAYS_OF_WEEK[new Date(prevYear, prevMonthIdx, day).getDay()];

    cells.push({
      dateStr,
      dayNumber: day,
      monthIndex: prevMonthIdx,
      year: prevYear,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek
    });
  }

  // Current month days
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const dateStr = formatDateKey(year, monthIndex, day);
    const dayOfWeek = DAYS_OF_WEEK[new Date(year, monthIndex, day).getDay()];

    cells.push({
      dateStr,
      dayNumber: day,
      monthIndex,
      year,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      dayOfWeek
    });
  }

  // Next month leading days (fill out row to complete 35 or 42 cells)
  const remainingCells = (7 - (cells.length % 7)) % 7;
  // If total cells is 28 or 35 and there is room, pad to minimum 35 or 42
  const targetTotal = cells.length + remainingCells < 35 ? 35 : cells.length + remainingCells;
  const nextDaysToFill = targetTotal - cells.length;

  for (let day = 1; day <= nextDaysToFill; day++) {
    const nextMonthIdx = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextYear = monthIndex === 11 ? year + 1 : year;
    const dateStr = formatDateKey(nextYear, nextMonthIdx, day);
    const dayOfWeek = DAYS_OF_WEEK[new Date(nextYear, nextMonthIdx, day).getDay()];

    cells.push({
      dateStr,
      dayNumber: day,
      monthIndex: nextMonthIdx,
      year: nextYear,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek
    });
  }

  return cells;
};

/**
 * Returns the day of the week for a given YYYY-MM-DD date string.
 * Example: '2026-09-25' -> 'Friday'
 */
export const getDayOfWeek = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return DAYS_OF_WEEK[dateObj.getDay()] || '';
  } catch (_) {
    return '';
  }
};

/**
 * Formats YYYY-MM-DD to readable date like "25 Sep 2026"
 */
export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (_) {
    return dateStr;
  }
};

/**
 * Formats YYYY-MM-DD to "25 Sep 2026 (Friday)" or "Friday, 25 Sep 2026"
 */
export const formatDateWithDay = (dateStr: string, sessionDay?: string): string => {
  if (!dateStr) return '';
  const day = sessionDay || getDayOfWeek(dateStr);
  const formatted = formatDateShort(dateStr);
  return day ? `${formatted} • ${day}` : formatted;
};

/**
 * Calculates present/absent breakdown and student lists for an attendance session
 */
export const getSessionStats = (
  session: AttendanceSession,
  allStudents: Student[]
) => {
  const records = session?.records || {};
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let unmarkedCount = 0;

  const presentStudents: Student[] = [];
  const absentStudents: Student[] = [];
  const lateStudents: Student[] = [];

  // If session has student records
  const studentMap = new Map(allStudents.map(s => [s.id, s]));

  Object.entries(records).forEach(([studentId, record]) => {
    const student = studentMap.get(studentId);
    if (!student) return;

    if (record.status === 'present') {
      presentCount++;
      presentStudents.push(student);
    } else if (record.status === 'absent') {
      absentCount++;
      absentStudents.push(student);
    } else if (record.status === 'late') {
      lateCount++;
      lateStudents.push(student);
    } else if (record.status === 'excused') {
      excusedCount++;
    } else {
      unmarkedCount++;
    }
  });

  const total = presentCount + absentCount + lateCount + excusedCount + unmarkedCount;
  const presentRate = total > 0 ? Math.round(((presentCount + lateCount * 0.5) / total) * 100) : 0;
  const absentRate = total > 0 ? Math.round((absentCount / total) * 100) : 0;

  return {
    total,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    unmarkedCount,
    presentRate,
    absentRate,
    presentStudents,
    absentStudents,
    lateStudents
  };
};
