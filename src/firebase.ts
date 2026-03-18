import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
let auth: any;
let db: any;
let googleProvider: GoogleAuthProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.error('Firebase initialization failed:', error);
  // We'll export empty objects or nulls and handle them in the UI
}

export { auth, db, googleProvider };
