import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  deleteDoc, 
  onSnapshot,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';
import { db } from './firebase';
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
import { isLegacyDummySession } from '../utils/dateUtils';

const COLLECTION_SNAPSHOT = 'campus_state';
const DOC_SNAPSHOT = 'current';
const QUOTA_STORAGE_KEY = 'dypatil_firestore_quota_exhausted_date';

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Deeply sanitizes data before sending to Firestore.
 * Firestore strictly rejects documents containing `undefined` values.
 * This recursively omits any keys with `undefined` values and converts top-level undefined to null.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

export class FirebaseDatabaseAdapter implements CampusDatabaseAdapter {
  readonly providerName: DatabaseProviderType = 'firebase';
  private _isConnected: boolean = false;
  private _isQuotaExhausted: boolean = false;
  private unsubscribeSnapshot: (() => void) | null = null;

  constructor() {
    try {
      const recordedDate = localStorage.getItem(QUOTA_STORAGE_KEY);
      if (recordedDate === getTodayString()) {
        this._isQuotaExhausted = true;
        this._isConnected = false;
        try {
          disableNetwork(db).catch(() => {});
        } catch (_) {}
      }
    } catch (_) {}
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isQuotaExhausted(): boolean {
    return this._isQuotaExhausted;
  }

  resetQuotaCheck(): void {
    this._isQuotaExhausted = false;
    try {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    } catch (_) {}
    try {
      enableNetwork(db).catch(() => {});
    } catch (_) {}
  }

  private handleFirebaseError(context: string, error: unknown): void {
    const errObj = error as { code?: string; message?: string };
    const code = errObj?.code || '';
    const message = errObj?.message || String(error);

    if (code === 'resource-exhausted' || message.includes('Quota limit exceeded') || message.includes('resource-exhausted')) {
      if (!this._isQuotaExhausted) {
        this._isQuotaExhausted = true;
        this._isConnected = false;
        try {
          localStorage.setItem(QUOTA_STORAGE_KEY, getTodayString());
        } catch (_) {}
        console.warn(
          `[Firebase] Daily free-tier write quota reached. Local offline storage is actively preserving campus data.`
        );
      }
      // Detach snapshot listener immediately
      if (this.unsubscribeSnapshot) {
        try {
          this.unsubscribeSnapshot();
        } catch (_) {}
        this.unsubscribeSnapshot = null;
      }
      // Disable network connection to immediately cancel Firestore's internal exponential backoff write stream
      try {
        disableNetwork(db).catch(() => {});
      } catch (_) {}
      return;
    }

    console.warn(`[Firebase] Notice in ${context}:`, message);
  }

  async init(): Promise<boolean> {
    try {
      if (this._isQuotaExhausted) {
        return false;
      }
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      await getDoc(snapRef);
      this._isConnected = true;
      return true;
    } catch (error) {
      this.handleFirebaseError('init', error);
      return false;
    }
  }

  async loadCampusState(): Promise<CampusState | null> {
    try {
      if (this._isQuotaExhausted) {
        return null;
      }
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const snapshot = await getDoc(snapRef);
      if (snapshot.exists()) {
        const data = snapshot.data() as CampusState;
        if (Array.isArray(data.sessions)) {
          data.sessions = data.sessions.filter(s => !isLegacyDummySession(s));
        }
        this._isConnected = true;
        return data;
      }
      return null;
    } catch (error) {
      this.handleFirebaseError('loadCampusState', error);
      return null;
    }
  }

  async saveEntireCampusState(state: CampusState): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const cleanSessions = Array.isArray(state.sessions) 
        ? state.sessions.filter(s => !isLegacyDummySession(s)) 
        : [];
      const payload = sanitizeForFirestore({
        ...state,
        sessions: cleanSessions,
        settings: {
          ...state.settings,
          cloudSyncStatus: 'synced',
          lastCloudSyncTimestamp: new Date().toISOString()
        }
      });
      await setDoc(snapRef, payload, { merge: true });
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveEntireCampusState', error);
    }
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const payload = sanitizeForFirestore({
        settings: {
          ...settings,
          cloudSyncStatus: 'synced',
          lastCloudSyncTimestamp: new Date().toISOString()
        }
      });
      await setDoc(snapRef, payload, { merge: true });
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveSettings', error);
    }
  }

  async saveClasses(classes: ClassGroup[]): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const payload = sanitizeForFirestore({ classes });
      await setDoc(snapRef, payload, { merge: true });
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveClasses', error);
    }
  }

  async saveStudents(students: Student[]): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const payload = sanitizeForFirestore({ students });
      await setDoc(snapRef, payload, { merge: true });
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveStudents', error);
    }
  }

  async saveTeachers(teachers: Teacher[]): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const payload = sanitizeForFirestore({ teachers });
      await setDoc(snapRef, payload, { merge: true });
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveTeachers', error);
    }
  }

  async saveClassrooms(classrooms: Classroom[]): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const payload = sanitizeForFirestore({ classrooms });
      await setDoc(snapRef, payload, { merge: true });
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveClassrooms', error);
    }
  }

  async saveTimetable(timetable: TimetableSlot[]): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const payload = sanitizeForFirestore({ timetable });
      await setDoc(snapRef, payload, { merge: true });
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveTimetable', error);
    }
  }

  async saveSessions(sessions: AttendanceSession[]): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const payload = sanitizeForFirestore({ sessions });
      await setDoc(snapRef, payload, { merge: true });
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveSessions', error);
    }
  }

  async saveSession(session: AttendanceSession): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const snap = await getDoc(snapRef);
      if (snap.exists()) {
        const data = snap.data() as CampusState;
        const currentSessions = data.sessions || [];
        const index = currentSessions.findIndex(s => s.id === session.id);
        const updatedSessions = index >= 0
          ? currentSessions.map((s, i) => i === index ? session : s)
          : [...currentSessions, session];

        const payload = sanitizeForFirestore({ sessions: updatedSessions });
        await setDoc(snapRef, payload, { merge: true });
      } else {
        const payload = sanitizeForFirestore({ sessions: [session] });
        await setDoc(snapRef, payload, { merge: true });
      }
      this._isConnected = true;
    } catch (error) {
      this.handleFirebaseError('saveSession', error);
    }
  }

  async deleteStudentPermanently(studentId: string): Promise<void> {
    if (this._isQuotaExhausted) {
      return;
    }
    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      const snap = await getDoc(snapRef);
      if (snap.exists()) {
        const data = snap.data() as CampusState;
        const updatedStudents = (data.students || []).filter(s => s.id !== studentId);
        const updatedClasses = (data.classes || []).map(c => ({
          ...c,
          studentIds: (c.studentIds || []).filter(id => id !== studentId)
        }));
        const updatedSessions = (data.sessions || []).map(s => {
          if (s.records && s.records[studentId]) {
            const nextRecords = { ...s.records };
            delete nextRecords[studentId];
            return { ...s, records: nextRecords };
          }
          return s;
        });

        const payload = sanitizeForFirestore({
          students: updatedStudents,
          classes: updatedClasses,
          sessions: updatedSessions
        });
        await setDoc(snapRef, payload, { merge: true });
        this._isConnected = true;
      }
    } catch (error) {
      this.handleFirebaseError('deleteStudentPermanently', error);
    }
  }

  subscribeToUpdates(onUpdate: (partialState: Partial<CampusState>) => void): () => void {
    if (this._isQuotaExhausted) {
      return () => {};
    }

    try {
      const snapRef = doc(db, COLLECTION_SNAPSHOT, DOC_SNAPSHOT);
      let activeUnsubscribe: (() => void) | null = null;
      let isCleanedUp = false;

      activeUnsubscribe = onSnapshot(snapRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as CampusState;
          this._isConnected = true;
          onUpdate(data);
        }
      }, (error) => {
        this.handleFirebaseError('subscribeToUpdates', error);
        if (this._isQuotaExhausted && !isCleanedUp) {
          isCleanedUp = true;
          // Unsubscribe immediately so Firestore does not retry in infinite backoff loop
          if (activeUnsubscribe) {
            try { activeUnsubscribe(); } catch (_) {}
            activeUnsubscribe = null;
          }
          if (this.unsubscribeSnapshot) {
            try { this.unsubscribeSnapshot(); } catch (_) {}
            this.unsubscribeSnapshot = null;
          }
        }
      });

      this.unsubscribeSnapshot = activeUnsubscribe;
      return () => {
        isCleanedUp = true;
        if (activeUnsubscribe) {
          try { activeUnsubscribe(); } catch (_) {}
          activeUnsubscribe = null;
        }
        if (this.unsubscribeSnapshot) {
          try { this.unsubscribeSnapshot(); } catch (_) {}
          this.unsubscribeSnapshot = null;
        }
      };
    } catch (err) {
      this.handleFirebaseError('subscribeToUpdates outer', err);
      return () => {};
    }
  }
}
