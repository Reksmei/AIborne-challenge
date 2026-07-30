import { initializeApp } from "firebase/app";
import { getAI, GoogleAIBackend } from "firebase/ai";

const defaultApiKey = typeof atob === "function" ? atob("QVEuQWI4Uk42SXdFN083ZUZNOUJ1T3U3VWotbFZ5WGN3QVc1RXFibEpZRW9zMlBfYU9Ub3c=") : "";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-pg-demos.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://ai-pg-demos.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ai-pg-demos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-pg-demos.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "389246838568",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:389246838568:web:fbf6202ec839b02fa2521d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-J8G160Q36V",
};

const app = initializeApp(firebaseConfig);
const ai = getAI(app, { backend: new GoogleAIBackend() });

export { app, ai };
