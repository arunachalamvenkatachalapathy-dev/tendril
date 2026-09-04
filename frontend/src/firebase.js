// src/firebase.js
//
// Note on Article 3: the Firebase web config below (apiKey, authDomain,
// etc.) is a PUBLIC IDENTIFIER by Firebase's own design — it is not a
// secret and is safe to ship in the client bundle. It only tells the
// Firebase SDK which project to talk to; actual authorization is enforced
// server-side by Firestore Security Rules and our backend's token
// verification. The Gemini API key is NEVER put here.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBqacPskeWDEspm3tKkJqugYd13fvKSVaM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'tendril-74291.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tendril-74291',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'tendril-74291.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1007307057399',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1007307057399:web:8e66de9570c24d3d380bf2',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}
