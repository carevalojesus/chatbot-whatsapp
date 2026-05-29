import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { config } from "../config.js";

let app: App | undefined;
let db: Firestore | undefined;

export function isFirebaseEnabled(): boolean {
  return config.firebase.enabled;
}

export function getFirebaseApp(): App {
  if (!config.firebase.enabled) {
    throw new Error("Firebase no está configurado");
  }

  if (!app) {
    const credentialPath = config.firebase.serviceAccountPath;
    const serviceAccount = JSON.parse(
      readFileSync(credentialPath, "utf8"),
    ) as Record<string, string>;

    app =
      getApps()[0] ??
      initializeApp({
        credential: cert(serviceAccount),
        projectId: config.firebase.projectId || serviceAccount.project_id,
      });
  }

  return app;
}

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export async function initFirebase(): Promise<void> {
  if (!config.firebase.enabled) {
    return;
  }
  getDb();
}
