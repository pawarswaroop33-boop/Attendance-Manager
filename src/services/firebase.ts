import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, setLogLevel } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Silence raw SDK-internal retry loop logging so application code cleanly controls errors
try {
  setLogLevel('silent');
} catch (_) {}

export const firebaseConfig = {
  projectId: firebaseConfigJson.projectId || 'robotic-quanta-2mln4',
  appId: firebaseConfigJson.appId || '1:556731817129:web:11cc601d7ea7ca5efa5db8',
  apiKey: firebaseConfigJson.apiKey || 'AIzaSyC-hl0wkEK-4fxlp3bFi9vARuGiQ362P5c',
  authDomain: firebaseConfigJson.authDomain || 'robotic-quanta-2mln4.firebaseapp.com',
  firestoreDatabaseId: firebaseConfigJson.firestoreDatabaseId || 'ai-studio-dypatiltechnical-2db2d2f0-88f1-4cba-9c2f-dba9f6aab366',
  storageBucket: firebaseConfigJson.storageBucket || 'robotic-quanta-2mln4.firebasestorage.app',
  messagingSenderId: firebaseConfigJson.messagingSenderId || '556731817129',
};

// Initialize Firebase App singleton
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firestore
// Use the specific firestoreDatabaseId if configured and not default
let db: Firestore;
if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} else {
  db = getFirestore(app);
}

export { app, db };
