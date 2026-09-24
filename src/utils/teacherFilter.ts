import { AuthUser, TimetableSlot, AttendanceSession } from '../types';

/**
 * Checks whether a timetable slot belongs to the given teacher.
 * If user is HOD or null, returns true (HOD has campus-wide access).
 */
export function isSlotBelongsToTeacher(
  slot: TimetableSlot,
  user: AuthUser | null | undefined
): boolean {
  if (!user || user.role === 'hod') return true;

  // 1. Direct teacher ID match
  if (slot.teacherId && user.id && slot.teacherId.toLowerCase() === user.id.toLowerCase()) {
    return true;
  }

  // 2. Name fuzzy matching (e.g. "Prof. Anjali Sharma" matches "Anjali Sharma")
  if (slot.teacherName && user.name) {
    const sName = slot.teacherName.toLowerCase().replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.)\s*/i, '').trim();
    const uName = user.name.toLowerCase().replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.)\s*/i, '').trim();
    if (sName === uName || sName.includes(uName) || uName.includes(sName)) {
      return true;
    }
  }

  // 3. Subject matching against teacher's assigned subjects
  if (slot.subject && user.assignedSubjects && user.assignedSubjects.length > 0) {
    const slotSub = slot.subject.toLowerCase().trim();
    if (user.assignedSubjects.some(sub => sub.toLowerCase().trim() === slotSub)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an attendance session was conducted by / belongs to the given teacher.
 * If user is HOD or null, returns true (HOD has campus-wide access).
 */
export function isSessionBelongsToTeacher(
  session: AttendanceSession,
  user: AuthUser | null | undefined,
  timetable?: TimetableSlot[]
): boolean {
  if (!user || user.role === 'hod') return true;

  // 1. Direct teacher ID match
  if (session.teacherId && user.id && session.teacherId.toLowerCase() === user.id.toLowerCase()) {
    return true;
  }

  // 2. Match against timetable slot if linked
  if (session.lectureSlotId && timetable && timetable.length > 0) {
    const slot = timetable.find(s => s.id === session.lectureSlotId);
    if (slot) {
      if (isSlotBelongsToTeacher(slot, user)) {
        return true;
      }
    }
  }

  // 3. Name fuzzy matching
  if (session.teacherName && user.name) {
    const sName = session.teacherName.toLowerCase().replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.)\s*/i, '').trim();
    const uName = user.name.toLowerCase().replace(/^(prof\.|dr\.|mr\.|mrs\.|ms\.)\s*/i, '').trim();
    if (sName === uName || sName.includes(uName) || uName.includes(sName)) {
      return true;
    }
  }

  // 4. Subject match against teacher's assigned subjects
  if (session.subject && user.assignedSubjects && user.assignedSubjects.length > 0) {
    const sessionSub = session.subject.toLowerCase().trim();
    if (user.assignedSubjects.some(sub => sub.toLowerCase().trim() === sessionSub)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter sessions to only those belonging to the current user (if teacher).
 */
export function filterSessionsForUser(
  sessions: AttendanceSession[],
  user: AuthUser | null | undefined,
  timetable?: TimetableSlot[]
): AttendanceSession[] {
  if (!user || user.role === 'hod') return sessions;
  return sessions.filter(s => isSessionBelongsToTeacher(s, user, timetable));
}

/**
 * Filter timetable slots to only those belonging to the current user (if teacher).
 */
export function filterTimetableForUser(
  timetable: TimetableSlot[],
  user: AuthUser | null | undefined
): TimetableSlot[] {
  if (!user || user.role === 'hod') return timetable;
  return timetable.filter(s => isSlotBelongsToTeacher(s, user));
}

const DAYS_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get day of week name from YYYY-MM-DD string
 */
export function getDayOfWeekFromDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return DAYS_NAMES[dateObj.getDay()] || '';
  } catch (_) {
    return '';
  }
}

/**
 * Get scheduled lectures for a given date and user.
 * If user is teacher, only returns lectures assigned to that teacher.
 * If user is HOD, returns all lectures for that day (optionally filtered by class).
 */
export function getLecturesForDateAndUser(
  dateStr: string,
  user: AuthUser | null | undefined,
  timetable: TimetableSlot[],
  classId?: string
): TimetableSlot[] {
  if (!dateStr || !timetable || timetable.length === 0) return [];
  const dayOfWeek = getDayOfWeekFromDate(dateStr);
  if (!dayOfWeek || dayOfWeek === 'Sunday') return [];

  return timetable.filter(slot => {
    if (slot.dayOfWeek !== dayOfWeek) return false;
    if (classId && slot.classId !== classId) return false;
    if (user && user.role === 'teacher') {
      return isSlotBelongsToTeacher(slot, user);
    }
    return true;
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Checks whether a user has any scheduled lectures on a given date.
 */
export function hasLectureOnDateForUser(
  dateStr: string,
  user: AuthUser | null | undefined,
  timetable: TimetableSlot[],
  classId?: string
): boolean {
  return getLecturesForDateAndUser(dateStr, user, timetable, classId).length > 0;
}

/**
 * Finds the next upcoming date (within 14 days) where the user has a scheduled lecture.
 */
export function getNextLectureDateForUser(
  fromDateStr: string,
  user: AuthUser | null | undefined,
  timetable: TimetableSlot[],
  classId?: string
): { dateStr: string; dayOfWeek: string; slots: TimetableSlot[] } | null {
  if (!fromDateStr) return null;
  const [year, month, day] = fromDateStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day);

  for (let offset = 1; offset <= 14; offset++) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + offset);
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    const candidateDateStr = `${yyyy}-${mm}-${dd}`;
    const slots = getLecturesForDateAndUser(candidateDateStr, user, timetable, classId);
    if (slots.length > 0) {
      return {
        dateStr: candidateDateStr,
        dayOfWeek: getDayOfWeekFromDate(candidateDateStr),
        slots
      };
    }
  }

  return null;
}
