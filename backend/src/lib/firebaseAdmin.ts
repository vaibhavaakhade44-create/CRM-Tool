import * as admin from "firebase-admin";

let initialized = false;

function init(): void {
  if (initialized) return;
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return;
  try {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    initialized = true;
  } catch {
    // Already initialized (hot-reload)
    initialized = true;
  }
}

export function isFirebaseConfigured(): boolean {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

export async function verifyFirebaseIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  init();
  if (!initialized) throw new Error("Firebase Admin is not configured on this server");
  return admin.auth().verifyIdToken(idToken);
}
