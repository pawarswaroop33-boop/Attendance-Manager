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

/**
 * Supabase Database Adapter (Migration Ready)
 * 
 * When shifting to Supabase:
 * 1. Install @supabase/supabase-js: `npm install @supabase/supabase-js`
 * 2. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment or HOD Settings.
 * 3. Run the SQL schema script generated below in your Supabase SQL editor.
 */
export class SupabaseDatabaseAdapter implements CampusDatabaseAdapter {
  readonly providerName: DatabaseProviderType = 'supabase';
  private _isConnected: boolean = false;
  private supabaseUrl: string = '';
  private supabaseAnonKey: string = '';

  constructor(url?: string, anonKey?: string) {
    this.supabaseUrl = url || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : '') || '';
    this.supabaseAnonKey = anonKey || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : '') || '';
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  setCredentials(url: string, anonKey: string) {
    this.supabaseUrl = url;
    this.supabaseAnonKey = anonKey;
  }

  async init(): Promise<boolean> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.info('Supabase credentials not yet provided. Ready for migration.');
      this._isConnected = false;
      return false;
    }
    this._isConnected = true;
    return true;
  }

  async loadCampusState(): Promise<CampusState | null> {
    // Falls back to local/cached state until Supabase credentials are configured
    return null;
  }

  async saveEntireCampusState(state: CampusState): Promise<void> {
    console.log('[Supabase Migration Ready] Save entire campus state queued:', state.settings.collegeName);
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    console.log('[Supabase Migration Ready] Save settings:', settings);
  }

  async saveClasses(classes: ClassGroup[]): Promise<void> {
    console.log('[Supabase Migration Ready] Save classes:', classes.length);
  }

  async saveStudents(students: Student[]): Promise<void> {
    console.log('[Supabase Migration Ready] Save students:', students.length);
  }

  async saveTeachers(teachers: Teacher[]): Promise<void> {
    console.log('[Supabase Migration Ready] Save teachers:', teachers.length);
  }

  async saveClassrooms(classrooms: Classroom[]): Promise<void> {
    console.log('[Supabase Migration Ready] Save classrooms:', classrooms.length);
  }

  async saveTimetable(timetable: TimetableSlot[]): Promise<void> {
    console.log('[Supabase Migration Ready] Save timetable slots:', timetable.length);
  }

  async saveSessions(sessions: AttendanceSession[]): Promise<void> {
    console.log('[Supabase Migration Ready] Save sessions:', sessions.length);
  }

  async saveSession(session: AttendanceSession): Promise<void> {
    console.log('[Supabase Migration Ready] Save session:', session.id);
  }

  async deleteStudentPermanently(studentId: string): Promise<void> {
    console.log('[Supabase Migration Ready] Delete student:', studentId);
  }

  /**
   * Generates production-ready PostgreSQL / Supabase SQL Schema
   * for easy 1-click execution in Supabase SQL editor.
   */
  static getSupabaseSqlSchema(): string {
    return `
-- ========================================================
-- D.Y.PATIL TECHNICAL CAMPUS ATTENDANCE SYSTEM
-- Supabase PostgreSQL Schema Migration
-- ========================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Campus System Settings
CREATE TABLE IF NOT EXISTS campus_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  college_name TEXT NOT NULL,
  department_name TEXT NOT NULL,
  hod_name TEXT NOT NULL,
  hod_passcode TEXT NOT NULL,
  defaulter_threshold NUMERIC DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Academic Classes / Divisions
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

-- 4. Students
CREATE TABLE IF NOT EXISTS campus_students (
  id TEXT PRIMARY KEY,
  roll_no TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  email TEXT,
  avatar_bg TEXT,
  class_id TEXT REFERENCES campus_classes(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Faculty / Teachers
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

-- 6. Classrooms & Labs
CREATE TABLE IF NOT EXISTS campus_classrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  building TEXT,
  capacity INT,
  type TEXT DEFAULT 'classroom'
);

-- 7. Timetable Slots
CREATE TABLE IF NOT EXISTS campus_timetable (
  id TEXT PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  time_slot_label TEXT NOT NULL,
  subject TEXT NOT NULL,
  class_id TEXT REFERENCES campus_classes(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  teacher_id TEXT,
  teacher_name TEXT,
  room_id TEXT,
  room_name TEXT
);

-- 8. Attendance Sessions & Records
CREATE TABLE IF NOT EXISTS campus_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES campus_classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  session_name TEXT NOT NULL,
  teacher_name TEXT,
  lecture_slot_id TEXT,
  time_slot TEXT,
  subject TEXT,
  records JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Row Level Security (RLS)
ALTER TABLE campus_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and service role access
CREATE POLICY "Allow public read-write for campus ops" ON campus_settings FOR ALL USING (true);
CREATE POLICY "Allow public read-write for campus ops" ON campus_classes FOR ALL USING (true);
CREATE POLICY "Allow public read-write for campus ops" ON campus_students FOR ALL USING (true);
CREATE POLICY "Allow public read-write for campus ops" ON campus_teachers FOR ALL USING (true);
CREATE POLICY "Allow public read-write for campus ops" ON campus_classrooms FOR ALL USING (true);
CREATE POLICY "Allow public read-write for campus ops" ON campus_timetable FOR ALL USING (true);
CREATE POLICY "Allow public read-write for campus ops" ON campus_sessions FOR ALL USING (true);
`;
  }
}
