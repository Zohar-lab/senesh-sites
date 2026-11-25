import {
  GoogleSiteLinkInfo,
  GradeFilter,
  SiteSortMode,
  SiteTag,
  StudentSiteItem,
  TagFilter,
} from '../types/portal';

export const GAME_GENERATOR_URL =
  'https://sites.google.com/edu-haifa.org.il/generator/full-page-embed';

export const SITE_TAGS: readonly SiteTag[] = [
  'משחק תחביב',
  'חקר',
  'מידע',
  'חברה',
  'מועצת תלמידים',
  'מחשבים ורשת',
] as const;

export const SITE_CATEGORIES = SITE_TAGS;

const ALLOWED_TAG_SET = new Set<string>(SITE_TAGS);

/**
 * הרכבת שם תצוגה מוגן פרטיות מתוך שם פרטי (מילה אחת בלבד) וכינוי אופציונלי
 */
export function formatStudentFirstNameAndNickname(
  firstName: string,
  nickname?: string
): string {
  const cleanFirst = firstName
    .replace(/[@()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')[0]
    .replace(/\.+$/, '')
    .slice(0, 16);

  if (!cleanFirst) return '';

  const cleanNickname = (nickname || '')
    .replace(/[@()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);

  if (!cleanNickname) return cleanFirst;
  return `${cleanFirst} (${cleanNickname})`.slice(0, 35);
}

/**
 * סינון פרטיות אוטומטי לשם תלמיד: שומר שם פרטי + כינוי בסוגריים בלבד,
 * ומסיר שמות משפחה, ראשי תיבות, כתובות אימייל ומספרי טלפון.
 */
export function sanitizeStudentDisplayName(rawName: string): string {
  const cleaned = (rawName || '')
    .replace(/\S+@\S+/g, '')
    .replace(/\d{6,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  // אם הוזן במבנה "שם פרטי (כינוי)"
  const parenMatch = cleaned.match(/^([^\s()]+)\s*\(([^()]+)\)$/);
  if (parenMatch) {
    return formatStudentFirstNameAndNickname(parenMatch[1], parenMatch[2]);
  }

  // אם הוזן במבנה "שם פרטי - כינוי" או "שם פרטי · כינוי"
  const sepMatch = cleaned.match(/^([^\s·\-]+)\s*[·\-]\s*(.+)$/);
  if (sepMatch) {
    return formatStudentFirstNameAndNickname(sepMatch[1], sepMatch[2]);
  }

  // שמירה על השם הפרטי בלבד (המילה הראשונה, ללא שם משפחה / אות שם משפחה)
  return formatStudentFirstNameAndNickname(cleaned);
}

/**
 * פיצול מחרוזת יוצרים לרשימת שמות פרטיים וכינויים בלבד (ללא שמות משפחה)
 */
export function parseCreatorsList(rawCreators: string): string[] {
  if (!rawCreators || !rawCreators.trim()) {
    return ['תלמידי חנה סנש'];
  }

  const parts = rawCreators
    .split(/[,;|\n]+/)
    .map((name) => sanitizeStudentDisplayName(name))
    .filter(Boolean)
    .slice(0, 10);

  return parts.length > 0 ? parts : ['תלמידי חנה סנש'];
}

export interface ParseCsvOptions {
  includeAllStatuses?: boolean;
}

export function normalizeHttpUrl(rawUrl?: string): string {
  const cleaned = (rawUrl || '').trim();
  if (!cleaned) return '';
  let candidate = cleaned;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

/**
 * בדיקה וחילוץ מידע מקישור Google Sites של תלמיד, כולל זיהוי קישורי עריכה שגויים (/edit)
 * והבחנה בין כתובת ציבורית (/view/) לבין כתובת ארגונית (/edu-haifa.org.il/).
 */
export function inspectGoogleSiteUrl(
  rawUrl?: string,
  requireGoogleSites = false
): GoogleSiteLinkInfo {
  const cleaned = (rawUrl || '').trim();
  if (!cleaned) {
    return {
      isValid: false,
      isGoogleSites: false,
      isEditLink: false,
      isOrgScopedUrl: false,
      normalizedUrl: '',
      domainLabel: 'קישור חסר',
      errorMessage: 'יש להזין קישור לאתר Google Sites שפורסם.',
    };
  }

  const normalizedUrl = normalizeHttpUrl(cleaned);
  if (!normalizedUrl || normalizedUrl.length < 8) {
    return {
      isValid: false,
      isGoogleSites: false,
      isEditLink: false,
      isOrgScopedUrl: false,
      normalizedUrl: '',
      domainLabel: 'קישור לא תקין',
      errorMessage: 'הכתובת שהוזנה אינה תקינה. ודאו שהיא מתחילה ב-https://.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return {
      isValid: false,
      isGoogleSites: false,
      isEditLink: false,
      isOrgScopedUrl: false,
      normalizedUrl: '',
      domainLabel: 'קישור לא תקין',
      errorMessage: 'הכתובת שהוזנה אינה תקינה.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const isGoogleSitesHost = host === 'sites.google.com' || host.endsWith('.sites.google.com');

  const isDriveOrDocs =
    host === 'drive.google.com' || host === 'docs.google.com';

  const isEditLink =
    isDriveOrDocs ||
    /\/d\/[^/]+\/(?:p\/[^/]+\/)?edit/i.test(path) ||
    /\/edit(?:\?|#|$)/i.test(normalizedUrl);

  if (isEditLink) {
    return {
      isValid: false,
      isGoogleSites: isGoogleSitesHost,
      isEditLink: true,
      isOrgScopedUrl: false,
      normalizedUrl,
      domainLabel: 'קישור עריכה',
      errorMessage:
        'נראה שהדבקתם קישור עריכה (/edit) או קישור Drive ולא את כתובת האתר המפורסם. לחצו בפינה העליונה ב-Google Sites על "פרסום" (Publish) ואז העתיקו את קישור האתר המפורסם.',
    };
  }

  if (requireGoogleSites && !isGoogleSitesHost) {
    return {
      isValid: false,
      isGoogleSites: false,
      isEditLink: false,
      isOrgScopedUrl: false,
      normalizedUrl,
      domainLabel: host,
      errorMessage:
        'פורטל זה מרכז אתרי Google Sites של תלמידים בלבד. יש להדביק קישור שמתחיל ב-https://sites.google.com/...',
    };
  }

  const isViewPath = path.startsWith('/view/');
  const isOrgScopedUrl = isGoogleSitesHost && !isViewPath && path.length > 1;

  let warningMessage: string | undefined;
  if (isOrgScopedUrl) {
    warningMessage =
      'אתר זה נוצר בדומיין הארגוני. לצפייה חופשית של משפחות ואורחים מחוץ לארגון, יש לוודא שבהגדרות הפרסום נבחר "כל אחד (ציבורי)".';
  }

  return {
    isValid: true,
    isGoogleSites: isGoogleSitesHost,
    isEditLink: false,
    isOrgScopedUrl,
    normalizedUrl,
    domainLabel: isGoogleSitesHost ? 'Google Sites' : host,
    warningMessage,
  };
}

function mapSingleTokenToSiteTag(rawToken: string): SiteTag | null {
  const value = rawToken.trim();
  if (!value) return null;
  if (ALLOWED_TAG_SET.has(value)) return value as SiteTag;

  if (/מועצת|תלמידים|הנהג|דמוקרטי|קמפיין|בחירות/.test(value)) return 'מועצת תלמידים';
  if (/מחשב|רשת|קוד|תכנות|דיגיטל|טכנולוג|אבטחה|אינטרנט/.test(value)) return 'מחשבים ורשת';
  if (/משחק|תחביב|פנאי|ארקייד|שחמט|ספורט|קריאה/.test(value)) return 'משחק תחביב';
  if (/חקר|מדע|טבע|חלל|חיות|סביבה|ניסוי|למיד/.test(value)) return 'חקר';
  if (/חברה|המלצ|תרבות|חגים|שכבה|כיתה|קהילה|יצירה|סיפור/.test(value)) return 'חברה';
  if (/מידע|אנציקלופד|מדריך|חדשות|היסטור/.test(value)) return 'מידע';

  return null;
}

/**
 * נירמול קשיח של מערך תוויות לרשימה של 1-6 תוויות רשמיות המותרות בחוקי Firestore
 */
export function normalizeTags(rawTags?: unknown, fallbackCategory?: string): SiteTag[] {
  const collected: SiteTag[] = [];

  const pushTag = (tag: SiteTag | null) => {
    if (tag && !collected.includes(tag) && collected.length < SITE_TAGS.length) {
      collected.push(tag);
    }
  };

  if (Array.isArray(rawTags)) {
    for (const item of rawTags) {
      if (typeof item === 'string') {
        pushTag(mapSingleTokenToSiteTag(item));
      }
    }
  } else if (typeof rawTags === 'string' && rawTags.trim()) {
    const parts = rawTags.split(/[,;|/\n]+/);
    for (const part of parts) {
      pushTag(mapSingleTokenToSiteTag(part));
    }
  }

  if (collected.length === 0 && fallbackCategory) {
    const fallbackParts = fallbackCategory.split(/[,;|/\n]+/);
    for (const part of fallbackParts) {
      pushTag(mapSingleTokenToSiteTag(part));
    }
    if (collected.length === 0) {
      if (fallbackCategory.includes('מדע וטבע') || fallbackCategory.includes('למידה וחקר')) {
        pushTag('חקר');
        pushTag('מידע');
      } else if (fallbackCategory.includes('יצירה וסיפורים')) {
        pushTag('חברה');
      } else if (fallbackCategory.includes('תחביבים')) {
        pushTag('משחק תחביב');
      }
    }
  }

  if (collected.length === 0) {
    collected.push('מידע');
  }

  return collected;
}

export function normalizeCategory(raw: string): SiteTag {
  const normalized = normalizeTags(undefined, raw);
  return normalized[0] || 'מידע';
}

export function parseFeaturedFlag(raw?: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw === 'string') {
    const val = raw.trim().toLowerCase();
    return ['true', '1', 'yes', 'כן', 'נבחר', 'featured', '★'].includes(val);
  }
  return false;
}

/**
 * מיון אתרים לפי תוויות, חדשים ביותר, נבחרים או סדר א'-ת'
 */
export function sortSites(
  sites: StudentSiteItem[],
  sortMode: SiteSortMode,
  preferredTag: TagFilter = 'הכל'
): StudentSiteItem[] {
  const copy = [...sites];

  const getTagRank = (site: StudentSiteItem): number => {
    const tags = site.tags.length > 0 ? site.tags : [normalizeCategory(site.category)];
    if (preferredTag !== 'הכל') {
      const idx = tags.indexOf(preferredTag);
      if (idx === 0) return -2;
      if (idx > 0) return -1;
    }
    const primaryIndex = SITE_TAGS.indexOf(tags[0]);
    return primaryIndex === -1 ? SITE_TAGS.length : primaryIndex;
  };

  const getDateMs = (site: StudentSiteItem): number => {
    if (!site.createdAt) return 0;
    const ms = Date.parse(site.createdAt);
    return Number.isNaN(ms) ? 0 : ms;
  };

  copy.sort((a, b) => {
    if (sortMode === 'title-az') {
      return a.title.localeCompare(b.title, 'he');
    }

    if (sortMode === 'featured') {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      const dateDiff = getDateMs(b) - getDateMs(a);
      if (dateDiff !== 0) return dateDiff;
      return a.title.localeCompare(b.title, 'he');
    }

    if (sortMode === 'newest') {
      const dateDiff = getDateMs(b) - getDateMs(a);
      if (dateDiff !== 0) return dateDiff;
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return a.title.localeCompare(b.title, 'he');
    }

    // default / 'tag-order': מיון תצוגה לפי התוויות
    const rankDiff = getTagRank(a) - getTagRank(b);
    if (rankDiff !== 0) return rankDiff;
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    const dateDiff = getDateMs(b) - getDateMs(a);
    if (dateDiff !== 0) return dateDiff;
    return a.title.localeCompare(b.title, 'he');
  });

  return copy;
}

/**
 * מפרסר CSV המתמודד עם גרשיים, פסיקים בתוך תיאורים ושורות מרובות.
 */
export function parseCSV(csvText: string, options: ParseCsvOptions = {}): StudentSiteItem[] {
  const { includeAllStatuses = false } = options;
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const rawHeaders = rows[0].map((h) => h.trim().toLowerCase());

  const findColumnIndex = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = rawHeaders.indexOf(alias.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colIdx = {
    title: findColumnIndex(['title', 'name', 'site_title', 'שם האתר', 'שם המשחק', 'שם']),
    creator: findColumnIndex([
      'creators',
      'creator',
      'authors',
      'author',
      'student',
      'students',
      'רשימת היוצרים',
      'יוצרים',
      'יוצר',
      'שם היוצר',
      'שמות היוצרים',
      'שם התלמיד',
    ]),
    creatorNote: findColumnIndex([
      'creatornote',
      'creator_note',
      'creatorwords',
      'creator_words',
      'creatormessage',
      'creator_message',
      'intro',
      'כמה מילים מאת היוצר',
      'כמה מילים מאת היוצרים',
      'מילים מאת היוצר',
      'דבר היוצר',
      'דבר היוצרים',
      'מאת היוצר',
      'הקדמה',
    ]),
    grade: findColumnIndex(['grade', 'class', 'שכבה', 'כיתה']),
    category: findColumnIndex(['category', 'topic', 'genre', 'קטגוריה', 'נושא']),
    tags: findColumnIndex(['tags', 'labels', 'תוויות', 'תיוג', 'תגיות']),
    isFeatured: findColumnIndex(['isfeatured', 'is_featured', 'featured', 'נבחר', 'נבחרים', 'מומלץ']),
    description: findColumnIndex(['description', 'desc', 'summary', 'תיאור']),
    siteUrl: findColumnIndex([
      'siteurl',
      'site_url',
      'gameurl',
      'game_url',
      'url',
      'link',
      'קישור',
      'קישור לאתר',
      'קישור למשחק',
    ]),
    imageUrl: findColumnIndex(['imageurl', 'image_url', 'image', 'thumbnail', 'תמונה', 'קישור לתמונה']),
    status: findColumnIndex(['status', 'moderation', 'סטטוס', 'אישור']),
  };

  const sites: StudentSiteItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((cell) => !cell.trim())) continue;

    const getCell = (idx: number): string => (idx >= 0 && idx < row.length ? row[idx].trim() : '');

    const status = getCell(colIdx.status) || (includeAllStatuses ? 'ממתין' : '');
    if (!includeAllStatuses && status !== 'מאושר') {
      continue;
    }

    const title = getCell(colIdx.title);
    const siteUrl = getCell(colIdx.siteUrl);
    if (!title || !siteUrl) {
      continue;
    }

    const creators = parseCreatorsList(getCell(colIdx.creator));
    const creatorNote =
      getCell(colIdx.creatorNote) ||
      `האתר "${title}" נבנה ב-Google Sites במסגרת שיעורי המחשבים בבית הספר חנה סנש.`;

    const rawCategory = getCell(colIdx.category);
    const rawTags = getCell(colIdx.tags);
    const tags = normalizeTags(rawTags || undefined, rawCategory);

    sites.push({
      id: `csv-site-${r}`,
      title,
      creators,
      creatorNote,
      grade: getCell(colIdx.grade) || "ג'-ד'",
      category: tags[0],
      tags,
      isFeatured: parseFeaturedFlag(getCell(colIdx.isFeatured)),
      description:
        getCell(colIdx.description) ||
        'אתר Google Sites שנוצר על ידי תלמידי בית הספר חנה סנש. לחצו לצפייה!',
      siteUrl,
      imageUrl: getCell(colIdx.imageUrl),
      status,
    });
  }

  return sites;
}

function escapeCsvCell(value: string): string {
  const safe = (value || '').replace(/"/g, '""');
  return /[",\n\r]/.test(safe) ? `"${safe}"` : safe;
}

export function exportSitesToCSV(sites: StudentSiteItem[]): string {
  const headers = [
    'title',
    'creators',
    'creatorNote',
    'grade',
    'tags',
    'isFeatured',
    'category',
    'description',
    'siteUrl',
    'imageUrl',
    'status',
  ];
  const lines = [headers.join(',')];

  for (const s of sites) {
    lines.push(
      [
        escapeCsvCell(s.title),
        escapeCsvCell(s.creators.join(', ')),
        escapeCsvCell(s.creatorNote),
        escapeCsvCell(s.grade),
        escapeCsvCell((s.tags || []).join('; ')),
        escapeCsvCell(s.isFeatured ? 'כן' : 'לא'),
        escapeCsvCell(s.category),
        escapeCsvCell(s.description),
        escapeCsvCell(s.siteUrl),
        escapeCsvCell(s.imageUrl.startsWith('http') ? s.imageUrl : ''),
        escapeCsvCell(s.status),
      ].join(',')
    );
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

/**
 * חילוץ מזהה קובץ מתוך קישורי Google Drive שונים לתמונת שער
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  const filePathMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (filePathMatch?.[1]) return filePathMatch[1];

  const queryIdMatch = trimmed.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i);
  if (queryIdMatch?.[1]) return queryIdMatch[1];

  const lh3Match = trimmed.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
  if (lh3Match?.[1]) return lh3Match[1];

  return null;
}

export function formatDriveImage(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const driveId = extractDriveFileId(trimmed);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  return trimmed;
}

export function getDriveThumbnailFallback(url?: string): string | null {
  if (!url) return null;
  const driveId = extractDriveFileId(url);
  if (!driveId) return null;
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
}

/**
 * התאמה גמישה של שכבת הגיל מול עמודת הכיתה/שכבה של התלמיד
 */
export function matchesGradeFilter(rawGrade: string, selectedFilter: GradeFilter): boolean {
  if (selectedFilter === 'כל השכבות') return true;

  const normalized = rawGrade.replace(/['׳"״\s]/g, '').toLowerCase();

  if (selectedFilter === "א'-ב'") {
    return (
      normalized.includes('א-ב') ||
      normalized.includes('אב') ||
      /(^|[^א-ת])[אב]([^א-ת]|$)/.test(rawGrade.replace(/['׳"״]/g, '')) ||
      normalized.includes('כיתהא') ||
      normalized.includes('כיתהב') ||
      normalized.includes('שכבתא') ||
      normalized.includes('שכבתב')
    );
  }

  if (selectedFilter === "ג'-ד'") {
    return (
      normalized.includes('ג-ד') ||
      normalized.includes('גד') ||
      /(^|[^א-ת])[גד]([^א-ת]|$)/.test(rawGrade.replace(/['׳"״]/g, '')) ||
      normalized.includes('כיתהג') ||
      normalized.includes('כיתהד') ||
      normalized.includes('שכבתג') ||
      normalized.includes('שכבתד')
    );
  }

  if (selectedFilter === "ה'-ו'") {
    return (
      normalized.includes('ה-ו') ||
      normalized.includes('הו') ||
      /(^|[^א-ת])[הו]([^א-ת]|$)/.test(rawGrade.replace(/['׳"״]/g, '')) ||
      normalized.includes('כיתהה') ||
      normalized.includes('כיתהו') ||
      normalized.includes('שכבתה') ||
      normalized.includes('שכבתו')
    );
  }

  return true;
}
