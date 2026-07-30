import { initializeApp } from "firebase/app";
import { getAI, GoogleAIBackend } from "firebase/ai";

const defaultApiKey = typeof atob === "function" ? atob("QVEuQWI4Uk42S1dBU3UzeDZreTh5cGtHOEVtYUhsV0l4YkJETkY5RjRGQnhNT3NTeFlpUQ==") : "";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || defaultApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-pg-demos.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://ai-pg-demos.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ai-pg-demos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-pg-demos.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "389246838568",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:389246838568:web:fbf6202ec839b02fa2521d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-J8G160Q36V",
};

const app = initializeApp(firebaseConfig);
const googleAI = getAI(app, { backend: new GoogleAIBackend() });

export { app, googleAI };
