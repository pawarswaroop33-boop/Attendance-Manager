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

      // If active provider had no data or tables aren't initialized yet, check fallback provider (Firestore)
      const secondary = this.activeProvider === 'supabase' ? this.firebaseAdapter : this.supabaseAdapter;
      try {
        const secondaryState = await secondary.loadCampusState();
        if (secondaryState && secondaryState.students && secondaryState.students.length > 0) {
          console.log(`[DB Service] Loaded complete campus state (${secondaryState.students.length} students) from backup: ${secondary.providerName}`);
          return secondaryState;
        }
      } catch (secErr) {
        console.warn('[DB Service] Secondary load notice:', secErr);
      }

      return primaryState;
    } catch (e) {
      console.warn('loadCampusState warning:', e);
      // Try secondary in case primary threw an error (e.g. table not found in Supabase)
      try {
        const secondary = this.activeProvider === 'supabase' ? this.firebaseAdapter : this.supabaseAdapter;
        const secondaryState = await secondary.loadCampusState();
        if (secondaryState && secondaryState.students && secondaryState.students.length > 0) {
          return secondaryState;
        }
      } catch (_) {}
      return null;
    }
  }

  async saveEntireCampusState(state: CampusState): Promise<void> {
    let primaryError: any = null;

    // 1. Attempt save to currently active provider (Supabase)
    try {
      await this.adapter.saveEntireCampusState(state);
    } catch (err) {
      primaryError = err;
      console.warn(`[DB Service] Primary provider (${this.activeProvider}) save notice:`, err);
    }

    // 2. Cross-cloud backup mirror: Always ensure Firestore holds a full replica so data is NEVER lost
    try {
      const secondary = this.activeProvider === 'supabase' ? this.firebaseAdapter : this.supabaseAdapter;
      if (secondary.providerName === 'firebase') {
        if (!this.firebaseAdapter.isQuotaExhausted) {
          await this.firebaseAdapter.saveEntireCampusState(state).catch(e => {
            console.warn('[Firebase Mirror Backup Notice]', e);
          });
        }
      } else {
        await this.supabaseAdapter.saveEntireCampusState(state).catch(e => {
          console.warn('[Supabase Mirror Backup Notice]', e);
        });
      }
    } catch (_) {}

    // If primary provider had an issue (e.g. Supabase tables need to be created), notify caller
    if (primaryError) {
      throw primaryError;
    }
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
