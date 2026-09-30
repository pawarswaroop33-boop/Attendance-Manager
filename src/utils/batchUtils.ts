import { Student, TimetableSlot, AttendanceSession, AttendanceStatus } from '../types';

export type StudentBatch = 'A1' | 'A2' | 'A3';

/**
 * Determine a student's assigned batch (A1, A2, or A3).
 * Uses explicit student.batch if set, or parses roll number / roster distribution.
 */
export function getStudentBatch(student: Student, allStudents?: Student[]): StudentBatch {
  if (student.batch === 'A1' || student.batch === 'A2' || student.batch === 'A3') {
    return student.batch;
  }

  // Check roll number for explicit batch identifier (e.g. "A1-01", "01-A1", "A2", etc.)
  const roll = (student.rollNo || '').toUpperCase();
  if (roll.includes('A1')) return 'A1';
  if (roll.includes('A2')) return 'A2';
  if (roll.includes('A3')) return 'A3';

  // Numeric roll number partitioning as specified:
  // Batch A1: Roll 1 to 29
  // Batch A2: Roll 30 to 57
  // Batch A3: Roll 58 to 86
  const num = parseInt(roll.replace(/\D/g, ''), 10);
  if (!isNaN(num)) {
    if (num >= 1 && num <= 29) return 'A1';
    if (num >= 30 && num <= 57) return 'A2';
    if (num >= 58 && num <= 86) return 'A3';

    // Standard boundary fallbacks
    if (num <= 29) return 'A1';
    if (num <= 57) return 'A2';
    return 'A3';
  }

  // Fallback based on position in roster
  if (allStudents && allStudents.length > 0) {
    const idx = allStudents.findIndex(s => s.id === student.id);
    if (idx >= 0) {
      if (idx < 29) return 'A1';
      if (idx < 57) return 'A2';
      return 'A3';
    }
  }

  return 'A1';
}

/**
 * Checks whether a time slot or label falls between 12:30 PM to 02:10 PM (12.30 to 2.10).
 */
export function isTimeSlot1230To210(timeSlot?: string): boolean {
  if (!timeSlot) return false;
  const normalized = timeSlot.toLowerCase().replace(/\s+/g, ' ');
  // Match common representations:
  // "12:30 pm - 02:10 pm", "12:30 - 2:10", "12.30 to 2.10", "12:30 to 2:10", "12:30 pm - 02:00 pm"
  if (
    normalized.includes('12:30') ||
    normalized.includes('12.30') ||
    (normalized.includes('12:30') && normalized.includes('2:10')) ||
    (normalized.includes('12.30') && normalized.includes('2.10')) ||
    normalized.includes('02:10') ||
    normalized.includes('2:10') ||
    normalized.includes('14:10')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether a slot or session represents a batch-wise practical / lab.
 */
export function isBatchPracticalSlot(slot?: TimetableSlot | AttendanceSession): boolean {
  if (!slot) return false;
  if (slot.batch && slot.batch !== 'All') return true;

  const timeLabel = 'timeSlotLabel' in slot ? slot.timeSlotLabel : (slot.timeSlot || '');
  if (isTimeSlot1230To210(timeLabel)) return true;

  const sessionName = 'sessionName' in slot ? slot.sessionName : '';
  const sub = (slot.subject || sessionName || '').toLowerCase();
  if (sub.includes('batch a1') || sub.includes('batch a2') || sub.includes('batch a3')) return true;
  if (sub.includes('(a1)') || sub.includes('(a2)') || sub.includes('(a3)')) return true;
  if (sub.includes('a1') || sub.includes('a2') || sub.includes('a3')) {
    if (sub.includes('lab') || sub.includes('practical')) return true;
  }

  return false;
}

/**
 * Get the specific batch ('A1' | 'A2' | 'A3' | 'All') for a slot or session.
 */
export function getSlotBatch(slot?: TimetableSlot | AttendanceSession): 'A1' | 'A2' | 'A3' | 'All' {
  if (!slot) return 'All';
  if (slot.batch === 'A1' || slot.batch === 'A2' || slot.batch === 'A3') {
    return slot.batch;
  }

  const timeLabel = 'timeSlotLabel' in slot ? slot.timeSlotLabel : (slot.timeSlot || '');
  const sessionName = 'sessionName' in slot ? slot.sessionName : '';
  const sub = ((slot.subject || sessionName || '') + ' ' + timeLabel).toLowerCase();
  if (sub.includes('a1') || sub.includes('batch a1')) return 'A1';
  if (sub.includes('a2') || sub.includes('batch a2')) return 'A2';
  if (sub.includes('a3') || sub.includes('batch a3')) return 'A3';

  return 'All';
}

/**
 * Filter a student list by batch.
 */
export function filterStudentsForBatch(
  students: Student[],
  batch?: 'A1' | 'A2' | 'A3' | 'All' | string
): Student[] {
  if (!batch || batch === 'All') return students;
  return students.filter(s => getStudentBatch(s, students) === batch);
}

export interface Combined1230Stats {
  hasBatchSessions: boolean;
  totalPresent: number;
  totalAbsent: number;
  totalStudents: number;
  presentRate: number;
  sessionsCount: number;
  batchBreakdown: {
    A1: { present: number; absent: number; total: number; isRecorded: boolean; teacherName?: string; subject?: string };
    A2: { present: number; absent: number; total: number; isRecorded: boolean; teacherName?: string; subject?: string };
    A3: { present: number; absent: number; total: number; isRecorded: boolean; teacherName?: string; subject?: string };
  };
}

/**
 * Check if a session applies to a specific student based on their batch.
 */
export function isStudentApplicableForSession(
  student: Student,
  session: AttendanceSession,
  allStudents?: Student[]
): boolean {
  const sessionBatch = getSlotBatch(session);
  if (sessionBatch === 'All') return true;
  const studentBatch = getStudentBatch(student, allStudents);
  return studentBatch === sessionBatch;
}

/**
 * Calculates the combined attendance count for the 12:30 to 2:10 time slot on a given date.
 * When A1, A2, and A3 lecture teachers take attendance between 12:30 to 2:10,
 * the total present count combines all present students from these 3 batches.
 */
export function getCombined1230To210Stats(
  date: string,
  allSessions: AttendanceSession[],
  allStudents: Student[],
  timetable?: TimetableSlot[]
): Combined1230Stats {
  // Find all recorded sessions for this date that are in the 12:30 to 2:10 time slot (or batch practicals)
  const dateSessions = allSessions.filter(s => {
    if (s.date !== date) return false;
    const timeLabel = s.timeSlot || s.sessionName || '';
    return isTimeSlot1230To210(timeLabel) || isBatchPracticalSlot(s);
  });

  const a1Students = allStudents.filter(s => getStudentBatch(s, allStudents) === 'A1');
  const a2Students = allStudents.filter(s => getStudentBatch(s, allStudents) === 'A2');
  const a3Students = allStudents.filter(s => getStudentBatch(s, allStudents) === 'A3');

  const breakdown: Combined1230Stats['batchBreakdown'] = {
    A1: { present: 0, absent: 0, total: a1Students.length, isRecorded: false },
    A2: { present: 0, absent: 0, total: a2Students.length, isRecorded: false },
    A3: { present: 0, absent: 0, total: a3Students.length, isRecorded: false }
  };

  // Populate assigned teacher & subject from timetable for this day of week (avoids random/demo faculty)
  if (timetable && timetable.length > 0 && date) {
    let dayOfWeek = '';
    try {
      const [year, month, day] = date.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayOfWeek = days[d.getDay()] || '';
    } catch (_) {}

    if (dayOfWeek) {
      const daySlots = timetable.filter(slot => {
        if (slot.dayOfWeek !== dayOfWeek) return false;
        const timeLabel = slot.timeSlotLabel || slot.startTime + ' - ' + slot.endTime;
        return isTimeSlot1230To210(timeLabel) || isBatchPracticalSlot(slot);
      });

      daySlots.forEach(slot => {
        const b = getSlotBatch(slot);
        if (b === 'A1' || b === 'A2' || b === 'A3') {
          if (slot.teacherName) breakdown[b].teacherName = slot.teacherName;
          if (slot.subject) breakdown[b].subject = slot.subject;
        }
      });
    }
  }

  const presentStudentIds = new Set<string>();
  const absentStudentIds = new Set<string>();

  dateSessions.forEach(session => {
    const sBatch = getSlotBatch(session);
    const targetBatch = (sBatch === 'All' ? 'A1' : sBatch) as StudentBatch;

    if (session.teacherName) {
      breakdown[targetBatch].teacherName = session.teacherName;
    }
    if (session.subject) {
      breakdown[targetBatch].subject = session.subject;
    }

    const records = session.records || {};
    let sessionHasMarks = false;

    // Check students belonging to this batch
    const batchRoster = targetBatch === 'A1' ? a1Students : targetBatch === 'A2' ? a2Students : a3Students;
    
    batchRoster.forEach(st => {
      const rec = records[st.id];
      if (rec) {
        if (rec.status === 'present' || rec.status === 'late') {
          presentStudentIds.add(st.id);
          absentStudentIds.delete(st.id);
          sessionHasMarks = true;
        } else if (rec.status === 'absent') {
          if (!presentStudentIds.has(st.id)) {
            absentStudentIds.add(st.id);
          }
          sessionHasMarks = true;
        }
      }
    });

    // Also check any other students who might have been explicitly marked in this session
    Object.entries(records).forEach(([stId, rec]) => {
      if (rec.status === 'present' || rec.status === 'late') {
        presentStudentIds.add(stId);
        absentStudentIds.delete(stId);
        sessionHasMarks = true;
      }
    });

    if (sessionHasMarks) {
      breakdown[targetBatch].isRecorded = true;
    }
  });

  // Calculate per-batch counts from the sets
  a1Students.forEach(st => {
    if (presentStudentIds.has(st.id)) breakdown.A1.present++;
    else if (absentStudentIds.has(st.id)) breakdown.A1.absent++;
  });
  a2Students.forEach(st => {
    if (presentStudentIds.has(st.id)) breakdown.A2.present++;
    else if (absentStudentIds.has(st.id)) breakdown.A2.absent++;
  });
  a3Students.forEach(st => {
    if (presentStudentIds.has(st.id)) breakdown.A3.present++;
    else if (absentStudentIds.has(st.id)) breakdown.A3.absent++;
  });

  const totalPresent = presentStudentIds.size;
  const totalAbsent = absentStudentIds.size;
  const totalStudents = allStudents.length > 0 ? allStudents.length : (a1Students.length + a2Students.length + a3Students.length);
  const presentRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

  return {
    hasBatchSessions: dateSessions.length > 0,
    totalPresent,
    totalAbsent,
    totalStudents,
    presentRate,
    sessionsCount: dateSessions.length,
    batchBreakdown: breakdown
  };
}
