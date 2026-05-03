import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyATmPMw_qmfptdoAkrP3iV_UgdHHIN2qwA",
  authDomain: "laundry-yalu.firebaseapp.com",
  projectId: "laundry-yalu",
  storageBucket: "laundry-yalu.firebasestorage.app",
  messagingSenderId: "341774885799",
  appId: "1:341774885799:web:0ebf9cb2a87958cb2b4c82",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);