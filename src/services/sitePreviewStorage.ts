import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { isFirebaseStorageConfigured, storage } from './firebaseApp';

function sanitizeFileSlug(rawIdOrTitle: string): string {
  const ascii = rawIdOrTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return ascii || 'site-cover';
}

function translateStorageError(err: unknown): Error {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : String(err || '');

  if (code === 'storage/unauthorized' || msg.includes('storage/unauthorized')) {
    return new Error(
      'לדלי האחסון ב-Firebase Storage אין כרגע הרשאות כתיבה/קריאה מתאימות (storage/unauthorized). ניתן להוריד את התמונה כ-PNG או להשתמש בקישור צילום מסך ישיר.'
    );
  }
  if (
    code === 'storage/bucket-not-found' ||
    code === 'storage/project-not-found' ||
    msg.includes('storage/bucket-not-found')
  ) {
    return new Error(
      'שירות Firebase Storage טרם הופעל בפרויקט זה. ניתן להפעיל אותו במסוף Firebase או להוריד את התמונה כ-PNG / להשתמש בצילום מסך ישיר.'
    );
  }
  if (code === 'storage/retry-limit-exceeded') {
    return new Error(
      'חריגת זמן בהעלאה ל-Firebase Storage. בדקו את החיבור לרשת או נסו שוב.'
    );
  }

  return new Error(
    'לא הצלחנו להעלות את התמונה ל-Firebase Storage כרגע. ניתן להוריד את קובץ ה-PNG למחשב או להשתמש בקישור צילום מסך ישיר.'
  );
}

/**
 * העלאת תמונת תצוגה מקדימה (PNG) ל-Firebase Storage והחזרת קישור קבוע בענן
 */
export async function uploadSiteCoverToStorage(
  siteIdOrSlug: string,
  pngBlob: Blob
): Promise<string> {
  if (!isFirebaseStorageConfigured || !storage) {
    throw new Error(
      'דלי האחסון (Firebase Storage) אינו מוגדר בבנייה זו. ניתן להוריד את קובץ ה-PNG למחשב או לשמור קישור צילום מסך ישיר.'
    );
  }

  const safeSlug = sanitizeFileSlug(siteIdOrSlug);
  const objectPath = `site-previews/${safeSlug}-${Date.now()}.png`;
  const storageRef = ref(storage, objectPath);

  const uploadTask = (async () => {
    await uploadBytes(storageRef, pngBlob, {
      contentType: 'image/png',
      cacheControl: 'public,max-age=31536000',
    });
    const downloadUrl = await getDownloadURL(storageRef);
    if (!downloadUrl || downloadUrl.length > 500) {
      throw new Error(
        'קישור התמונה שהתקבל מהענן חורג מהמגבלה המותרת (500 תווים).'
      );
    }
    return downloadUrl;
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            'ההעלאה ל-Firebase Storage התארכה מדי (ייתכן שהשירות טרם הופעל בפרויקט). ניתן להוריד את התמונה כ-PNG או להשתמש בקישור צילום מסך.'
          )
        ),
      15000
    );
  });

  try {
    return await Promise.race([uploadTask, timeoutPromise]);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('התארכה') || err.message.includes('500 תווים'))
    ) {
      throw err;
    }
    throw translateStorageError(err);
  }
}
