import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

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

function cleanConfigValue(raw?: string): string {
  if (!raw) return '';
  let val = raw.trim();
  if (val.endsWith(',')) {
    val = val.slice(0, -1).trim();
  }
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

const localConfig = extractLocalConfig();

const resolvedConfig = {
  apiKey:
    cleanConfigValue(localConfig.apiKey) ||
    cleanConfigValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain:
    cleanConfigValue(localConfig.authDomain) ||
    cleanConfigValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId:
    cleanConfigValue(localConfig.projectId) ||
    cleanConfigValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket:
    cleanConfigValue(localConfig.storageBucket) ||
    cleanConfigValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId:
    cleanConfigValue(localConfig.messagingSenderId) ||
    cleanConfigValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId:
    cleanConfigValue(localConfig.appId) ||
    cleanConfigValue(import.meta.env.VITE_FIREBASE_APP_ID),
  firestoreDatabaseId:
    cleanConfigValue(localConfig.firestoreDatabaseId) ||
    cleanConfigValue(import.meta.env.VITE_FIREBASE_DATABASE_ID),
};

export const isFirebaseConfigured = Boolean(
  resolvedConfig.apiKey && resolvedConfig.projectId && resolvedConfig.appId
);

export const isFirebaseStorageConfigured = Boolean(
  isFirebaseConfigured && resolvedConfig.storageBucket
);

export const firebaseConfigError = isFirebaseConfigured
  ? null
  : 'הגדרות Firebase חסרות בבנייה זו. הוסיפו את הסוד FIREBASE_APPLET_CONFIG בהגדרות GitHub Actions והריצו פריסה מחדש.';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

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

  if (resolvedConfig.storageBucket) {
    try {
      storageInstance = getStorage(appInstance);
    } catch {
      storageInstance = null;
    }
  }
}

export function getActiveFirebaseSecretConfig(): FirebaseAppletConfig | null {
  if (!isFirebaseConfigured) return null;
  const config: FirebaseAppletConfig = {
    apiKey: resolvedConfig.apiKey,
    authDomain: resolvedConfig.authDomain,
    projectId: resolvedConfig.projectId,
    storageBucket: resolvedConfig.storageBucket,
    messagingSenderId: resolvedConfig.messagingSenderId,
    appId: resolvedConfig.appId,
  };
  if (resolvedConfig.firestoreDatabaseId) {
    config.firestoreDatabaseId = resolvedConfig.firestoreDatabaseId;
  }
  return config;
}

export const firebaseApp = appInstance;
export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;
