import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyATmPMw_qmfptdoAkrP3iV_UgdHHIN2qwA",
  authDomain: "laundry-yalu.firebaseapp.com",
  projectId: "laundry-yalu",
  storageBucket: "laundry-yalu.firebasestorage.app",
  messagingSenderId: "341774885799",
  appId: "1:341774885799:web:0ebf9cb2a87958cb2b4c82",
  measurementId: "G-GW6LMWEWZY"
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);