import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getDatabase, Database } from "firebase-admin/database";

let _db: Database | null = null;

export function getAdminDb(): Database {
  if (!_db) {
    const existing = getApps().find((a) => a.name === "admin");
    const app = existing ?? initializeApp(
      {
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      },
      "admin"
    );
    _db = getDatabase(app);
  }
  return _db;
}
