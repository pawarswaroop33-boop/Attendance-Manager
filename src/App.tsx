import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  INITIAL_CLASSES, 
  INITIAL_STUDENTS, 
  INITIAL_TEACHERS,
  INITIAL_CLASSROOMS,
  INITIAL_TIMETABLE,
  INITIAL_SETTINGS,
  generateInitialSessions 
} from './data/mockData';
import { 
  ClassGroup, 
  Student, 
  AttendanceSession, 
  AttendanceStatus,
  AuthUser,
  Teacher,
  Classroom,
  TimetableSlot,
  SystemSettings
} from './types';
import { dbService } from './services/databaseService';
import { LoginPage } from './components/LoginPage';
import { Header, AppTab } from './components/Header';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { LiveDashboard } from './components/LiveDashboard';
import { AnalyticsView } from './components/AnalyticsView';
import { StudentManagement } from './components/StudentManagement';
import { DefaultersView } from './components/DefaultersView';
import { TimetableLectureSelector } from './components/TimetableLectureSelector';
import { HodControlCenter } from './components/HodControlCenter';
import { ImportStudentsModal } from './components/ImportStudentsModal';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';

const STORAGE_KEY_AUTH = 'dypatil_auth_user_v1';
const STORAGE_KEY_SETTINGS = 'dypatil_settings_v1';
const STORAGE_KEY_TEACHERS = 'dypatil_teachers_v1';
const STORAGE_KEY_CLASSROOMS = 'dypatil_classrooms_v1';
const STORAGE_KEY_TIMETABLE = 'dypatil_timetable_v1';
const STORAGE_KEY_CLASSES = 'dypatil_classes_v1';
const STORAGE_KEY_STUDENTS = 'dypatil_students_v1';
const STORAGE_KEY_SESSIONS = 'dypatil_sessions_v1';

export default function App() {
  // Helper to format today YYYY-MM-DD
  const getTodayDateStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // 1. Authenticated User (Null implies show Login Page)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTH);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load auth user', e);
    }
    // Default: show login page so user immediately sees the D.Y.PATIL login page
    return null;
  });

  // 2. Campus & System Settings
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    return INITIAL_SETTINGS;
  });

  // 3. Teachers & Unique Codes
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TEACHERS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load teachers', e);
    }
    return INITIAL_TEACHERS;
  });

  // 4. Classrooms & Labs
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLASSROOMS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load classrooms', e);
    }
    return INITIAL_CLASSROOMS;
  });

  // 5. Timetable Slots
  const [timetable, setTimetable] = useState<TimetableSlot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TIMETABLE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some(s => s.classId === 'class-ece-a')) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load timetable', e);
    }
    return INITIAL_TIMETABLE;
  });

  // 6. Classes & Divisions (Scoped to single class: Electronics and Computer Engineering - Div A)
  const [classes, setClasses] = useState<ClassGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLASSES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some(c => c.name.includes('Electronics and Computer Engineering'))) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load classes', e);
    }
    return INITIAL_CLASSES;
  });

  // 7. Students Roster
  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STUDENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.classId === 'class-ece-a') {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load students', e);
    }
    return INITIAL_STUDENTS;
  });

  // 8. Attendance Sessions
  const [sessions, setSessions] = useState<AttendanceSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some(s => s.classId === 'class-ece-a')) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load sessions', e);
    }
    return generateInitialSessions(INITIAL_CLASSES, INITIAL_STUDENTS);
  });

  // Active UI Navigation & Selection State
  const [selectedClassId, setSelectedClassId] = useState<string>(() => classes[0]?.id || 'class-ece-a');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [currentTab, setCurrentTab] = useState<AppTab>('dashboard');
  const [activeLectureSlotId, setActiveLectureSlotId] = useState<string | undefined>('slot-mon-1');

  // Modals & Synchronization States
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(true);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const isRemoteUpdateRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const lastSyncedHashRef = useRef('');
  const userHasModifiedDataRef = useRef(false);

  // Initialize Firebase Database Persistence & Real-time Bi-directional Cloud Sync
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const bootstrapFirebase = async () => {
      setCloudSyncing(true);
      try {
        await dbService.init();

        const cloudState = await dbService.loadCampusState();
        const currentLocalStudentsCount = students.length;
        const cloudStudentsCount = cloudState?.students?.length || 0;

        // If cloud already has state and has at least as many students as local (or local only has default <= 20)
        if (cloudState && (cloudStudentsCount >= currentLocalStudentsCount || currentLocalStudentsCount <= 20)) {
          isRemoteUpdateRef.current = true;
          if (cloudState.settings) setSettings(cloudState.settings);
          if (cloudState.classes && cloudState.classes.length > 0) {
            setClasses(cloudState.classes);
            setSelectedClassId(prev => cloudState.classes.some(c => c.id === prev) ? prev : cloudState.classes[0].id);
          }
          if (cloudState.students && cloudState.students.length > 0) setStudents(cloudState.students);
          if (cloudState.teachers && cloudState.teachers.length > 0) setTeachers(cloudState.teachers);
          if (cloudState.classrooms && cloudState.classrooms.length > 0) setClassrooms(cloudState.classrooms);
          if (cloudState.timetable && cloudState.timetable.length > 0) setTimetable(cloudState.timetable);
          if (cloudState.sessions && cloudState.sessions.length > 0) setSessions(cloudState.sessions);
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 300);
        } else if (currentLocalStudentsCount > cloudStudentsCount && currentLocalStudentsCount > 20) {
          // Device 1 case: Local device has 85 enrolled students, but cloud has 0 or only default 20!
          // Auto-push the 85 students to the cloud so that other devices can receive them
          console.log(`[Auto-Push] Device has ${currentLocalStudentsCount} local students while cloud has ${cloudStudentsCount}. Pushing local state to cloud...`);
          try {
            await dbService.saveEntireCampusState({
              settings,
              classes,
              students,
              teachers,
              classrooms,
              timetable,
              sessions
            });
            showToast(`Synchronized all ${currentLocalStudentsCount} students with cloud!`, 'success');
          } catch (e) {
            console.warn('[Auto-Push] Sync error:', e);
          }
        }

        // Subscribe to live multi-device updates (only if free quota is not exhausted)
        if (!dbService.isQuotaExhausted) {
          unsubscribe = dbService.subscribeToLiveUpdates((incoming) => {
            isRemoteUpdateRef.current = true;
            if (incoming.settings) setSettings(incoming.settings);
            if (incoming.classes) setClasses(incoming.classes);
            if (incoming.students) setStudents(incoming.students);
            if (incoming.teachers) setTeachers(incoming.teachers);
            if (incoming.classrooms) setClassrooms(incoming.classrooms);
            if (incoming.timetable) setTimetable(incoming.timetable);
            if (incoming.sessions) setSessions(incoming.sessions);
            setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 300);
          });
        }

        // Establish initial hash baseline so initial page load does not trigger an immediate write
        lastSyncedHashRef.current = `${settings.collegeName}_${classes.length}_${students.length}_${sessions.length}_${timetable.length}`;
        setIsDbReady(true);
        setSavedIndicator(true);
      } catch (err) {
        console.warn('Database sync notice:', err);
      } finally {
        setCloudSyncing(false);
      }
    };

    bootstrapFirebase();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Persistence to LocalStorage (Instant offline-first resilience, no circular loops)
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTH);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(teachers));
    } catch (e) {
      console.error(e);
    }
  }, [teachers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLASSROOMS, JSON.stringify(classrooms));
    } catch (e) {
      console.error(e);
    }
  }, [classrooms]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TIMETABLE, JSON.stringify(timetable));
    } catch (e) {
      console.error(e);
    }
  }, [timetable]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(classes));
    } catch (e) {
      console.error(e);
    }
  }, [classes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    } catch (e) {
      console.error(e);
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error(e);
    }
  }, [sessions]);

  // Debounced Cloud Sync: Persists user-initiated changes without spamming Firestore or exhausting daily limits
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!isDbReady) return;
    if (isRemoteUpdateRef.current) return;
    if (dbService.isQuotaExhausted) return;
    if (!userHasModifiedDataRef.current) return;

    // Fast signature to avoid re-uploading identical states
    const stateSignature = `${settings.collegeName}_${classes.length}_${students.length}_${sessions.length}_${timetable.length}`;
    if (lastSyncedHashRef.current === stateSignature) return;

    const timer = setTimeout(async () => {
      if (isRemoteUpdateRef.current || dbService.isQuotaExhausted || !userHasModifiedDataRef.current) return;
      try {
        setCloudSyncing(true);
        await dbService.saveEntireCampusState({
          settings,
          classes,
          students,
          teachers,
          classrooms,
          timetable,
          sessions
        });
        lastSyncedHashRef.current = stateSignature;
        setSavedIndicator(true);
      } catch (err) {
        console.warn('Debounced cloud sync notice:', err);
      } finally {
        setCloudSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [settings, classes, students, teachers, classrooms, timetable, sessions, isDbReady]);

  // Current active class
  const currentClass = useMemo(() => {
    return classes.find(c => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Find active slot details if any
  const activeSlot = useMemo(() => {
    if (!activeLectureSlotId) return undefined;
    return timetable.find(s => s.id === activeLectureSlotId);
  }, [timetable, activeLectureSlotId]);

  // Current session for selected class, date, and lecture slot
  const currentSession = useMemo(() => {
    // Look for session with matching classId, date, and lecture slot
    const existing = sessions.find(s => 
      s.classId === selectedClassId && 
      s.date === selectedDate && 
      (activeLectureSlotId ? s.lectureSlotId === activeLectureSlotId : true)
    );

    if (existing) return existing;

    // Create session template if not found
    const defaultRecords: Record<string, { studentId: string; status: AttendanceStatus; timestamp: string; note?: string }> = {};
    currentClass.studentIds.forEach(stId => {
      defaultRecords[stId] = {
        studentId: stId,
        status: 'present',
        timestamp: new Date().toISOString()
      };
    });

    const sessionName = activeSlot 
      ? `${activeSlot.timeSlotLabel} - ${activeSlot.subject}`
      : `${currentClass.name} Session`;

    return {
      id: `${selectedClassId}_${selectedDate}_${activeLectureSlotId || 'general'}`,
      classId: selectedClassId,
      date: selectedDate,
      sessionName,
      teacherName: activeSlot?.teacherName || currentClass.teacherName,
      lectureSlotId: activeLectureSlotId,
      timeSlot: activeSlot?.timeSlotLabel,
      subject: activeSlot?.subject || currentClass.subject,
      records: defaultRecords,
      lastUpdated: new Date().toISOString(),
      remarks: ''
    };
  }, [sessions, selectedClassId, selectedDate, activeLectureSlotId, currentClass, activeSlot]);

  const notifyUserChange = useCallback(() => {
    userHasModifiedDataRef.current = true;
  }, []);

  // Real-time Update individual record (ticking checkbox, setting absent, late, or adding note)
  const handleUpdateRecord = useCallback((studentId: string, status: AttendanceStatus, note?: string) => {
    notifyUserChange();
    setSessions(prevSessions => {
      const sessionIndex = prevSessions.findIndex(s => 
        s.classId === selectedClassId && 
        s.date === selectedDate &&
        (activeLectureSlotId ? s.lectureSlotId === activeLectureSlotId : true)
      );
      const timestamp = new Date().toISOString();

      if (sessionIndex >= 0) {
        const session = prevSessions[sessionIndex];
        const prevNote = session.records[studentId]?.note;
        const resolvedNote = note !== undefined ? note.trim() : prevNote;

        const updatedRecord: { studentId: string; status: AttendanceStatus; timestamp: string; note?: string } = {
          studentId,
          status,
          timestamp
        };
        if (resolvedNote) {
          updatedRecord.note = resolvedNote;
        }

        const updatedRecords = {
          ...session.records,
          [studentId]: updatedRecord
        };

        const updatedSession: AttendanceSession = {
          ...session,
          records: updatedRecords,
          lastUpdated: timestamp
        };

        const next = [...prevSessions];
        next[sessionIndex] = updatedSession;
        return next;
      } else {
        // Create new session entry
        const newRecords: Record<string, { studentId: string; status: AttendanceStatus; timestamp: string; note?: string }> = {};
        currentClass.studentIds.forEach(id => {
          const itemRecord: { studentId: string; status: AttendanceStatus; timestamp: string; note?: string } = {
            studentId: id,
            status: id === studentId ? status : 'present',
            timestamp
          };
          if (id === studentId && note && note.trim()) {
            itemRecord.note = note.trim();
          }
          newRecords[id] = itemRecord;
        });

        const newSession: AttendanceSession = {
          id: `${selectedClassId}_${selectedDate}_${activeLectureSlotId || 'general'}`,
          classId: selectedClassId,
          date: selectedDate,
          sessionName: activeSlot ? `${activeSlot.timeSlotLabel} - ${activeSlot.subject}` : 'Lecture Session',
          teacherName: activeSlot?.teacherName || currentClass.teacherName,
          lectureSlotId: activeLectureSlotId,
          timeSlot: activeSlot?.timeSlotLabel,
          subject: activeSlot?.subject || currentClass.subject,
          records: newRecords,
          lastUpdated: timestamp,
          remarks: ''
        };

        return [...prevSessions, newSession];
      }
    });
  }, [selectedClassId, selectedDate, activeLectureSlotId, currentClass, activeSlot]);

  // Batch update
  const handleBatchUpdate = useCallback((status: AttendanceStatus) => {
    notifyUserChange();
    setSessions(prevSessions => {
      const sessionIndex = prevSessions.findIndex(s => 
        s.classId === selectedClassId && 
        s.date === selectedDate &&
        (activeLectureSlotId ? s.lectureSlotId === activeLectureSlotId : true)
      );
      const timestamp = new Date().toISOString();

      const updatedRecords: Record<string, { studentId: string; status: AttendanceStatus; timestamp: string; note?: string }> = {};
      currentClass.studentIds.forEach(stId => {
        const existingNote = sessionIndex >= 0 ? prevSessions[sessionIndex].records[stId]?.note : undefined;
        const recItem: { studentId: string; status: AttendanceStatus; timestamp: string; note?: string } = {
          studentId: stId,
          status,
          timestamp
        };
        if (existingNote) {
          recItem.note = existingNote;
        }
        updatedRecords[stId] = recItem;
      });

      if (sessionIndex >= 0) {
        const session = prevSessions[sessionIndex];
        const updatedSession: AttendanceSession = {
          ...session,
          records: updatedRecords,
          lastUpdated: timestamp
        };
        const next = [...prevSessions];
        next[sessionIndex] = updatedSession;
        return next;
      } else {
        const newSession: AttendanceSession = {
          id: `${selectedClassId}_${selectedDate}_${activeLectureSlotId || 'general'}`,
          classId: selectedClassId,
          date: selectedDate,
          sessionName: activeSlot ? `${activeSlot.timeSlotLabel} - ${activeSlot.subject}` : 'Lecture Session',
          teacherName: activeSlot?.teacherName || currentClass.teacherName,
          lectureSlotId: activeLectureSlotId,
          timeSlot: activeSlot?.timeSlotLabel,
          subject: activeSlot?.subject || currentClass.subject,
          records: updatedRecords,
          lastUpdated: timestamp,
          remarks: ''
        };
        return [...prevSessions, newSession];
      }
    });
  }, [selectedClassId, selectedDate, activeLectureSlotId, currentClass, activeSlot, notifyUserChange]);

  // Invert Selection
  const handleInvertSelection = useCallback(() => {
    notifyUserChange();
    setSessions(prevSessions => {
      const sessionIndex = prevSessions.findIndex(s => 
        s.classId === selectedClassId && 
        s.date === selectedDate &&
        (activeLectureSlotId ? s.lectureSlotId === activeLectureSlotId : true)
      );
      const timestamp = new Date().toISOString();

      const updatedRecords: Record<string, { studentId: string; status: AttendanceStatus; timestamp: string; note?: string }> = {};
      currentClass.studentIds.forEach(stId => {
        const currentRecord = currentSession.records[stId];
        const currentStatus = currentRecord?.status || 'present';
        const invertedStatus: AttendanceStatus = currentStatus === 'present' ? 'absent' : 'present';
        
        updatedRecords[stId] = {
          studentId: stId,
          status: invertedStatus,
          timestamp,
          note: currentRecord?.note
        };
      });

      if (sessionIndex >= 0) {
        const session = prevSessions[sessionIndex];
        const updatedSession: AttendanceSession = {
          ...session,
          records: updatedRecords,
          lastUpdated: timestamp
        };
        const next = [...prevSessions];
        next[sessionIndex] = updatedSession;
        return next;
      } else {
        const newSession: AttendanceSession = {
          id: `${selectedClassId}_${selectedDate}_${activeLectureSlotId || 'general'}`,
          classId: selectedClassId,
          date: selectedDate,
          sessionName: activeSlot ? `${activeSlot.timeSlotLabel} - ${activeSlot.subject}` : 'Lecture Session',
          teacherName: activeSlot?.teacherName || currentClass.teacherName,
          lectureSlotId: activeLectureSlotId,
          timeSlot: activeSlot?.timeSlotLabel,
          subject: activeSlot?.subject || currentClass.subject,
          records: updatedRecords,
          lastUpdated: timestamp,
          remarks: ''
        };
        return [...prevSessions, newSession];
      }
    });
  }, [selectedClassId, selectedDate, activeLectureSlotId, currentClass, currentSession, activeSlot, notifyUserChange]);

  // Update remarks
  const handleUpdateSessionRemarks = useCallback((remarks: string) => {
    notifyUserChange();
    setSessions(prevSessions => {
      const sessionIndex = prevSessions.findIndex(s => 
        s.classId === selectedClassId && 
        s.date === selectedDate &&
        (activeLectureSlotId ? s.lectureSlotId === activeLectureSlotId : true)
      );
      const timestamp = new Date().toISOString();

      if (sessionIndex >= 0) {
        const session = prevSessions[sessionIndex];
        const updatedSession: AttendanceSession = {
          ...session,
          remarks,
          lastUpdated: timestamp
        };
        const next = [...prevSessions];
        next[sessionIndex] = updatedSession;
        return next;
      } else {
        const newSession: AttendanceSession = {
          id: `${selectedClassId}_${selectedDate}_${activeLectureSlotId || 'general'}`,
          classId: selectedClassId,
          date: selectedDate,
          sessionName: activeSlot ? `${activeSlot.timeSlotLabel} - ${activeSlot.subject}` : 'Lecture Session',
          teacherName: activeSlot?.teacherName || currentClass.teacherName,
          lectureSlotId: activeLectureSlotId,
          timeSlot: activeSlot?.timeSlotLabel,
          subject: activeSlot?.subject || currentClass.subject,
          records: currentSession.records,
          lastUpdated: timestamp,
          remarks
        };
        return [...prevSessions, newSession];
      }
    });
  }, [selectedClassId, selectedDate, activeLectureSlotId, currentClass, currentSession, activeSlot, notifyUserChange]);

  // Add individual student
  const handleAddStudent = (newStudentData: Omit<Student, 'id'>) => {
    notifyUserChange();
    const newId = `std-${Date.now()}`;
    const newStudent: Student = {
      ...newStudentData,
      id: newId
    };

    setStudents(prev => [...prev, newStudent]);
    setClasses(prev => prev.map(c => {
      if (c.id === selectedClassId) {
        return {
          ...c,
          studentIds: [...c.studentIds, newId]
        };
      }
      return c;
    }));

    handleUpdateRecord(newId, 'present');
  };

  // Update individual student (Req 10)
  const handleUpdateStudent = (updatedStudent: Student) => {
    notifyUserChange();
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
  };

  // Remove student from current class
  const handleRemoveStudentFromClass = (studentId: string) => {
    notifyUserChange();
    setClasses(prev => prev.map(c => {
      if (c.id === selectedClassId) {
        return {
          ...c,
          studentIds: c.studentIds.filter(id => id !== studentId)
        };
      }
      return c;
    }));
  };

  // Import batch students from Excel / PDF Scanner (Req 5)
  const handleImportStudents = (targetClassId: string, importedList: Omit<Student, 'id'>[]) => {
    notifyUserChange();
    const newStudents: Student[] = importedList.map((st, idx) => ({
      ...st,
      id: `std-imp-${Date.now()}-${idx}`
    }));

    setStudents(prev => [...prev, ...newStudents]);
    setClasses(prev => prev.map(c => {
      if (c.id === targetClassId) {
        return {
          ...c,
          studentIds: Array.from(new Set([...c.studentIds, ...newStudents.map(s => s.id)]))
        };
      }
      return c;
    }));

    // Switch to target class
    setSelectedClassId(targetClassId);
  };

  // Lecture Slot Click Handler (Req 13: "Suppose it's 8 to 9 am lecture ... So by clicking on that lecture teachers can tick the attendance")
  const handleSelectLecture = (slot: TimetableSlot, date: string) => {
    setSelectedDate(date);
    setSelectedClassId(slot.classId);
    setActiveLectureSlotId(slot.id);
    setCurrentTab('dashboard'); // Navigate directly to Attendance Roster so the teacher can tick students!
  };

  // Calculate Defaulters Count for Header Badge (Req 15 & 16)
  const defaultersCount = useMemo(() => {
    const threshold = settings.defaulterThreshold || 50;
    let count = 0;

    students.forEach(st => {
      const studentClasses = classes.filter(c => c.studentIds.includes(st.id));
      const relevantSessions = sessions.filter(s => 
        studentClasses.some(c => c.id === s.classId)
      );

      let total = 0;
      let attended = 0;
      relevantSessions.forEach(sess => {
        const rec = sess.records[st.id];
        if (rec && rec.status !== 'unmarked') {
          total++;
          if (rec.status === 'present') attended += 1;
          else if (rec.status === 'late') attended += 0.5;
        }
      });

      if (total > 0 && (attended / total) * 100 < threshold) {
        count++;
      }
    });

    return count;
  }, [students, classes, sessions, settings.defaulterThreshold]);

  // Total present for header badge
  const totalPresentCount = useMemo(() => {
    let count = 0;
    currentClass.studentIds.forEach(id => {
      if (currentSession.records[id]?.status === 'present') {
        count++;
      }
    });
    return count;
  }, [currentClass.studentIds, currentSession.records]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Permanently delete student from campus database
  const handleDeleteStudentPermanently = (studentId: string) => {
    notifyUserChange();
    const targetStudent = students.find(s => s.id === studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setClasses(prev => prev.map(c => ({
      ...c,
      studentIds: c.studentIds.filter(id => id !== studentId)
    })));
    setSessions(prev => prev.map(s => {
      if (s.records[studentId]) {
        const nextRecords = { ...s.records };
        delete nextRecords[studentId];
        return { ...s, records: nextRecords };
      }
      return s;
    }));
    showToast(`Student ${targetStudent ? targetStudent.name : ''} deleted permanently from campus database.`, 'success');
  };

  // Delete all students from class or campus-wide
  const handleDeleteAllStudents = (scope: 'current_class' | 'all_campus', targetClassId?: string) => {
    notifyUserChange();
    if (scope === 'all_campus') {
      setStudents([]);
      setClasses(prev => prev.map(c => ({ ...c, studentIds: [] })));
      setSessions(prev => prev.map(s => ({ ...s, records: {} })));
      showToast('All students across entire campus database have been deleted.', 'success');
    } else {
      const classId = targetClassId || selectedClassId;
      const targetCls = classes.find(c => c.id === classId);
      const studentIdsInClass = new Set(targetCls?.studentIds || []);

      setClasses(prev => prev.map(c => c.id === classId ? { ...c, studentIds: [] } : c));
      setStudents(prev => prev.filter(s => {
        if (!studentIdsInClass.has(s.id)) return true;
        return classes.some(c => c.id !== classId && c.studentIds.includes(s.id));
      }));
      setSessions(prev => prev.map(s => {
        if (s.classId === classId) {
          return { ...s, records: {} };
        }
        return s;
      }));
      showToast(`All students deleted from ${targetCls?.name || 'class'}.`, 'success');
    }
  };

  // Reset Campus Settings Only
  const handleResetSettingsOnly = () => {
    notifyUserChange();
    setSettings(INITIAL_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(INITIAL_SETTINGS));
    } catch (e) {
      console.error(e);
    }
    showToast('Campus settings reset to default D.Y.PATIL TECHNICAL CAMPUS configuration.', 'success');
  };

  // Reset Campus Data completely
  const handleResetAllData = () => {
    const freshSessions = generateInitialSessions(INITIAL_CLASSES, INITIAL_STUDENTS);
    setClasses(INITIAL_CLASSES);
    setStudents(INITIAL_STUDENTS);
    setTeachers(INITIAL_TEACHERS);
    setClassrooms(INITIAL_CLASSROOMS);
    setTimetable(INITIAL_TIMETABLE);
    setSettings(INITIAL_SETTINGS);
    setSessions(freshSessions);
    setSelectedClassId(INITIAL_CLASSES[0].id);

    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(INITIAL_TEACHERS));
      localStorage.setItem(STORAGE_KEY_CLASSROOMS, JSON.stringify(INITIAL_CLASSROOMS));
      localStorage.setItem(STORAGE_KEY_TIMETABLE, JSON.stringify(INITIAL_TIMETABLE));
      localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(INITIAL_CLASSES));
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(INITIAL_STUDENTS));
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(freshSessions));
    } catch (e) {
      console.error(e);
    }

    // Sync reset to Firebase Firestore if quota available
    if (!dbService.isQuotaExhausted) {
      dbService.saveEntireCampusState({
        settings: INITIAL_SETTINGS,
        classes: INITIAL_CLASSES,
        students: INITIAL_STUDENTS,
        teachers: INITIAL_TEACHERS,
        classrooms: INITIAL_CLASSROOMS,
        timetable: INITIAL_TIMETABLE,
        sessions: freshSessions
      }).catch(console.warn);
    }

    showToast('Campus system & database successfully reset to default D.Y.PATIL TECHNICAL CAMPUS state (ECE Div A).', 'success');
  };

  // Force Push to Cloud Database (Supabase / Firebase)
  const handleForceSyncCloud = async () => {
    if (dbService.currentProvider === 'firebase' && dbService.isQuotaExhausted) {
      showToast('Firebase daily write limit reached. All campus data is safely stored locally in your browser.', 'info');
      return;
    }
    setCloudSyncing(true);
    try {
      await dbService.saveEntireCampusState({
        settings,
        classes,
        students,
        teachers,
        classrooms,
        timetable,
        sessions
      });
      const providerTitle = dbService.currentProvider === 'supabase' ? 'Supabase PostgreSQL' : 'Firebase Firestore';
      showToast(`All ${students.length} students & campus records successfully stored in ${providerTitle}!`, 'success');
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes('tables have not been created') || e?.message?.includes('schema cache')) {
        showToast('Supabase connected! Please run the SQL schema in Supabase SQL editor to initialize tables.', 'info');
      } else {
        showToast('Failed to force sync to cloud. Local records preserved.', 'error');
      }
    } finally {
      setCloudSyncing(false);
    }
  };

  // IF NOT LOGGED IN: SHOW LOGIN PAGE (Req 1, 2, 3, 7)
  if (!currentUser) {
    return (
      <LoginPage
        settings={settings}
        teachers={teachers}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          // If teacher, set their first assigned class as active
          if (user.role === 'teacher' && user.assignedClasses && user.assignedClasses[0]) {
            setSelectedClassId(user.assignedClasses[0]);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400 shrink-0" />}
            <span className="text-xs font-semibold leading-snug">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        classes={classes}
        selectedClassId={selectedClassId}
        onClassChange={(id) => {
          setSelectedClassId(id);
          setActiveLectureSlotId(undefined);
        }}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onOpenWhatsApp={() => setIsWhatsAppModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        savedIndicator={savedIndicator}
        totalPresent={totalPresentCount}
        totalStudents={currentClass.studentIds.length}
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
        settings={settings}
        defaultersCount={defaultersCount}
        cloudSyncing={cloudSyncing}
        isQuotaExhausted={dbService.isQuotaExhausted}
        onForceSync={handleForceSyncCloud}
        activeDbProvider={dbService.currentProvider === 'supabase' ? 'Supabase' : 'Firebase'}
      />

      {/* Active Lecture Banner (Req 13) */}
      {activeSlot && currentTab === 'dashboard' && (
        <div className="bg-sky-50 border-b border-sky-200 py-2.5 px-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white font-mono font-bold text-[11px]">
                {activeSlot.timeSlotLabel}
              </span>
              <span className="font-extrabold text-sky-950 text-sm">
                {activeSlot.subject}
              </span>
              <span className="text-sky-700 hidden sm:inline">&bull;</span>
              <span className="text-sky-800 font-medium hidden sm:inline">
                {activeSlot.roomName} &bull; Faculty: {activeSlot.teacherName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sky-700 font-semibold">Ticking Live Attendance for this lecture</span>
              <button
                type="button"
                onClick={() => setActiveLectureSlotId(undefined)}
                className="text-[11px] text-sky-600 hover:text-sky-900 underline font-bold cursor-pointer"
              >
                Clear Lecture Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* VIEW 1: MARK ATTENDANCE */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6">
            <LiveDashboard
              session={currentSession}
              currentClass={currentClass}
              allStudents={students}
              onUpdateRecord={handleUpdateRecord}
              onBatchUpdate={handleBatchUpdate}
              onInvertSelection={handleInvertSelection}
              onUpdateSessionRemarks={handleUpdateSessionRemarks}
              onOpenWhatsApp={() => setIsWhatsAppModalOpen(true)}
            />
          </div>
        )}

        {/* VIEW 2: TIMETABLE & LECTURE SCHEDULE (Req 11, 13) */}
        {currentTab === 'timetable' && (
          <div className="space-y-6">
            <TimetableLectureSelector
              timetable={timetable}
              sessions={sessions}
              currentUser={currentUser}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onSelectLecture={handleSelectLecture}
              activeLectureSlotId={activeLectureSlotId}
            />
          </div>
        )}

        {/* VIEW 3: DEFAULTER LIST & PARENT WARNING ALERTS (Req 15, 16) */}
        {currentTab === 'defaulters' && (
          <DefaultersView
            students={students}
            classes={classes}
            sessions={sessions}
            settings={settings}
            onUpdateThreshold={(val) => setSettings(prev => ({ ...prev, defaulterThreshold: val }))}
            userRole={currentUser.role}
          />
        )}

        {/* VIEW 4: CAMPUS ANALYTICS (Req 8) */}
        {currentTab === 'analytics' && (
          <AnalyticsView
            sessions={sessions}
            currentClass={currentClass}
            students={students}
            onOpenWhatsApp={() => setIsWhatsAppModalOpen(true)}
          />
        )}

        {/* VIEW 5: STUDENTS ROSTER (Req 10) */}
        {currentTab === 'students' && (
          <StudentManagement
            currentClass={currentClass}
            students={students}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onRemoveStudentFromClass={handleRemoveStudentFromClass}
            onDeleteStudentPermanently={handleDeleteStudentPermanently}
            onDeleteAllStudents={handleDeleteAllStudents}
            onOpenImportModal={() => setIsImportModalOpen(true)}
          />
        )}

        {/* VIEW 6: HOD CONTROL CENTER (Req 6, 8, 9, 11, 12) */}
        {currentTab === 'hod' && currentUser.role === 'hod' && (
          <HodControlCenter
            settings={settings}
            onUpdateSettings={(newSettings) => {
              notifyUserChange();
              setSettings(newSettings);
            }}
            onResetSettings={handleResetSettingsOnly}
            teachers={teachers}
            onAddTeacher={(t) => {
              notifyUserChange();
              setTeachers(prev => [...prev, t]);
              showToast(`Teacher ${t.name} added with code ${t.uniqueCode}`, 'success');
            }}
            onUpdateTeacher={(t) => {
              notifyUserChange();
              setTeachers(prev => prev.map(old => old.id === t.id ? t : old));
            }}
            onDeleteTeacher={(id) => {
              notifyUserChange();
              setTeachers(prev => prev.filter(t => t.id !== id));
              showToast('Faculty member removed.', 'info');
            }}
            classrooms={classrooms}
            onAddClassroom={(r) => {
              notifyUserChange();
              setClassrooms(prev => [...prev, r]);
              showToast(`Classroom ${r.name} created.`, 'success');
            }}
            onDeleteClassroom={(id) => {
              notifyUserChange();
              setClassrooms(prev => prev.filter(r => r.id !== id));
              showToast('Classroom removed.', 'info');
            }}
            classes={classes}
            onAddClass={(c) => {
              notifyUserChange();
              setClasses(prev => [...prev, c]);
              showToast(`Class ${c.name} created.`, 'success');
            }}
            onDeleteClass={(id) => {
              notifyUserChange();
              setClasses(prev => prev.filter(c => c.id !== id));
              showToast('Class group removed.', 'info');
            }}
            timetable={timetable}
            onAddTimetableSlot={(s) => {
              notifyUserChange();
              setTimetable(prev => [...prev, s]);
              showToast('Lecture scheduled into timetable.', 'success');
            }}
            onDeleteTimetableSlot={(id) => {
              notifyUserChange();
              setTimetable(prev => prev.filter(s => s.id !== id));
              showToast('Timetable lecture removed.', 'info');
            }}
            students={students}
            onAddStudent={(newSt, targetClassId) => {
              notifyUserChange();
              const newId = `st-${Date.now()}`;
              const fullStudent: Student = { ...newSt, id: newId };
              setStudents(prev => [...prev, fullStudent]);
              setClasses(prev => prev.map(c => c.id === targetClassId ? { ...c, studentIds: [...c.studentIds, newId] } : c));
              showToast(`Enrolled student ${fullStudent.name}.`, 'success');
            }}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudentPermanently}
            onDeleteAllStudents={handleDeleteAllStudents}
            onResetAllData={handleResetAllData}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onForceSyncCloud={handleForceSyncCloud}
            isCloudSyncing={cloudSyncing}
            sessions={sessions}
          />
        )}

      </main>

      {/* MODAL 1: EXCEL / PDF STUDENT IMPORT (Req 5) */}
      <ImportStudentsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        classes={classes}
        selectedClassId={selectedClassId}
        onImportStudents={handleImportStudents}
      />

      {/* MODAL 2: WHATSAPP SHARE MODAL */}
      <WhatsAppShareModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        session={currentSession}
        currentClass={currentClass}
        students={students}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-4 text-center text-xs text-slate-500">
        <p className="max-w-xl mx-auto leading-relaxed">
          {settings.collegeName} &bull; {settings.departmentName} &bull; Real-time Attendance & Cloud ERP
        </p>
      </footer>
    </div>
  );
}
