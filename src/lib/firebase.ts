import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0288497771",
  appId: "1:541191944800:web:bc1a5e652d4cbfe62aa105",
  apiKey: "AIzaSyBrSMY44ihzlXiMT2BdqYAO-P4gRQ-AlPk",
  authDomain: "gen-lang-client-0288497771.firebaseapp.com",
  storageBucket: "gen-lang-client-0288497771.firebasestorage.app",
  messagingSenderId: "541191944800",
  measurementId: ""
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use the dynamically provisioned Firestore database ID
export const db = getFirestore(app, "ai-studio-55ad7788-3095-4cb2-a3a5-880b47f4f5e0");

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

let cachedAccessToken: string | null = null;

export const getCachedAccessToken = () => cachedAccessToken;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedAccessToken = credential.accessToken;
  }
  return result;
};

export const logout = async () => {
  cachedAccessToken = null;
  await signOut(auth);
};
