import { inspectGoogleSiteUrl, normalizeHttpUrl } from './portalUtils';

export type SmartCoverMotif =
  | 'arcade'
  | 'research'
  | 'info'
  | 'community'
  | 'council'
  | 'tech';

export interface SmartCoverTheme {
  motif: SmartCoverMotif;
  tagLabel: string;
  bgStart: string;
  bgMid: string;
  bgEnd: string;
  gridColor: string;
  accentPrimary: string;
  accentSecondary: string;
  surfaceTint: string;
}

const COVER_THEMES: Record<SmartCoverMotif, SmartCoverTheme> = {
  arcade: {
    motif: 'arcade',
    tagLabel: 'משחק תחביב',
    bgStart: '#1e1b4b',
    bgMid: '#7c2d12',
    bgEnd: '#ea580c',
    gridColor: 'rgba(253, 224, 71, 0.14)',
    accentPrimary: '#fbbf24',
    accentSecondary: '#fb7185',
    surfaceTint: 'rgba(254, 243, 199, 0.16)',
  },
  research: {
    motif: 'research',
    tagLabel: 'חקר',
    bgStart: '#042f2e',
    bgMid: '#065f46',
    bgEnd: '#0d9488',
    gridColor: 'rgba(167, 243, 208, 0.14)',
    accentPrimary: '#a3e635',
    accentSecondary: '#2dd4bf',
    surfaceTint: 'rgba(209, 250, 229, 0.15)',
  },
  info: {
    motif: 'info',
    tagLabel: 'מידע',
    bgStart: '#0c4a6e',
    bgMid: '#0369a1',
    bgEnd: '#0284c7',
    gridColor: 'rgba(186, 230, 253, 0.16)',
    accentPrimary: '#38bdf8',
    accentSecondary: '#fde047',
    surfaceTint: 'rgba(224, 242, 254, 0.16)',
  },
  community: {
    motif: 'community',
    tagLabel: 'חברה',
    bgStart: '#4c0519',
    bgMid: '#9d174d',
    bgEnd: '#e11d48',
    gridColor: 'rgba(254, 205, 211, 0.14)',
    accentPrimary: '#fda4af',
    accentSecondary: '#fcd34d',
    surfaceTint: 'rgba(255, 228, 230, 0.16)',
  },
  council: {
    motif: 'council',
    tagLabel: 'מועצת תלמידים',
    bgStart: '#1e1b4b',
    bgMid: '#4338ca',
    bgEnd: '#6d28d9',
    gridColor: 'rgba(221, 214, 254, 0.15)',
    accentPrimary: '#c4b5fd',
    accentSecondary: '#a3e635',
    surfaceTint: 'rgba(237, 233, 254, 0.16)',
  },
  tech: {
    motif: 'tech',
    tagLabel: 'מחשבים ורשת',
    bgStart: '#020617',
    bgMid: '#0f172a',
    bgEnd: '#1d4ed8',
    gridColor: 'rgba(125, 211, 252, 0.15)',
    accentPrimary: '#22d3ee',
    accentSecondary: '#a3e635',
    surfaceTint: 'rgba(224, 242, 254, 0.14)',
  },
};

export function getSmartCoverTheme(
  primaryTag?: string,
  titleSeed = ''
): SmartCoverTheme {
  const normalized = (primaryTag || '').trim();
  if (normalized === 'משחק תחביב') return COVER_THEMES.arcade;
  if (normalized === 'חקר') return COVER_THEMES.research;
  if (normalized === 'חברה') return COVER_THEMES.community;
  if (normalized === 'מועצת תלמידים') return COVER_THEMES.council;
  if (normalized === 'מחשבים ורשת') return COVER_THEMES.tech;
  if (normalized === 'מידע') return COVER_THEMES.info;

  const themes = Object.values(COVER_THEMES);
  let hash = 0;
  for (let i = 0; i < titleSeed.length; i++) {
    hash = (hash * 31 + titleSeed.charCodeAt(i)) >>> 0;
  }
  return themes[hash % themes.length] || COVER_THEMES.info;
}

/**
 * בדיקה האם ניתן לצלם אוטומטית את הכתובת מבחוץ ללא חסימת מסך כניסה ארגוני
 */
export function isPubliclyCapturableUrl(rawUrl?: string): boolean {
  const normalized = normalizeHttpUrl(rawUrl);
  if (!normalized) return false;

  const siteCheck = inspectGoogleSiteUrl(normalized, false);
  if (!siteCheck.isValid || siteCheck.isEditLink) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // כתובות ארגוניות סגורות או דפי Drive/Gemini הדורשים התחברות מחזירות צילום של מסך כניסה
  if (siteCheck.isOrgScopedUrl) return false;
  if (host === 'drive.google.com' || host === 'docs.google.com') return false;
  if (host === 'accounts.google.com') return false;
  if (host === 'gemini.google.com' && path.includes('/app')) return false;

  return true;
}

/**
 * בניית כתובת צילום מסך אוטומטי ציבורית העומדת במגבלת 500 תווים של Firestore
 */
export function buildAutoScreenshotUrl(
  rawUrl?: string,
  width = 960,
  height = 540
): string {
  const normalized = normalizeHttpUrl(rawUrl);
  if (!normalized) return '';

  const withSize = `https://s0.wp.com/mshots/v1/${encodeURIComponent(normalized)}?w=${width}&h=${height}`;
  if (withSize.length <= 495) {
    return withSize;
  }

  const basic = `https://s0.wp.com/mshots/v1/${encodeURIComponent(normalized)}?w=${width}`;
  if (basic.length <= 495) {
    return basic;
  }

  return '';
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        // צירוף שאר המילים לשורה האחרונה עם קיצור מבוקר במידת הצורך
        const rest = [current, ...words.slice(i + 1)].join(' ');
        let trimmedRest = rest;
        while (
          trimmedRest.length > 3 &&
          ctx.measureText(`${trimmedRest}…`).width > maxWidth
        ) {
          trimmedRest = trimmedRest.slice(0, -1);
        }
        lines.push(
          trimmedRest.length < rest.length ? `${trimmedRest}…` : trimmedRest
        );
        return lines;
      }
    }
  }

  lines.push(current);
  return lines.slice(0, maxLines);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCanvasMotifIllustration(
  ctx: CanvasRenderingContext2D,
  theme: SmartCoverTheme
): void {
  ctx.save();
  ctx.strokeStyle = theme.accentPrimary;
  ctx.fillStyle = theme.surfaceTint;
  ctx.lineWidth = 4;

  if (theme.motif === 'arcade') {
    // חלון משחק בסגנון ארקייד + בקר גאומטרי בצד שמאל
    drawRoundedRect(ctx, 90, 95, 360, 225, 28);
    ctx.fill();
    ctx.stroke();

    // צלב D-pad
    ctx.fillStyle = theme.accentPrimary;
    drawRoundedRect(ctx, 165, 165, 28, 86, 6);
    ctx.fill();
    drawRoundedRect(ctx, 136, 194, 86, 28, 6);
    ctx.fill();

    // כפתורי פעולה
    ctx.fillStyle = theme.accentSecondary;
    ctx.beginPath();
    ctx.arc(345, 190, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(388, 225, 18, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme.motif === 'research') {
    // מסלולי חקר וזכוכית מגדלת / מצפן מדעי
    ctx.beginPath();
    ctx.arc(245, 205, 108, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = theme.accentSecondary;
    ctx.beginPath();
    ctx.arc(245, 205, 68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = theme.accentPrimary;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(324, 284);
    ctx.lineTo(395, 355);
    ctx.stroke();

    ctx.fillStyle = theme.accentPrimary;
    ctx.beginPath();
    ctx.arc(245, 205, 14, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme.motif === 'info') {
    // כרטיסיות ידע וסימניית מידע מסודרת
    drawRoundedRect(ctx, 95, 90, 310, 230, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.accentPrimary;
    drawRoundedRect(ctx, 130, 132, 140, 20, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    drawRoundedRect(ctx, 130, 174, 235, 14, 5);
    ctx.fill();
    drawRoundedRect(ctx, 130, 204, 200, 14, 5);
    ctx.fill();
    drawRoundedRect(ctx, 130, 234, 175, 14, 5);
    ctx.fill();
  } else if (theme.motif === 'community') {
    // מעגלי קהילה ושיתוף פעולה
    ctx.beginPath();
    ctx.arc(195, 195, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = theme.accentSecondary;
    ctx.beginPath();
    ctx.arc(290, 220, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (theme.motif === 'council') {
    // כוכב הנהגה וגלי קול של מועצת תלמידים
    drawRoundedRect(ctx, 110, 110, 270, 195, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = theme.accentSecondary;
    ctx.beginPath();
    ctx.arc(178, 208, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.accentPrimary;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(230, 208, 42, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(230, 208, 72, -0.65, 0.65);
    ctx.stroke();
  } else {
    // חלון שרטוט טכני וצמתים
    drawRoundedRect(ctx, 90, 92, 345, 228, 18);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = theme.accentSecondary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(90, 142);
    ctx.lineTo(435, 142);
    ctx.stroke();

    ctx.fillStyle = theme.accentPrimary;
    ctx.beginPath();
    ctx.arc(165, 222, 16, 0, Math.PI * 2);
    ctx.arc(262, 188, 16, 0, Math.PI * 2);
    ctx.arc(356, 242, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.accentPrimary;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(165, 222);
    ctx.lineTo(262, 188);
    ctx.lineTo(356, 242);
    ctx.stroke();
  }

  ctx.restore();
}

export interface SmartCoverRenderOptions {
  title: string;
  creatorsText: string;
  grade: string;
  primaryTag?: string;
}

/**
 * רינדור עטיפת תצוגה מקדימה ברזולוציית 1280x720 PNG עבור העלאה לענן או הורדה
 */
export async function renderSmartCoverPngBlob(
  options: SmartCoverRenderOptions
): Promise<Blob> {
  const width = 1280;
  const height = 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('הדפדפן לא הצליח לאתחל משטח ציור ליצירת התמונה.');
  }

  const theme = getSmartCoverTheme(options.primaryTag, options.title);

  // רקע מדורג עשיר
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, theme.bgStart);
  bgGradient.addColorStop(0.55, theme.bgMid);
  bgGradient.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // רשת גאומטרית עדינה
  ctx.strokeStyle = theme.gridColor;
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // איור נושא ייעודי
  drawCanvasMotifIllustration(ctx, theme);

  // משטח הצללה תחתון לקריאות גבוהה
  const scrim = ctx.createLinearGradient(0, height * 0.34, 0, height);
  scrim.addColorStop(0, 'rgba(2, 6, 23, 0)');
  scrim.addColorStop(0.45, 'rgba(2, 6, 23, 0.72)');
  scrim.addColorStop(1, 'rgba(2, 6, 23, 0.94)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, height * 0.34, width, height * 0.66);

  // פס מסגרת עליון ותחתון בסגנון הפורטל
  ctx.fillStyle = theme.accentPrimary;
  ctx.fillRect(0, height - 12, width, 12);

  // תגית קטגוריה בפינה הימנית העליונה (RTL)
  const tagText = (options.primaryTag || theme.tagLabel).trim() || 'אתר תלמידים';
  ctx.font = '800 26px "Rubik", "Heebo", system-ui, sans-serif';
  const tagTextWidth = ctx.measureText(tagText).width;
  const tagBoxW = Math.min(360, tagTextWidth + 48);
  const tagBoxH = 52;
  const tagBoxX = width - 64 - tagBoxW;
  const tagBoxY = 52;

  ctx.fillStyle = theme.accentPrimary;
  drawRoundedRect(ctx, tagBoxX, tagBoxY, tagBoxW, tagBoxH, 12);
  ctx.fill();
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#020617';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, tagBoxX + tagBoxW / 2, tagBoxY + tagBoxH / 2 + 1);

  // טקסט כותרת ויוצרים מיושר לימין (RTL)
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  const titleText = options.title.trim() || 'משחק ואתר תלמידים';
  ctx.font = '900 62px "Rubik", "Heebo", system-ui, sans-serif';
  const titleLines = wrapLines(ctx, titleText, width - 140, 2);

  const metaLine = [
    options.creatorsText.trim() ? `מאת ${options.creatorsText.trim()}` : 'תלמידי חנה סנש',
    options.grade.trim() ? `שכבת ${options.grade.trim()}` : '',
    'פורטל חנה סנש',
  ]
    .filter(Boolean)
    .join('  ·  ');

  const metaY = height - 64;
  const titleBaseY = metaY - 58 - (titleLines.length - 1) * 76;

  ctx.fillStyle = '#ffffff';
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, width - 68, titleBaseY + idx * 76);
  });

  ctx.font = '700 28px "Heebo", "Rubik", system-ui, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(metaLine, width - 68, metaY);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('לא הצלחנו לייצא את קובץ התמונה מהדפדפן.'));
          return;
        }
        resolve(blob);
      },
      'image/png',
      0.95
    );
  });
}

export function triggerCoverPngDownload(blob: Blob, siteTitle: string): void {
  const safeName =
    siteTitle
      .trim()
      .replace(/[^\u0590-\u05FFa-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'site-preview';

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${safeName}-preview.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
