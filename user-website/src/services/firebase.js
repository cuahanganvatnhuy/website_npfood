import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBE3I9inSpoRbkhmf8iaRANtxI5jqL0X2s",
  authDomain: "course-management-e4a28.firebaseapp.com",
  databaseURL: "https://course-management-e4a28-default-rtdb.firebaseio.com",
  projectId: "course-management-e4a28",
  storageBucket: "course-management-e4a28.firebasestorage.app",
  messagingSenderId: "191236422828",
  appId: "1:191236422828:web:3c6d693158bd62d029f309",
  measurementId: "G-TNF4733HC7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Initialize Analytics (only in browser)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { auth, db, analytics, app };
