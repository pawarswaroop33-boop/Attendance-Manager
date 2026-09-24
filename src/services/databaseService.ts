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

const STORAGE_KEY_PROVIDER = 'dypatil_active_database_provider';

class CampusDatabaseService {
  private activeProvider: DatabaseProviderType = 'supabase';
  private firebaseAdapter: FirebaseDatabaseAdapter;
  private supabaseAdapter: SupabaseDatabaseAdapter;
  private isInitialized: boolean = false;

  constructor() {
    this.firebaseAdapter = new FirebaseDatabaseAdapter();
    this.supabaseAdapter = new SupabaseDatabaseAdapter();

    // Default to Supabase as requested by user, or restore preference
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_PROVIDER) as DatabaseProviderType;
        if (saved === 'firebase' || saved === 'supabase') {
          this.activeProvider = saved;
        } else {
          this.activeProvider = 'supabase';
          localStorage.setItem(STORAGE_KEY_PROVIDER, 'supabase');
        }
      }
    } catch (_) {
      this.activeProvider = 'supabase';
    }
  }

  get currentProvider(): DatabaseProviderType {
    return this.activeProvider;
  }

  get adapter(): CampusDatabaseAdapter {
    return this.activeProvider === 'supabase' ? this.supabaseAdapter : this.firebaseAdapter;
  }

  get supabase(): SupabaseDatabaseAdapter {
    return this.supabaseAdapter;
  }

  get firebase(): FirebaseDatabaseAdapter {
    return this.firebaseAdapter;
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

  setProvider(provider: DatabaseProviderType): void {
    this.activeProvider = provider;
    try {
      localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
    } catch (_) {}
    this.adapter.init();
  }

  setSupabaseCredentials(url: string, key: string): void {
    this.supabaseAdapter.setCredentials(url, key);
  }

  async init(): Promise<boolean> {
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
    try {
      const primaryState = await this.adapter.loadCampusState();
      if (primaryState && primaryState.students && primaryState.students.length > 0) {
        return primaryState;
      }
      return primaryState;
    } catch (e) {
      console.warn('loadCampusState notice:', e);
      return null;
    }
  }

  async saveEntireCampusState(state: CampusState): Promise<void> {
    // Save exclusively to the active provider (Supabase) - zero load on Firebase
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
