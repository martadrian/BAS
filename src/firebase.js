import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB0RLZJlY01E_flxt8CWI4eO_VWkN3Alkw",
  authDomain: "guess-guess.firebaseapp.com",
  projectId: "guess-guess",
  storageBucket: "guess-guess.firebasestorage.app",
  messagingSenderId: "923159169926",
  appId: "1:923159169926:web:4fb1e5d95d5239a051fa07",
  measurementId: "G-LZZ6QGE0XE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
