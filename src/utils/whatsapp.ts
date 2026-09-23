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
  config: WhatsAppMessageConfig
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

  let message = `📋 *DAILY ATTENDANCE REPORT*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🏫 *Class:* ${classGroup.name}\n`;
  message += `📚 *Subject:* ${classGroup.subject}\n`;
  message += `📅 *Date:* ${readableDate}\n`;
  message += `⏰ *Session:* ${session.sessionName}\n`;
  message += `👨‍🏫 *Teacher:* ${session.teacherName || classGroup.teacherName}\n`;
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

  if (config.includeAbsentList && absentList.length > 0) {
    message += `❌ *ABSENT STUDENTS (${absentCount}):*\n`;
    absentList.forEach((item, index) => {
      const noteStr = item.note ? ` _(${item.note})_` : '';
      message += `${index + 1}. Roll #${item.student.rollNo} - *${item.student.name}*${noteStr}\n`;
    });
    message += `\n`;
  } else if (config.includeAbsentList && absentList.length === 0) {
    message += `🎉 *100% ATTENDANCE TODAY! No absentees.*\n\n`;
  }

  if (config.includeLateList && lateList.length > 0) {
    message += `⏰ *LATE ARRIVALS (${lateCount}):*\n`;
    lateList.forEach((item, index) => {
      const noteStr = item.note ? ` _(${item.note})_` : '';
      message += `${index + 1}. Roll #${item.student.rollNo} - *${item.student.name}*${noteStr}\n`;
    });
    message += `\n`;
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
    const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  } else {
    // Universal WhatsApp share link that opens chat selector or WhatsApp Web
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export function generateParentAlertMessage(
  student: Student,
  status: AttendanceStatus,
  dateStr: string,
  classGroup: ClassGroup
): string {
  const readableDate = formatDateReadable(dateStr);
  const statusLabel = status.toUpperCase();

  let msg = `⚠️ *ATTENDANCE NOTICE*\n\n`;
  msg += `Dear Parent/Guardian of *${student.name}* (Roll #${student.rollNo}),\n\n`;
  msg += `This is an official notice that ${student.name} was marked *${statusLabel}* for *${classGroup.name}* on *${readableDate}*.\n\n`;
  
  if (status === 'absent') {
    msg += `If you have already submitted a leave application or if this is an error, please contact the class teacher.\n\n`;
  } else if (status === 'late') {
    msg += `Please ensure your ward reaches the school on time for the morning session.\n\n`;
  }

  msg += `Regards,\n*${classGroup.teacherName}*\n${classGroup.name}`;
  return msg;
}

export function generateAnalyticsReportMessage(
  classGroup: ClassGroup,
  avgRate: number,
  totalSessions: number,
  defaulters: Student[]
): string {
  let msg = `📊 *ATTENDANCE ANALYTICS SUMMARY REPORT*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏫 *Class:* ${classGroup.name}\n`;
  msg += `📚 *Subject:* ${classGroup.subject}\n`;
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
