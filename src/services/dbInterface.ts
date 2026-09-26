import { 
  ClassGroup, 
  Student, 
  AttendanceSession, 
  Teacher, 
  Classroom, 
  TimetableSlot, 
  SystemSettings,
  Holiday
} from '../types';

export interface CampusState {
  settings: SystemSettings;
  classes: ClassGroup[];
  students: Student[];
  teachers: Teacher[];
  classrooms: Classroom[];
  timetable: TimetableSlot[];
  sessions: AttendanceSession[];
  holidays?: Holiday[];
}

export type DatabaseProviderType = 'firebase' | 'supabase';

export interface CampusDatabaseAdapter {
  readonly providerName: DatabaseProviderType;
  readonly isConnected: boolean;
  init(): Promise<boolean>;
  loadCampusState(): Promise<CampusState | null>;
  saveSettings(settings: SystemSettings): Promise<void>;
  saveClasses(classes: ClassGroup[]): Promise<void>;
  saveStudents(students: Student[]): Promise<void>;
  saveTeachers(teachers: Teacher[]): Promise<void>;
  saveClassrooms(classrooms: Classroom[]): Promise<void>;
  saveTimetable(timetable: TimetableSlot[]): Promise<void>;
  saveSessions(sessions: AttendanceSession[]): Promise<void>;
  saveSession(session: AttendanceSession): Promise<void>;
  deleteStudentPermanently(studentId: string): Promise<void>;
  saveEntireCampusState(state: CampusState): Promise<void>;
  subscribeToUpdates?(onUpdate: (partialState: Partial<CampusState>) => void): () => void;
}
