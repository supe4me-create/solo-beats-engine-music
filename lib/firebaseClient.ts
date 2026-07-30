import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA88aF7OEMAdoQwQrYhScngyI3oeR-sZ98",
  authDomain: "solo-beats-engine.firebaseapp.com",
  projectId: "solo-beats-engine",
  storageBucket: "solo-beats-engine.firebasestorage.app",
  messagingSenderId: "459557796958",
  appId: "1:459557796958:web:bc5b0f4325b3a92c16c8cf",
};

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});
