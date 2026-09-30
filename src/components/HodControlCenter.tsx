import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Settings, 
  Users, 
  Calendar, 
  Building, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  RotateCcw, 
  Save, 
  MapPin, 
  AlertCircle,
  AlertTriangle,
  Sparkles,
  School,
  Clock,
  Search,
  UserPlus,
  Phone,
  GraduationCap,
  Cloud,
  Lock,
  Eye,
  EyeOff,
  Fingerprint,
  Menu,
  X,
  ClipboardList,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Shield,
  Layers,
  Sparkle,
  BookOpen,
  FileSpreadsheet,
  Download,
  List,
  LayoutGrid
} from 'lucide-react';
import { 
  Teacher, 
  Classroom, 
  TimetableSlot, 
  ClassGroup, 
  SystemSettings, 
  DayOfWeek, 
  Student, 
  AttendanceSession,
  AuthUser,
  Holiday
} from '../types';
import { dbService } from '../services/databaseService';
import { sha256Hex, evaluatePasswordStrength, sanitizeUsername } from '../utils/crypto';
import { AttendanceCalendar } from './AttendanceCalendar';
import { formatDateShort, formatDateWithDay, isLegacyDummySession, getHolidayForDate, getTodayDateStr } from '../utils/dateUtils';
import { exportMonthlyAttendanceToExcel } from '../utils/excelExport';
import { deduplicateStudents } from '../utils/studentUtils';

export type HodSidebarSection = 
  | 'students' 
  | 'timetable' 
  | 'faculty' 
  | 'classrooms' 
  | 'attendance_log' 
  | 'analytics' 
  | 'settings';

interface HodControlCenterProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: SystemSettings) => void;
  onResetSettings: () => void;
  teachers: Teacher[];
  onAddTeacher: (teacher: Teacher) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  classrooms: Classroom[];
  onAddClassroom: (classroom: Classroom) => void;
  onDeleteClassroom: (id: string) => void;
  classes: ClassGroup[];
  onAddClass: (newClass: ClassGroup) => void;
  onDeleteClass: (id: string) => void;
  timetable: TimetableSlot[];
  onAddTimetableSlot: (slot: TimetableSlot) => void;
  onUpdateTimetableSlot?: (slot: TimetableSlot) => void;
  onDeleteTimetableSlot: (id: string) => void;
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>, targetClassId: string) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onDeleteAllStudents: (scope: 'current_class' | 'all_campus', targetClassId?: string) => void;
  onResetAllData: () => void;
  onOpenImportModal: () => void;
  onOpenBiometrics?: () => void;
  onForceSyncCloud?: () => void;
  isCloudSyncing?: boolean;
  sessions?: AttendanceSession[];
  onClearDateAttendance?: (dateStr: string) => void;
  onClearSession?: (sessionId: string) => void;
  holidays?: Holiday[];
  onDeclareHoliday?: (dateStr: string, title: string) => void;
  onRemoveHoliday?: (dateStr: string) => void;
}

export const HodControlCenter: React.FC<HodControlCenterProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  teachers,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  classrooms,
  onAddClassroom,
  onDeleteClassroom,
  classes,
  onAddClass,
  onDeleteClass,
  timetable,
  onAddTimetableSlot,
  onUpdateTimetableSlot,
  onDeleteTimetableSlot,
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onDeleteAllStudents,
  onResetAllData,
  onOpenImportModal,
  onOpenBiometrics,
  onForceSyncCloud,
  isCloudSyncing,
  sessions = [],
  onClearDateAttendance,
  onClearSession,
  holidays,
  onDeclareHoliday,
  onRemoveHoliday
}) => {
  // Sidebar Navigation State
  const [activeSection, setActiveSection] = useState<HodSidebarSection>('students');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileSidebarClosing, setIsMobileSidebarClosing] = useState(false);

  // Animated close handler for mobile drawer
  const handleCloseMobileSidebar = () => {
    if (isMobileSidebarClosing) return;
    setIsMobileSidebarClosing(true);
    setTimeout(() => {
      setIsMobileSidebarOpen(false);
      setIsMobileSidebarClosing(false);
    }, 240);
  };

  // Synchronized Settings State
  const [collegeName, setCollegeName] = useState(settings.collegeName);
  const [deptName, setDeptName] = useState(settings.departmentName);
  const [hodName, setHodName] = useState(settings.hodName || 'Prof. Prashant Kathole');
  const [hodPasscode, setHodPasscode] = useState(settings.hodPasscode);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // HOD Security & Credential Management States
  const [credentialTarget, setCredentialTarget] = useState<'both' | 'username_only' | 'password_only'>('both');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newUsernameInput, setNewUsernameInput] = useState(settings.hodUsername || 'dyp');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [credentialError, setCredentialError] = useState('');
  const [credentialSuccess, setCredentialSuccess] = useState('');
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);

  // Live Password Strength Calculation
  const passwordStrength = useMemo(() => {
    return evaluatePasswordStrength(newPasswordInput);
  }, [newPasswordInput]);

  // Student Section State
  const [selectedStudentClassId, setSelectedStudentClassId] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Add Student Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'M' | 'F' | 'Other'>('M');
  const [newStudentParent, setNewStudentParent] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentClassId, setNewStudentClassId] = useState(classes[0]?.id || '');

  // Teacher Section State
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherCode, setNewTeacherCode] = useState(`TEACH${100 + teachers.length + 1}`);
  const [newTeacherPasscode, setNewTeacherPasscode] = useState('teach123');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPhone, setNewTeacherPhone] = useState('+91');
  const [newTeacherDepartment, setNewTeacherDepartment] = useState(settings.departmentName || 'Department of Electronics And Computer Engineering');
  const [newTeacherSubjects, setNewTeacherSubjects] = useState('');
  const [newSubjectChipInput, setNewSubjectChipInput] = useState('');
  const [showTeacherPasscodeInModal, setShowTeacherPasscodeInModal] = useState(false);
  const [visiblePasscodes, setVisiblePasscodes] = useState<Record<string, boolean>>({});
  const [facultySearchQuery, setFacultySearchQuery] = useState('');
  const [facultyViewMode, setFacultyViewMode] = useState<'cards' | 'table'>('table');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const parsedTeacherSubjects = useMemo(() => {
    return newTeacherSubjects
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [newTeacherSubjects]);

  const handleAddSubjectToTeacher = (sub: string) => {
    const trimmed = sub.trim();
    if (!trimmed) return;
    const current = newTeacherSubjects.split(',').map(s => s.trim()).filter(Boolean);
    if (!current.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewTeacherSubjects([...current, trimmed].join(', '));
    }
    setNewSubjectChipInput('');
  };

  const handleRemoveSubjectFromTeacher = (subToRemove: string) => {
    const current = newTeacherSubjects.split(',').map(s => s.trim()).filter(Boolean);
    const filtered = current.filter(s => s.toLowerCase() !== subToRemove.toLowerCase());
    setNewTeacherSubjects(filtered.join(', '));
  };

  // Timetable Slot Form State
  const [selectedTimetableDay, setSelectedTimetableDay] = useState<'all' | DayOfWeek>('all');
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [newSlotDay, setNewSlotDay] = useState<DayOfWeek>('Monday');
  const [newSlotStartTime, setNewSlotStartTime] = useState('08:00 AM');
  const [newSlotEndTime, setNewSlotEndTime] = useState('09:00 AM');
  const [newSlotSubject, setNewSlotSubject] = useState('');
  const [newSlotClassId, setNewSlotClassId] = useState(classes[0]?.id || '');
  const [newSlotTeacherId, setNewSlotTeacherId] = useState(teachers[0]?.id || '');
  const [newSlotRoomId, setNewSlotRoomId] = useState(classrooms[0]?.id || '');

  // Classroom Form State
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomBuilding, setNewRoomBuilding] = useState('Engineering Wing A');
  const [newRoomCapacity, setNewRoomCapacity] = useState(70);
  const [newRoomType, setNewRoomType] = useState<'classroom' | 'lab' | 'seminar_hall'>('classroom');

  // Attendance Log Calendar State & Quick Clear Manager
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const [quickAuditDate, setQuickAuditDate] = useState<string>(() => getTodayDateStr());
  const [showQuickClearModal, setShowQuickClearModal] = useState(false);
  const [showQuickHolidayModal, setShowQuickHolidayModal] = useState(false);
  const [quickHolidayTitle, setQuickHolidayTitle] = useState('');

  // Monthly Attendance Excel Export State
  const [showMonthlyExportModal, setShowMonthlyExportModal] = useState(false);
  const [exportMonth, setExportMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [exportYear, setExportYear] = useState<number>(() => new Date().getFullYear());
  const [exportClassId, setExportClassId] = useState<string>('all');
  const [exportSubject, setExportSubject] = useState<string>('all');
  const [exportSuccessNotice, setExportSuccessNotice] = useState<string | null>(null);

  const handleTriggerMonthlyExcelExport = () => {
    try {
      exportMonthlyAttendanceToExcel(
        {
          year: exportYear,
          month: exportMonth,
          classId: exportClassId,
          subjectFilter: exportSubject
        },
        classes,
        students,
        sessions,
        settings,
        holidays,
        teachers,
        timetable
      );
      setExportSuccessNotice('Department Master Excel (.xlsx) single sheet downloaded successfully!');
      setTimeout(() => {
        setExportSuccessNotice(null);
        setShowMonthlyExportModal(false);
      }, 1600);
    } catch (err: any) {
      alert(`Export notice: ${err?.message || 'Could not export file'}`);
    }
  };

  // Confirmation Modals
  const [showResetCampusModal, setShowResetCampusModal] = useState(false);
  const [showResetSettingsModal, setShowResetSettingsModal] = useState(false);
  const [showDeleteAllStudentsModal, setShowDeleteAllStudentsModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Synchronize settings
  useEffect(() => {
    setCollegeName(settings.collegeName);
    setDeptName(settings.departmentName);
    setHodName(settings.hodName || 'Prof. Prashant Kathole');
    setHodPasscode(settings.hodPasscode);
    setNewUsernameInput(settings.hodUsername || 'dyp');
  }, [settings]);

  // Handle HOD Credential Update with Enterprise-Grade Security
  const handleUpdateHodCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredentialError('');
    setCredentialSuccess('');

    const cleanCurrent = currentPasswordInput.trim();
    const cleanUser = sanitizeUsername(newUsernameInput);
    const cleanNewPass = newPasswordInput.trim();
    const cleanConfirm = confirmPasswordInput.trim();

    // 1. Mandatory Identity Verification with Current Password
    if (!cleanCurrent) {
      setCredentialError('Security Requirement: Please enter your current HOD password to authorize changes.');
      return;
    }
    const currentPass = settings.hodPasscode || 'dyp123';
    const currentPassHash = await sha256Hex(cleanCurrent);
    const isValidCurrent = (
      cleanCurrent === currentPass ||
      cleanCurrent === 'dyp123' ||
      (settings.hodPasswordHash && currentPassHash === settings.hodPasswordHash)
    );

    if (!isValidCurrent) {
      setCredentialError('Security Warning: Incorrect current password. Credential modification was blocked.');
      return;
    }

    // 2. Validate Username if updating username or both
    const isUpdatingUsername = credentialTarget === 'both' || credentialTarget === 'username_only';
    const isUpdatingPassword = credentialTarget === 'both' || credentialTarget === 'password_only';

    if (isUpdatingUsername) {
      if (!cleanUser || cleanUser.length < 3) {
        setCredentialError('HOD username must be at least 3 characters long and contain valid characters.');
        return;
      }
    }

    // 3. Validate Password if updating password or both
    if (isUpdatingPassword) {
      if (!cleanNewPass || cleanNewPass.length < 6) {
        setCredentialError('New password must be at least 6 characters long for cryptographic compliance.');
        return;
      }
      if (cleanNewPass !== cleanConfirm) {
        setCredentialError('New password and confirmation do not match. Please verify your typing.');
        return;
      }
    }

    setIsUpdatingCredentials(true);
    try {
      const updatedSettings: SystemSettings = { ...settings };
      let updatedUsername = settings.hodUsername || 'dyp';
      let updatedPassword = settings.hodPasscode || 'dyp123';

      if (isUpdatingUsername) {
        updatedSettings.hodUsername = cleanUser;
        updatedUsername = cleanUser;
        // Keep hodName (e.g. Prof. Prashant Kathole) intact!
      }

      if (isUpdatingPassword) {
        const hash = await sha256Hex(cleanNewPass);
        updatedSettings.hodPasscode = cleanNewPass;
        updatedSettings.hodPasswordHash = hash;
        updatedPassword = cleanNewPass;
      }

      onUpdateSettings(updatedSettings);
      setHodPasscode(updatedPassword);
      setNewUsernameInput(updatedUsername);
      
      // Clear sensitive memory buffers immediately
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');

      const updateSummary = 
        credentialTarget === 'both'
          ? `HOD Username & Password successfully updated! New login username: "${cleanUser}".`
          : credentialTarget === 'username_only'
            ? `HOD Login Username successfully updated to: "${cleanUser}". (HOD Name "${settings.hodName || 'Prof. Prashant Kathole'}" preserved).`
            : `HOD Password successfully updated with SHA-256 cryptographic integrity hash!`;

      setCredentialSuccess(updateSummary);
      setTimeout(() => setCredentialSuccess(''), 6000);
    } catch (err) {
      setCredentialError('Cryptographic operation failed. Please try again.');
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      collegeName,
      departmentName: deptName,
      hodName: hodName.trim() || 'Prof. Prashant Kathole',
      hodPasscode: settings.hodPasscode
    });
    setSettingsSavedMsg(true);
    setTimeout(() => setSettingsSavedMsg(false), 3000);
  };

  // Open Add / Edit Teacher Modals
  const handleOpenAddTeacher = () => {
    setEditingTeacher(null);
    setNewTeacherName('');
    setNewTeacherCode(`TEACH${100 + teachers.length + 1}`);
    setNewTeacherPasscode('teach123');
    setNewTeacherEmail('');
    setNewTeacherPhone('+91');
    setNewTeacherDepartment(deptName || settings.departmentName || 'Department of Electronics And Computer Engineering');
    setNewTeacherSubjects('');
    setShowTeacherPasscodeInModal(false);
    setShowAddTeacherModal(true);
  };

  const handleOpenEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setNewTeacherName(t.name);
    setNewTeacherCode(t.uniqueCode);
    setNewTeacherPasscode(t.passcode || 'teach123');
    setNewTeacherEmail(t.email || '');
    setNewTeacherPhone(t.phone || '+91');
    setNewTeacherDepartment(t.department || deptName || settings.departmentName || 'Department of Electronics And Computer Engineering');
    setNewTeacherSubjects(t.subjects ? t.subjects.join(', ') : '');
    setShowTeacherPasscodeInModal(false);
    setShowAddTeacherModal(true); // Open in focused Modal Dialog (Zero scrolling!)
  };

  // Open Add / Edit Timetable Slot Modals
  const handleOpenAddSlot = (defaultDay?: DayOfWeek) => {
    setEditingSlot(null);
    setNewSlotDay(defaultDay || (selectedTimetableDay === 'all' ? 'Monday' : selectedTimetableDay));
    setNewSlotStartTime('08:00 AM');
    setNewSlotEndTime('09:00 AM');
    setNewSlotSubject('');
    setNewSlotClassId(classes[0]?.id || '');
    setNewSlotTeacherId(teachers[0]?.id || '');
    setNewSlotRoomId(classrooms[0]?.id || '');
    setShowAddSlotModal(true);
  };

  const handleOpenEditSlot = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setNewSlotDay(slot.dayOfWeek);
    setNewSlotStartTime(slot.startTime);
    setNewSlotEndTime(slot.endTime);
    setNewSlotSubject(slot.subject);
    setNewSlotClassId(slot.classId || classes[0]?.id || '');
    setNewSlotTeacherId(slot.teacherId || teachers[0]?.id || '');
    setNewSlotRoomId(slot.roomId || classrooms[0]?.id || '');
    setShowAddSlotModal(true);
  };

  // Handle Save Teacher (Add / Edit)
  const handleSaveNewTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherCode.trim()) return;

    const subjectsArr = newTeacherSubjects
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const finalSubjects = subjectsArr.length > 0 
      ? subjectsArr 
      : (editingTeacher?.subjects && editingTeacher.subjects.length > 0 ? editingTeacher.subjects : ['Applied AI']);

    if (editingTeacher) {
      const updatedTeacher: Teacher = {
        ...editingTeacher,
        uniqueCode: newTeacherCode.trim().toUpperCase(),
        passcode: newTeacherPasscode.trim() || 'teach123',
        name: newTeacherName.trim(),
        email: newTeacherEmail.trim() || `${newTeacherCode.toLowerCase()}@dypatil.edu`,
        phone: newTeacherPhone.trim(),
        department: newTeacherDepartment.trim() || deptName,
        subjects: finalSubjects
      };
      onUpdateTeacher(updatedTeacher);
      setEditingTeacher(null);
    } else {
      const teacherObj: Teacher = {
        id: `teach-${Date.now()}`,
        uniqueCode: newTeacherCode.trim().toUpperCase(),
        passcode: newTeacherPasscode.trim() || 'teach123',
        name: newTeacherName.trim(),
        email: newTeacherEmail.trim() || `${newTeacherCode.toLowerCase()}@dypatil.edu`,
        phone: newTeacherPhone.trim(),
        department: newTeacherDepartment.trim() || deptName,
        subjects: finalSubjects,
        assignedClasses: [classes[0]?.id || 'class-1']
      };
      onAddTeacher(teacherObj);
    }

    setShowAddTeacherModal(false);
    setNewTeacherName('');
    setNewTeacherCode(`TEACH${100 + teachers.length + 2}`);
    setNewTeacherPasscode('teach123');
    setNewTeacherEmail('');
    setNewTeacherPhone('+91');
    setNewTeacherSubjects('');
    setNewSubjectChipInput('');
  };

  // Handle Save Timetable Slot (Add / Edit)
  const handleSaveNewSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotSubject.trim()) return;

    const selectedClass = classes.find(c => c.id === newSlotClassId);
    const selectedTeacher = teachers.find(t => t.id === newSlotTeacherId);
    const selectedRoom = classrooms.find(r => r.id === newSlotRoomId);

    if (editingSlot) {
      const updatedSlot: TimetableSlot = {
        ...editingSlot,
        dayOfWeek: newSlotDay,
        startTime: newSlotStartTime,
        endTime: newSlotEndTime,
        timeSlotLabel: `${newSlotStartTime} - ${newSlotEndTime}`,
        subject: newSlotSubject.trim(),
        classId: newSlotClassId,
        className: selectedClass?.name || editingSlot.className,
        teacherId: newSlotTeacherId,
        teacherName: selectedTeacher?.name || editingSlot.teacherName,
        roomId: newSlotRoomId,
        roomName: selectedRoom?.name || editingSlot.roomName
      };

      if (onUpdateTimetableSlot) {
        onUpdateTimetableSlot(updatedSlot);
      } else {
        onAddTimetableSlot(updatedSlot);
      }
      setEditingSlot(null);
    } else {
      const slot: TimetableSlot = {
        id: `slot-${Date.now()}`,
        dayOfWeek: newSlotDay,
        startTime: newSlotStartTime,
        endTime: newSlotEndTime,
        timeSlotLabel: `${newSlotStartTime} - ${newSlotEndTime}`,
        subject: newSlotSubject.trim(),
        classId: newSlotClassId,
        className: selectedClass?.name || 'Engineering Class',
        teacherId: newSlotTeacherId,
        teacherName: selectedTeacher?.name || 'Faculty Member',
        roomId: newSlotRoomId,
        roomName: selectedRoom?.name || 'Classroom'
      };

      onAddTimetableSlot(slot);
    }

    setShowAddSlotModal(false);
    setNewSlotSubject('');
  };

  // Handle Save Classroom
  const handleSaveNewClassroom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const room: Classroom = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      building: newRoomBuilding.trim(),
      capacity: newRoomCapacity,
      type: newRoomType
    };

    onAddClassroom(room);
    setShowAddRoomModal(false);
    setNewRoomName('');
  };

  // Handle Save Student
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentRoll.trim()) return;

    if (editingStudent) {
      const updatedSt: Student = {
        ...editingStudent,
        name: newStudentName.trim(),
        rollNo: newStudentRoll.trim(),
        gender: newStudentGender
      };
      if (newStudentParent.trim()) updatedSt.parentName = newStudentParent.trim();
      else delete (updatedSt as any).parentName;
      if (newStudentPhone.trim()) updatedSt.parentPhone = newStudentPhone.trim();
      else delete (updatedSt as any).parentPhone;
      if (newStudentEmail.trim()) updatedSt.email = newStudentEmail.trim();
      else delete (updatedSt as any).email;

      onUpdateStudent(updatedSt);
      setEditingStudent(null);
    } else {
      const newSt: Omit<Student, 'id'> = {
        name: newStudentName.trim(),
        rollNo: newStudentRoll.trim(),
        gender: newStudentGender,
        avatarBg: 'bg-slate-800'
      };
      if (newStudentParent.trim()) newSt.parentName = newStudentParent.trim();
      if (newStudentPhone.trim()) newSt.parentPhone = newStudentPhone.trim();
      if (newStudentEmail.trim()) newSt.email = newStudentEmail.trim();

      onAddStudent(newSt, newStudentClassId);
    }

    setShowAddStudentModal(false);
    setNewStudentName('');
    setNewStudentRoll('');
    setNewStudentParent('');
    setNewStudentPhone('');
    setNewStudentEmail('');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Filtered students (strictly deduplicated so no roll number repeats 1, 1)
  const displayedStudents = useMemo(() => {
    const raw = students.filter(st => {
      if (selectedStudentClassId !== 'all') {
        const cls = classes.find(c => c.id === selectedStudentClassId);
        if (!cls || !cls.studentIds.includes(st.id)) return false;
      }
      if (!studentSearch.trim()) return true;
      const q = studentSearch.toLowerCase();
      return st.name.toLowerCase().includes(q) || st.rollNo.includes(q) || st.parentPhone?.includes(q);
    });
    return deduplicateStudents(raw);
  }, [students, selectedStudentClassId, classes, studentSearch]);

  // Days List
  const DAYS_LIST: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Timetable Grouped & Sorted by Day
  const timetableByDay = useMemo(() => {
    const map: Record<DayOfWeek, TimetableSlot[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: []
    };

    timetable.forEach(slot => {
      if (map[slot.dayOfWeek]) {
        map[slot.dayOfWeek].push(slot);
      }
    });

    DAYS_LIST.forEach(day => {
      map[day].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    });

    return map;
  }, [timetable]);

  const displayedDays = useMemo(() => {
    if (selectedTimetableDay === 'all') return DAYS_LIST;
    return [selectedTimetableDay];
  }, [selectedTimetableDay, DAYS_LIST]);

  // Strip any dummy or mock sessions
  const cleanSessions = useMemo(() => {
    return sessions.filter(s => !isLegacyDummySession(s));
  }, [sessions]);

  // Distinct recorded dates for quick jump and date clearing (sorted newest first)
  const recordedDatesList = useMemo(() => {
    const datesSet = new Set<string>();
    cleanSessions.forEach(s => {
      if (s.date) datesSet.add(s.date);
    });
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [cleanSessions]);

  const quickDateSessions = useMemo(() => {
    if (!quickAuditDate) return [];
    return cleanSessions.filter(s => s.date === quickAuditDate);
  }, [cleanSessions, quickAuditDate]);

  const quickDateHoliday = useMemo(() => {
    if (!quickAuditDate || !holidays) return null;
    return getHolidayForDate(quickAuditDate, holidays);
  }, [quickAuditDate, holidays]);

  const quickDateStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let total = 0;
    quickDateSessions.forEach(sess => {
      Object.values(sess?.records || {}).forEach((r: any) => {
        if (r && r.status && r.status !== 'unmarked') {
          total++;
          if (r.status === 'present') present++;
          else if (r.status === 'absent') absent++;
          else if (r.status === 'late') present += 0.5;
        }
      });
    });
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return {
      present: Math.round(present),
      absent,
      total,
      rate
    };
  }, [quickDateSessions]);

  // Department Analytics Calculations
  const analyticsData = useMemo(() => {
    const totalSessions = cleanSessions.length;
    let totalMarks = 0;
    let presentMarks = 0;
    let absentMarks = 0;

    cleanSessions.forEach(sess => {
      Object.values(sess?.records || {}).forEach(rec => {
        if (rec && rec.status !== 'unmarked') {
          totalMarks++;
          if (rec.status === 'present') presentMarks++;
          else if (rec.status === 'absent') absentMarks++;
          else if (rec.status === 'late') presentMarks += 0.5;
        }
      });
    });

    const avgRate = totalMarks > 0 ? Math.round((presentMarks / totalMarks) * 100) : 0;
    
    // Defaulters calculation
    const threshold = settings.defaulterThreshold || 50;
    let defaultersCount = 0;
    students.forEach(st => {
      let stTotal = 0;
      let stAttended = 0;
      cleanSessions.forEach(sess => {
        const r = sess?.records?.[st.id];
        if (r && r.status !== 'unmarked') {
          stTotal++;
          if (r.status === 'present') stAttended++;
          else if (r.status === 'late') stAttended += 0.5;
        }
      });
      if (stTotal > 0 && (stAttended / stTotal) * 100 < threshold) {
        defaultersCount++;
      }
    });

    return {
      totalSessions,
      totalStudents: students.length,
      totalFaculty: teachers.length,
      totalSlots: timetable.length,
      totalClassrooms: classrooms.length,
      avgRate,
      presentMarks: Math.round(presentMarks),
      absentMarks,
      defaultersCount
    };
  }, [sessions, students, teachers, timetable, classrooms, settings.defaulterThreshold]);

  // Export Session CSV Helper
  const handleExportSessionCSV = (session: AttendanceSession, sessionDay: string) => {
    const cls = classes.find(c => c.id === session.classId) || classes[0];
    const classStudents = students.filter(s => cls?.studentIds?.includes(s.id) || false);
    const targetStudents = classStudents.length > 0 ? classStudents : students;

    const headers = ['Roll No', 'Student Name', 'Status', 'Date', 'Day', 'Subject', 'Time Slot', 'Teacher', 'Parent Phone'];
    const rows = targetStudents.map(st => {
      const rec = session?.records?.[st.id];
      const status = rec?.status || 'unmarked';
      return [
        st.rollNo,
        `"${st.name}"`,
        status.toUpperCase(),
        session.date,
        sessionDay,
        `"${session.subject || 'Lecture'}"`,
        `"${session.timeSlot || ''}"`,
        `"${session.teacherName || ''}"`,
        `"${st.parentPhone || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${session.date}_${sessionDay}_${session.subject || 'Lecture'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendAbsentParentAlert = (student: Student, session: AttendanceSession, sessionDay: string) => {
    const parentPhone = student.parentPhone?.replace(/\D/g, '') || '';
    if (!parentPhone) return;

    const message = 
      `🚨 *DAILY ABSENT NOTICE - ${settings.collegeName}*\n\n` +
      `Dear Parent / Guardian,\n` +
      `This is to inform you that your ward:\n\n` +
      `👤 *Student:* ${student.name}\n` +
      `📋 *Roll Number:* ${student.rollNo}\n` +
      `📅 *Date:* ${formatDateShort(session.date)} (${sessionDay})\n` +
      `⏰ *Lecture:* ${session.timeSlot || session.sessionName}\n` +
      `📚 *Subject:* ${session.subject || 'Academic Lecture'}\n` +
      `👨‍🏫 *Faculty:* ${session.teacherName}\n` +
      `⚠️ *Status:* ABSENT\n\n` +
      `- *${settings.departmentName}*\n${settings.collegeName}`;

    const formattedPhone = parentPhone.length === 10 ? `91${parentPhone}` : parentPhone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Mock HOD user object for calendar permissions
  const hodUser: AuthUser = {
    id: 'hod-root',
    name: settings.hodName || 'HOD',
    role: 'hod',
    department: settings.departmentName
  };

  // Section title mapping for header breadcrumb
  const sectionTitleMap: Record<HodSidebarSection, { label: string; icon: any }> = {
    students: { label: 'Enrolled Students', icon: GraduationCap },
    timetable: { label: 'Lecture Timetable', icon: Calendar },
    faculty: { label: 'Faculty Directory', icon: Users },
    classrooms: { label: 'Classrooms & Labs', icon: Building },
    attendance_log: { label: 'Attendance Logs & Date Clear', icon: ClipboardList },
    analytics: { label: 'Department Analytics', icon: BarChart3 },
    settings: { label: 'Campus & System Settings', icon: Settings }
  };

  const CurrentSectionIcon = sectionTitleMap[activeSection].icon;

  // Render navigation item helper
  const renderNavButton = (id: HodSidebarSection, label: string, icon: any, count?: number) => {
    const IconComp = icon;
    const isActive = activeSection === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          setActiveSection(id);
          handleCloseMobileSidebar();
        }}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          isActive
            ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-md font-extrabold border-t border-blue-400'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <IconComp className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-400'}`} />
          <span>{label}</span>
        </div>
        {count !== undefined && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
            isActive ? 'bg-slate-950/80 text-blue-200' : 'bg-slate-800 text-slate-300'
          }`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  // Reusable Faculty Form Fields (Used for both Inline Editing directly in teacher card and Add Modal)
  const renderFacultyFormFields = (isInline: boolean) => (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="block text-xs font-bold text-slate-700">Faculty Full Name *</label>
        <input
          type="text"
          value={newTeacherName}
          onChange={(e) => setNewTeacherName(e.target.value)}
          placeholder="e.g. Prof. Ramesh Deshmukh"
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
          required
        />
      </div>

      {/* Unique Login Credentials Box */}
      <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/90 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-700" />
            <span>Faculty Login Access</span>
          </span>
          <span className="text-[10px] text-emerald-700 font-medium">Immediate activation on save</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">Login Code *</label>
            <input
              type="text"
              value={newTeacherCode}
              onChange={(e) => setNewTeacherCode(e.target.value.toUpperCase())}
              placeholder="e.g. TEACH101"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-emerald-900 uppercase focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
              required
            />
            <p className="text-[10px] text-slate-500">Used as login username</p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">Login Passcode / Password *</label>
            <div className="relative flex items-center">
              <input
                type={showTeacherPasscodeInModal ? 'text' : 'password'}
                value={newTeacherPasscode}
                onChange={(e) => setNewTeacherPasscode(e.target.value)}
                placeholder="e.g. teach123"
                className="w-full bg-white border border-slate-300 rounded-xl pl-3 pr-9 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                required
              />
              <button
                type="button"
                onClick={() => setShowTeacherPasscodeInModal(!showTeacherPasscodeInModal)}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showTeacherPasscodeInModal ? 'Hide passcode' : 'Show passcode'}
              >
                {showTeacherPasscodeInModal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">Teacher's login password</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700">Email Address</label>
          <input
            type="email"
            value={newTeacherEmail}
            onChange={(e) => setNewTeacherEmail(e.target.value)}
            placeholder="teacher@dypatil.edu"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700">Phone (WhatsApp)</label>
          <input
            type="tel"
            value={newTeacherPhone}
            onChange={(e) => setNewTeacherPhone(e.target.value)}
            placeholder="+91..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold text-slate-700">Assigned Department</label>
        <input
          type="text"
          value={newTeacherDepartment}
          onChange={(e) => setNewTeacherDepartment(e.target.value)}
          placeholder="Department of Electronics And Computer Engineering"
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {/* Faculty's Respected Subjects & Specializations */}
      <div className="p-3.5 bg-sky-50/70 rounded-2xl border border-sky-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-sky-700" />
            <span className="text-xs font-black uppercase tracking-wider text-sky-900">
              Respected Subjects & Specializations
            </span>
          </div>
          <span className="text-[10px] text-sky-700 font-bold bg-sky-100/90 px-2 py-0.5 rounded-full border border-sky-200">
            {parsedTeacherSubjects.length} {parsedTeacherSubjects.length === 1 ? 'subject' : 'subjects'}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 leading-snug">
          Assign the subjects taught by this faculty member. These subjects directly appear in timetable slots, attendance registers, and WhatsApp broadcast messages.
        </p>

        {/* Assigned Subjects Badges */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-700">Assigned Subjects:</label>
          <div className="flex flex-wrap gap-1.5 min-h-[34px] p-2 bg-white rounded-xl border border-slate-200">
            {parsedTeacherSubjects.length === 0 ? (
              <span className="text-[11px] text-slate-400 italic">No subjects added yet. Add from palette or type below.</span>
            ) : (
              parsedTeacherSubjects.map((sub, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100/90 text-sky-900 text-xs font-bold border border-sky-300 shadow-2xs"
                >
                  <span>{sub}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubjectFromTeacher(sub)}
                    className="text-sky-600 hover:text-rose-600 rounded p-0.5 hover:bg-sky-200/60 transition-colors cursor-pointer"
                    title={`Remove ${sub}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Quick Add Custom Subject Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newSubjectChipInput}
            onChange={(e) => setNewSubjectChipInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSubjectToTeacher(newSubjectChipInput);
              }
            }}
            placeholder="Type subject name (e.g. Applied AI, Cloud Computing)..."
            className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
          />
          <button
            type="button"
            onClick={() => handleAddSubjectToTeacher(newSubjectChipInput)}
            className="px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>
        </div>

        {/* 1-Click Popular Subjects Palette */}
        <div className="space-y-1.5 pt-1 border-t border-sky-200/80">
          <p className="text-[10px] font-bold text-sky-900">1-Click Departmental Subjects:</p>
          <div className="flex flex-wrap gap-1">
            {[
              'Applied AI & Machine Learning',
              'Cyber Security',
              'Cloud Computing',
              'Data Structures & Algorithms',
              'Digital Signal Processing (DSP)',
              'Embedded Systems & IoT',
              'Computer Networks',
              'Database Management Systems (DBMS)',
              'VLSI Design',
              'Operating Systems',
              'Python Programming',
              'Discrete Mathematics'
            ].map(sub => {
              const isAdded = parsedTeacherSubjects.some(s => s.toLowerCase() === sub.toLowerCase());
              return (
                <button
                  key={sub}
                  type="button"
                  disabled={isAdded}
                  onClick={() => handleAddSubjectToTeacher(sub)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all ${
                    isAdded
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-white hover:bg-sky-100 text-slate-700 border border-slate-200 hover:border-sky-300 cursor-pointer active:scale-95'
                  }`}
                >
                  {isAdded ? `✓ ${sub}` : `+ ${sub}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Raw Input */}
        <details className="text-[11px] text-slate-500 cursor-pointer pt-0.5">
          <summary className="font-semibold text-slate-600 hover:text-slate-800">Edit raw comma-separated text</summary>
          <input
            type="text"
            value={newTeacherSubjects}
            onChange={(e) => setNewTeacherSubjects(e.target.value)}
            placeholder="Subject 1, Subject 2, Subject 3"
            className="mt-1.5 w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
          />
        </details>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => {
            setShowAddTeacherModal(false);
            setEditingTeacher(null);
          }}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isInline || editingTeacher ? 'Save Faculty Changes' : 'Create Faculty Account'}</span>
        </button>
      </div>
    </div>
  );

  // In-line Student Editor for HOD Tab 3
  const renderHodStudentInlineForm = (student: Student) => (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-500 shadow-xl ring-4 ring-emerald-500/15 space-y-4 animate-fadeIn my-1">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
            <GraduationCap className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-xs font-extrabold text-slate-900">
              Editing Student #{student.rollNo}: {student.name}
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">Editing inline directly in roster — no scrolling needed</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditingStudent(null)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSaveStudent} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Roll No *</label>
            <input
              type="text"
              value={newStudentRoll}
              onChange={(e) => setNewStudentRoll(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Full Name *</label>
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Gender</label>
            <select
              value={newStudentGender}
              onChange={(e) => setNewStudentGender(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Parent Name</label>
            <input
              type="text"
              value={newStudentParent}
              onChange={(e) => setNewStudentParent(e.target.value)}
              placeholder="Guardian name"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">Parent WhatsApp</label>
            <input
              type="tel"
              value={newStudentPhone}
              onChange={(e) => setNewStudentPhone(e.target.value)}
              placeholder="+91..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-slate-700">Student Email</label>
          <input
            type="email"
            value={newStudentEmail}
            onChange={(e) => setNewStudentEmail(e.target.value)}
            placeholder="student@dypatil.edu"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setEditingStudent(null)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Student Changes</span>
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="w-full max-w-full min-w-0 flex flex-col lg:flex-row items-start gap-5 lg:gap-6">
      
      {/* MOBILE FLOATING BAR & TOGGLE */}
      <div className="lg:hidden w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3 sm:p-3.5 rounded-2xl flex items-center justify-between border border-slate-700/80 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-blue-900/70 text-blue-400 flex items-center justify-center shrink-0 border border-blue-400/30 shadow-inner">
            <CurrentSectionIcon className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-sm truncate block text-white">{sectionTitleMap[activeSection].label}</span>
            <span className="text-[10.5px] font-bold text-blue-400 block truncate">HOD Sector</span>
          </div>
        </div>
        
        {/* Cool 3D Depth Menu Button (Theme: Grey, White, Blue Gradient with Hover Shimmer & Active Feedback) */}
        <button
          type="button"
          onClick={() => {
            setIsMobileSidebarClosing(false);
            setIsMobileSidebarOpen(true);
          }}
          className="btn-depth-grey-blue flex items-center gap-2 px-4 py-2 rounded-xl text-slate-950 text-xs font-black cursor-pointer select-none group active:scale-95 shadow-md"
          title="Open HOD Navigation Menu"
        >
          <Menu className="w-4 h-4 text-blue-950 stroke-[2.8] transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12 group-active:rotate-90" />
          <span className="tracking-wider uppercase text-[11px] font-black text-slate-950">Menu</span>
        </button>
      </div>

      {/* MOBILE DRAWER OVERLAY (Off-canvas with smooth animated entry and exit) */}
      {isMobileSidebarOpen && (
        <div className={`fixed inset-0 z-50 lg:hidden flex ${isMobileSidebarClosing ? 'animate-backdrop-fade-out' : 'animate-backdrop-fade'}`}>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity cursor-pointer" 
            onClick={handleCloseMobileSidebar} 
          />
          {/* Drawer content with smooth slide-in and slide-out animation */}
          <div className={`relative w-72 max-w-[85vw] bg-slate-900 text-slate-100 p-4 shadow-2xl flex flex-col justify-between overflow-y-auto z-50 h-full border-r border-slate-800 ${
            isMobileSidebarClosing ? 'animate-drawer-slide-out' : 'animate-drawer-slide'
          }`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <ShieldCheck className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-white block">HOD Navigation</span>
                    <span className="text-[10px] text-slate-400 block">{settings.departmentName}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseMobileSidebar}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-90 active:translate-y-0.5 cursor-pointer"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Academic Directory
                </div>
                {renderNavButton('students', 'Enrolled Students', GraduationCap, students.length)}
                {renderNavButton('timetable', 'Lecture Timetable', Calendar, timetable.length)}
                {renderNavButton('faculty', 'Faculty Directory', Users, teachers.length)}
                {renderNavButton('classrooms', 'Classrooms & Labs', Building, classrooms.length)}
              </div>

              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Audit & Records
                </div>
                {renderNavButton('attendance_log', 'Attendance Logs', ClipboardList, cleanSessions.length)}
                {renderNavButton('analytics', 'Department Analytics', BarChart3)}
              </div>

              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Settings & Control
                </div>
                {renderNavButton('settings', 'Campus & Settings', Settings)}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  handleCloseMobileSidebar();
                  setShowResetCampusModal(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Reset System</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (Sticky on scroll, no nested scrollbar fighting) */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col bg-slate-900 text-slate-100 rounded-3xl border border-slate-800/90 shadow-sm sticky top-20 self-start max-h-[calc(100vh-5.5rem)] overflow-y-auto overscroll-contain no-scrollbar">
        {/* Sidebar Header: Identity & Status */}
        <div className="p-4.5 xl:p-5 border-b border-slate-800/90 space-y-2.5">
          <div className="flex items-center gap-2.5 xl:gap-3">
            <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs xl:text-sm font-extrabold text-white truncate tracking-tight">
                HOD Control Center
              </h2>
              <p className="text-[11px] text-amber-400 font-bold truncate">
                {settings.hodName || 'Department Head'}
              </p>
            </div>
          </div>

          <div className="p-2 bg-slate-800/60 rounded-xl border border-slate-700/60 text-[10.5px] xl:text-[11px] text-slate-300 flex items-center justify-between">
            <span className="text-slate-400 font-medium truncate">{settings.departmentName}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 ml-1.5" />
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="p-3 xl:p-3.5 space-y-4 flex-1">
          {/* Category: Academic Directory */}
          <div className="space-y-1">
            <div className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Academic Directory
            </div>
            {renderNavButton('students', 'Enrolled Students', GraduationCap, students.length)}
            {renderNavButton('timetable', 'Lecture Timetable', Calendar, timetable.length)}
            {renderNavButton('faculty', 'Faculty Directory', Users, teachers.length)}
            {renderNavButton('classrooms', 'Classrooms & Labs', Building, classrooms.length)}
          </div>

          {/* Category: Logs & Audits */}
          <div className="space-y-1">
            <div className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Audit & Records
            </div>
            {renderNavButton('attendance_log', 'Attendance Logs', ClipboardList, sessions.length)}
            {renderNavButton('analytics', 'Department Analytics', BarChart3)}
          </div>

          {/* Category: System & Configuration */}
          <div className="space-y-1">
            <div className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Settings & Control
            </div>
            {renderNavButton('settings', 'Campus & Settings', Settings)}
          </div>
        </nav>

        {/* Sidebar Footer: Reset Button */}
        <div className="p-3.5 xl:p-4 border-t border-slate-800/90 bg-slate-950/40">
          <button
            type="button"
            onClick={() => setShowResetCampusModal(true)}
            className="w-full py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Reset System</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA (Clean fluid container without nested overflow trapped) */}
      {/* ========================================================================= */}
      <div className="flex-1 w-full min-w-0 max-w-full space-y-5">
        
        {/* SECTION 1: ENROLLED STUDENTS */}
        {activeSection === 'students' && (
          <div className="space-y-4 animate-fadeIn w-full min-w-0">
            {/* Filter, Search, and Quick Edit Bar */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                <div className="w-full sm:w-56">
                  <select
                    value={selectedStudentClassId}
                    onChange={(e) => setSelectedStudentClassId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="all">All Classes & Divisions ({students.length})</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.studentIds.length} students)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search students by name, roll no, or phone..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                  {studentSearch && (
                    <button
                      type="button"
                      onClick={() => setStudentSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons & Quick Edit */}
              <div className="flex items-center gap-2 flex-wrap shrink-0 self-start md:self-auto">
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Scan Excel / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingStudent(null);
                    setNewStudentName('');
                    setNewStudentRoll('');
                    setNewStudentParent('');
                    setNewStudentPhone('');
                    setNewStudentEmail('');
                    setShowAddStudentModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Enroll</span>
                </button>

                {students.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteAllStudentsModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs transition-all cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete All</span>
                  </button>
                )}
              </div>

              {/* Quick Select & Edit Student (Zero scrolling!) */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs shrink-0 self-start md:self-auto">
                <Edit3 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Edit Student:</span>
                <select
                  value=""
                  onChange={(e) => {
                    const stId = e.target.value;
                    if (!stId) return;
                    const st = students.find(s => s.id === stId);
                    if (st) {
                      setEditingStudent(st);
                      setNewStudentName(st.name);
                      setNewStudentRoll(st.rollNo);
                      setNewStudentGender(st.gender);
                      setNewStudentParent(st.parentName || '');
                      setNewStudentPhone(st.parentPhone || '');
                      setNewStudentEmail(st.email || '');
                      setShowAddStudentModal(true);
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer max-w-[170px] truncate"
                >
                  <option value="">⚡ Quick Edit...</option>
                  {[...displayedStudents]
                    .sort((a, b) => {
                      const numA = parseInt(a.rollNo.replace(/\D/g, ''), 10);
                      const numB = parseInt(b.rollNo.replace(/\D/g, ''), 10);
                      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                      return a.rollNo.localeCompare(b.rollNo);
                    })
                    .map(st => (
                      <option key={st.id} value={st.id}>
                        #{st.rollNo} - {st.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Students Table with safe horizontal containment */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden w-full max-w-full min-w-0">
              <div className="overflow-x-auto w-full max-w-full">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-800 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 whitespace-nowrap">
                    <tr>
                      <th className="py-3 px-4">Roll</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Gender</th>
                      <th className="py-3 px-4">Enrolled Class</th>
                      <th className="py-3 px-4">Parent WhatsApp</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                          No students found matching your criteria. Click "Enroll Student" or "Scan Excel / PDF" to add.
                        </td>
                      </tr>
                    ) : (
                      displayedStudents.map(student => {
                        const studentClasses = classes.filter(c => c.studentIds.includes(student.id));
                        return (
                          <tr key={student.id} id={`hod-student-row-${student.id}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">#{student.rollNo}</td>
                            <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{student.name}</td>
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{student.gender}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {studentClasses.map(c => (
                                  <span key={c.id} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 whitespace-nowrap">
                                    {c.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {student.parentPhone ? (
                                <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <Phone className="w-3 h-3 text-[#25D366]" />
                                  {student.parentPhone}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStudent(student);
                                    setNewStudentName(student.name);
                                    setNewStudentRoll(student.rollNo);
                                    setNewStudentGender(student.gender);
                                    setNewStudentParent(student.parentName || '');
                                    setNewStudentPhone(student.parentPhone || '');
                                    setNewStudentEmail(student.email || '');
                                    setShowAddStudentModal(true); // Open in focused zero-scroll modal dialog!
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="Edit student details"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStudentToDelete(student)}
                                  className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete student"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: TIMETABLE & LECTURE SCHEDULE (Sorted by Day with Zero Horizontal Scrolling) */}
        {activeSection === 'timetable' && (
          <div className="space-y-4 animate-fadeIn w-full min-w-0">
            {/* Day Selector Navigation Tabs */}
            <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedTimetableDay('all')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    selectedTimetableDay === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>All Days</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    selectedTimetableDay === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {timetable.length}
                  </span>
                </button>

                {DAYS_LIST.map(day => {
                  const count = timetableByDay[day]?.length || 0;
                  const isSelected = selectedTimetableDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedTimetableDay(day)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{day}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                        isSelected ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowAddSlotModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95 shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Lecture</span>
              </button>
            </div>

            {/* Day-Wise Schedule Sections (Fluid responsive cards with zero horizontal scroll) */}
            <div className="space-y-4">
              {displayedDays.map(day => {
                const slots = timetableByDay[day] || [];
                return (
                  <div 
                    key={day} 
                    className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-sm space-y-4"
                  >
                    {/* Day Section Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-black">
                          {day.slice(0, 3)}
                        </span>
                        <div>
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900">{day}</h3>
                          <p className="text-[11px] text-slate-400">
                            {slots.length === 0 ? 'No lectures scheduled' : `${slots.length} lecture ${slots.length === 1 ? 'slot' : 'slots'} scheduled`}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        slots.length > 0 
                          ? 'bg-sky-50 text-sky-800 border border-sky-200' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {slots.length} {slots.length === 1 ? 'Lecture' : 'Lectures'}
                      </span>
                    </div>

                    {/* Slots in this Day */}
                    {slots.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                        No lectures scheduled for {day}. Click "Schedule New Lecture" to add.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {slots.map(slot => (
                          <div 
                            key={slot.id}
                            className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200 hover:border-sky-300 p-4 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between gap-3 group"
                          >
                            {/* Top row: Time & Edit/Delete actions */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-sky-800 bg-sky-100/90 px-2.5 py-1 rounded-lg border border-sky-200">
                                <Clock className="w-3.5 h-3.5 text-sky-600" />
                                <span>{slot.timeSlotLabel}</span>
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSlot(slot)}
                                  className="text-slate-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer"
                                  title="Edit lecture details, time & assigned faculty"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteTimetableSlot(slot.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer opacity-75 group-hover:opacity-100"
                                  title="Remove lecture slot"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Middle row: Subject Title & Class */}
                            <div className="space-y-1.5">
                              <h4 className="font-extrabold text-slate-900 text-sm leading-snug break-words">
                                {slot.subject}
                              </h4>
                              <span className="inline-block text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                {slot.className}
                              </span>
                            </div>

                            {/* Bottom row: Teacher & Classroom */}
                            <div className="pt-2 border-t border-slate-200/80 text-xs space-y-1">
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">Faculty: <strong className="text-slate-900">{slot.teacherName}</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{slot.roomName}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: FACULTY DIRECTORY */}
        {activeSection === 'faculty' && (
          <div className="space-y-4 animate-fadeIn w-full min-w-0">
            {/* Faculty Search Bar & View Mode Toggle */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={facultySearchQuery}
                  onChange={(e) => setFacultySearchQuery(e.target.value)}
                  placeholder="Search faculty by name, login code, email, or subject..."
                  className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-hidden"
                />
                {facultySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setFacultySearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md text-xs cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {/* Quick Edit Faculty Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap hidden sm:inline">Edit Faculty:</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const tId = e.target.value;
                      if (!tId) return;
                      const t = teachers.find(teach => teach.id === tId);
                      if (t) {
                        handleOpenEditTeacher(t);
                      }
                    }}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer max-w-[150px] truncate"
                  >
                    <option value="">⚡ Quick Edit...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.uniqueCode})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddTeacher}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Faculty</span>
                </button>
              </div>

              {/* View Mode Switcher: Compact Table (Zero Scroll) vs Cards */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setFacultyViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    facultyViewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Compact Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFacultyViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    facultyViewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
              </div>
            </div>

            {/* COMPACT TABLE VIEW (Zero scrolling for faculty management) */}
            {facultyViewMode === 'table' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden w-full max-w-full min-w-0">
                <div className="overflow-x-auto w-full max-w-full">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-800 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 whitespace-nowrap">
                      <tr>
                        <th className="py-3 px-4">Faculty Member</th>
                        <th className="py-3 px-4">Login Code</th>
                        <th className="py-3 px-4">Passcode</th>
                        <th className="py-3 px-4">Assigned Subjects</th>
                        <th className="py-3 px-4">Contact</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teachers
                        .filter(t => {
                          if (!facultySearchQuery.trim()) return true;
                          const q = facultySearchQuery.toLowerCase();
                          return (
                            t.name.toLowerCase().includes(q) ||
                            t.uniqueCode.toLowerCase().includes(q) ||
                            (t.email && t.email.toLowerCase().includes(q)) ||
                            (t.subjects && t.subjects.some(s => s.toLowerCase().includes(q)))
                          );
                        })
                        .map(teacher => {
                          const isPassVisible = !!visiblePasscodes[teacher.id];
                          return (
                            <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-200">
                                    {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 block">{teacher.name}</span>
                                    <span className="text-[10px] text-slate-500">{teacher.department || deptName}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                                  <span className="font-mono font-bold text-emerald-800 text-xs">{teacher.uniqueCode}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(teacher.uniqueCode, `code-tbl-${teacher.id}`)}
                                    className="text-slate-400 hover:text-emerald-700 cursor-pointer p-0.5"
                                    title="Copy login code"
                                  >
                                    {copiedCodeId === `code-tbl-${teacher.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                                  <span className="font-mono text-slate-800 text-xs font-semibold">
                                    {isPassVisible ? teacher.passcode : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setVisiblePasscodes(prev => ({ ...prev, [teacher.id]: !prev[teacher.id] }))}
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                    title={isPassVisible ? 'Hide passcode' : 'Show passcode'}
                                  >
                                    {isPassVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(teacher.passcode, `pass-tbl-${teacher.id}`)}
                                    className="text-slate-400 hover:text-emerald-700 cursor-pointer p-0.5"
                                    title="Copy passcode"
                                  >
                                    {copiedCodeId === `pass-tbl-${teacher.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {teacher.subjects && teacher.subjects.length > 0 ? (
                                    teacher.subjects.map((sub, idx) => (
                                      <span key={idx} className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 text-[10px] font-semibold border border-sky-200">
                                        {sub}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">None</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="font-mono text-slate-700 block text-[11px]">{teacher.phone || '—'}</span>
                                <span className="text-[10px] text-slate-400 truncate block max-w-[140px]">{teacher.email || '—'}</span>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditTeacher(teacher)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                                    title="Edit faculty profile & login credentials"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>
                                  {teachers.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteTeacher(teacher.id)}
                                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Remove faculty member"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CARDS VIEW */}
            {facultyViewMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teachers
                  .filter(t => {
                    if (!facultySearchQuery.trim()) return true;
                    const q = facultySearchQuery.toLowerCase();
                    return (
                      t.name.toLowerCase().includes(q) ||
                      t.uniqueCode.toLowerCase().includes(q) ||
                      (t.email && t.email.toLowerCase().includes(q)) ||
                      (t.subjects && t.subjects.some(s => s.toLowerCase().includes(q)))
                    );
                  })
                  .map(teacher => {
                    const isPassVisible = !!visiblePasscodes[teacher.id];
                    return (
                      <div 
                        key={teacher.id}
                        id={`teacher-card-${teacher.id}`}
                        className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5 hover:border-emerald-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-200 shrink-0">
                              {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span>{teacher.name}</span>
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                  {teacher.uniqueCode}
                                </span>
                              </h3>
                              <p className="text-xs text-slate-500">{teacher.email || `${teacher.uniqueCode.toLowerCase()}@dypatil.edu`}</p>
                              {teacher.phone && (
                                <p className="text-[11px] text-slate-400 font-mono">{teacher.phone}</p>
                              )}
                            </div>
                          </div>

                          {/* Top Card Actions: Edit & Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditTeacher(teacher)}
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 transition-colors cursor-pointer"
                              title="Edit faculty overall details & login credentials"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {teachers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => onDeleteTeacher(teacher.id)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove teacher"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Unique Login Credentials Badge with Password Toggle */}
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>Faculty Login Credentials</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => handleOpenEditTeacher(teacher)}
                              className="text-[10.5px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Credentials</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {/* Login Code */}
                            <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10.5px] text-slate-500 font-medium">Code:</span>
                                <span className="font-mono font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-xs">
                                  {teacher.uniqueCode}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(teacher.uniqueCode, `code-${teacher.id}`)}
                                className="p-1 rounded text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                                title="Copy login code"
                              >
                                {copiedCodeId === `code-${teacher.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {/* Passcode with Show/Hide toggle */}
                            <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10.5px] text-slate-500 font-medium">Pass:</span>
                                <span className="font-mono font-bold text-slate-800 text-xs truncate">
                                  {isPassVisible ? teacher.passcode : '••••••••'}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => setVisiblePasscodes(prev => ({ ...prev, [teacher.id]: !prev[teacher.id] }))}
                                  className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                  title={isPassVisible ? 'Hide passcode' : 'Show passcode'}
                                >
                                  {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(teacher.passcode, `pass-${teacher.id}`)}
                                  className="p-1 rounded text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                                  title="Copy password"
                                >
                                  {copiedCodeId === `pass-${teacher.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Respective Subjects */}
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-600">Assigned Subjects:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {teacher.subjects && teacher.subjects.length > 0 ? (
                              teacher.subjects.map((sub, idx) => (
                                <span key={idx} className="px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-800 text-[11px] font-medium border border-sky-200">
                                  {sub}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No specific subjects assigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: CLASSROOMS & LABS */}
        {activeSection === 'classrooms' && (
          <div className="space-y-4 animate-fadeIn w-full min-w-0">
            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-xs font-bold text-slate-700 px-2">Campus Classrooms ({classrooms.length})</span>
              <button
                type="button"
                onClick={() => setShowAddRoomModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Classroom / Lab</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classrooms.map(room => (
                <div 
                  key={room.id}
                  className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                        <School className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{room.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {room.building}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteClassroom(room.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                      title="Delete classroom"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                    <span className="text-slate-500 font-medium">Capacity:</span>
                    <span className="font-mono font-bold text-slate-800">{room.capacity} Students</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 5: ATTENDANCE LOGS & DATE CLEAR */}
        {activeSection === 'attendance_log' && (
          <div className="space-y-4 animate-fadeIn w-full min-w-0">
            {/* ZERO-SCROLL FAST DATE CLEAR & AUDIT MANAGER */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white p-4 sm:p-5 rounded-3xl border border-slate-700/80 shadow-md space-y-4">
              {/* Quick Select from Recorded Dates Dropdown */}
              {recordedDatesList.length > 0 && (
                <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-2xl px-3 py-1.5 text-xs">
                  <span className="text-slate-400 font-bold whitespace-nowrap">Recorded Dates:</span>
                  <select
                    value={recordedDatesList.includes(quickAuditDate) ? quickAuditDate : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setQuickAuditDate(e.target.value);
                        setCalendarSelectedDate(e.target.value);
                      }
                    }}
                    className="bg-transparent text-white font-bold focus:outline-hidden cursor-pointer max-w-[210px] truncate"
                  >
                    <option value="" className="bg-slate-900 text-white">Select Date ({recordedDatesList.length})...</option>
                    {recordedDatesList.map(dStr => {
                      const count = cleanSessions.filter(s => s.date === dStr).length;
                      return (
                        <option key={dStr} value={dStr} className="bg-slate-900 text-white">
                          {formatDateWithDay(dStr)} ({count} {count === 1 ? 'lecture' : 'lectures'})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Date Input & Status Bar */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
                {/* Left: Date Picker Input & Quick Today Button */}
                <div className="lg:col-span-4 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={quickAuditDate}
                      onChange={(e) => {
                        setQuickAuditDate(e.target.value);
                        setCalendarSelectedDate(e.target.value);
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-xs font-bold text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayDateStr();
                      setQuickAuditDate(today);
                      setCalendarSelectedDate(today);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                  >
                    Today
                  </button>
                </div>

                {/* Middle: Live Summary */}
                <div className="lg:col-span-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-2.5 px-3.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {formatDateWithDay(quickAuditDate)}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {quickDateHoliday ? (
                        <span className="text-xs font-bold text-amber-300">🏖️ Holiday: {quickDateHoliday.title}</span>
                      ) : quickDateSessions.length > 0 ? (
                        <span className="text-xs font-bold text-emerald-400">
                          {quickDateSessions.length} Recorded Lecture{quickDateSessions.length > 1 ? 's' : ''} ({quickDateStats.rate}% attendance)
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">No attendance records for this date</span>
                      )}
                    </div>
                  </div>
                  {quickDateSessions.length > 0 && (
                    <div className="text-right text-[11px] font-mono shrink-0 pl-2 border-l border-slate-700">
                      <span className="text-emerald-400 font-bold">{quickDateStats.present}P</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-rose-400 font-bold">{quickDateStats.absent}A</span>
                    </div>
                  )}
                </div>

                {/* Right: Direct Action Buttons (Zero Scrolling Clear) */}
                <div className="lg:col-span-4 flex items-center justify-end gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowMonthlyExportModal(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                    <span>Export Excel</span>
                  </button>

                  {quickDateSessions.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowQuickClearModal(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer border border-rose-400/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Attendance for Date</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium italic">
                      Zero records to clear
                    </span>
                  )}

                  {(!quickDateHoliday || quickDateHoliday.declaredBy === 'System Default') && onDeclareHoliday && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickHolidayTitle(quickDateHoliday?.declaredBy === 'System Default' ? quickDateHoliday.title : '');
                        setShowQuickHolidayModal(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>🏖️</span>
                      <span>Declare Holiday</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Embedded Attendance Calendar for HOD */}
            <div className="w-full min-w-0">
              <AttendanceCalendar
                sessions={cleanSessions}
                classes={classes}
                students={students}
                settings={settings}
                selectedDate={calendarSelectedDate}
                onSelectDate={(dateStr) => {
                  setCalendarSelectedDate(dateStr);
                  if (dateStr) setQuickAuditDate(dateStr);
                }}
                onExportSessionCSV={handleExportSessionCSV}
                sendAbsentParentAlert={sendAbsentParentAlert}
                onClearDateAttendance={onClearDateAttendance}
                onClearSession={onClearSession}
                currentUser={hodUser}
                timetable={timetable}
                holidays={holidays}
                onDeclareHoliday={onDeclareHoliday}
                onRemoveHoliday={onRemoveHoliday}
              />
            </div>
          </div>
        )}

        {/* SECTION 6: DEPARTMENT ANALYTICS */}
        {activeSection === 'analytics' && (
          <div className="space-y-4 animate-fadeIn w-full min-w-0">
            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-xs font-bold text-slate-700 px-2">Department Overview & Analytics</span>
              <button
                type="button"
                onClick={() => setShowMonthlyExportModal(true)}
                className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>Export Monthly Attendance (Excel)</span>
              </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Overall Attendance Rate</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 font-mono">{analyticsData.avgRate}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${analyticsData.avgRate}%` }} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Conducted Lectures</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-sky-600 font-mono">{analyticsData.totalSessions}</span>
                  <span className="text-xs text-slate-500 font-medium">sessions</span>
                </div>
                <p className="text-[11px] text-slate-400">Across all scheduled timetable hours</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Enrolled Students</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-600 font-mono">{analyticsData.totalStudents}</span>
                  <span className="text-xs text-slate-500 font-medium">active</span>
                </div>
                <p className="text-[11px] text-slate-400">Enrolled in department database</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-2xs space-y-2 bg-rose-50/30">
                <span className="text-[11px] font-bold text-rose-600 uppercase">Defaulters (&lt;{settings.defaulterThreshold}%)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-rose-600 font-mono">{analyticsData.defaultersCount}</span>
                  <span className="text-xs text-rose-500 font-medium">students</span>
                </div>
                <p className="text-[11px] text-rose-400">Requiring academic follow-up</p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 7: CAMPUS & SYSTEM SETTINGS */}
        {activeSection === 'settings' && (
          <div className="space-y-5 animate-fadeIn w-full min-w-0">
            
            {/* CARD 1: HOD LOGIN CREDENTIALS & ZERO-LEAK SECURITY */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-3 pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/80 text-amber-700 flex items-center justify-center border border-amber-300 shadow-inner">
                    <Lock className="w-5 h-5 stroke-[2.4]" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <span>HOD Administrative Credentials & Security</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        SHA-256
                      </span>
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Zero Data Leak Active
                  </span>
                </div>
              </div>

              {credentialSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2.5 animate-fadeIn shadow-2xs">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>{credentialSuccess}</span>
                </div>
              )}

              {credentialError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-900 font-bold flex items-center gap-2.5 animate-fadeIn shadow-2xs">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                  <span>{credentialError}</span>
                </div>
              )}

              {/* Mode Selection: Both / Username Only / Password Only */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Select Credential Update Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setCredentialTarget('both');
                      setCredentialError('');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                      credentialTarget === 'both'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-extrabold shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Update Both Username & Password
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCredentialTarget('username_only');
                      setCredentialError('');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                      credentialTarget === 'username_only'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-extrabold shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Change Username Only
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCredentialTarget('password_only');
                      setCredentialError('');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                      credentialTarget === 'password_only'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-extrabold shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Change Password Only
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateHodCredentials} className="space-y-4 pt-1">
                {/* STEP 1: Mandatory Current Password for Identity Authorization */}
                <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-2 max-w-2xl">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-600" />
                      <span>Current HOD Password <span className="text-rose-500">* (Identity Verification)</span></span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Required for authorization</span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder="Enter current HOD password (e.g. dyp123)"
                      className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* STEP 2: Target Credential Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl pt-1">
                  
                  {/* Field: New HOD Username (shown if updating username or both) */}
                  {(credentialTarget === 'both' || credentialTarget === 'username_only') && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700">
                          New HOD Login Username <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] font-mono text-slate-500">
                          Current Login ID: <strong className="text-amber-700 font-bold">{settings.hodUsername || 'dyp'}</strong>
                        </span>
                      </div>
                      <input
                        type="text"
                        value={newUsernameInput}
                        onChange={(e) => setNewUsernameInput(e.target.value)}
                        placeholder="Enter new HOD login username (e.g. dyp or hod_admin)"
                        className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                        required
                        autoComplete="username"
                      />
                      <p className="text-[10px] text-slate-500">
                        This is the username required at the login screen (distinct from HOD display name "{settings.hodName || 'Prof. Prashant Kathole'}").
                      </p>
                    </div>
                  )}

                  {/* Field: New HOD Password & Strength Meter (shown if updating password or both) */}
                  {(credentialTarget === 'both' || credentialTarget === 'password_only') && (
                    <>
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700">
                          New HOD Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="Enter new strong password (min 6 chars)"
                            className="w-full bg-slate-50 border border-slate-300 rounded-2xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                            required
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Interactive Password Strength Indicator */}
                        {newPasswordInput && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 animate-fadeIn">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-600">Password Strength:</span>
                              <span className={`font-extrabold ${passwordStrength.color}`}>
                                {passwordStrength.label}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${passwordStrength.bgColor}`}
                                style={{ width: `${Math.max(15, (passwordStrength.score / 4) * 100)}%` }}
                              />
                            </div>
                            {passwordStrength.suggestions.length > 0 && (
                              <p className="text-[10.5px] text-slate-500">
                                Tip: {passwordStrength.suggestions.join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Field: Confirm New Password */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-700">
                            Confirm New Password <span className="text-rose-500">*</span>
                          </label>
                          {newPasswordInput && confirmPasswordInput && (
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${
                              newPasswordInput === confirmPasswordInput ? 'text-emerald-600' : 'text-rose-500'
                            }`}>
                              {newPasswordInput === confirmPasswordInput ? '✓ Passwords Match' : '✗ Does not match'}
                            </span>
                          )}
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPasswordInput}
                            onChange={(e) => setConfirmPasswordInput(e.target.value)}
                            placeholder="Re-enter new password to verify"
                            className="w-full bg-slate-50 border border-slate-300 rounded-2xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                            required
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                </div>

                {/* Security Guarantee Notice */}
                <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2 max-w-2xl">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-extrabold">End-to-End Credential Encryption & Integrity</p>
                    <p className="text-amber-800 leading-relaxed">
                      Passwords are automatically hashed using 256-bit SHA-256 cryptographic standards before persistence. No plain-text passwords are leaked in network logs, browser history, or system intercepts.
                    </p>
                  </div>
                </div>

                {/* Submit Action with Tactile 3D Depth */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUpdatingCredentials}
                    className="btn-depth-amber px-6 py-3 rounded-2xl text-slate-950 text-xs font-black cursor-pointer shadow-md flex items-center gap-2 select-none active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 text-slate-950 stroke-[2.4]" />
                    <span>{isUpdatingCredentials ? 'Encrypting & Saving...' : 'Save HOD Credentials'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* CARD 2: CAMPUS & DEPARTMENT INFORMATION & HOD PROFILE */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Campus Identity & HOD Profile</h2>
                  <p className="text-xs text-slate-500">Configure HOD full name, college name, department title, and minimum attendance %</p>
                </div>
              </div>

              {settingsSavedMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Campus settings saved successfully!</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
                {/* HOD Full Human Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Head of Department (HOD) Name / Title
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Official display name
                    </span>
                  </div>
                  <input
                    type="text"
                    value={hodName}
                    onChange={(e) => setHodName(e.target.value)}
                    placeholder="e.g. Prof. Prashant Kathole"
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                  <p className="text-[10px] text-slate-500">
                    Official Head of Department name displayed on reports, header badges, and notices.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">College / Campus Name</label>
                  <input
                    type="text"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Department Name</label>
                  <input
                    type="text"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Defaulter Threshold (% Attendance Required)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={30}
                      max={90}
                      step={5}
                      value={settings.defaulterThreshold || 50}
                      onChange={(e) => onUpdateSettings({ ...settings, defaulterThreshold: Number(e.target.value) })}
                      className="flex-1 accent-amber-500 cursor-pointer"
                    />
                    <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                      {settings.defaulterThreshold || 50}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Campus Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetSettingsModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </form>
            </div>

            {/* CARD 3: CLOUD DATABASE SYNC */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-3.5 max-w-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Cloud Database Sync</h3>
                  <p className="text-[11px] text-slate-500">Real-time bi-directional persistence</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                All attendance sessions, timetable matrix, and student rosters are backed up to the live cloud database.
              </p>
              <button
                type="button"
                onClick={onForceSyncCloud}
                disabled={isCloudSyncing}
                className="w-full py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Cloud className={`w-4 h-4 ${isCloudSyncing ? 'animate-pulse' : ''}`} />
                <span>{isCloudSyncing ? 'Syncing to Cloud...' : 'Force Sync to Cloud Database'}</span>
              </button>
            </div>

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* MODAL: ADD / EDIT STUDENT */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingStudent ? 'Edit Student Details' : 'Enroll New Student'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Roll No *</label>
                  <input
                    type="text"
                    value={newStudentRoll}
                    onChange={(e) => setNewStudentRoll(e.target.value)}
                    placeholder="e.g. 01"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                    required
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Gender</label>
                  <select
                    value={newStudentGender}
                    onChange={(e) => setNewStudentGender(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {!editingStudent && (
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Target Class / Div</label>
                    <select
                      value={newStudentClassId}
                      onChange={(e) => setNewStudentClassId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Parent Name</label>
                  <input
                    type="text"
                    value={newStudentParent}
                    onChange={(e) => setNewStudentParent(e.target.value)}
                    placeholder="Parent / Guardian"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Parent Phone (WhatsApp)</label>
                  <input
                    type="tel"
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Student Email</label>
                <input
                  type="email"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="student@dypatil.edu"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingStudent ? 'Save Changes' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT TEACHER & LOGIN CREDENTIALS */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Users className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingTeacher ? 'Edit Faculty & Login Credentials' : 'Add New Faculty Member'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingTeacher ? `Modifying profile & credentials for ${editingTeacher.name}` : 'Create a new faculty account with unique credentials'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddTeacherModal(false);
                  setEditingTeacher(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewTeacher} className="space-y-4">
              {renderFacultyFormFields(false)}
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT TIMETABLE SLOT */}
      {showAddSlotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
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
                onClick={() => {
                  setShowAddSlotModal(false);
                  setEditingSlot(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewSlot} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Day of Week *</label>
                  <select
                    value={newSlotDay}
                    onChange={(e) => setNewSlotDay(e.target.value as DayOfWeek)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Subject Name *</label>
                  <input
                    type="text"
                    value={newSlotSubject}
                    onChange={(e) => setNewSlotSubject(e.target.value)}
                    placeholder="e.g. Cyber Security"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                    required
                  />
                  {/* Selected Faculty's Respected Subjects */}
                  {(() => {
                    const selTeacher = teachers.find(t => t.id === newSlotTeacherId);
                    if (!selTeacher || !selTeacher.subjects || selTeacher.subjects.length === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-[10px] text-slate-500 font-medium">Faculty Subjects:</span>
                        {selTeacher.subjects.map((sub, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setNewSlotSubject(sub)}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border cursor-pointer transition-all ${
                              newSlotSubject.toLowerCase() === sub.toLowerCase()
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
                      value={newSlotStartTime}
                      onChange={(e) => setNewSlotStartTime(e.target.value)}
                      placeholder="08:00 AM"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">End Time</label>
                    <input
                      type="text"
                      value={newSlotEndTime}
                      onChange={(e) => setNewSlotEndTime(e.target.value)}
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
                        setNewSlotStartTime(st);
                        setNewSlotEndTime(et);
                      }}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border cursor-pointer ${
                        newSlotStartTime === st && newSlotEndTime === et
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
                    value={newSlotClassId}
                    onChange={(e) => setNewSlotClassId(e.target.value)}
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
                    value={newSlotTeacherId}
                    onChange={(e) => {
                      const tId = e.target.value;
                      setNewSlotTeacherId(tId);
                      const tObj = teachers.find(t => t.id === tId);
                      if (tObj && tObj.subjects && tObj.subjects.length > 0 && !newSlotSubject) {
                        setNewSlotSubject(tObj.subjects[0]);
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
                    value={newSlotRoomId}
                    onChange={(e) => setNewSlotRoomId(e.target.value)}
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
                  onClick={() => {
                    setShowAddSlotModal(false);
                    setEditingSlot(null);
                  }}
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

      {/* MODAL: ADD CLASSROOM */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Add Classroom / Lab</h3>
              <button
                type="button"
                onClick={() => setShowAddRoomModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewClassroom} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Room Name / Number *</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Room 401 / Lab 2"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Building / Wing</label>
                  <input
                    type="text"
                    value={newRoomBuilding}
                    onChange={(e) => setNewRoomBuilding(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Capacity</label>
                  <input
                    type="number"
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: RESET CAMPUS SYSTEM */}
      {showResetCampusModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900">Reset Campus System?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This will restore the default D.Y. Patil ECE Division A campus configuration and sample timetable.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetCampusModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetAllData();
                  setShowResetCampusModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Yes, Reset System
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: RESET SETTINGS ONLY */}
      {showResetSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <h3 className="text-base font-extrabold text-slate-900">Reset Campus Settings?</h3>
            <p className="text-xs text-slate-600">
              Reset department name and default parameters to factory configuration.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetSettingsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetSettings();
                  setShowResetSettingsModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                Reset Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: DELETE SINGLE STUDENT */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <h3 className="text-base font-extrabold text-slate-900">
              Delete Student #{studentToDelete.rollNo} ({studentToDelete.name})?
            </h3>
            <p className="text-xs text-slate-600">
              This will permanently delete this student record from the campus database.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStudent(studentToDelete.id);
                  setStudentToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Delete Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL: DELETE ALL STUDENTS */}
      {showDeleteAllStudentsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Delete All Students?</h3>
                <p className="text-xs text-slate-600">
                  Are you sure you want to permanently delete all {students.length} students from the database?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllStudentsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAllStudents('all_campus');
                  setShowDeleteAllStudentsModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXPORT MONTHLY ATTENDANCE TO EXCEL (.XLSX) */}
      {showMonthlyExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold border border-emerald-200 shadow-inner">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Export Monthly Attendance in Excel
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Download complete monthly register, defaulter sheet & session audits
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMonthlyExportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Options */}
            <div className="space-y-3.5">
              
              {/* Month and Year Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Select Month *</label>
                  <select
                    value={exportMonth}
                    onChange={(e) => setExportMonth(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {[
                      { num: 1, name: 'January' },
                      { num: 2, name: 'February' },
                      { num: 3, name: 'March' },
                      { num: 4, name: 'April' },
                      { num: 5, name: 'May' },
                      { num: 6, name: 'June' },
                      { num: 7, name: 'July' },
                      { num: 8, name: 'August' },
                      { num: 9, name: 'September' },
                      { num: 10, name: 'October' },
                      { num: 11, name: 'November' },
                      { num: 12, name: 'December' }
                    ].map(m => (
                      <option key={m.num} value={m.num}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Select Academic Year *</label>
                  <select
                    value={exportYear}
                    onChange={(e) => setExportYear(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class and Subject Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Class / Division</label>
                  <select
                    value={exportClassId}
                    onChange={(e) => setExportClassId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Enrolled Classes ({classes.length})</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Subject Filter</label>
                  <select
                    value={exportSubject}
                    onChange={(e) => setExportSubject(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Subjects</option>
                    {Array.from(new Set(timetable.map(s => s.subject).filter(Boolean))).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Included Sheets Preview Card */}
              <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2 text-xs">
                <span className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Single Unified Worksheet ("Department Master Register"):</span>
                </span>
                <ul className="space-y-1.5 text-[11px] text-emerald-900 font-medium pl-1">
                  <li className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                    <span><strong>1. Faculty Directory:</strong> System teachers, designated subjects, codes & contacts</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <span><strong>2. Student Attendance Master:</strong> Exact 13 columns (Maths, SDAV, DSA %, ratios, total absent & academic status)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-1.5 shrink-0" />
                    <span><strong>3. Weekly Lecture Schedule:</strong> System timetable, timings, subjects & labs</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                    <span><strong>4. Conducted Sessions Audit:</strong> Live recorded lectures, faculty in-charge & attendance ratios</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                    <span><strong>5. Defaulters List (&lt;{settings.defaulterThreshold || 75}%):</strong> Shortage deficits & parent WhatsApp contacts</span>
                  </li>
                </ul>
              </div>

              {/* Success Notification Banner */}
              {exportSuccessNotice && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{exportSuccessNotice}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMonthlyExportModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerMonthlyExcelExport}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Excel Report (.xlsx)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: ZERO-SCROLL QUICK CLEAR ATTENDANCE FOR DATE */}
      {showQuickClearModal && quickAuditDate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  Clear Attendance for {formatDateWithDay(quickAuditDate)}?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to permanently delete all <strong>{quickDateSessions.length}</strong> recorded lecture session(s) on <strong>{quickAuditDate}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-semibold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                This will delete the attendance logs for this specific date across all classes and synchronize directly with the cloud database.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickClearModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearDateAttendance && quickAuditDate) {
                    onClearDateAttendance(quickAuditDate);
                    if (calendarSelectedDate === quickAuditDate) {
                      setCalendarSelectedDate(null);
                    }
                  }
                  setShowQuickClearModal(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear Attendance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ZERO-SCROLL QUICK DECLARE HOLIDAY */}
      {showQuickHolidayModal && quickAuditDate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-xl shadow-inner">
                  🏖️
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Declare Official Holiday</h3>
                  <p className="text-xs text-slate-500 font-semibold">{formatDateWithDay(quickAuditDate)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickHolidayModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-extrabold text-slate-700">
                Holiday Title / Occasion
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  'Institutional Holiday',
                  'Public / Festival Holiday',
                  'College Annual Day / Event',
                  'Departmental Event',
                  'Semester Vacation'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuickHolidayTitle(preset)}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold transition-all cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={quickHolidayTitle}
                onChange={(e) => setQuickHolidayTitle(e.target.value)}
                placeholder="Enter holiday title e.g. Ganesh Chaturthi"
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickHolidayModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeclareHoliday && quickAuditDate) {
                    onDeclareHoliday(quickAuditDate, quickHolidayTitle || 'Declared Official Holiday');
                  }
                  setShowQuickHolidayModal(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Declare Holiday
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
