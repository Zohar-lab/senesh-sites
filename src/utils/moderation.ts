import { ModerationCategory, ModerationResult } from '../types/portal';

/**
 * מנוע בקרת תוכן לפני פרסום משוב בפורטל בית הספר חנה סנש.
 * בודק מילים פוגעניות, אלימות ותוכן מיני בעברית ובאנגלית (כולל ניסיון עקיפה עם רווחים או אותיות כפולות).
 */

const OFFENSIVE_PATTERNS: RegExp[] = [
  // עברית - קללות, השפלות ובריונות
  /(?:^|[^א-ת])(ה|ל|מ|ב|ש|ו)?(טיפש|טיפשה|טיפשים|מטומטם|מטומטמת|מטומטמים|מפגר|מפגרת|מפגרים|אידיוט|אידיוטית|דביל|דבילית|סתום|סתומה|טמבל|חרא|זבל|אפס|לעזאזל|מניאק|מניאקית|מניאקים|בן\s*זונה|בת\s*זונה|שרמוטה|כוסאמק|כוס\s*אמא|יא\s*כלב|חמור|מגעיל|מגעילה|לוזר|לוזרית)(?:$|[^א-ת])/i,
  // אנגלית - קללות ופגיעה
  /\b(fuck|fucking|shit|bitch|asshole|idiot|stupid|dumb|retard|loser|moron|crap|suck|sucks)\b/i,
];

const VIOLENCE_PATTERNS: RegExp[] = [
  // עברית - אלימות, איומים, נשק ופגיעה עצמית
  /(?:^|[^א-ת])(ה|ל|מ|ב|ש|ו)?(להרוג|אהרוג|יהרוג|רצח|לרצוח|רוצח|תמות|ימות|למות|מוות\s*ל|התאבדות|להתאבד|תתאבד|לדקור|דקירה|סכין|אקדח|רובה|פיגוע|פצצה|לפוצץ|אלימות|מכות|ארביץ|להרביץ|לשחוט|שחיטה|אני\s*אפוצץ)(?:$|[^א-ת])/i,
  // אנגלית - אלימות
  /\b(kill|murder|suicide|bomb|gun|weapon|stab|shoot|die\s+you|violence|beat\s+you)\b/i,
];

const SEXUAL_PATTERNS: RegExp[] = [
  // עברית - תכנים מיניים שאינם הולמים את בית הספר
  /(?:^|[^א-ת])(ה|ל|מ|ב|ש|ו)?(סקס|מיני|מינית|מיניות|פורנו|פורנוגרפיה|עירום|ערום|ערומה|זיון|לזיין|אונס|לאנוס|אנס|חרמן|חרמנית|ציצי|שדיים|תחת|בולבול|פין|פות|זונה|זונות|זנות)(?:$|[^א-ת])/i,
  // אנגלית - תוכן מיני
  /\b(sex|porn|porno|nude|naked|boobs|tits|penis|vagina|dick|cock|pussy|rape|horny|nsfw|xxx)\b/i,
];

function normalizeForModeration(input: string): string {
  return (
    input
      // הסרת ניקוד
      .replace(/[\u0591-\u05C7]/g, '')
      // החלפת סימנים דמויי אותיות (1337 / התחכמויות)
      .replace(/[@]/g, 'a')
      .replace(/[$]/g, 's')
      .replace(/[*_~`"'.,!?;:()[\]{}\\/|+=-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

/**
 * יצירת גרסה מצומצמת ללא רווחים בין אותיות בודדות (למשל: "ט י פ ש" -> "טיפש")
 */
function collapseSpacedLetters(normalized: string): string {
  return normalized.replace(/(^|\s)([א-תa-z])\s+(?=[א-תa-z](?:\s|$))/g, '$1$2').replace(/\s+/g, ' ');
}

function testPatternList(text: string, patterns: RegExp[]): boolean {
  const collapsed = collapseSpacedLetters(text);
  // צמצום אותיות כפולות מוגזמות (למשל "מטומטםםםם" -> "מטומטם")
  const deduped = text.replace(/([א-תa-z])\1{2,}/g, '$1');
  const dedupedCollapsed = collapseSpacedLetters(deduped);

  return patterns.some(
    (regex) =>
      regex.test(text) ||
      regex.test(collapsed) ||
      regex.test(deduped) ||
      regex.test(dedupedCollapsed)
  );
}

const CATEGORY_LABELS: Record<ModerationCategory, string> = {
  offensive: 'שפה פוגענית או מעליבה',
  violence: 'ביטויי אלימות או איומים',
  sexual: 'תוכן מיני שאינו מותאם לבית הספר',
};

/**
 * בדיקה מלאה של שם המגיב ותוכן המשוב לפני הגשה
 */
export function checkFeedbackModeration(
  playerName: string,
  comment: string
): ModerationResult {
  const combined = `${normalizeForModeration(playerName)} ${normalizeForModeration(comment)}`.trim();

  if (!combined) {
    return {
      isAllowed: true,
      flaggedCategories: [],
      reasonMessage: '',
    };
  }

  const flagged: ModerationCategory[] = [];

  if (testPatternList(combined, OFFENSIVE_PATTERNS)) {
    flagged.push('offensive');
  }
  if (testPatternList(combined, VIOLENCE_PATTERNS)) {
    flagged.push('violence');
  }
  if (testPatternList(combined, SEXUAL_PATTERNS)) {
    flagged.push('sexual');
  }

  if (flagged.length === 0) {
    return {
      isAllowed: true,
      flaggedCategories: [],
      reasonMessage: '',
    };
  }

  const labels = flagged.map((cat) => CATEGORY_LABELS[cat]).join(', ');

  return {
    isAllowed: false,
    flaggedCategories: flagged,
    reasonMessage: `המשוב נחסם בבדיקת הבטיחות: זוהה תוכן שאינו מתאים (${labels}). אנא כתבו משוב מכבד, חיובי ובונה לחברים שיצרו את האתר.`,
  };
}
