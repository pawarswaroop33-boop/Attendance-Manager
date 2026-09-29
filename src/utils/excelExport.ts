import * as XLSX from 'xlsx';
import { AttendanceSession, ClassGroup, Student, SystemSettings, Holiday } from '../types';
import { isValidRecordedSession } from './dateUtils';

export interface MonthlyExcelExportOptions {
  year: number;
  month: number; // 1 - 12
  classId?: string; // 'all' or specific class ID
  subjectFilter?: string; // 'all' or specific subject
}

export function exportMonthlyAttendanceToExcel(
  options: MonthlyExcelExportOptions,
  classes: ClassGroup[],
  allStudents: Student[],
  allSessions: AttendanceSession[],
  settings: SystemSettings,
  holidays: Holiday[] = []
): void {
  const { year, month, classId = 'all', subjectFilter = 'all' } = options;

  // Format month string: '2026-09'
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });

  // 1. Filter sessions for this month and class/subject
  const monthSessions = allSessions.filter(s => {
    if (!isValidRecordedSession(s)) return false;
    if (!s.date || !s.date.startsWith(monthStr)) return false;
    if (classId !== 'all' && s.classId !== classId) return false;
    if (subjectFilter !== 'all' && s.subject && s.subject.toLowerCase() !== subjectFilter.toLowerCase()) return false;
    return true;
  });

  // Sort sessions chronologically
  monthSessions.sort((a, b) => a.date.localeCompare(b.date));

  // Determine target class and target students
  const targetClass = classes.find(c => c.id === classId);
  const targetStudents = (targetClass && targetClass.studentIds.length > 0)
    ? allStudents.filter(s => targetClass.studentIds.includes(s.id))
    : (classId === 'all' ? allStudents : allStudents.filter(s => classes.some(c => c.id === classId && c.studentIds.includes(s.id))));

  // Sort students by numerical roll number
  const sortedStudents = [...targetStudents].sort((a, b) => {
    const numA = parseInt(a.rollNo.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.rollNo.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  // Group sessions by unique date for matrix columns
  const uniqueDates = Array.from(new Set(monthSessions.map(s => s.date))).sort();

  // Create new workbook
  const wb = XLSX.utils.book_new();

  // =========================================================================
  // SHEET 1: MONTHLY ATTENDANCE REGISTER MATRIX
  // =========================================================================
  const matrixHeaders = [
    'Roll No',
    'Student Name',
    'Gender',
    'Parent Contact',
    ...uniqueDates.map(d => {
      const parts = d.split('-');
      return `${parts[2]}-${monthName.slice(0, 3)}`;
    }),
    'Total Lectures',
    'Attended',
    'Absent',
    'Attendance %',
    'Academic Status'
  ];

  const threshold = settings.defaulterThreshold || 75;

  const matrixRows = sortedStudents.map(student => {
    let studentTotal = 0;
    let studentAttended = 0;
    let studentAbsent = 0;

    const dateStatuses = uniqueDates.map(d => {
      // Find all sessions on this date for this class
      const daySessions = monthSessions.filter(s => s.date === d);
      if (daySessions.length === 0) return '-';

      const statuses = daySessions.map(s => {
        const rec = s.records?.[student.id];
        const status = rec?.status || 'unmarked';
        if (status === 'present') {
          studentTotal++;
          studentAttended++;
          return 'P';
        } else if (status === 'late') {
          studentTotal++;
          studentAttended += 0.5;
          return 'L';
        } else if (status === 'absent') {
          studentTotal++;
          studentAbsent++;
          return 'A';
        } else if (status === 'excused') {
          return 'E';
        }
        return '-';
      });

      return statuses.join('/');
    });

    const percent = studentTotal > 0 ? Math.round((studentAttended / studentTotal) * 100) : 0;
    const isDefaulter = studentTotal > 0 && percent < threshold;
    const statusText = studentTotal === 0 ? 'N/A' : (isDefaulter ? `Defaulter (<${threshold}%)` : 'Regular');

    return [
      student.rollNo,
      student.name,
      student.gender || '—',
      student.parentPhone || '—',
      ...dateStatuses,
      studentTotal,
      studentAttended,
      studentAbsent,
      `${percent}%`,
      statusText
    ];
  });

  // Calculate daily attendance summary row
  const dailySummaryRow = [
    'TOTAL',
    'Total Present Students',
    '',
    '',
    ...uniqueDates.map(d => {
      const daySessions = monthSessions.filter(s => s.date === d);
      let count = 0;
      sortedStudents.forEach(st => {
        const hasPresent = daySessions.some(s => s.records?.[st.id]?.status === 'present');
        if (hasPresent) count++;
      });
      return count;
    }),
    '',
    '',
    '',
    '',
    ''
  ];

  const wsMatrixData = [
    [settings.collegeName || 'D.Y. Patil College of Engineering & Technology'],
    [`Department: ${settings.departmentName || 'Department of Electronics and Computer Engineering'}`],
    [`Monthly Attendance Register - ${monthName} ${year}`],
    [`Class: ${targetClass ? targetClass.name : 'All Classes'} | Defaulter Threshold: <${threshold}%`],
    [], // Empty spacing row
    matrixHeaders,
    ...matrixRows,
    [], // Empty row
    dailySummaryRow
  ];

  const wsMatrix = XLSX.utils.aoa_to_sheet(wsMatrixData);

  // Set column widths
  const colWidths = [
    { wch: 10 }, // Roll No
    { wch: 25 }, // Name
    { wch: 8 },  // Gender
    { wch: 16 }, // Phone
    ...uniqueDates.map(() => ({ wch: 10 })), // Dates
    { wch: 14 }, // Total
    { wch: 10 }, // Attended
    { wch: 10 }, // Absent
    { wch: 14 }, // %
    { wch: 18 }  // Status
  ];
  wsMatrix['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Monthly Matrix');

  // =========================================================================
  // SHEET 2: MONTHLY DEFAULTERS LIST (< Threshold)
  // =========================================================================
  const defaulterHeaders = [
    'Sr No',
    'Roll Number',
    'Student Full Name',
    'Gender',
    'Total Lectures',
    'Lectures Attended',
    'Lectures Missed',
    'Attendance %',
    'Parent / Guardian Name',
    'Parent WhatsApp Phone'
  ];

  const defaulterRows: any[] = [];
  let defaulterIndex = 1;

  sortedStudents.forEach(student => {
    let studentTotal = 0;
    let studentAttended = 0;
    let studentAbsent = 0;

    monthSessions.forEach(s => {
      const rec = s.records?.[student.id];
      if (rec) {
        if (rec.status === 'present') {
          studentTotal++;
          studentAttended++;
        } else if (rec.status === 'late') {
          studentTotal++;
          studentAttended += 0.5;
        } else if (rec.status === 'absent') {
          studentTotal++;
          studentAbsent++;
        }
      }
    });

    const percent = studentTotal > 0 ? Math.round((studentAttended / studentTotal) * 100) : 0;
    if (studentTotal > 0 && percent < threshold) {
      defaulterRows.push([
        defaulterIndex++,
        student.rollNo,
        student.name,
        student.gender || '—',
        studentTotal,
        studentAttended,
        studentAbsent,
        `${percent}%`,
        student.parentName || '—',
        student.parentPhone || '—'
      ]);
    }
  });

  const wsDefaultersData = [
    [settings.collegeName || 'D.Y. Patil College of Engineering & Technology'],
    [`Monthly Defaulters Notice (<${threshold}% Attendance) - ${monthName} ${year}`],
    [`Class: ${targetClass ? targetClass.name : 'All Classes'} | Total Defaulters: ${defaulterRows.length}`],
    [],
    defaulterHeaders,
    ...(defaulterRows.length > 0 ? defaulterRows : [['—', 'No defaulters found for this month.', '', '', '', '', '', '', '', '']])
  ];

  const wsDefaulters = XLSX.utils.aoa_to_sheet(wsDefaultersData);
  wsDefaulters['!cols'] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 26 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDefaulters, `Defaulters (<${threshold}%)`);

  // =========================================================================
  // SHEET 3: CONDUCTED SESSIONS AUDIT LOG
  // =========================================================================
  const sessionLogHeaders = [
    'Date',
    'Day',
    'Subject',
    'Time Slot',
    'Faculty In-Charge',
    'Total Enrolled',
    'Present Count',
    'Absent Count',
    'Attendance %',
    'Session Remarks'
  ];

  const sessionLogRows = monthSessions.map(s => {
    let p = 0;
    let a = 0;
    const records = Object.values(s.records || {});
    records.forEach(r => {
      if (r.status === 'present') p++;
      else if (r.status === 'absent') a++;
      else if (r.status === 'late') p += 0.5;
    });
    const total = records.length;
    const pct = total > 0 ? Math.round((p / total) * 100) : 0;

    return [
      s.date,
      s.dayOfWeek || '—',
      s.subject || s.sessionName || 'Lecture',
      s.timeSlot || '—',
      s.teacherName || 'Faculty',
      total,
      Math.round(p),
      a,
      `${pct}%`,
      s.remarks || '—'
    ];
  });

  const wsSessionsData = [
    [settings.collegeName || 'D.Y. Patil College of Engineering & Technology'],
    [`Academic Sessions Conducted Log - ${monthName} ${year}`],
    [`Total Conducted Sessions: ${monthSessions.length}`],
    [],
    sessionLogHeaders,
    ...(sessionLogRows.length > 0 ? sessionLogRows : [['—', 'No recorded sessions in this month.', '', '', '', '', '', '', '', '']])
  ];

  const wsSessions = XLSX.utils.aoa_to_sheet(wsSessionsData);
  wsSessions['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSessions, 'Conducted Sessions');

  // Trigger Excel file download
  const safeClassName = (targetClass ? targetClass.name : 'Campus').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Attendance_${safeClassName}_${monthName}_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}
