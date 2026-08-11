import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig, ALLOWED_EMAILS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

export function isEmailAllowed(email){
  if (!ALLOWED_EMAILS || ALLOWED_EMAILS.length === 0) return true;
  return ALLOWED_EMAILS.includes(email);
}

export function loginWithGoogle(){
  return signInWithPopup(auth, provider);
}

export function logout(){
  return signOut(auth);
}

export function watchAuth(callback){
  onAuthStateChanged(auth, callback);
}
