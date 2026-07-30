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
    privateKey: value.private_key,
  };
}

const STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ||
  "solo-beats-engine.firebasestorage.app";

const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const credential = inlineJson
  ? cert(
      toServiceAccount(
        JSON.parse(inlineJson) as ServiceAccountJson
      )
    )
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