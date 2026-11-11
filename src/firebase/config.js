import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA-nx8ioayMxHNOA14kJHYCA52QsjGEz7w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "alafat-zwmaryan.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alafat-zwmaryan",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alafat-zwmaryan.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "497246248078",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:497246248078:web:ad30ec7dcf1cc7eed17ddf",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-VSJYWNT8LH"
};

const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);


