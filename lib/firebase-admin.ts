import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export class FirebaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigurationError";
  }
}

let firestore: Firestore | undefined;

function getServiceAccount(): ServiceAccount | null {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson) as ServiceAccount;

      if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) {
        throw new Error("missing service account fields");
      }

      return parsed;
    } catch {
      throw new FirebaseConfigurationError(
        "FIREBASE_SERVICE_ACCOUNT_JSON no contiene una cuenta de servicio valida.",
      );
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId && !clientEmail && !privateKey) {
    return null;
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseConfigurationError(
      "Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

function initializeFirebaseApp(): App {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = getServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  if (process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === "true") {
    return initializeApp({ credential: applicationDefault() });
  }

  throw new FirebaseConfigurationError(
    "Firebase Admin no esta configurado. Agrega las credenciales del servidor.",
  );
}

export function getRegistrationFirestore() {
  if (!firestore) {
    firestore = getFirestore(initializeFirebaseApp());
  }

  return firestore;
}
