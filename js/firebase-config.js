import { initializeApp } from "firebase/app";
import { getAI, VertexAIBackend } from "firebase/ai";

const firebaseConfig = {
  apiKey: "AIzaSyB0zh50hIUdKjMQSRKhyXbHvB7c1vJivCQ",
  authDomain: "ai-pg-demos.firebaseapp.com",
  databaseURL: "https://ai-pg-demos.firebaseio.com",
  projectId: "ai-pg-demos",
  storageBucket: "ai-pg-demos.firebasestorage.app",
  messagingSenderId: "389246838568",
  appId: "1:389246838568:web:fbf6202ec839b02fa2521d",
  measurementId: "G-J8G160Q36V",
};

const app = initializeApp(firebaseConfig);
const ai = getAI(app, { backend: new VertexAIBackend() });

export { app, ai };
