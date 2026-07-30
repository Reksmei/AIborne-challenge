import { initializeApp } from "firebase/app";
import { getAI, VertexAIBackend } from "firebase/ai";

const firebaseConfig = {
  apiKey: "AIzaSyCCQ_h98gq6IbDbWLakvRuedfdkzM1XpW8",
  authDomain: "ai-pg-demos.firebaseapp.com",
  databaseURL: "https://ai-pg-demos.firebaseio.com",
  projectId: "ai-pg-demos",
  storageBucket: "ai-pg-demos.firebasestorage.app",
  messagingSenderId: "584146333585",
  appId: "ai-borne-demo",
  measurementId: "G-J8G160Q36V",
};

const app = initializeApp(firebaseConfig);
const ai = getAI(app, { backend: new VertexAIBackend() });

export { app, ai };
