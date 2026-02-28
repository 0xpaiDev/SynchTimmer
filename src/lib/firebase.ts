import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";

let _db: Database | null = null;

export function getFirebaseDb(): Database {
  if (!_db) {
    const app: FirebaseApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        });
    _db = getDatabase(app);
  }
  return _db;
}
