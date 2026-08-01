import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function toServiceAccount(value: ServiceAccountJson): ServiceAccount {
  return {
    projectId: value.project_id,
    clientEmail: value.client_email,
    privateKey: value.private_key.replace(/\\n/g, "\n"),
  };
}

const STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  "solo-beats-engine.firebasestorage.app";

const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const separateServiceAccount =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY &&
  process.env.FIREBASE_PRIVATE_KEY.length > 500
    ? {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY,
      }
    : null;

const credential = inlineJson
  ? cert(
      toServiceAccount(
        JSON.parse(inlineJson) as ServiceAccountJson
      )
    )
  : separateServiceAccount
    ? cert(toServiceAccount(separateServiceAccount))
    : applicationDefault();

const existingApp = getApps()[0];

const firebaseAdminApp =
  existingApp ||
  initializeApp({
    credential,
    storageBucket: STORAGE_BUCKET,
  });

const adminDb = getFirestore(firebaseAdminApp);
const adminStorage = getStorage(firebaseAdminApp);
const adminBucket = adminStorage.bucket(STORAGE_BUCKET);

export {
  adminBucket,
  adminDb,
  adminStorage,
  firebaseAdminApp,
};

