import { CampusDatabaseAdapter, CampusState, DatabaseProviderType } from './dbInterface';
import { FirebaseDatabaseAdapter } from './firebaseAdapter';
import { SupabaseDatabaseAdapter } from './supabaseAdapter';
import { 
  ClassGroup, 
  Student, 
  AttendanceSession, 
  Teacher, 
  Classroom, 
  TimetableSlot, 
  SystemSettings 
} from '../types';

class CampusDatabaseService {
  private activeProvider: DatabaseProviderType = 'firebase';
  private firebaseAdapter: FirebaseDatabaseAdapter;
  private supabaseAdapter: SupabaseDatabaseAdapter;
  private isInitialized: boolean = false;

  constructor() {
    this.firebaseAdapter = new FirebaseDatabaseAdapter();
    this.supabaseAdapter = new SupabaseDatabaseAdapter();
  }

  get currentProvider(): DatabaseProviderType {
    return this.activeProvider;
  }

  get adapter(): CampusDatabaseAdapter {
    return this.activeProvider === 'firebase' ? this.firebaseAdapter : this.supabaseAdapter;
  }

  get isConnected(): boolean {
    return this.adapter.isConnected;
  }

  get isQuotaExhausted(): boolean {
    if (this.activeProvider === 'firebase') {
      return this.firebaseAdapter.isQuotaExhausted;
    }
    return false;
  }

  resetQuotaCheck() {
    if (this.activeProvider === 'firebase') {
      this.firebaseAdapter.resetQuotaCheck();
    }
  }

  setProvider(provider: DatabaseProviderType) {
    this.activeProvider = provider;
    this.adapter.init();
  }

  async init(): Promise<boolean> {
    if (this.isInitialized) return true;
    try {
      const success = await this.adapter.init();
      this.isInitialized = true;
      return success;
    } catch (e) {
      console.warn('Database service init warning:', e);
      return false;
    }
  }

  async loadCampusState(): Promise<CampusState | null> {
    return await this.adapter.loadCampusState();
  }

  async saveEntireCampusState(state: CampusState): Promise<void> {
    await this.adapter.saveEntireCampusState(state);
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    await this.adapter.saveSettings(settings);
  }

  async saveClasses(classes: ClassGroup[]): Promise<void> {
    await this.adapter.saveClasses(classes);
  }

  async saveStudents(students: Student[]): Promise<void> {
    await this.adapter.saveStudents(students);
  }

  async saveTeachers(teachers: Teacher[]): Promise<void> {
    await this.adapter.saveTeachers(teachers);
  }

  async saveClassrooms(classrooms: Classroom[]): Promise<void> {
    await this.adapter.saveClassrooms(classrooms);
  }

  async saveTimetable(timetable: TimetableSlot[]): Promise<void> {
    await this.adapter.saveTimetable(timetable);
  }

  async saveSessions(sessions: AttendanceSession[]): Promise<void> {
    await this.adapter.saveSessions(sessions);
  }

  async saveSession(session: AttendanceSession): Promise<void> {
    await this.adapter.saveSession(session);
  }

  async deleteStudentPermanently(studentId: string): Promise<void> {
    await this.adapter.deleteStudentPermanently(studentId);
  }

  subscribeToLiveUpdates(onUpdate: (state: Partial<CampusState>) => void): (() => void) | undefined {
    if (this.adapter.subscribeToUpdates) {
      return this.adapter.subscribeToUpdates(onUpdate);
    }
    return undefined;
  }

  getSupabaseSchema(): string {
    return SupabaseDatabaseAdapter.getSupabaseSqlSchema();
  }
}

export const dbService = new CampusDatabaseService();
