import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;

let _auth: Auth | null = null;

if (apiKey) {
  try {
    const firebaseConfig = {
      apiKey,
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
      storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
      appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
    };
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    _auth = getAuth(app);
  } catch {
    // Firebase not available — fall back to email/password only
    _auth = null;
  }
}

export const auth = _auth;
export const isFirebaseReady = _auth !== null;
