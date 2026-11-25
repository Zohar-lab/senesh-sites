import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { auth, firebaseConfigError } from './firebaseApp';

// כתובת הסופר אדמין הקבועה של הפורטל בחשבון הארגוני
export const SUPER_ADMIN_EMAIL = '1001974053@edu-haifa.org.il';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const initAuth = (onUserChanged?: (user: User | null) => void) => {
  if (!auth) {
    onUserChanged?.(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (user: User | null) => {
    onUserChanged?.(user);
  });
};

export const googleSignIn = async (): Promise<User> => {
  if (!auth) {
    throw new Error(firebaseConfigError || 'חיבור Firebase אינו זמין בסביבה זו.');
  }

  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const logout = async () => {
  if (auth) {
    await auth.signOut();
  }
};

export function isSuperAdminEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}
