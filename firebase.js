import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
  setDoc,
  writeBatch,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDw2tivlQ2K1yXsymitj3xYRZT3XPdrXq0",
  authDomain: "expenses-6705c.firebaseapp.com",
  projectId: "expenses-6705c",
  storageBucket: "expenses-6705c.firebasestorage.app",
  messagingSenderId: "259031265331",
  appId: "1:259031265331:web:cd475029220bc73cc17346",
  measurementId: "G-TJ6EV2TQGJ",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export {
  auth,
  db,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
};
export {
  collection,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
  setDoc,
  writeBatch,
  updateDoc,
};
