import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { DEMO_SITES } from '../data/mockSites';
import {
  AuthorizedEditor,
  SiteFeedback,
  SiteStatus,
  SiteTag,
  StudentSiteItem,
} from '../types/portal';
import {
  inspectGoogleSiteUrl,
  normalizeHttpUrl,
  normalizeTags,
  parseFeaturedFlag,
  sanitizeStudentDisplayName,
} from '../utils/portalUtils';
import { auth, db, firebaseConfigError } from './firebaseApp';
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from './googleAuth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function requireDb(): Firestore {
  if (!db) {
    throw new Error(firebaseConfigError || 'מסד הנתונים אינו זמין בסביבה זו.');
  }
  return db;
}

// בדיקת חיבור ראשונית בעליית האפליקציה
async function testConnection(): Promise<void> {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_STATUSES: SiteStatus[] = ['מאושר', 'ממתין', 'נדחה'];

const DEMO_FALLBACK_IMAGES = new Map<string, string>(
  DEMO_SITES.flatMap((s) => [
    [s.id, s.imageUrl],
    [s.title.trim(), s.imageUrl],
  ])
);

function resolveDisplayImage(id: string, title: string, rawImageUrl: string): string {
  if (rawImageUrl && /^https?:\/\//i.test(rawImageUrl)) {
    return rawImageUrl;
  }
  return DEMO_FALLBACK_IMAGES.get(id) || DEMO_FALLBACK_IMAGES.get(title.trim()) || '';
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date(0).toISOString();
}

function generateSafeDocId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function normalizeStatus(raw?: string): SiteStatus {
  const trimmed = (raw || '').trim() as SiteStatus;
  return VALID_STATUSES.includes(trimmed) ? trimmed : 'ממתין';
}

function sanitizeSiteInput(
  input: Omit<StudentSiteItem, 'id' | 'isDemo'>,
  options: {
    forcedStatus?: SiteStatus;
    forceUnfeatured?: boolean;
    requireGoogleSites?: boolean;
  } = {}
): {
  title: string;
  creators: string[];
  creatorNote: string;
  grade: string;
  category: string;
  tags: SiteTag[];
  isFeatured: boolean;
  description: string;
  gameUrl: string;
  imageUrl: string;
  status: SiteStatus;
} {
  const {
    forcedStatus,
    forceUnfeatured = false,
    requireGoogleSites = false,
  } = options;

  const title = (input.title || '').trim().slice(0, 120);
  if (!title) {
    throw new Error('יש למלא שם אתר תקין.');
  }

  const linkCheck = inspectGoogleSiteUrl(input.siteUrl, requireGoogleSites);
  if (!linkCheck.isValid) {
    throw new Error(linkCheck.errorMessage || 'יש להזין קישור תקין לאתר.');
  }
  const normalizedSiteUrl = linkCheck.normalizedUrl.slice(0, 500);

  const creators = (Array.isArray(input.creators) ? input.creators : [])
    .map((c) => sanitizeStudentDisplayName(c))
    .filter(Boolean)
    .slice(0, 10);
  if (creators.length === 0) {
    creators.push('תלמידי חנה סנש');
  }

  const rawImage = (input.imageUrl || '').trim();
  const normalizedImageUrl = rawImage ? normalizeHttpUrl(rawImage).slice(0, 500) : '';

  const creatorNote = (
    input.creatorNote?.trim() ||
    `האתר "${title}" נבנה ב-Google Sites במסגרת שיעורי המחשבים בבית הספר חנה סנש.`
  ).slice(0, 1000);

  const grade = (input.grade || "ג'-ד'").trim().slice(0, 30) || "ג'-ד'";
  const tags = normalizeTags(input.tags, input.category);
  const category = (tags[0] || 'מידע').slice(0, 30);
  const isFeatured = forceUnfeatured ? false : Boolean(input.isFeatured);

  const description = (
    input.description?.trim() || 'אתר Google Sites שנוצר על ידי תלמידי בית הספר חנה סנש.'
  ).slice(0, 1500);

  const status = forcedStatus ?? normalizeStatus(input.status);

  return {
    title,
    creators,
    creatorNote,
    grade,
    category,
    tags,
    isFeatured,
    description,
    gameUrl: normalizedSiteUrl,
    imageUrl: normalizedImageUrl,
    status,
  };
}

function docToSiteItem(id: string, data: Record<string, unknown>): StudentSiteItem & { _sortMs: number } {
  const title = typeof data.title === 'string' ? data.title : 'ללא שם';
  const rawImageUrl = typeof data.imageUrl === 'string' ? data.imageUrl : '';
  const createdIso = timestampToIso(data.createdAt);
  const rawCategory = typeof data.category === 'string' ? data.category : '';
  const tags = normalizeTags(data.tags, rawCategory);
  const isFeatured = parseFeaturedFlag(data.isFeatured);

  return {
    id,
    title,
    creators: Array.isArray(data.creators)
      ? data.creators.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : ['תלמידי בית הספר חנה סנש'],
    creatorNote: typeof data.creatorNote === 'string' ? data.creatorNote : '',
    grade: typeof data.grade === 'string' ? data.grade : "ג'-ד'",
    category: tags[0],
    tags,
    isFeatured,
    description: typeof data.description === 'string' ? data.description : '',
    siteUrl: typeof data.gameUrl === 'string' ? data.gameUrl : '',
    imageUrl: resolveDisplayImage(id, title, rawImageUrl),
    status: typeof data.status === 'string' ? data.status : 'ממתין',
    createdAt: createdIso,
    isDemo: id.startsWith('demo-'),
    _sortMs: Date.parse(createdIso) || 0,
  };
}

/**
 * האזנה בזמן אמת לקטלוג אתרי התלמידים המאושרים (זמין לכל צופה מחוץ לארגון ובתוכו ללא צורך בהתחברות)
 */
export function subscribeApprovedSites(
  onData: (sites: StudentSiteItem[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!db) {
    onData([]);
    return () => {};
  }
  const sitesQuery = query(collection(db, 'games'), where('status', '==', 'מאושר'));

  return onSnapshot(
    sitesQuery,
    (snapshot) => {
      const parsed = snapshot.docs
        .map((d) => docToSiteItem(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b._sortMs - a._sortMs)
        .map(({ _sortMs: _ignored, ...item }) => item);
      onData(parsed);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'games');
      } catch (wrapped) {
        onError?.(wrapped);
      }
    }
  );
}

/**
 * האזנה בזמן אמת למשובי המבקרים המבוקרים
 */
export function subscribeFeedbacks(
  onData: (bySite: Record<string, SiteFeedback[]>) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!db) {
    onData({});
    return () => {};
  }
  const feedbacksQuery = query(
    collection(db, 'feedbacks'),
    where('rating', '>=', 1),
    where('rating', '<=', 5)
  );

  return onSnapshot(
    feedbacksQuery,
    (snapshot) => {
      const grouped: Record<string, Array<SiteFeedback & { _sortMs: number }>> = {};
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Record<string, unknown>;
        const siteId = typeof data.gameId === 'string' ? data.gameId : '';
        if (!siteId) continue;

        const createdAt = timestampToIso(data.createdAt);
        const item: SiteFeedback & { _sortMs: number } = {
          id: docSnap.id,
          siteId,
          playerName: typeof data.playerName === 'string' ? data.playerName : 'אורח',
          playerGrade:
            typeof data.playerGrade === 'string' && data.playerGrade ? data.playerGrade : undefined,
          rating: typeof data.rating === 'number' ? data.rating : 5,
          comment: typeof data.comment === 'string' ? data.comment : '',
          createdAt,
          _sortMs: Date.parse(createdAt) || 0,
        };

        if (!grouped[siteId]) grouped[siteId] = [];
        grouped[siteId].push(item);
      }

      const sorted: Record<string, SiteFeedback[]> = {};
      for (const [siteId, items] of Object.entries(grouped)) {
        sorted[siteId] = items
          .sort((a, b) => b._sortMs - a._sortMs)
          .map(({ _sortMs: _ignored, ...rest }) => rest);
      }
      onData(sorted);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'feedbacks');
      } catch (wrapped) {
        onError?.(wrapped);
      }
    }
  );
}

/**
 * הגשת אתר Google Sites חדש על ידי תלמיד (נשמר עם סטטוס "ממתין" וללא סימון כנבחר)
 */
export async function submitStudentSite(
  input: Omit<StudentSiteItem, 'id' | 'status' | 'rowNumber' | 'isDemo' | 'isFeatured' | 'createdAt'>
): Promise<string> {
  const docId = generateSafeDocId('site');
  const sanitized = sanitizeSiteInput(
    { ...input, status: 'ממתין', isFeatured: false },
    { forcedStatus: 'ממתין', forceUnfeatured: true, requireGoogleSites: true }
  );
  const path = `games/${docId}`;

  try {
    await setDoc(doc(requireDb(), 'games', docId), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * שמירת משוב מבוקר של צופה על אתר קיים ב-Firestore
 */
export async function addFeedbackToFirestore(
  input: Omit<SiteFeedback, 'id' | 'createdAt'>
): Promise<string> {
  const siteId = (input.siteId || '').trim();
  if (!siteId || !VALID_ID_REGEX.test(siteId)) {
    throw new Error('מזהה אתר לא תקין.');
  }

  const playerName = sanitizeStudentDisplayName(input.playerName || '').slice(0, 35);
  if (!playerName) {
    throw new Error('אנא כתבו שם פרטי (ללא שם משפחה).');
  }

  const comment = (input.comment || '').trim().slice(0, 350);
  if (comment.length < 3) {
    throw new Error('אנא כתבו משוב של לפחות 3 תווים.');
  }

  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5)));
  const playerGrade = (input.playerGrade || '').trim().slice(0, 15);

  const feedbackId = generateSafeDocId('fb');
  const path = `feedbacks/${feedbackId}`;

  const payload: Record<string, unknown> = {
    gameId: siteId,
    playerName,
    rating,
    comment,
    createdAt: serverTimestamp(),
  };
  if (playerGrade) {
    payload.playerGrade = playerGrade;
  }

  try {
    await setDoc(doc(requireDb(), 'feedbacks', feedbackId), payload);
    return feedbackId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function checkEditorAuthorization(email?: string | null): Promise<boolean> {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;
  if (isSuperAdminEmail(normalized)) return true;

  const path = `editors/${normalized}`;
  try {
    const snap = await getDoc(doc(requireDb(), 'editors', normalized));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * אתחול ראשוני אוטומטי כשסופר אדמין מתחבר לראשונה:
 * מוודא שרשומת הסופר אדמין קיימת ב-/editors וזורע את אתרי הפתיחה לדוגמה אם האוסף ריק.
 */
export async function ensureSuperAdminBootstrapped(currentEmail?: string | null): Promise<{
  seededSitesCount: number;
}> {
  if (!isSuperAdminEmail(currentEmail)) {
    return { seededSitesCount: 0 };
  }

  const adminEmail = SUPER_ADMIN_EMAIL.toLowerCase();
  const editorPath = `editors/${adminEmail}`;
  try {
    const adminSnap = await getDoc(doc(requireDb(), 'editors', adminEmail));
    if (!adminSnap.exists()) {
      await setDoc(doc(requireDb(), 'editors', adminEmail), {
        email: adminEmail,
        role: 'super_admin',
        addedBy: 'system',
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, editorPath);
  }

  let seededSitesCount = 0;
  try {
    const existingSites = await getDocs(collection(requireDb(), 'games'));
    if (existingSites.empty) {
      for (const demo of DEMO_SITES) {
        const sanitized = sanitizeSiteInput(
          {
            title: demo.title,
            creators: demo.creators,
            creatorNote: demo.creatorNote,
            grade: demo.grade,
            category: demo.category,
            tags: demo.tags,
            isFeatured: demo.isFeatured,
            description: demo.description,
            siteUrl: demo.siteUrl,
            imageUrl: '',
            status: 'מאושר',
          },
          { forcedStatus: 'מאושר', requireGoogleSites: false }
        );
        await setDoc(doc(requireDb(), 'games', demo.id), {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        seededSitesCount++;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'games');
  }

  return { seededSitesCount };
}

export async function fetchAllSitesForAdmin(): Promise<StudentSiteItem[]> {
  try {
    const snap = await getDocs(collection(requireDb(), 'games'));
    return snap.docs
      .map((d) => docToSiteItem(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b._sortMs - a._sortMs)
      .map(({ _sortMs: _ignored, ...item }) => item);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'games');
  }
}

export async function createSiteInFirestore(
  input: Omit<StudentSiteItem, 'id' | 'isDemo'>,
  customId?: string
): Promise<string> {
  const docId =
    customId && VALID_ID_REGEX.test(customId) && customId.length <= 128
      ? customId
      : generateSafeDocId('site');
  const sanitized = sanitizeSiteInput(input);
  const path = `games/${docId}`;

  try {
    await setDoc(doc(requireDb(), 'games', docId), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSiteInFirestore(
  siteId: string,
  input: Omit<StudentSiteItem, 'id' | 'isDemo'>
): Promise<void> {
  if (!VALID_ID_REGEX.test(siteId)) {
    throw new Error('מזהה אתר לא תקין לעדכון.');
  }
  const sanitized = sanitizeSiteInput(input);
  const path = `games/${siteId}`;

  try {
    await updateDoc(doc(requireDb(), 'games', siteId), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSiteInFirestore(siteId: string): Promise<void> {
  if (!VALID_ID_REGEX.test(siteId)) {
    throw new Error('מזהה אתר לא תקין למחיקה.');
  }
  const path = `games/${siteId}`;
  try {
    await deleteDoc(doc(requireDb(), 'games', siteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertImportedSitesToFirestore(
  incomingSites: StudentSiteItem[]
): Promise<{ added: number; updated: number; skipped: number }> {
  const existing = await fetchAllSitesForAdmin();
  const byKey = new Map<string, StudentSiteItem>();
  for (const item of existing) {
    const key = `${item.title.trim().toLowerCase()}||${item.siteUrl.trim().toLowerCase()}`;
    byKey.set(key, item);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const rawSite of incomingSites) {
    try {
      const sanitized = sanitizeSiteInput({
        ...rawSite,
        imageUrl: rawSite.imageUrl && /^https?:\/\//i.test(rawSite.imageUrl) ? rawSite.imageUrl : '',
      });
      const key = `${sanitized.title.toLowerCase()}||${sanitized.gameUrl.toLowerCase()}`;
      const match = byKey.get(key);

      if (match) {
        await updateDoc(doc(requireDb(), 'games', match.id), {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
        updated++;
      } else {
        const newId = generateSafeDocId('site');
        await setDoc(doc(requireDb(), 'games', newId), {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        byKey.set(key, {
          id: newId,
          title: sanitized.title,
          creators: sanitized.creators,
          creatorNote: sanitized.creatorNote,
          grade: sanitized.grade,
          category: sanitized.category,
          tags: sanitized.tags,
          isFeatured: sanitized.isFeatured,
          description: sanitized.description,
          siteUrl: sanitized.gameUrl,
          imageUrl: sanitized.imageUrl,
          status: sanitized.status,
        });
        added++;
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('{')) {
        throw err;
      }
      skipped++;
    }
  }

  return { added, updated, skipped };
}

export async function fetchEditorsForAdmin(): Promise<AuthorizedEditor[]> {
  try {
    const snap = await getDocs(collection(requireDb(), 'editors'));
    const list: AuthorizedEditor[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const email = (typeof data.email === 'string' ? data.email : d.id).toLowerCase();
      return {
        email,
        role: isSuperAdminEmail(email)
          ? 'super_admin'
          : data.role === 'super_admin'
            ? 'super_admin'
            : 'editor',
        addedBy: typeof data.addedBy === 'string' ? data.addedBy : SUPER_ADMIN_EMAIL,
        addedAt: timestampToIso(data.createdAt),
      };
    });

    if (!list.some((e) => isSuperAdminEmail(e.email))) {
      list.unshift({
        email: SUPER_ADMIN_EMAIL.toLowerCase(),
        role: 'super_admin',
        addedBy: 'system',
        addedAt: new Date().toISOString(),
      });
    }

    return list.sort((a, b) =>
      a.role === 'super_admin' ? -1 : b.role === 'super_admin' ? 1 : a.email.localeCompare(b.email)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'editors');
  }
}

export async function addEditorToFirestore(
  editorEmail: string,
  addedByEmail: string
): Promise<void> {
  const normalized = editorEmail.trim().toLowerCase().slice(0, 120);
  const path = `editors/${normalized}`;
  try {
    await setDoc(doc(requireDb(), 'editors', normalized), {
      email: normalized,
      role: isSuperAdminEmail(normalized) ? 'super_admin' : 'editor',
      addedBy: (addedByEmail || SUPER_ADMIN_EMAIL).trim().toLowerCase().slice(0, 120),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeEditorFromFirestore(editorEmail: string): Promise<void> {
  const normalized = editorEmail.trim().toLowerCase();
  if (isSuperAdminEmail(normalized)) {
    throw new Error('לא ניתן להסיר את משתמש הסופר אדמין.');
  }
  const path = `editors/${normalized}`;
  try {
    await deleteDoc(doc(requireDb(), 'editors', normalized));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
