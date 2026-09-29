import { AttendanceSession, ClassGroup, Student, WhatsAppMessageConfig, AttendanceStatus } from '../types';

export function formatDateReadable(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function generateWhatsAppMessage(
  session: AttendanceSession,
  classGroup: ClassGroup,
  students: Student[],
  config: WhatsAppMessageConfig,
  overrides?: {
    subject?: string;
    timeSlot?: string;
    teacherName?: string;
  }
): string {
  const classStudents = students.filter(s => classGroup.studentIds.includes(s.id));
  const total = classStudents.length;

  const presentList: Student[] = [];
  const absentList: { student: Student; note?: string }[] = [];
  const lateList: { student: Student; note?: string }[] = [];
  const excusedList: { student: Student; note?: string }[] = [];
  const unmarkedList: Student[] = [];

  classStudents.forEach(st => {
    const rec = session.records[st.id];
    const status = rec?.status || 'unmarked';
    if (status === 'present') {
      presentList.push(st);
    } else if (status === 'absent') {
      absentList.push({ student: st, note: rec?.note });
    } else if (status === 'late') {
      lateList.push({ student: st, note: rec?.note });
    } else if (status === 'excused') {
      excusedList.push({ student: st, note: rec?.note });
    } else {
      unmarkedList.push(st);
    }
  });

  const presentCount = presentList.length;
  const absentCount = absentList.length;
  const lateCount = lateList.length;
  const excusedCount = excusedList.length;
  const rate = total > 0 ? ((presentCount / total) * 100).toFixed(1) : '0';

  const readableDate = formatDateReadable(session.date);

  // 1. Resolve exact subject: Prioritize overrides, session subject, extracted from sessionName, then classGroup
  let effectiveSubject = (overrides?.subject || session.subject || '').trim();
  if (!effectiveSubject && session.sessionName) {
    if (session.sessionName.includes(' - ')) {
      const parts = session.sessionName.split(' - ');
      effectiveSubject = parts.slice(1).join(' - ').trim();
    }
  }
  if (!effectiveSubject) {
    effectiveSubject = classGroup.subject || 'Engineering Lecture';
  }

  // 2. Resolve timing/session slot without embedding or confusing with the subject
  let effectiveTimeSlot = (overrides?.timeSlot || session.timeSlot || '').trim();
  if (!effectiveTimeSlot && session.sessionName) {
    if (session.sessionName.includes(' - ')) {
      effectiveTimeSlot = session.sessionName.split(' - ')[0].trim();
    } else {
      effectiveTimeSlot = session.sessionName.trim();
    }
  }
  if (!effectiveTimeSlot || effectiveTimeSlot.toLowerCase() === effectiveSubject.toLowerCase()) {
    effectiveTimeSlot = 'Scheduled Lecture Hour';
  }

  // 3. Resolve faculty / teacher name
  const effectiveTeacher = (overrides?.teacherName || session.teacherName || classGroup.teacherName || 'Faculty Member').trim();

  let message = `📋 *DAILY ATTENDANCE REPORT*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🏫 *Class:* ${classGroup.name}\n`;
  message += `📚 *Subject:* ${effectiveSubject}\n`;
  message += `⏰ *Session Timing:* ${effectiveTimeSlot}\n`;
  message += `📅 *Date:* ${readableDate}\n`;
  message += `👨‍🏫 *Faculty:* ${effectiveTeacher}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (config.includeStats) {
    message += `📊 *ATTENDANCE SUMMARY*\n`;
    message += `👥 Total Strength: *${total}*\n`;
    message += `✅ Present: *${presentCount}* (${rate}%)\n`;
    message += `❌ Absent: *${absentCount}*\n`;
    if (lateCount > 0) message += `⚠️ Late: *${lateCount}*\n`;
    if (excusedCount > 0) message += `ℹ️ Excused: *${excusedCount}*\n`;
    if (unmarkedList.length > 0) message += `⚪ Unmarked / Pending: *${unmarkedList.length}*\n`;
    message += `\n`;
  }

  const sortRolls = (rolls: string[]) => {
    return [...rolls].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  };

  if (config.includeAbsentList && absentList.length > 0) {
    const absentRolls = sortRolls(absentList.map(item => item.student.rollNo)).join(', ');
    message += `❌ *Absent Roll Nos (${absentCount}):*\n${absentRolls}\n\n`;
  } else if (config.includeAbsentList && absentList.length === 0) {
    message += `🎉 *100% ATTENDANCE TODAY! No absentees.*\n\n`;
  }

  if (presentList.length > 0) {
    const presentRolls = sortRolls(presentList.map(st => st.rollNo)).join(', ');
    message += `✅ *Present Roll Nos (${presentCount}):*\n${presentRolls}\n\n`;
  }

  if (config.includeLateList && lateList.length > 0) {
    const lateRolls = sortRolls(lateList.map(item => item.student.rollNo)).join(', ');
    message += `⏰ *Late Roll Nos (${lateCount}):*\n${lateRolls}\n\n`;
  }

  if (config.includeRemarks && (config.customNote || session.remarks)) {
    message += `📝 *NOTE / ANNOUNCEMENT:*\n`;
    if (config.customNote) {
      message += `${config.customNote}\n`;
    } else if (session.remarks) {
      message += `${session.remarks}\n`;
    }
    message += `\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `_Generated via School Attendance Dashboard_`;

  return message;
}

export function shareToWhatsApp(text: string, phone?: string): void {
  const encodedText = encodeURIComponent(text);
  let url = '';
  
  if (phone && phone.trim()) {
    // Clean phone number (strip spaces, dashes, parentheses)
    let cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    // If it's a 10-digit Indian mobile number without country code, prefix 91
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  } else {
    // Universal WhatsApp share link that opens chat selector or WhatsApp Web
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export type StudentIdentifierFormat = 'both' | 'name_only' | 'roll_only';
export type RollListStyle = 'numbered' | 'inline';

export interface AbsenteeBroadcastConfig {
  format?: StudentIdentifierFormat;
  rollListStyle?: RollListStyle;
  includeStats?: boolean;
  includeLectureDetails?: boolean;
  customNote?: string;
  subject?: string;
  timeSlot?: string;
  teacherName?: string;
  collegeName?: string;
  departmentName?: string;
  totalEnrolled?: number;
  presentCount?: number;
}

export function generateAbsentParentAlertMessage(
  student: Student,
  dateStr: string,
  classGroup: ClassGroup,
  format: StudentIdentifierFormat = 'both',
  subject?: string,
  timeSlot?: string,
  teacherName?: string,
  collegeName?: string,
  customNote?: string
): string {
  const readableDate = formatDateReadable(dateStr);
  const collegeHeader = collegeName ? `*${collegeName.toUpperCase()}*\n` : '';
  const facultyLine = teacherName ? `\n👨‍🏫 *Faculty:* ${teacherName}` : '';
  const timeDisplay = timeSlot ? ` [${timeSlot}]` : '';

  let studentIdentifier = `*${student.name}* (Roll #${student.rollNo})`;
  let studentRef = student.name;
  if (format === 'name_only') {
    studentIdentifier = `*${student.name}*`;
    studentRef = student.name;
  } else if (format === 'roll_only') {
    studentIdentifier = `student with Roll #${student.rollNo}`;
    studentRef = `Roll #${student.rollNo}`;
  }

  let msg = `🚨 ${collegeHeader}*DAILY ABSENCE ALERT NOTICE*\n\n`;
  msg += `Dear Parent/Guardian of ${studentIdentifier},\n\n`;
  msg += `This is an official intimation from the college that your ward (${studentRef}) was marked *ABSENT* today for:\n`;
  msg += `• *Class:* ${classGroup.name}\n`;
  if (subject) msg += `• *Subject:* ${subject}${timeDisplay}\n`;
  msg += `• *Date:* ${readableDate}${facultyLine}\n\n`;
  
  if (customNote && customNote.trim()) {
    msg += `📝 *Note from Faculty:* ${customNote.trim()}\n\n`;
  }

  msg += `If you have already submitted an official leave application or if this is an unforeseen emergency, kindly notify the faculty/department coordinator.\n\n`;
  msg += `Regards,\n*${teacherName || classGroup.teacherName || 'Department Faculty'}*\n${collegeName || classGroup.name}`;
  return msg;
}

export function generateAbsenteeBroadcastMessage(
  absentStudents: Student[],
  dateStr: string,
  classGroup: ClassGroup,
  formatOrConfig: StudentIdentifierFormat | AbsenteeBroadcastConfig = 'both',
  subjectArg?: string,
  timeSlotArg?: string,
  teacherNameArg?: string,
  collegeNameArg?: string
): string {
  // Normalize args to config
  let config: AbsenteeBroadcastConfig = {};
  if (typeof formatOrConfig === 'string') {
    config = {
      format: formatOrConfig,
      subject: subjectArg,
      timeSlot: timeSlotArg,
      teacherName: teacherNameArg,
      collegeName: collegeNameArg
    };
  } else {
    config = formatOrConfig || {};
  }

  const format: StudentIdentifierFormat = config.format || 'both';
  const rollListStyle: RollListStyle = config.rollListStyle || 'numbered';
  const readableDate = formatDateReadable(dateStr);
  const collegeHeader = config.collegeName ? `🏛️ *${config.collegeName.toUpperCase()}*\n` : '';
  
  const subject = config.subject;
  const timeSlot = config.timeSlot;
  const teacherName = config.teacherName;
  const includeStats = config.includeStats ?? true;

  let msg = `🚨 ${collegeHeader}*OFFICIAL ABSENT STUDENTS NOTICE*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏫 *Class:* ${classGroup.name}\n`;
  if (subject) msg += `📚 *Subject:* ${subject}\n`;
  if (timeSlot) msg += `⏰ *Lecture Slot:* ${timeSlot}\n`;
  msg += `📅 *Date:* ${readableDate}\n`;
  if (teacherName) msg += `👨‍🏫 *Faculty:* ${teacherName}\n`;
  msg += `❌ *Total Absent:* *${absentStudents.length} Students*\n`;

  if (includeStats && config.totalEnrolled && config.totalEnrolled > 0) {
    const present = config.presentCount ?? (config.totalEnrolled - absentStudents.length);
    const rate = ((present / config.totalEnrolled) * 100).toFixed(1);
    msg += `📊 *Attendance:* ${present}/${config.totalEnrolled} Present (${rate}%)\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (absentStudents.length === 0) {
    msg += `🎉 *100% ATTENDANCE TODAY!*\nAll students are present in this lecture.\n\n`;
  } else {
    // Sort absent students by roll number numerically if possible
    const sortedStudents = [...absentStudents].sort((a, b) => {
      const numA = parseInt(a.rollNo.replace(/\D/g, ''), 10);
      const numB = parseInt(b.rollNo.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
    });

    if (format === 'roll_only' && rollListStyle === 'inline') {
      const rollList = sortedStudents.map(st => st.rollNo).join(', ');
      msg += `📋 *Absent Roll Numbers (${sortedStudents.length}):*\n`;
      msg += `${rollList}\n\n`;
    } else {
      msg += `*LIST OF ABSENT STUDENTS TODAY:*\n`;
      sortedStudents.forEach((st, idx) => {
        if (format === 'name_only') {
          msg += `${idx + 1}. *${st.name}*\n`;
        } else if (format === 'roll_only') {
          msg += `${idx + 1}. Roll #${st.rollNo}\n`;
        } else {
          msg += `${idx + 1}. Roll #${st.rollNo} - *${st.name}*\n`;
        }
      });
      msg += `\n`;
    }
  }

  if (config.customNote && config.customNote.trim()) {
    msg += `📝 *ANNOUNCEMENT / NOTE:*\n${config.customNote.trim()}\n\n`;
  }

  msg += `⚠️ _Parents of the above absent students are requested to acknowledge their ward's absence._\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_Generated via Campus Attendance System_`;
  return msg;
}

export function generateParentAlertMessage(
  student: Student,
  status: AttendanceStatus,
  dateStr: string,
  classGroup: ClassGroup,
  subject?: string,
  timeSlot?: string
): string {
  const readableDate = formatDateReadable(dateStr);
  const statusLabel = status.toUpperCase();
  const subjectDisplay = subject ? ` - ${subject}` : '';
  const timeDisplay = timeSlot ? ` [${timeSlot}]` : '';

  let msg = `⚠️ *ATTENDANCE NOTICE*\n\n`;
  msg += `Dear Parent/Guardian of *${student.name}* (Roll #${student.rollNo}),\n\n`;
  msg += `This is an official notice that ${student.name} was marked *${statusLabel}* for *${classGroup.name}${subjectDisplay}*${timeDisplay} on *${readableDate}*.\n\n`;
  
  if (status === 'absent') {
    msg += `If you have already submitted a leave application or if this is an error, please contact the class teacher.\n\n`;
  } else if (status === 'late') {
    msg += `Please ensure your ward reaches the school on time for the scheduled lecture.\n\n`;
  }

  msg += `Regards,\n*${classGroup.teacherName}*\n${classGroup.name}`;
  return msg;
}

export function generateAnalyticsReportMessage(
  classGroup: ClassGroup,
  avgRate: number,
  totalSessions: number,
  defaulters: Student[],
  subject?: string
): string {
  let msg = `📊 *ATTENDANCE ANALYTICS SUMMARY REPORT*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏫 *Class:* ${classGroup.name}\n`;
  msg += `📚 *Subject:* ${subject || classGroup.subject}\n`;
  msg += `📈 *Class Attendance Average:* *${avgRate}%*\n`;
  msg += `📅 *Total Sessions Conducted:* *${totalSessions}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (defaulters.length > 0) {
    msg += `⚠️ *STUDENTS REQUIRING ATTENTION (<75% ATTENDANCE):*\n`;
    defaulters.forEach((st, idx) => {
      msg += `${idx + 1}. Roll #${st.rollNo} - *${st.name}* (Parent: ${st.parentName || 'N/A'})\n`;
    });
    msg += `\n_Parents of these students have been sent attendance alert notices._\n\n`;
  } else {
    msg += `✅ *All students maintain good attendance (≥75%).*\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_Generated via School Attendance Dashboard_`;
  return msg;
}

export function generateDefaulterWarningMessage(
  student: Student,
  classGroup: ClassGroup,
  attendanceRate: number
): string {
  let msg = `🚨 *URGENT ATTENDANCE SHORTAGE WARNING*\n\n`;
  msg += `Dear Parent/Guardian of *${student.name}* (Roll #${student.rollNo}),\n\n`;
  msg += `This is an official intimation regarding the low attendance record of your ward in *${classGroup.name}*.\n\n`;
  msg += `• Current Attendance Rate: *${attendanceRate}%*\n`;
  msg += `• Minimum Required Attendance: *75%*\n\n`;
  msg += `As per institution rules, a minimum of 75% attendance is compulsory to be eligible for upcoming examinations.\n\n`;
  msg += `Please meet the class teacher or contact the administration at your earliest convenience.\n\n`;
  msg += `Regards,\n*${classGroup.teacherName}*\n${classGroup.name}`;
  return msg;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
}
