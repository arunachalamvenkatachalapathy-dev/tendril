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
  signInWithRedirect,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signInWithGoogleRedirect() {
  return signInWithRedirect(auth, googleProvider);
}

export function signInAsGuest() {
  return signInAnonymously(auth);
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function watchAuthState(callback) {
  if (typeof window !== 'undefined' && window.__TEST_USER__) {
    setTimeout(() => callback(window.__TEST_USER__), 50);
    return () => {};
  }
  // Listen for local guest fallback (when Firebase anonymous auth is disabled)
  function onLocalGuest(e) {
    callback(e.detail);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('tendril:localGuest', onLocalGuest);
  }
  const unsub = onAuthStateChanged(auth, callback);
  return () => {
    unsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('tendril:localGuest', onLocalGuest);
    }
  };
}

export async function getIdToken() {
  if (typeof window !== 'undefined' && window.__TEST_USER__) {
    return 'mock-test-token';
  }
  // Local guest fallback — token won't pass backend auth but allows front-end-only use
  if (typeof window !== 'undefined' && window.__TENDRIL_LOCAL_GUEST__) {
    return 'local-guest-token';
  }
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}
