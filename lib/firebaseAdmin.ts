import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

function findLocalServiceAccountPath(): string | undefined {
  const configuredPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  const downloadsFolder = path.join(os.homedir(), "Downloads");

  if (!fs.existsSync(downloadsFolder)) {
    return undefined;
  }

  const matchingFiles = fs
    .readdirSync(downloadsFolder)
    .filter(
      (fileName) =>
        fileName.startsWith(
          "solo-beats-engine-firebase-adminsdk"
        ) && fileName.endsWith(".json")
    )
    .map((fileName) => {
      const fullPath = path.join(downloadsFolder, fileName);

      return {
        fullPath,
        modifiedAt: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  return matchingFiles[0]?.fullPath;
}

function loadServiceAccount(): ServiceAccount {
  const inlineJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (inlineJson) {
    return toServiceAccount(
      JSON.parse(inlineJson) as ServiceAccountJson
    );
  }

  const serviceAccountPath = findLocalServiceAccountPath();

  if (!serviceAccountPath) {
    throw new Error(
      "Firebase Admin credentials were not found. Set FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  const rawJson = fs.readFileSync(
    serviceAccountPath,
    "utf8"
  );

  return toServiceAccount(
    JSON.parse(rawJson) as ServiceAccountJson
  );
}

const existingApp = getApps()[0];

const firebaseAdminApp =
  existingApp ||
  initializeApp({
    credential: cert(loadServiceAccount()),
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
