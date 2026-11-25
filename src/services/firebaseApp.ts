import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

interface FirebaseAppletConfig {
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

type OptionalConfigModule =
  | FirebaseAppletConfig
  | { default?: FirebaseAppletConfig };

// ייבוא אופציונלי של קובץ ההגדרות המקומי (קיים ב-AI Studio, ומוחרג מ-GitHub)
const localConfigModules = import.meta.glob<OptionalConfigModule>(
  '../../firebase-applet-config.json',
  { eager: true }
);

function extractLocalConfig(): FirebaseAppletConfig {
  const firstModule = Object.values(localConfigModules)[0];
  if (!firstModule) return {};
  if ('default' in firstModule && firstModule.default) {
    return firstModule.default;
  }
  return firstModule as FirebaseAppletConfig;
}

const localConfig = extractLocalConfig();

const resolvedConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId || '',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket || '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    localConfig.messagingSenderId ||
    '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig.appId || '',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId || '',
};

export const isFirebaseConfigured = Boolean(
  resolvedConfig.apiKey && resolvedConfig.projectId && resolvedConfig.appId
);

export const firebaseConfigError = isFirebaseConfigured
  ? null
  : 'הגדרות Firebase חסרות בבנייה זו. הוסיפו את הסוד FIREBASE_APPLET_CONFIG בהגדרות GitHub Actions והריצו פריסה מחדש.';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  appInstance =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          apiKey: resolvedConfig.apiKey,
          authDomain: resolvedConfig.authDomain,
          projectId: resolvedConfig.projectId,
          storageBucket: resolvedConfig.storageBucket,
          messagingSenderId: resolvedConfig.messagingSenderId,
          appId: resolvedConfig.appId,
        });

  authInstance = getAuth(appInstance);
  dbInstance = resolvedConfig.firestoreDatabaseId
    ? getFirestore(appInstance, resolvedConfig.firestoreDatabaseId)
    : getFirestore(appInstance);
}

export const firebaseApp = appInstance;
export const auth = authInstance;
export const db = dbInstance;
