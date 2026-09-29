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
      if (this.activeProvider === 'supabase') {
        const success = await this.supabaseAdapter.init();
        this.isInitialized = true;
        return success;
      } else {
        const success = await this.firebaseAdapter.init();
        this.isInitialized = true;
        return success;
      }
    } catch (e) {
      console.warn('Database service init warning:', e);
      return false;
    }
  }

  async loadCampusState(): Promise<CampusState | null> {
    try {
      // 1. Fetch from server API first (instant multi-device sync across mobile & PC)
      let serverState: CampusState | null = null;
      try {
        const resp = await fetch('/api/campus/state', { cache: 'no-store' });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.state && typeof json.state === 'object') {
            serverState = json.state;
          }
        }
      } catch (err) {
        console.warn('[DatabaseService] Notice checking server state:', err);
      }

      // 2. Fetch directly from active cloud adapter (Supabase PostgreSQL - avoids Firestore reads)
      let cloudState: CampusState | null = null;
      try {
        cloudState = await this.adapter.loadCampusState();
      } catch (err) {
        console.warn('[DatabaseService] Notice loading cloud state from active adapter:', err);
      }

      // If serverState exists and has campus state, it is authoritative for the active instance
      const primaryState = serverState || cloudState;
      if (!primaryState) return null;

      // Select student roster from the richer state if one had full enrollment
      const maxStudents = Math.max(
        serverState?.students?.length || 0,
        cloudState?.students?.length || 0
      );
      const chosenStudents = (serverState?.students?.length || 0) >= (cloudState?.students?.length || 0)
        ? (serverState?.students || primaryState.students || [])
        : (cloudState?.students || primaryState.students || []);

      // Authoritative sessions from the primary state, strictly filtered to valid recorded sessions only
      const rawSessions = Array.isArray(primaryState.sessions) ? primaryState.sessions : [];
      const cleanSessions = rawSessions.filter(s => {
        if (!s || typeof s !== 'object') return false;
        // Check that at least one student was marked
        const recs = s.records || {};
        return Object.values(recs).some((r: any) => r && r.status && r.status !== 'unmarked');
      });

      const finalState: CampusState = {
        ...primaryState,
        students: chosenStudents,
        sessions: cleanSessions
      };

      return finalState;
    } catch (e) {
      console.warn('loadCampusState notice:', e);
      return null;
    }
  }

  async saveEntireCampusState(state: CampusState): Promise<void> {
    // 1. Immediately persist to Server API (guarantees other devices see it in real-time)
    const serverPromise = fetch('/api/campus/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    }).catch(err => {
      console.warn('[DatabaseService] Server state save notice:', err);
    });

    // 2. Persist to active Cloud Database (Supabase PostgreSQL - does NOT touch or burn Firestore quota)
    const cloudPromises: Promise<any>[] = [];
    try {
      cloudPromises.push(this.adapter.saveEntireCampusState(state));
    } catch (err) {
      console.warn('[DatabaseService] Cloud adapter save notice:', err);
    }

    // Only save to Firebase if Firebase is explicitly the active provider
    if (this.activeProvider === 'firebase' && !this.firebaseAdapter.isQuotaExhausted) {
      try {
        cloudPromises.push(this.firebaseAdapter.saveEntireCampusState(state));
      } catch (_) {}
    }

    await Promise.allSettled([serverPromise, ...cloudPromises]);
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
    // Immediate post to server session endpoint for cross-device reflection
    const serverPromise = fetch('/api/campus/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session })
    }).catch(err => {
      console.warn('[DatabaseService] Server session push notice:', err);
    });

    // Persist session to active Cloud Database (Supabase PostgreSQL)
    const cloudPromises: Promise<any>[] = [this.adapter.saveSession(session)];
    
    // Only save to Firebase if Firebase is explicitly the active provider
    if (this.activeProvider === 'firebase' && !this.firebaseAdapter.isQuotaExhausted) {
      cloudPromises.push(this.firebaseAdapter.saveSession(session));
    }

    await Promise.allSettled([serverPromise, ...cloudPromises]);
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
