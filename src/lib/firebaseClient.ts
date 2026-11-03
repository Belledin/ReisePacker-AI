import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use the specific firestoreDatabaseId if provisioned
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Signs in with Google using popup, with automatic fallback to redirect on mobile devices
 * or when popups are blocked by browser settings.
 */
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('signInWithPopup failed:', error?.code, error?.message);

    // On mobile devices (iOS / Android), popups are frequently blocked or fail in standalone PWA mode.
    // In that case, fall back seamlessly to signInWithRedirect.
    const isMobile = typeof window !== 'undefined' && /iphone|ipad|ipod|android/i.test(navigator.userAgent);
    const isPopupIssue = error?.code === 'auth/popup-blocked' ||
                         error?.code === 'auth/cancelled-popup-request' ||
                         error?.code === 'auth/popup-closed-by-user';

    if (isMobile && isPopupIssue) {
      console.log('Falling back to signInWithRedirect for mobile browser...');
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, signInWithRedirect, getRedirectResult };
export type { User };

// Connectivity validation
export async function validateFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase is offline or waiting for network connection.');
      return false;
    }
    // Any permission error or doc-not-found means we reached server successfully
    return true;
  }
}

// Initial probe
validateFirebaseConnection().catch(() => {});
