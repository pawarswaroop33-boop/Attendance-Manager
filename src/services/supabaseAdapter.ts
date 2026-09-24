import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CampusDatabaseAdapter, CampusState, DatabaseProviderType } from './dbInterface';
import { 
  ClassGroup, 
  Student, 
  AttendanceSession, 
  Teacher, 
  Classroom, 
  TimetableSlot, 
  SystemSettings 
} from '../types';

export const DEFAULT_SUPABASE_URL = 'https://lascgvyktowhgrfcnqbp.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_TnPeA9j7P_JkSTa4VpEQRw_xYI3_59R';
export const DEFAULT_SUPABASE_PROJECT_ID = 'lascgvyktowhgrfcnqbp';
export const DEFAULT_SUPABASE_PROJECT_NAME = 'attendance';

const STORAGE_KEY_SUPABASE_URL = 'dypatil_supabase_url';
const STORAGE_KEY_SUPABASE_KEY = 'dypatil_supabase_anon_key';

export class SupabaseDatabaseAdapter implements CampusDatabaseAdapter {
  readonly providerName: DatabaseProviderType = 'supabase';
  private _isConnected: boolean = false;
  private _tablesVerified: boolean = false;
  private _lastError: string | null = null;
  private supabaseUrl: string;
  private supabaseAnonKey: string;
  private client: SupabaseClient | null = null;

  constructor(url?: string, anonKey?: string) {
    let resolvedUrl = url || '';
    let resolvedKey = anonKey || '';

    if (!resolvedUrl && typeof localStorage !== 'undefined') {
      resolvedUrl = localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || '';
    }
    if (!resolvedKey && typeof localStorage !== 'undefined') {
      resolvedKey = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || '';
    }

    // Auto-migrate from any old placeholder projects to user's specified project
    if (
      !resolvedUrl || 
      resolvedUrl.includes('nwfugweckpnozbfoxtov') || 
      resolvedKey.includes('dqiR-13ExmSqZqRc1u93pg')
    ) {
      resolvedUrl = DEFAULT_SUPABASE_URL;
      resolvedKey = DEFAULT_SUPABASE_ANON_KEY;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_SUPABASE_URL, DEFAULT_SUPABASE_URL);
          localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, DEFAULT_SUPABASE_ANON_KEY);
        } catch (_) {}
      }
    }

    if (!resolvedUrl && typeof import.meta !== 'undefined') {
      resolvedUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    }
    if (!resolvedKey && typeof import.meta !== 'undefined') {
      resolvedKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
    }

    // Default to user's provided Supabase credentials
    this.supabaseUrl = (resolvedUrl || DEFAULT_SUPABASE_URL).trim().replace(/\/rest\/v1\/?$/, '');
    this.supabaseAnonKey = (resolvedKey || DEFAULT_SUPABASE_ANON_KEY).trim();

    this.initClient();
  }

  private initClient(): void {
    if (this.supabaseUrl && this.supabaseAnonKey) {
      try {
        this.client = createClient(this.supabaseUrl, this.supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
      } catch (err) {
        console.warn('[Supabase] Client init warning:', err);
        this.client = null;
      }
    }
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get tablesVerified(): boolean {
    return this._tablesVerified;
  }

  get isQuotaExhausted(): boolean {
    return false;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  get url(): string {
    return this.supabaseUrl;
  }

  get anonKey(): string {
    return this.supabaseAnonKey;
  }

  setCredentials(url: string, anonKey: string): void {
    this.supabaseUrl = (url || DEFAULT_SUPABASE_URL).trim().replace(/\/rest\/v1\/?$/, '');
    this.supabaseAnonKey = (anonKey || DEFAULT_SUPABASE_ANON_KEY).trim();
    try {
      localStorage.setItem(STORAGE_KEY_SUPABASE_URL, this.supabaseUrl);
      localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, this.supabaseAnonKey);
    } catch (_) {}
    this.initClient();
  }

  async init(): Promise<boolean> {
    if (!this.client) {
      this.initClient();
    }
    if (!this.client) {
      this._isConnected = false;
      return false;
    }

    try {
      // Check if Supabase endpoint is reachable
      const { data, error } = await this.client
        .from('campus_state')
        .select('id')
        .limit(1);

      if (error) {
        // Code PGRST205 or 42P01 means endpoint works, but tables need to be created via SQL
        if (error.code === 'PGRST205' || error.message.includes('schema cache') || error.message.includes('does not exist')) {
          this._isConnected = true;
          this._tablesVerified = false;
          this._lastError = 'Tables need to be created. Please run the Supabase SQL schema in your Supabase SQL editor.';
          return true;
        }
        this._lastError = error.message;
        this._isConnected = true;
        return true;
      }

      this._isConnected = true;
      this._tablesVerified = true;
      this._lastError = null;
      return true;
    } catch (err: any) {
      this._isConnected = false;
      this._lastError = err?.message || 'Connection failed';
      return false;
    }
  }

  async loadCampusState(): Promise<CampusState | null> {
    if (!this.client) return null;

    try {
      // 1. Try to load from master campus_state snapshot (supports both 'state' and 'data' columns)
      const { data: snapshotData, error: snapErr } = await this.client
        .from('campus_state')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();

      if (!snapErr && snapshotData) {
        const rawState = (snapshotData as any).state || (snapshotData as any).data;
        if (rawState && typeof rawState === 'object') {
          this._isConnected = true;
          this._tablesVerified = true;
          return rawState as CampusState;
        }
      }

      // 2. Alternatively, attempt reading relational tables
      const [
        { data: settingsRow },
        { data: classesRows },
        { data: studentsRows },
        { data: teachersRows },
        { data: classroomsRows },
        { data: timetableRows },
        { data: sessionsRows }
      ] = await Promise.all([
        this.client.from('campus_settings').select('*').eq('id', 'current').maybeSingle(),
        this.client.from('campus_classes').select('*'),
        this.client.from('campus_students').select('*'),
        this.client.from('campus_teachers').select('*'),
        this.client.from('campus_classrooms').select('*'),
        this.client.from('campus_timetable').select('*'),
        this.client.from('campus_sessions').select('*')
      ]);

      if (studentsRows && studentsRows.length > 0) {
        this._isConnected = true;
        this._tablesVerified = true;

        const students: Student[] = studentsRows.map(r => ({
          id: r.id,
          rollNo: r.roll_no,
          name: r.name,
          gender: r.gender,
          parentPhone: r.parent_phone,
          parentName: r.parent_name,
          email: r.email,
          avatarBg: r.avatar_bg,
          classId: r.class_id,
          remarks: r.remarks
        }));

        const classes: ClassGroup[] = (classesRows || []).map(r => ({
          id: r.id,
          name: r.name,
          grade: r.grade,
          section: r.section,
          subject: r.subject,
          room: r.room,
          teacherName: r.teacher_name,
          studentIds: r.student_ids || []
        }));

        const teachers: Teacher[] = (teachersRows || []).map(r => ({
          id: r.id,
          uniqueCode: r.unique_code,
          passcode: r.passcode,
          name: r.name,
          email: r.email,
          phone: r.phone,
          department: r.department,
          subjects: r.subjects || [],
          assignedClasses: r.assigned_classes || []
        }));

        const classrooms: Classroom[] = (classroomsRows || []).map(r => ({
          id: r.id,
          name: r.name,
          building: r.building,
          capacity: r.capacity,
          type: r.type
        }));

        const timetable: TimetableSlot[] = (timetableRows || []).map(r => ({
          id: r.id,
          dayOfWeek: r.day_of_week,
          startTime: r.start_time,
          endTime: r.end_time,
          timeSlotLabel: r.time_slot_label,
          subject: r.subject,
          classId: r.class_id,
          className: r.class_name,
          teacherId: r.teacher_id,
          teacherName: r.teacher_name,
          roomId: r.room_id,
          roomName: r.room_name
        }));

        const sessions: AttendanceSession[] = (sessionsRows || []).map(r => ({
          id: r.id,
          classId: r.class_id,
          date: r.date,
          sessionName: r.session_name,
          teacherName: r.teacher_name,
          lectureSlotId: r.lecture_slot_id,
          timeSlot: r.time_slot,
          subject: r.subject,
          records: r.records || {},
          lastUpdated: r.last_updated,
          remarks: r.remarks
        }));

        const settings: SystemSettings = settingsRow ? {
          collegeName: settingsRow.college_name,
          departmentName: settingsRow.department_name,
          hodName: settingsRow.hod_name,
          hodPasscode: settingsRow.hod_passcode,
          defaulterThreshold: Number(settingsRow.defaulter_threshold || 50),
          autoCloudSync: settingsRow.auto_cloud_sync ?? true,
          cloudSyncStatus: 'synced',
          lastCloudSyncTimestamp: settingsRow.last_cloud_sync_timestamp || new Date().toISOString()
        } : (null as any);

        return {
          settings,
          classes,
          students,
          teachers,
          classrooms,
          timetable,
          sessions
        };
      }

      return null;
    } catch (err: any) {
      console.warn('[Supabase] Notice loading campus state:', err?.message || err);
      return null;
    }
  }

  async saveEntireCampusState(state: CampusState): Promise<void> {
    if (!this.client) return;

    try {
      const payload = {
        ...state,
        settings: {
          ...state.settings,
          cloudSyncStatus: 'synced',
          lastCloudSyncTimestamp: new Date().toISOString()
        }
      };

      // 1. Save master state snapshot (guarantees complete preservation)
      // Attempt upsert with 'state' column first (which is the actual column in Supabase PostgreSQL)
      let snapError: any = null;
      const resState = await this.client
        .from('campus_state')
        .upsert({
          id: 'current',
          state: payload,
          updated_at: new Date().toISOString()
        });

      if (resState.error) {
        // Fallback to 'data' column if table was created with 'data'
        const resData = await this.client
          .from('campus_state')
          .upsert({
            id: 'current',
            data: payload,
            updated_at: new Date().toISOString()
          });
        snapError = resData.error;
      }

      if (snapError && (snapError.code === 'PGRST205' || snapError.message?.includes('schema cache'))) {
        this._tablesVerified = false;
        this._lastError = 'Tables need to be created. Please run the SQL schema in Supabase SQL editor.';
        throw new Error('Supabase tables have not been created yet. Please copy and execute the SQL Schema in your Supabase SQL editor.');
      }

      this._tablesVerified = true;
      this._isConnected = true;
      this._lastError = null;

      // 2. Upsert relational tables
      try {
        if (state.settings) {
          await this.client.from('campus_settings').upsert({
            id: 'current',
            college_name: state.settings.collegeName,
            department_name: state.settings.departmentName,
            hod_name: state.settings.hodName,
            hod_passcode: state.settings.hodPasscode,
            defaulter_threshold: state.settings.defaulterThreshold,
            auto_cloud_sync: state.settings.autoCloudSync,
            cloud_sync_status: 'synced',
            last_cloud_sync_timestamp: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      } catch (_) {}

      try {
        if (state.classes && state.classes.length > 0) {
          const classRows = state.classes.map(c => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
            section: c.section,
            subject: c.subject,
            room: c.room,
            teacher_name: c.teacherName,
            student_ids: c.studentIds,
            updated_at: new Date().toISOString()
          }));
          await this.client.from('campus_classes').upsert(classRows);
        }
      } catch (_) {}

      try {
        if (state.students && state.students.length > 0) {
          const studentRows = state.students.map(s => ({
            id: s.id,
            roll_no: s.rollNo,
            name: s.name,
            gender: s.gender,
            parent_phone: s.parentPhone || null,
            parent_name: s.parentName || null,
            email: s.email || null,
            avatar_bg: s.avatarBg || null,
            class_id: s.classId || null,
            remarks: s.remarks || null
          }));
          await this.client.from('campus_students').upsert(studentRows);
        }
      } catch (_) {}

      try {
        if (state.teachers && state.teachers.length > 0) {
          const teacherRows = state.teachers.map(t => ({
            id: t.id,
            unique_code: t.uniqueCode,
            passcode: t.passcode,
            name: t.name,
            email: t.email,
            phone: t.phone,
            department: t.department,
            subjects: t.subjects,
            assigned_classes: t.assignedClasses
          }));
          await this.client.from('campus_teachers').upsert(teacherRows);
        }
      } catch (_) {}

      try {
        if (state.classrooms && state.classrooms.length > 0) {
          const roomRows = state.classrooms.map(r => ({
            id: r.id,
            name: r.name,
            building: r.building,
            capacity: r.capacity,
            type: r.type
          }));
          await this.client.from('campus_classrooms').upsert(roomRows);
        }
      } catch (_) {}

      try {
        if (state.timetable && state.timetable.length > 0) {
          const timetableRows = state.timetable.map(s => ({
            id: s.id,
            day_of_week: s.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime,
            time_slot_label: s.timeSlotLabel,
            subject: s.subject,
            class_id: s.classId,
            class_name: s.className,
            teacher_id: s.teacherId,
            teacher_name: s.teacherName,
            room_id: s.roomId,
            room_name: s.roomName
          }));
          await this.client.from('campus_timetable').upsert(timetableRows);
        }
      } catch (_) {}

      try {
        if (state.sessions && state.sessions.length > 0) {
          const sessionRows = state.sessions.map(s => ({
            id: s.id,
            class_id: s.classId,
            date: s.date,
            session_name: s.sessionName,
            teacher_name: s.teacherName,
            lecture_slot_id: s.lectureSlotId || null,
            time_slot: s.timeSlot || null,
            subject: s.subject || null,
            records: s.records || {},
            last_updated: s.lastUpdated || new Date().toISOString(),
            remarks: s.remarks || null
          }));
          await this.client.from('campus_sessions').upsert(sessionRows);
        }
      } catch (_) {}
    } catch (err: any) {
      console.warn('[Supabase] Save error:', err?.message || err);
      throw err;
    }
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.from('campus_settings').upsert({
        id: 'current',
        college_name: settings.collegeName,
        department_name: settings.departmentName,
        hod_name: settings.hodName,
        hod_passcode: settings.hodPasscode,
        defaulter_threshold: settings.defaulterThreshold,
        auto_cloud_sync: settings.autoCloudSync,
        cloud_sync_status: 'synced',
        last_cloud_sync_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[Supabase] saveSettings error:', e);
    }
  }

  async saveClasses(classes: ClassGroup[]): Promise<void> {
    if (!this.client || classes.length === 0) return;
    try {
      const rows = classes.map(c => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        section: c.section,
        subject: c.subject,
        room: c.room,
        teacher_name: c.teacherName,
        student_ids: c.studentIds,
        updated_at: new Date().toISOString()
      }));
      await this.client.from('campus_classes').upsert(rows);
    } catch (e) {
      console.warn('[Supabase] saveClasses error:', e);
    }
  }

  async saveStudents(students: Student[]): Promise<void> {
    if (!this.client || students.length === 0) return;
    try {
      const rows = students.map(s => ({
        id: s.id,
        roll_no: s.rollNo,
        name: s.name,
        gender: s.gender,
        parent_phone: s.parentPhone || null,
        parent_name: s.parentName || null,
        email: s.email || null,
        avatar_bg: s.avatarBg || null,
        class_id: s.classId || null,
        remarks: s.remarks || null
      }));
      await this.client.from('campus_students').upsert(rows);
    } catch (e) {
      console.warn('[Supabase] saveStudents error:', e);
    }
  }

  async saveTeachers(teachers: Teacher[]): Promise<void> {
    if (!this.client || teachers.length === 0) return;
    try {
      const rows = teachers.map(t => ({
        id: t.id,
        unique_code: t.uniqueCode,
        passcode: t.passcode,
        name: t.name,
        email: t.email,
        phone: t.phone,
        department: t.department,
        subjects: t.subjects,
        assigned_classes: t.assignedClasses
      }));
      await this.client.from('campus_teachers').upsert(rows);
    } catch (e) {
      console.warn('[Supabase] saveTeachers error:', e);
    }
  }

  async saveClassrooms(classrooms: Classroom[]): Promise<void> {
    if (!this.client || classrooms.length === 0) return;
    try {
      const rows = classrooms.map(r => ({
        id: r.id,
        name: r.name,
        building: r.building,
        capacity: r.capacity,
        type: r.type
      }));
      await this.client.from('campus_classrooms').upsert(rows);
    } catch (e) {
      console.warn('[Supabase] saveClassrooms error:', e);
    }
  }

  async saveTimetable(timetable: TimetableSlot[]): Promise<void> {
    if (!this.client || timetable.length === 0) return;
    try {
      const rows = timetable.map(s => ({
        id: s.id,
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
        time_slot_label: s.timeSlotLabel,
        subject: s.subject,
        class_id: s.classId,
        class_name: s.className,
        teacher_id: s.teacherId,
        teacher_name: s.teacherName,
        room_id: s.roomId,
        room_name: s.roomName
      }));
      await this.client.from('campus_timetable').upsert(rows);
    } catch (e) {
      console.warn('[Supabase] saveTimetable error:', e);
    }
  }

  async saveSessions(sessions: AttendanceSession[]): Promise<void> {
    if (!this.client || sessions.length === 0) return;
    try {
      const rows = sessions.map(s => ({
        id: s.id,
        class_id: s.classId,
        date: s.date,
        session_name: s.sessionName,
        teacher_name: s.teacherName,
        lecture_slot_id: s.lectureSlotId || null,
        time_slot: s.timeSlot || null,
        subject: s.subject || null,
        records: s.records || {},
        last_updated: s.lastUpdated || new Date().toISOString(),
        remarks: s.remarks || null
      }));
      await this.client.from('campus_sessions').upsert(rows);
    } catch (e) {
      console.warn('[Supabase] saveSessions error:', e);
    }
  }

  async saveSession(session: AttendanceSession): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.from('campus_sessions').upsert({
        id: session.id,
        class_id: session.classId,
        date: session.date,
        session_name: session.sessionName,
        teacher_name: session.teacherName,
        lecture_slot_id: session.lectureSlotId || null,
        time_slot: session.timeSlot || null,
        subject: session.subject || null,
        records: session.records || {},
        last_updated: session.lastUpdated || new Date().toISOString(),
        remarks: session.remarks || null
      });
    } catch (e) {
      console.warn('[Supabase] saveSession error:', e);
    }
  }

  async deleteStudentPermanently(studentId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.from('campus_students').delete().eq('id', studentId);
    } catch (e) {
      console.warn('[Supabase] deleteStudentPermanently error:', e);
    }
  }

  subscribeToUpdates(onUpdate: (partialState: Partial<CampusState>) => void): () => void {
    if (!this.client) return () => {};

    try {
      const channel = this.client
        .channel('campus-live-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'campus_state' },
          (payload: any) => {
            const raw = payload?.new?.state || payload?.new?.data;
            if (raw && typeof raw === 'object') {
              onUpdate(raw as Partial<CampusState>);
            }
          }
        )
        .subscribe();

      return () => {
        try {
          if (this.client) {
            this.client.removeChannel(channel);
          }
        } catch (_) {}
      };
    } catch (err) {
      console.warn('[Supabase] Realtime subscription error:', err);
      return () => {};
    }
  }

  /**
   * Generates production-ready PostgreSQL / Supabase SQL Schema
   * for 1-click execution in Supabase SQL editor.
   */
  static getSupabaseSqlSchema(): string {
    return `-- ========================================================
-- D.Y.PATIL TECHNICAL CAMPUS ATTENDANCE ERP
-- Supabase PostgreSQL Schema & Real-Time Sync Setup
-- Project: attendance (ID: lascgvyktowhgrfcnqbp)
-- ========================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Master Campus State Snapshot (Instant 1-Click Sync Table)
CREATE TABLE IF NOT EXISTS campus_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  state JSONB DEFAULT '{}'::jsonb,
  data JSONB DEFAULT '{}'::jsonb,
  version INT DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Campus System Settings
CREATE TABLE IF NOT EXISTS campus_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  college_name TEXT NOT NULL,
  department_name TEXT NOT NULL,
  hod_name TEXT NOT NULL,
  hod_passcode TEXT NOT NULL,
  defaulter_threshold NUMERIC DEFAULT 50,
  auto_cloud_sync BOOLEAN DEFAULT true,
  cloud_sync_status TEXT DEFAULT 'synced',
  last_cloud_sync_timestamp TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Academic Classes / Divisions
CREATE TABLE IF NOT EXISTS campus_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  section TEXT NOT NULL,
  subject TEXT,
  room TEXT,
  teacher_name TEXT,
  student_ids JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Students Roster
CREATE TABLE IF NOT EXISTS campus_students (
  id TEXT PRIMARY KEY,
  roll_no TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  email TEXT,
  avatar_bg TEXT,
  class_id TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Faculty / Teachers
CREATE TABLE IF NOT EXISTS campus_teachers (
  id TEXT PRIMARY KEY,
  unique_code TEXT UNIQUE NOT NULL,
  passcode TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  subjects JSONB DEFAULT '[]'::jsonb,
  assigned_classes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Classrooms & Labs
CREATE TABLE IF NOT EXISTS campus_classrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  building TEXT,
  capacity INT,
  type TEXT DEFAULT 'classroom'
);

-- 8. Timetable Slots
CREATE TABLE IF NOT EXISTS campus_timetable (
  id TEXT PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  time_slot_label TEXT NOT NULL,
  subject TEXT NOT NULL,
  class_id TEXT,
  class_name TEXT NOT NULL,
  teacher_id TEXT,
  teacher_name TEXT,
  room_id TEXT,
  room_name TEXT
);

-- 9. Attendance Sessions & Records
CREATE TABLE IF NOT EXISTS campus_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT,
  date DATE NOT NULL,
  session_name TEXT NOT NULL,
  teacher_name TEXT,
  lecture_slot_id TEXT,
  time_slot TEXT,
  subject TEXT,
  records JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  remarks TEXT
);

-- 10. Enable Row Level Security (RLS) on all tables
ALTER TABLE campus_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_sessions ENABLE ROW LEVEL SECURITY;

-- 11. Allow Public (anon) Read & Write for Campus Web App
DROP POLICY IF EXISTS "Public campus_state access" ON campus_state;
CREATE POLICY "Public campus_state access" ON campus_state FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public campus_settings access" ON campus_settings;
CREATE POLICY "Public campus_settings access" ON campus_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public campus_classes access" ON campus_classes;
CREATE POLICY "Public campus_classes access" ON campus_classes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public campus_students access" ON campus_students;
CREATE POLICY "Public campus_students access" ON campus_students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public campus_teachers access" ON campus_teachers;
CREATE POLICY "Public campus_teachers access" ON campus_teachers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public campus_classrooms access" ON campus_classrooms;
CREATE POLICY "Public campus_classrooms access" ON campus_classrooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public campus_timetable access" ON campus_timetable;
CREATE POLICY "Public campus_timetable access" ON campus_timetable FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public campus_sessions access" ON campus_sessions;
CREATE POLICY "Public campus_sessions access" ON campus_sessions FOR ALL USING (true) WITH CHECK (true);

-- 12. Enable Real-Time Replication for Live Sync
ALTER TABLE campus_state REPLICA IDENTITY FULL;
ALTER TABLE campus_sessions REPLICA IDENTITY FULL;
ALTER TABLE campus_students REPLICA IDENTITY FULL;
ALTER TABLE campus_timetable REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE campus_state;
ALTER PUBLICATION supabase_realtime ADD TABLE campus_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE campus_students;
ALTER PUBLICATION supabase_realtime ADD TABLE campus_timetable;
`;
  }
}
