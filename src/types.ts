export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'unmarked';

export type UserRole = 'hod' | 'teacher';

export interface AuthUser {
  role: UserRole;
  id: string;
  name: string;
  uniqueCode?: string;
  department: string;
  email?: string;
  assignedSubjects?: string[];
  assignedClasses?: string[];
}

export interface Teacher {
  id: string;
  uniqueCode: string; // e.g. "TEACH101"
  passcode: string;   // e.g. "teach123"
  name: string;
  email: string;
  phone: string;
  department: string;
  subjects: string[];
  assignedClasses: string[];
}

export interface Classroom {
  id: string;
  name: string; // e.g. "Room 302", "Computer Lab 1", "Seminar Hall 2"
  building: string;
  capacity: number;
  type: 'classroom' | 'lab' | 'seminar_hall';
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface TimetableSlot {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // e.g. "08:00 AM"
  endTime: string;   // e.g. "09:00 AM"
  timeSlotLabel: string; // e.g. "08:00 AM - 09:00 AM"
  subject: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  gender: 'M' | 'F' | 'Other';
  parentPhone?: string;
  parentName?: string;
  email?: string;
  avatarBg?: string;
  classId?: string;
  remarks?: string;
}

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  timestamp: string; // ISO string
  note?: string;
}

export interface AttendanceSession {
  id: string; // e.g. "class1_2026-09-22" or "class1_2026-09-22_slot1"
  classId: string;
  date: string; // YYYY-MM-DD
  dayOfWeek?: string; // e.g. "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
  sessionName: string; // e.g. "08:00 AM - 09:00 AM - Data Structures"
  teacherName: string;
  teacherId?: string;
  lectureSlotId?: string;
  timeSlot?: string;
  subject?: string;
  records: Record<string, AttendanceRecord>; // studentId -> AttendanceRecord
  lastUpdated: string;
  remarks?: string;
  isRegistered?: boolean;
  isRealSession?: boolean;
}

export interface ClassGroup {
  id: string;
  name: string;
  grade: string;
  section: string;
  subject: string;
  room: string;
  teacherName: string;
  studentIds: string[];
}

export interface SystemSettings {
  collegeName: string; // "D.Y.PATIL TECHNICAL CAMPUS"
  departmentName: string; // "Computer Engineering & Technology"
  hodName: string; // "Dr. S. K. Patil (HOD)"
  hodUsername?: string; // HOD login username e.g. "dyp" or "hod_admin"
  hodPasscode: string; // "DYP-HOD-2026"
  hodPasswordHash?: string; // Cryptographic SHA-256 integrity hash
  defaulterThreshold: number; // e.g. 50 (percentage)
  cloudSyncStatus: 'synced' | 'syncing' | 'offline';
  lastCloudSyncTimestamp: string;
  autoCloudSync: boolean;
}

export interface DefaulterStudentSummary {
  student: Student;
  classGroup: ClassGroup;
  totalLectures: number;
  attendedLectures: number;
  percentage: number;
  isDefaulter: boolean;
  remarks: string;
}

export interface WhatsAppMessageConfig {
  includeAbsentList: boolean;
  includeLateList: boolean;
  includeStats: boolean;
  includeRemarks: boolean;
  customNote: string;
  targetPhone?: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  title: string; // e.g. "Ganesh Chaturthi", "Institutional Holiday"
  declaredBy?: string;
  createdAt?: string;
}
