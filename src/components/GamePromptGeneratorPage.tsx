import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Link2,
  LogIn,
  LogOut,
  Maximize2,
  MonitorPlay,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebaseApp';
import {
  checkEditorAuthorization,
  createGamePromptInFirestore,
  deleteGamePromptInFirestore,
  SaveGamePromptInput,
  subscribeAllPromptsForAdmin,
  subscribeUserPrompts,
  updateGamePromptInFirestore,
} from '../services/firestorePortal';
import { isSuperAdminEmail } from '../services/googleAuth';
import {
  GamePromptWizardState,
  GameSimulatorTab,
  PromptProductionStatus,
  SavedGamePromptItem,
} from '../types/portal';
import {
  GAME_GENERATOR_URL,
  normalizeHttpUrl,
  sanitizeStudentDisplayName,
} from '../utils/portalUtils';

interface GamePromptGeneratorPageProps {
  user: User | null;
  isSigningIn: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onBackHome: () => void;
  onOpenCatalog: () => void;
  onOpenSubmit: () => void;
}

const LOCAL_PROMPTS_KEY = 'senesh_game_prompts_v1';

const STEP_META: Array<{
  num: number;
  shortLabel: string;
  title: string;
  subtitle: string;
}> = [
  {
    num: 1,
    shortLabel: 'מהות',
    title: 'שם המשחק ומהותו',
    subtitle: 'איך קוראים למשחק שלכם ומה הדמות הראשית עושה בו?',
  },
  {
    num: 2,
    shortLabel: 'השראה',
    title: 'השראה מהעולם האמיתי',
    subtitle: 'האם המשחק מבוסס על משחק מוכר מהחצר, הספורט או הקופסה?',
  },
  {
    num: 3,
    shortLabel: 'ממדים',
    title: 'עולם המשחק: 2D או 3D',
    subtitle: 'בחרו את הממדים וזווית המצלמה של המשחק',
  },
  {
    num: 4,
    shortLabel: 'אתגר',
    title: 'הקונפליקט והאתגר',
    subtitle: 'מה מפריע לשחקן להצליח, ואיך מנצחים או נפסלים?',
  },
  {
    num: 5,
    shortLabel: 'רמות',
    title: 'רמות מורכבות',
    subtitle: 'איך המשחק משתנה בין רמה קלה, בינונית וקשה?',
  },
  {
    num: 6,
    shortLabel: 'עיצוב',
    title: 'גרפיקה ועיצוב',
    subtitle: 'בחרו את הסגנון החזותי, הצבעים והדמויות',
  },
  {
    num: 7,
    shortLabel: 'שליטה',
    title: 'הדרכה וכפתורי שליטה',
    subtitle: 'איך שולטים במשחק ומה יופיע במסך ההדרכה לשחקן?',
  },
];

const CAMERA_VIEWS: GamePromptWizardState['cameraView'][] = [
  'מבט מלמעלה',
  'מבט מהצד',
  'דרך עיני השחקן',
];

const ART_STYLES: GamePromptWizardState['artStyle'][] = [
  'מצויר וצבעוני',
  'פיקסל-ארט (רטרו)',
  'חלל וניאון זוהר',
  'עולם הטבע',
];

function createDefaultWizardState(): GamePromptWizardState {
  return {
    currentStep: 1,
    simulatorTab: 'menu',
    gameName: '',
    gameSummary: '',
    isRealWorldBased: 'no',
    realWorldGame: '',
    digitalTwist: '',
    dimension: '2D',
    cameraView: 'מבט מהצד',
    winCondition: '',
    conflictObstacle: '',
    loseCondition: '',
    easyLevel: 'מכשולים איטיים, 5 לבבות חיים',
    mediumLevel: 'מהירות רגילה, 3 לבבות חיים',
    hardLevel: 'מכשולים מהירים ורבים, 2 לבבות חיים',
    artStyle: 'מצויר וצבעוני',
    characterAndBg: '',
    controls: 'מקשי החצים לתזוזה ורווח לקפיצה',
    tutorialText: '',
  };
}

function buildFinalPromptText(state: GamePromptWizardState): string {
  const name = state.gameName.trim() || '[שם המשחק]';
  const summary = state.gameSummary.trim() || '[תיאור מהות המשחק]';
  const realWorld =
    state.isRealWorldBased === 'yes'
      ? `מבוסס על המשחק "${state.realWorldGame.trim() || 'משחק מוכר'}" עם שדרוג דיגיטלי: ${
          state.digitalTwist.trim() || 'כוחות מיוחדים ואתגרים'
        }`
      : 'רעיון מקורי לחלוטין';
  const win = state.winCondition.trim() || '[תנאי הניצחון]';
  const conflict = state.conflictObstacle.trim() || '[האויבים והמכשולים]';
  const lose = state.loseCondition.trim() || '[תנאי הפסילה]';
  const visuals = state.characterAndBg.trim() || '[תיאור הדמות והרקע]';
  const controls = state.controls.trim() || 'מקשי החצים';
  const tutorial =
    state.tutorialText.trim() ||
    `השתמשו ב-${controls} כדי להגיע ליעד ולהימנע ממכשולים!`;

  return `צור משחק דפדפן אינטראקטיבי, צבעוני ועובד המותאם לילדים בשם "${name}".

1. מהות המשחק וההשראה:
- מהות המשחק: ${summary}
- בסיס בעולם האמיתי: ${realWorld}

2. גרפיקה וסביבת המשחק:
- ממדים וזווית ראייה: המשחק בנוי ב-${state.dimension} מזווית מבט ${state.cameraView}.
- סגנון גרפי: ${state.artStyle}. עיצוב דמויות ורקע: ${visuals}. הוסף אנימציות חלקות ומשוב ויזואלי ברור בעת איסוף נקודות או פגיעה.

3. הקונפליקט וחוקי המשחק:
- מטרת השחקן וניצחון: ${win}
- הקונפליקט המרכזי: ${conflict}
- תנאי פסילה: ${lose}

4. רמות מורכבות:
- צור 3 רמות קושי לבחירה:
  * קל: ${state.easyLevel}
  * בינוני: ${state.mediumLevel}
  * קשה: ${state.hardLevel}

5. ממשק, הדרכה וכפתורי שליטה (חובה לממש במלואם):
- תפריט פתיחה מסודר: מסך פתיחה מעוצב עם שם המשחק "${name}", כפתור "התחל משחק", כפתור "איך משחקים?" ובורר לבחירת "רמת קושי".
- מסך הדרכה (Tutorial): מסך ברור עם הסבר על המקשים (${controls}) וטקסט ההסבר: "${tutorial}", כולל כפתור "הבנתי, בואו נשחק!".
- השהיה (Pause): כפתור השהיה בפינת המסך (וגם במקש Esc או P) שעוצר את המשחק ומציג תפריט עם "המשך משחק", "התחלה מחדש" ו"תפריט ראשי".
- התחלה מחדש (Restart): כפתור בולט להתחלה מחדש גם בתפריט ההשהיה וגם במסך הסיום שמאפס מיד את המשחק.
- תצוגה עילית (HUD): הצג בזמן אמת ניקוד, לבבות חיים ורמת קושי.`;
}

function cleanPlaceholder(value: string): string {
  const trimmed = value.trim();
  if (/^\[.+\]$/.test(trimmed)) return '';
  return trimmed;
}

/**
 * פענוח פרומפט טקסטואלי (מבני או חופשי) בחזרה לשדות 7 השלבים של האשף
 */
function parsePromptTextIntoWizardState(
  rawText: string,
  fallbackGameName?: string
): { wizardState: GamePromptWizardState; matchedSections: number } {
  const base = createDefaultWizardState();
  const text = (rawText || '').replace(/\r\n/g, '\n').trim();
  let matchedSections = 0;

  if (!text) {
    if (fallbackGameName?.trim()) {
      base.gameName = fallbackGameName.trim();
    }
    return { wizardState: base, matchedSections: 0 };
  }

  // שלב 1: שם המשחק ומהותו
  const titleMatch =
    text.match(/בשם\s*"([^"]+)"/) ||
    text.match(/משחק\s+בשם\s*([^\n."]+)/) ||
    text.match(/שם המשחק\s*:\s*([^\n]+)/);
  if (titleMatch?.[1]) {
    const clean = cleanPlaceholder(titleMatch[1]);
    if (clean) {
      base.gameName = clean;
      matchedSections++;
    }
  } else if (fallbackGameName?.trim()) {
    base.gameName = fallbackGameName.trim();
  }

  const summaryMatch = text.match(/מהות המשחק\s*:\s*([^\n]+)/);
  if (summaryMatch?.[1]) {
    const clean = cleanPlaceholder(summaryMatch[1]);
    if (clean) {
      base.gameSummary = clean;
      matchedSections++;
    }
  }

  // שלב 2: השראה מהעולם האמיתי
  const realWorldLineMatch = text.match(/בסיס בעולם האמיתי\s*:\s*([^\n]+)/);
  if (realWorldLineMatch?.[1]) {
    const line = realWorldLineMatch[1].trim();
    matchedSections++;
    if (line.includes('רעיון מקורי')) {
      base.isRealWorldBased = 'no';
    } else {
      const rwMatch = line.match(
        /מבוסס על המשחק\s*"([^"]*)"\s*עם שדרוג דיגיטלי\s*:\s*(.+)$/
      );
      if (rwMatch) {
        base.isRealWorldBased = 'yes';
        base.realWorldGame = cleanPlaceholder(rwMatch[1] || '');
        base.digitalTwist = cleanPlaceholder(rwMatch[2] || '');
      } else {
        base.isRealWorldBased = 'yes';
        base.realWorldGame = line;
      }
    }
  }

  // שלב 3: ממדים וזווית מצלמה
  const dimMatch = text.match(/\b(2D|3D)\b/i);
  if (dimMatch?.[1]) {
    base.dimension = dimMatch[1].toUpperCase() === '3D' ? '3D' : '2D';
    matchedSections++;
  }
  for (const cam of CAMERA_VIEWS) {
    if (text.includes(cam)) {
      base.cameraView = cam;
      break;
    }
  }

  // שלב 4: קונפליקט, ניצחון ופסילה
  const winMatch = text.match(/(?:מטרת השחקן וניצחון|איך מנצחים|ניצחון)\s*:\s*([^\n]+)/);
  if (winMatch?.[1]) {
    const clean = cleanPlaceholder(winMatch[1]);
    if (clean) {
      base.winCondition = clean;
      matchedSections++;
    }
  }

  const conflictMatch = text.match(/(?:הקונפליקט המרכזי|קונפליקט|מכשולים)\s*:\s*([^\n]+)/);
  if (conflictMatch?.[1]) {
    const clean = cleanPlaceholder(conflictMatch[1]);
    if (clean) {
      base.conflictObstacle = clean;
      matchedSections++;
    }
  }

  const loseMatch = text.match(/(?:תנאי פסילה|מתי נפסלים|פסילה)\s*:\s*([^\n]+)/);
  if (loseMatch?.[1]) {
    const clean = cleanPlaceholder(loseMatch[1]);
    if (clean) {
      base.loseCondition = clean;
      matchedSections++;
    }
  }

  // שלב 5: רמות מורכבות
  const easyMatch = text.match(/(?:\*\s*)?קל\s*:\s*([^\n]+)/);
  if (easyMatch?.[1]) {
    base.easyLevel = easyMatch[1].trim();
    matchedSections++;
  }
  const medMatch = text.match(/(?:\*\s*)?בינוני\s*:\s*([^\n]+)/);
  if (medMatch?.[1]) {
    base.mediumLevel = medMatch[1].trim();
  }
  const hardMatch = text.match(/(?:\*\s*)?קשה\s*:\s*([^\n]+)/);
  if (hardMatch?.[1]) {
    base.hardLevel = hardMatch[1].trim();
  }

  // שלב 6: גרפיקה ועיצוב
  for (const style of ART_STYLES) {
    if (text.includes(style) || (style.includes('פיקסל') && text.includes('פיקסל'))) {
      base.artStyle = style;
      break;
    }
  }
  const visualsMatch = text.match(
    /עיצוב דמויות ורקע\s*:\s*(.+?)(?:\.\s*הוסף אנימציות|\n|$)/
  );
  if (visualsMatch?.[1]) {
    const clean = cleanPlaceholder(visualsMatch[1]);
    if (clean) {
      base.characterAndBg = clean;
      matchedSections++;
    }
  }

  // שלב 7: מקשי שליטה והדרכה
  const tutorialBlockMatch = text.match(
    /הסבר על המקשים\s*\(([^)]+)\)\s*וטקסט ההסבר\s*:\s*"([^"]*)"/
  );
  if (tutorialBlockMatch) {
    if (tutorialBlockMatch[1]?.trim()) {
      base.controls = tutorialBlockMatch[1].trim();
    }
    if (tutorialBlockMatch[2]?.trim()) {
      base.tutorialText = tutorialBlockMatch[2].trim();
    }
    matchedSections++;
  } else {
    const controlsMatch = text.match(/(?:מקשי שליטה|מקשים|שליטה)\s*:\s*([^\n]+)/);
    if (controlsMatch?.[1]) {
      base.controls = controlsMatch[1].trim();
    }
    const tutMatch = text.match(/(?:טקסט הדרכה|הדרכה)\s*:\s*([^\n]+)/);
    if (tutMatch?.[1]) {
      base.tutorialText = tutMatch[1].trim();
    }
  }

  // השלמת חסרים אם הפרומפט חופשי ולא בפורמט המובנה
  if (!base.gameName) {
    const firstLine = text.split('\n')[0]?.replace(/^["#\s*-]+|["\s.]+$/g, '') || '';
    base.gameName = firstLine.slice(0, 60) || fallbackGameName?.trim() || 'משחק מיובא';
  }
  if (!base.gameSummary) {
    base.gameSummary = text.slice(0, 550);
  }

  return { wizardState: base, matchedSections };
}

function loadLocalPrompts(): SavedGamePromptItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_PROMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...(item as SavedGamePromptItem),
      productionStatus:
        (item as SavedGamePromptItem).productionStatus === 'הופק' ? 'הופק' : 'ממתין',
      createdSiteUrl: String((item as SavedGamePromptItem).createdSiteUrl || ''),
      storageScope: 'local' as const,
    }));
  } catch {
    return [];
  }
}

function persistLocalPrompts(items: SavedGamePromptItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_PROMPTS_KEY, JSON.stringify(items));
  } catch {
    // התעלמות ממגבלת אחסון מקומית בדפדפן
  }
}

function extractFirstNameFromUser(user: User | null): string {
  if (!user) return '';
  if (user.displayName) {
    const clean = sanitizeStudentDisplayName(user.displayName);
    if (clean) return clean;
  }
  return '';
}

function formatHebrewDate(isoString: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '');
  const lower = msg.toLowerCase();
  if (lower.includes('popup-blocked')) {
    return 'הדפדפן חסם את חלון ההתחברות הקופץ. אפשרו חלונות קופצים עבור אתר זה ולחצו על "פתח חלון התחברות בחזית".';
  }
  if (lower.includes('popup-closed-by-user')) {
    return 'חלון ההתחברות של Google נסגר לפני השלמת הכניסה. לחצו למטה כדי לפתוח אותו מחדש.';
  }
  if (lower.includes('cancelled-popup-request')) {
    return 'נפתחה בקשת התחברות חדשה. השלימו את הכניסה בחלון החדש.';
  }
  if (lower.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `הדומיין "${host}" עדיין לא מאושר בהגדרות Firebase Authentication (Authorized domains).`;
  }
  return msg || 'אירעה שגיאה בהתחברות לחשבון Google.';
}

function formatFirestoreWriteError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed?.error) detail = parsed.error;
  } catch {
    // שמירת ההודעה המקורית
  }

  const lower = detail.toLowerCase();
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return 'אין הרשאת שמירה או קריאה במסד הנתונים. ודאו שאתם מחוברים עם חשבון Google מאומת.';
  }
  if (lower.includes('quota exceeded')) {
    return 'מכסת הקריאות היומית של מסד הנתונים הסתיימה להיום.';
  }
  return detail || 'אירעה שגיאה בעבודה מול מסד הנתונים.';
}

export const GamePromptGeneratorPage: React.FC<GamePromptGeneratorPageProps> = ({
  user,
  isSigningIn,
  onSignIn,
  onSignOut,
  onBackHome,
  onOpenCatalog,
  onOpenSubmit,
}) => {
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRafRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const signInAttemptRef = useRef<number>(0);

  const [wizard, setWizard] = useState<GamePromptWizardState>(() =>
    createDefaultWizardState()
  );
  const [isManualEdited, setIsManualEdited] = useState(false);
  const [manualPromptText, setManualPromptText] = useState('');
  const [activeLoadedPromptId, setActiveLoadedPromptId] = useState<string | null>(null);

  // חלונות ייעודיים להפחתת עומס כפתורים + חלון עריכה מוגדל + חלון התחברות בחזית
  const [isExpandedEditorOpen, setIsExpandedEditorOpen] = useState(false);
  const [isWizardToolsOpen, setIsWizardToolsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [showStep1Ideas, setShowStep1Ideas] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authDialogError, setAuthDialogError] = useState<string | null>(null);

  // שמירה בענן (Firestore) למשתמשים מחוברים + גיבוי/מצב אורח במכשיר
  const [cloudPrompts, setCloudPrompts] = useState<SavedGamePromptItem[]>([]);
  const [localPrompts, setLocalPrompts] = useState<SavedGamePromptItem[]>(() =>
    loadLocalPrompts()
  );
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  // הרשאת מנהל / מורשה לצפייה בכל הפרומפטים
  const [isAdminOrEditor, setIsAdminOrEditor] = useState(false);
  const [allAdminPrompts, setAllAdminPrompts] = useState<SavedGamePromptItem[]>([]);
  const [isAllPromptsOpen, setIsAllPromptsOpen] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'הכל' | PromptProductionStatus>('הכל');
  const [expandedAdminPromptId, setExpandedAdminPromptId] = useState<string | null>(null);

  // חלון הספרייה שלי
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryActionTab, setLibraryActionTab] = useState<'save-current' | 'import-prompt'>(
    'save-current'
  );
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryStatusFilter, setLibraryStatusFilter] = useState<'הכל' | PromptProductionStatus>(
    'הכל'
  );
  const [expandedMoreActionsId, setExpandedMoreActionsId] = useState<string | null>(null);

  // טופס שמירת הפרומפט הנוכחי
  const [libraryPromptName, setLibraryPromptName] = useState('');
  const [creatorFirstName, setCreatorFirstName] = useState(() =>
    extractFirstNameFromUser(user)
  );
  const [creatorClassName, setCreatorClassName] = useState('');
  const [saveProductionStatus, setSaveProductionStatus] =
    useState<PromptProductionStatus>('ממתין');
  const [saveSiteUrl, setSaveSiteUrl] = useState('');

  // טופס טעינת פרומפט לספרייה (מקובץ או הדבקה)
  const [importPromptName, setImportPromptName] = useState('');
  const [importPromptText, setImportPromptText] = useState('');
  const [importClassName, setImportClassName] = useState('');
  const [importStatus, setImportStatus] = useState<PromptProductionStatus>('ממתין');
  const [importSiteUrl, setImportSiteUrl] = useState('');

  // עריכה מהירה וקישור לאתר בתוך רשימת הספרייה
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardClass, setEditCardClass] = useState('');
  const [editCardStatus, setEditCardStatus] = useState<PromptProductionStatus>('ממתין');
  const [editCardSiteUrl, setEditCardSiteUrl] = useState('');
  const [editCardText, setEditCardText] = useState('');
  const [siteUrlDrafts, setSiteUrlDrafts] = useState<Record<string, string>>({});

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [libraryAlert, setLibraryAlert] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [copiedJustNow, setCopiedJustNow] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const userEmail = (user?.email || '').trim().toLowerCase();
  const isCloudUser = Boolean(isFirebaseConfigured && user?.uid && userEmail);

  // סגירה אוטומטית של חלון ההתחברות ברגע שהמשתמש חובר בהצלחה
  useEffect(() => {
    if (isCloudUser && isAuthDialogOpen && !isSigningIn) {
      setIsAuthDialogOpen(false);
      setAuthDialogError(null);
      showToast(`מחובר כעת לענן (${userEmail})!`);
    }
  }, [isCloudUser, isAuthDialogOpen, isSigningIn, userEmail]);

  // עדכון שם פרטי אוטומטי מהמשתמש המחובר
  useEffect(() => {
    const first = extractFirstNameFromUser(user);
    if (first && !creatorFirstName) {
      setCreatorFirstName(first);
    }
  }, [user, creatorFirstName]);

  // מיקוד אוטומטי בתיבת העריכה המוגדלת עם פתיחתה
  useEffect(() => {
    if (isExpandedEditorOpen) {
      requestAnimationFrame(() => {
        expandedTextareaRef.current?.focus();
      });
    }
  }, [isExpandedEditorOpen]);

  // סנכרון מקומי בין לשוניות
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_PROMPTS_KEY) {
        setLocalPrompts(loadLocalPrompts());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // בדיקת הרשאות מנהל / מורשה והאזנה לפרומפטים ב-Firestore
  useEffect(() => {
    if (!isCloudUser || !user?.uid) {
      setCloudPrompts([]);
      setCloudError(null);
      setIsCloudLoading(false);
      setIsAdminOrEditor(false);
      setAllAdminPrompts([]);
      return;
    }

    let cancelled = false;
    setIsCloudLoading(true);
    setCloudError(null);

    const unsubOwn = subscribeUserPrompts(
      user.uid,
      (items) => {
        if (cancelled) return;
        setCloudPrompts(items);
        setIsCloudLoading(false);
        setCloudError(null);
      },
      (err) => {
        if (cancelled) return;
        setIsCloudLoading(false);
        setCloudError(formatFirestoreWriteError(err));
      }
    );

    let unsubAll: (() => void) | undefined;
    void (async () => {
      try {
        const allowed =
          Boolean(user.emailVerified && isSuperAdminEmail(userEmail)) ||
          (await checkEditorAuthorization(userEmail));
        if (cancelled) return;
        setIsAdminOrEditor(allowed);
        if (allowed) {
          unsubAll = subscribeAllPromptsForAdmin(
            (all) => {
              if (!cancelled) setAllAdminPrompts(all);
            },
            () => {
              // התצוגה של המשתמש עדיין פעילה
            }
          );
        }
      } catch {
        if (!cancelled) setIsAdminOrEditor(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubOwn();
      unsubAll?.();
    };
  }, [isCloudUser, user?.uid, userEmail, user?.emailVerified]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (confettiRafRef.current) window.cancelAnimationFrame(confettiRafRef.current);
    };
  }, []);

  useEffect(() => {
    const anyModalOpen =
      isLibraryOpen ||
      isAllPromptsOpen ||
      isExpandedEditorOpen ||
      isWizardToolsOpen ||
      isExportModalOpen ||
      isCompletionModalOpen ||
      isAuthDialogOpen;
    if (!anyModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAuthDialogOpen && !isSigningIn) {
          setIsAuthDialogOpen(false);
          setAuthDialogError(null);
          return;
        }
        if (isExpandedEditorOpen) {
          setIsExpandedEditorOpen(false);
          return;
        }
        if (isExportModalOpen) {
          setIsExportModalOpen(false);
          return;
        }
        if (isWizardToolsOpen) {
          setIsWizardToolsOpen(false);
          return;
        }
        if (isCompletionModalOpen) {
          setIsCompletionModalOpen(false);
          return;
        }
        setIsLibraryOpen(false);
        setIsAllPromptsOpen(false);
        setPendingDeleteId(null);
        setEditingCardId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isLibraryOpen,
    isAllPromptsOpen,
    isExpandedEditorOpen,
    isWizardToolsOpen,
    isExportModalOpen,
    isCompletionModalOpen,
    isAuthDialogOpen,
    isSigningIn,
  ]);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3600);
  };

  // פתיחת חלון ההתחברות של Google בחזית מעל כל חלונות הדפדפן והפורטל
  const handleTriggerGoogleSignIn = async () => {
    if (!isFirebaseConfigured) return;
    const attemptId = ++signInAttemptRef.current;
    setAuthDialogError(null);
    setIsAuthDialogOpen(true);
    try {
      await onSignIn();
      if (attemptId === signInAttemptRef.current) {
        setIsAuthDialogOpen(false);
      }
    } catch (err) {
      if (attemptId === signInAttemptRef.current) {
        setAuthDialogError(formatAuthError(err));
      }
    }
  };

  const launchConfetti = () => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (confettiRafRef.current) window.cancelAnimationFrame(confettiRafRef.current);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#a3e635', '#22d3ee', '#ec4899', '#facc15', '#ffffff'];
    const pieces = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 180,
      r: 4 + Math.random() * 6,
      c: colors[Math.floor(Math.random() * colors.length)],
      vy: 3 + Math.random() * 4,
      vx: -2 + Math.random() * 4,
    }));

    let frame = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.r, p.r * 1.4);
      }
      frame++;
      if (frame < 105) {
        confettiRafRef.current = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        confettiRafRef.current = null;
      }
    };
    confettiRafRef.current = window.requestAnimationFrame(tick);
  };

  const generatedPromptText = useMemo(() => buildFinalPromptText(wizard), [wizard]);
  const effectivePromptText = isManualEdited ? manualPromptText : generatedPromptText;
  const activeStepMeta = STEP_META[wizard.currentStep - 1] || STEP_META[0];

  const myPrompts = useMemo(() => {
    return isCloudUser ? cloudPrompts : localPrompts;
  }, [isCloudUser, cloudPrompts, localPrompts]);

  const promptStats = useMemo(() => {
    const produced = myPrompts.filter((p) => p.productionStatus === 'הופק').length;
    return {
      total: myPrompts.length,
      produced,
      waiting: myPrompts.length - produced,
    };
  }, [myPrompts]);

  const filteredMyPrompts = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    return myPrompts.filter((item) => {
      const matchStatus =
        libraryStatusFilter === 'הכל' || item.productionStatus === libraryStatusFilter;
      const haystack = `${item.promptName} ${item.gameName} ${item.creatorFirstName} ${item.className} ${item.createdSiteUrl}`.toLowerCase();
      const matchQuery = !q || haystack.includes(q);
      return matchStatus && matchQuery;
    });
  }, [myPrompts, librarySearch, libraryStatusFilter]);

  const filteredAdminPrompts = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    return allAdminPrompts.filter((item) => {
      const matchStatus =
        adminStatusFilter === 'הכל' || item.productionStatus === adminStatusFilter;
      const haystack = `${item.promptName} ${item.gameName} ${item.creatorFirstName} ${item.className} ${item.ownerEmail || ''} ${item.createdSiteUrl}`.toLowerCase();
      const matchQuery = !q || haystack.includes(q);
      return matchStatus && matchQuery;
    });
  }, [allAdminPrompts, adminSearch, adminStatusFilter]);

  const updateField = <K extends keyof GamePromptWizardState>(
    field: K,
    value: GamePromptWizardState[K]
  ) => {
    setWizard((prev) => ({ ...prev, [field]: value }));
  };

  const handleManualPromptChange = (nextText: string) => {
    setIsManualEdited(true);
    setManualPromptText(nextText);
  };

  const handleResetToWizardAuto = () => {
    setIsManualEdited(false);
    setManualPromptText('');
    showToast('הפרומפט סונכרן מחדש עם שלבי האשף!');
  };

  /**
   * טעינת פרומפט טקסטואלי ישירות לחלונות 7 השלבים (גם מעורך ידני, גם מהייבוא וגם מהספרייה)
   */
  const loadTextIntoSevenSteps = (
    rawText: string,
    fallbackGameName?: string,
    options?: { startAtStep?: number; keepManualIfCustom?: boolean }
  ) => {
    const { wizardState, matchedSections } = parsePromptTextIntoWizardState(
      rawText,
      fallbackGameName
    );
    setWizard({
      ...wizardState,
      currentStep: options?.startAtStep ?? 1,
    });

    if (matchedSections >= 2 || !options?.keepManualIfCustom) {
      setIsManualEdited(false);
      setManualPromptText('');
    } else {
      setIsManualEdited(true);
      setManualPromptText(rawText);
    }

    setIsExpandedEditorOpen(false);
    setIsExportModalOpen(false);
    setIsLibraryOpen(false);
    setIsAllPromptsOpen(false);
    showToast(
      matchedSections >= 2
        ? 'הפרומפט פוענח ונטען לכל 7 שלבי האשף!'
        : 'שם המשחק ומהותו נטענו ל-7 השלבים — אפשר להשלים את שאר השלבים כרצונכם!'
    );
  };

  const handleAutoGenerateTutorial = () => {
    const name = wizard.gameName.trim() || 'המשחק';
    const win = wizard.winCondition.trim() || 'לאסוף את כל הנקודות';
    const obs = wizard.conflictObstacle.trim() || 'מהמכשולים';
    const controls = wizard.controls.trim() || 'מקשי החצים';
    updateField(
      'tutorialText',
      `ברוכים הבאים ל-${name}! השתמשו ב-${controls} כדי ${win}, והיזהרו ${obs}. בהצלחה!`
    );
    showToast('הדרכה אוטומטית נוצרה בהצלחה!');
  };

  const handleFillDemoExample = () => {
    setWizard({
      ...createDefaultWizardState(),
      currentStep: 7,
      gameName: 'תופסת בחלל',
      gameSummary:
        'השחקן שולט באסטרונאוט מרחף שצריך לאסוף קריסטלים זוהרים בתחנת החלל ולברוח מחייזרים תופסים.',
      isRealWorldBased: 'yes',
      realWorldGame: 'תופסת',
      digitalTwist: 'ריחוף באפס כבידה, שער טלפורטציה ומגן אנרגיה ל-3 שניות',
      dimension: '2D',
      cameraView: 'מבט מלמעלה',
      winCondition: 'אוספים 20 קריסטלים זוהרים לפני שנגמר הזמן',
      conflictObstacle: 'חייזרים סגולים שרודפים אחרי השחקן ומטאורים מרחפים',
      loseCondition: 'כשהחייזרים תופסים את השחקן 3 פעמים ונגמרים הלבבות',
      easyLevel: '2 חייזרים איטיים, 5 לבבות חיים',
      mediumLevel: '4 חייזרים במהירות רגילה, 3 לבבות חיים',
      hardLevel: '6 חייזרים מהירים ומטאורים זזים, 2 לבבות חיים',
      artStyle: 'חלל וניאון זוהר',
      characterAndBg:
        'אסטרונאוט בחליפה ירוקה זוהרת על רקע גלקסיה כהה עם כוכבים וכוכבי לכת צבעוניים.',
      controls: 'מקשי החצים לתזוזה ורווח להפעלת מגן אנרגיה',
      tutorialText:
        'הזיזו את האסטרונאוט בעזרת החצים, אספו 20 קריסטלים ולחצו רווח להפעלת מגן כשחייזר מתקרב!',
    });
    setIsManualEdited(false);
    setManualPromptText('');
    setActiveLoadedPromptId(null);
    setIsWizardToolsOpen(false);
    launchConfetti();
    showToast('דוגמת "תופסת בחלל" מולאה ב-7 השלבים!');
  };

  const handleResetWizard = () => {
    setWizard(createDefaultWizardState());
    setIsManualEdited(false);
    setManualPromptText('');
    setActiveLoadedPromptId(null);
    setIsWizardToolsOpen(false);
    showToast('האשף אופס להתחלה חדשה');
  };

  const handleCopyPrompt = async (customText?: string) => {
    const text = customText ?? effectivePromptText;
    try {
      await navigator.clipboard.writeText(text);
      if (!customText) {
        setCopiedJustNow(true);
        window.setTimeout(() => setCopiedJustNow(false), 2200);
      }
      showToast('הפרומפט הועתק ללוח! עכשיו אפשר להדביק אותו במחולל.');
    } catch {
      if (!customText && promptTextareaRef.current) {
        promptTextareaRef.current.focus();
        promptTextareaRef.current.select();
      }
      showToast('סמנו את הטקסט בתיבה והעתיקו בעזרת Ctrl+C');
    }
  };

  const handleDownloadTxt = (customText?: string, customFileName?: string) => {
    const text = customText ?? effectivePromptText;
    const rawName = (customFileName ?? wizard.gameName.trim()) || 'game-prompt';
    const fileName = rawName.replace(/[^a-zA-Z0-9\u0590-\u05FF_-]/g, '_');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('קובץ הפרומפט ירד למחשב בהצלחה!');
  };

  const openLibraryModal = (initialTab: 'save-current' | 'import-prompt' = 'save-current') => {
    setLibraryActionTab(initialTab);
    setLibraryPromptName(wizard.gameName.trim() || 'המשחק החדש שלי');
    setSaveProductionStatus('ממתין');
    setSaveSiteUrl('');
    setLibraryAlert(null);
    setPendingDeleteId(null);
    setEditingCardId(null);
    setExpandedMoreActionsId(null);
    setIsExportModalOpen(false);
    setIsCompletionModalOpen(false);
    setIsLibraryOpen(true);
  };

  const createPromptRecord = async (input: SaveGamePromptInput) => {
    if (isCloudUser && user?.uid && userEmail) {
      await createGamePromptInFirestore(user.uid, userEmail, input);
      return 'cloud' as const;
    }

    const rawUrl = input.createdSiteUrl.trim();
    let normalizedUrl = '';
    if (rawUrl) {
      const normalized = normalizeHttpUrl(rawUrl).slice(0, 500);
      if (!normalized) {
        throw new Error('הקישור לאתר שנוצר אינו תקין. ודאו שהוא מתחיל ב-https://.');
      }
      normalizedUrl = normalized;
    }

    const nowIso = new Date().toISOString();
    const newItem: SavedGamePromptItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      promptName: input.promptName.trim() || input.gameName.trim() || 'פרומפט משחק',
      gameName: input.gameName.trim() || input.promptName.trim() || 'משחק חדש',
      creatorFirstName: sanitizeStudentDisplayName(input.creatorFirstName) || 'תלמיד',
      className: input.className.trim().slice(0, 20) || 'כללי',
      promptText: input.promptText.trim(),
      productionStatus: input.productionStatus === 'הופק' ? 'הופק' : 'ממתין',
      createdSiteUrl: normalizedUrl,
      isManualEdited: Boolean(input.isManualEdited),
      wizardState: input.wizardState ? { ...input.wizardState } : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      storageScope: 'local',
    };
    const next = [newItem, ...localPrompts];
    setLocalPrompts(next);
    persistLocalPrompts(next);
    return 'local' as const;
  };

  const updatePromptRecord = async (
    target: SavedGamePromptItem,
    patch: Partial<SaveGamePromptInput>
  ) => {
    const merged: SaveGamePromptInput = {
      promptName: patch.promptName ?? target.promptName,
      gameName: patch.gameName ?? target.gameName,
      creatorFirstName: patch.creatorFirstName ?? target.creatorFirstName,
      className: patch.className ?? target.className,
      promptText: patch.promptText ?? target.promptText,
      productionStatus: patch.productionStatus ?? target.productionStatus,
      createdSiteUrl: patch.createdSiteUrl ?? target.createdSiteUrl,
      isManualEdited:
        patch.isManualEdited !== undefined ? patch.isManualEdited : target.isManualEdited,
      wizardState: patch.wizardState !== undefined ? patch.wizardState : target.wizardState,
    };

    if (target.storageScope === 'cloud' && isCloudUser) {
      await updateGamePromptInFirestore(target.id, merged);
      return;
    }

    const rawUrl = merged.createdSiteUrl.trim();
    let normalizedUrl = '';
    if (rawUrl) {
      const normalized = normalizeHttpUrl(rawUrl).slice(0, 500);
      if (!normalized) {
        throw new Error('הקישור לאתר שנוצר אינו תקין. ודאו שהוא מתחיל ב-https://.');
      }
      normalizedUrl = normalized;
    }

    const nowIso = new Date().toISOString();
    const next = localPrompts.map((item) =>
      item.id === target.id
        ? {
            ...item,
            promptName: merged.promptName.trim() || item.promptName,
            gameName: merged.gameName.trim() || item.gameName,
            creatorFirstName:
              sanitizeStudentDisplayName(merged.creatorFirstName) || item.creatorFirstName,
            className: merged.className.trim().slice(0, 20) || item.className,
            promptText: merged.promptText.trim() || item.promptText,
            productionStatus: merged.productionStatus,
            createdSiteUrl: normalizedUrl,
            isManualEdited: Boolean(merged.isManualEdited),
            wizardState: merged.wizardState ? { ...merged.wizardState } : item.wizardState,
            updatedAt: nowIso,
          }
        : item
    );
    setLocalPrompts(next);
    persistLocalPrompts(next);
  };

  const deletePromptRecord = async (target: SavedGamePromptItem) => {
    if (target.storageScope === 'cloud' && isCloudUser) {
      await deleteGamePromptInFirestore(target.id);
      return;
    }
    const next = localPrompts.filter((item) => item.id !== target.id);
    setLocalPrompts(next);
    persistLocalPrompts(next);
  };

  const handleSaveCurrentPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLibraryAlert(null);
    setIsSavingAction(true);
    try {
      const promptTitle =
        libraryPromptName.trim() || wizard.gameName.trim() || 'המשחק החדש שלי';
      const scope = await createPromptRecord({
        promptName: promptTitle,
        gameName: wizard.gameName.trim() || promptTitle,
        creatorFirstName: creatorFirstName.trim() || 'תלמיד',
        className: creatorClassName.trim() || 'כללי',
        promptText: effectivePromptText,
        productionStatus: saveProductionStatus,
        createdSiteUrl: saveSiteUrl,
        isManualEdited,
        wizardState: wizard,
      });

      setSaveSiteUrl('');
      setLibraryAlert({
        type: 'success',
        text:
          scope === 'cloud'
            ? `הפרומפט "${promptTitle}" נשמר בהצלחה בענן ובספרייה שלך (וצוות המורים יכול לצפות בו)!`
            : `הפרומפט "${promptTitle}" נשמר בספרייה המקומית במכשיר. התחברו עם Google לשמירה בענן.`,
      });
      showToast(`הפרומפט "${promptTitle}" נשמר בספרייה!`);
    } catch (err) {
      setLibraryAlert({ type: 'error', text: formatFirestoreWriteError(err) });
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleImportTxtFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      setImportPromptText(text.slice(0, 12000));
      if (!importPromptName.trim()) {
        setImportPromptName(baseName || 'פרומפט מיובא');
      }
      setLibraryAlert({
        type: 'success',
        text: `הקובץ "${file.name}" נטען לטופס! אפשר לשמור לספרייה או לטעון ישירות ל-7 השלבים.`,
      });
    } catch {
      setLibraryAlert({ type: 'error', text: 'לא הצלחנו לקרוא את קובץ הטקסט שנבחר.' });
    }
  };

  const handleSubmitImportPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLibraryAlert(null);
    if (!importPromptText.trim()) {
      setLibraryAlert({ type: 'error', text: 'יש להדביק או לטעון טקסט של פרומפט לפני השמירה.' });
      return;
    }

    setIsSavingAction(true);
    try {
      const promptTitle = importPromptName.trim() || 'פרומפט מיובא';
      const parsed = parsePromptTextIntoWizardState(importPromptText, promptTitle);
      const scope = await createPromptRecord({
        promptName: promptTitle,
        gameName: parsed.wizardState.gameName || promptTitle,
        creatorFirstName: creatorFirstName.trim() || 'תלמיד',
        className: importClassName.trim() || creatorClassName.trim() || 'כללי',
        promptText: importPromptText,
        productionStatus: importStatus,
        createdSiteUrl: importSiteUrl,
        isManualEdited: true,
        wizardState: parsed.wizardState,
      });

      setImportPromptName('');
      setImportPromptText('');
      setImportSiteUrl('');
      setImportStatus('ממתין');
      setLibraryAlert({
        type: 'success',
        text:
          scope === 'cloud'
            ? `הפרומפט "${promptTitle}" נטען ונשמר בספריית הענן (ומוכן גם לטעינה ל-7 השלבים)!`
            : `הפרומפט "${promptTitle}" נטען ונשמר בספרייה המקומית במכשיר.`,
      });
      showToast(`הפרומפט "${promptTitle}" נטען לספרייה!`);
    } catch (err) {
      setLibraryAlert({ type: 'error', text: formatFirestoreWriteError(err) });
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleMigrateLocalToCloud = async () => {
    if (!isCloudUser || localPrompts.length === 0) return;
    setIsSavingAction(true);
    setLibraryAlert(null);
    let moved = 0;
    try {
      const remaining: SavedGamePromptItem[] = [];
      for (const item of localPrompts) {
        try {
          await createGamePromptInFirestore(user!.uid, userEmail, {
            promptName: item.promptName,
            gameName: item.gameName,
            creatorFirstName: item.creatorFirstName || creatorFirstName || 'תלמיד',
            className: item.className || 'כללי',
            promptText: item.promptText,
            productionStatus: item.productionStatus,
            createdSiteUrl: item.createdSiteUrl,
            isManualEdited: item.isManualEdited,
            wizardState: item.wizardState,
          });
          moved++;
        } catch {
          remaining.push(item);
        }
      }
      setLocalPrompts(remaining);
      persistLocalPrompts(remaining);
      setLibraryAlert({
        type: 'success',
        text: `${moved} פרומפטים מקומיים הועלו בהצלחה לספריית הענן שלך!`,
      });
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleTogglePromptStatus = async (
    item: SavedGamePromptItem,
    nextStatus: PromptProductionStatus
  ) => {
    if (item.productionStatus === nextStatus) return;
    setLibraryAlert(null);
    setIsSavingAction(true);
    try {
      await updatePromptRecord(item, { productionStatus: nextStatus });
      showToast(`סטטוס "${item.promptName}" עודכן ל-${nextStatus}`);
    } catch (err) {
      setLibraryAlert({ type: 'error', text: formatFirestoreWriteError(err) });
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleSaveCardSiteUrl = async (item: SavedGamePromptItem) => {
    const draftUrl = (siteUrlDrafts[item.id] ?? item.createdSiteUrl).trim();
    setLibraryAlert(null);
    setIsSavingAction(true);
    try {
      await updatePromptRecord(item, { createdSiteUrl: draftUrl });
      setSiteUrlDrafts((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
      showToast(draftUrl ? 'הקישור לאתר שנוצר נשמר!' : 'הקישור הוסר.');
    } catch (err) {
      setLibraryAlert({ type: 'error', text: formatFirestoreWriteError(err) });
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleStartInlineEdit = (item: SavedGamePromptItem) => {
    setEditingCardId(item.id);
    setExpandedMoreActionsId(null);
    setEditCardName(item.promptName);
    setEditCardClass(item.className);
    setEditCardStatus(item.productionStatus);
    setEditCardSiteUrl(item.createdSiteUrl);
    setEditCardText(item.promptText);
    setLibraryAlert(null);
  };

  const handleSaveInlineEdit = async (item: SavedGamePromptItem) => {
    setLibraryAlert(null);
    setIsSavingAction(true);
    try {
      const parsed = parsePromptTextIntoWizardState(editCardText, editCardName || item.gameName);
      await updatePromptRecord(item, {
        promptName: editCardName,
        className: editCardClass,
        productionStatus: editCardStatus,
        createdSiteUrl: editCardSiteUrl,
        promptText: editCardText,
        isManualEdited: editCardText.trim() !== item.promptText.trim() ? true : item.isManualEdited,
        wizardState: parsed.matchedSections >= 2 ? parsed.wizardState : item.wizardState,
      });
      setEditingCardId(null);
      showToast(`השינויים ב-"${editCardName || item.promptName}" נשמרו!`);
    } catch (err) {
      setLibraryAlert({ type: 'error', text: formatFirestoreWriteError(err) });
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleOverwriteFromGenerator = async (item: SavedGamePromptItem) => {
    setLibraryAlert(null);
    setIsSavingAction(true);
    try {
      await updatePromptRecord(item, {
        promptName: libraryPromptName.trim() || item.promptName,
        gameName: wizard.gameName.trim() || item.gameName,
        creatorFirstName: creatorFirstName.trim() || item.creatorFirstName,
        className: creatorClassName.trim() || item.className,
        promptText: effectivePromptText,
        isManualEdited,
        wizardState: wizard,
      });
      showToast(`הפרומפט "${item.promptName}" עודכן בתוכן שבעורך!`);
    } catch (err) {
      setLibraryAlert({ type: 'error', text: formatFirestoreWriteError(err) });
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleConfirmDeletePrompt = async (item: SavedGamePromptItem) => {
    setLibraryAlert(null);
    setIsSavingAction(true);
    try {
      await deletePromptRecord(item);
      setPendingDeleteId(null);
      if (activeLoadedPromptId === item.id) {
        setActiveLoadedPromptId(null);
      }
      showToast('הפרומפט נמחק מהספרייה');
    } catch (err) {
      setLibraryAlert({ type: 'error', text: formatFirestoreWriteError(err) });
    } finally {
      setIsSavingAction(false);
    }
  };

  /**
   * טעינת פרומפט שמור מתוך הספרייה / מאגר המנהל אל חלונות 7 השלבים של המחולל
   */
  const handleLoadPromptToGenerator = (item: SavedGamePromptItem) => {
    if (item.wizardState) {
      const merged = { ...createDefaultWizardState(), ...item.wizardState, currentStep: 1 };
      setWizard(merged);
      const wizardBuilt = buildFinalPromptText(merged);
      const differsFromWizard =
        Boolean(item.isManualEdited) ||
        (Boolean(item.promptText) && item.promptText.trim() !== wizardBuilt.trim());
      if (differsFromWizard) {
        setIsManualEdited(true);
        setManualPromptText(item.promptText);
      } else {
        setIsManualEdited(false);
        setManualPromptText('');
      }
    } else {
      const parsed = parsePromptTextIntoWizardState(
        item.promptText,
        item.gameName || item.promptName
      );
      setWizard({ ...parsed.wizardState, currentStep: 1 });
      if (parsed.matchedSections >= 2) {
        setIsManualEdited(false);
        setManualPromptText('');
      } else {
        setIsManualEdited(true);
        setManualPromptText(item.promptText);
      }
    }

    setActiveLoadedPromptId(item.storageScope === 'cloud' || !isCloudUser ? item.id : null);
    setIsLibraryOpen(false);
    setIsAllPromptsOpen(false);
    setPendingDeleteId(null);
    showToast(`הפרומפט "${item.promptName || item.gameName}" נטען לחלונות 7 השלבים!`);
  };

  const handleNextStep = () => {
    if (wizard.currentStep < 7) {
      updateField('currentStep', wizard.currentStep + 1);
    } else {
      launchConfetti();
      setIsCompletionModalOpen(true);
    }
  };

  const activeLoadedPrompt = useMemo(
    () => myPrompts.find((p) => p.id === activeLoadedPromptId) || null,
    [myPrompts, activeLoadedPromptId]
  );

  const simGameTitle = wizard.gameName.trim() || 'המשחק המגניב שלי';
  const promptLineCount = effectivePromptText.split('\n').length;

  return (
    <div className="bg-dark-wall text-slate-100 min-h-[calc(100vh-4rem)] pb-14">
      <canvas
        ref={confettiCanvasRef}
        aria-hidden="true"
        className="fixed inset-0 w-screen h-screen pointer-events-none z-[110]"
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 rounded-2xl bg-slate-950 border-2 border-lime-400 shadow-[0_0_24px_rgba(163,230,53,0.35)] flex items-center gap-2.5 text-sm font-black text-white"
        >
          <Sparkles className="w-4 h-4 text-lime-400 shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* סרגל ניווט, הדגשת סטטוס החיבור וכרטיס ספריית הפרומטים המוגדל          */}
      {/* ===================================================================== */}
      <section className="border-b-4 border-slate-950 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8 space-y-5">
          {/* שורה 1: ניווט מינימלי ללא עומס כפתורים */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-cyan-300 hover:text-lime-300 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>חזרה לדף הראשי</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {isAdminOrEditor && (
                <button
                  type="button"
                  onClick={() => setIsAllPromptsOpen(true)}
                  className="min-h-10 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-white font-black text-xs sm:text-sm transition-all cursor-pointer tabular-nums"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>כל הפרומפטים ({allAdminPrompts.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsWizardToolsOpen(true)}
                className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <span>אפשרויות אשף (דוגמה ואיפוס)</span>
              </button>
            </div>
          </div>

          {/* פס סטטוס חיבור מודגש וברור */}
          <div
            role="status"
            aria-live="polite"
            className={`rounded-2xl border-2 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
              !isFirebaseConfigured
                ? 'border-rose-400 bg-rose-950/75 text-rose-50'
                : isSigningIn
                  ? 'border-cyan-400 bg-cyan-950/75 text-cyan-50'
                  : isCloudUser
                    ? 'border-emerald-400 bg-emerald-950/70 text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.16)]'
                    : 'border-amber-400 bg-amber-950/60 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.12)]'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                  !isFirebaseConfigured
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                    : isSigningIn
                      ? 'bg-cyan-400/20 border-cyan-400 text-cyan-300'
                      : isCloudUser
                        ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                        : 'bg-amber-400 text-slate-950 border-amber-200'
                }`}
              >
                {!isFirebaseConfigured ? (
                  <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                ) : isSigningIn ? (
                  <RefreshCw className="w-6 h-6 animate-spin" aria-hidden="true" />
                ) : isCloudUser ? (
                  <Cloud className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <HardDrive className="w-6 h-6" aria-hidden="true" />
                )}
              </div>

              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm sm:text-base font-black">
                    {!isFirebaseConfigured
                      ? 'סטטוס חיבור: הענן אינו מוגדר בסביבה זו'
                      : isSigningIn
                        ? 'סטטוס חיבור: בתהליך התחברות לחשבון Google...'
                        : isCloudUser
                          ? 'סטטוס חיבור: מחובר לענן (Firebase + Google פעילים)'
                          : 'סטטוס חיבור: לא מחובר · מצב אורח מקומי'}
                  </span>
                  {isCloudUser && (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>שמירה בענן פעילה</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-200/90">
                  {isCloudUser ? (
                    <>
                      מחובר כעת:{' '}
                      <strong className="font-mono text-white" dir="ltr">
                        {userEmail}
                      </strong>{' '}
                      {creatorFirstName ? `(${creatorFirstName})` : ''} · כל פרומפט נשמר לחשבון ונגיש למורים ולמנהלים.
                    </>
                  ) : isSigningIn ? (
                    'חלון ההתחברות של Google נפתח בחזית הדפדפן — בחרו את החשבון הארגוני שלכם.'
                  ) : (
                    'הפרומפטים נשמרים רק בדפדפן הנוכחי. התחברו עם Google כדי לשמור בענן ושהמורה יראה את התוצרים.'
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isCloudUser ? (
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="min-h-10 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 text-emerald-200 border border-emerald-400/60 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>התנתקות מהחשבון</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSigningIn || !isFirebaseConfigured}
                  onClick={() => void handleTriggerGoogleSignIn()}
                  className="min-h-11 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-amber-200 text-slate-950 border-2 border-slate-950 font-black text-xs sm:text-sm shadow-[3px_3px_0px_#06b6d4] transition-all cursor-pointer disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{isSigningIn ? 'פותח חלון התחברות...' : 'התחבר עם Google לשמירה בענן'}</span>
                </button>
              )}
            </div>
          </div>

          {cloudError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-950/90 border-2 border-rose-400 text-rose-100 text-xs sm:text-sm"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
                <span>{cloudError}</span>
              </div>
            </div>
          )}

          {/* כרטיס בולט וברור לספריית הפרומטים עם אייקון מוגדל */}
          <div className="rounded-3xl border-2 border-cyan-400 bg-gradient-to-l from-[#101b22] via-[#132530] to-[#0f172a] p-5 sm:p-6 shadow-[0_0_28px_rgba(34,211,238,0.18)] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => openLibraryModal('save-current')}
                aria-label="פתיחת ספריית הפרומטים שלי"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-2 border-white shadow-[5px_5px_0px_#ec4899] flex items-center justify-center shrink-0 transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                <FolderOpen className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.2]" aria-hidden="true" />
              </button>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-xl sm:text-2xl font-black text-white">
                    ספריית הפרומטים שלי
                  </h2>
                  <span className="text-xs sm:text-sm font-black text-cyan-300 tabular-nums">
                    ({promptStats.total} פרומפטים שמורים
                    {promptStats.total > 0
                      ? ` · ${promptStats.produced} הופקו · ${promptStats.waiting} ממתינים`
                      : ''}
                    )
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  כאן שומרים את הפרומפטים שבניתם, טוענים פרומפט מוכן מקובץ או הדבקה ישר לתוך 7 השלבים, עורכים, מסמנים סטטוס (<strong>הופק / ממתין</strong>) ומוסיפים קישור לאתר שנוצר.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => openLibraryModal('save-current')}
                className="min-h-12 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-2 border-white font-black text-sm shadow-[3px_3px_0px_#ec4899] transition-all cursor-pointer"
              >
                <FolderOpen className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>פתח את ספריית הפרומטים</span>
              </button>

              <button
                type="button"
                onClick={() => openLibraryModal('import-prompt')}
                className="min-h-12 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/35 text-pink-200 border-2 border-pink-400 font-black text-xs sm:text-sm transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>טען פרומפט מקובץ / טקסט</span>
              </button>
            </div>
          </div>

          {/* כותרת והסבר על המחולל */}
          <div className="bg-[#101b22]/95 border-2 border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="minecraft-title text-3xl sm:text-5xl leading-tight tracking-tight">
                    מחולל המשחקים
                  </h1>
                  <span className="inline-block px-3.5 py-1.5 rounded-xl border-2 border-white bg-amber-400 text-slate-950 font-display text-sm sm:text-base font-black shadow-[4px_4px_0px_#ec4899] -rotate-2">
                    כיתות א׳–ו׳
                  </span>
                </div>

                <p className="text-cyan-300 font-extrabold text-base sm:text-lg leading-snug">
                  מתכננים משחק משלכם ב-7 שלבים פשוטים, מגדילים את חלון העריכה הידנית מתי שרוצים, וטוענים פרומפטים ישר לשלבים!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-2xl bg-[#0b1116] border border-pink-500/70 p-3.5 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500 text-white flex items-center justify-center shrink-0">
                      <Wand2 className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">7 שלבים + טעינת פרומפט</h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        אפשר לבנות מאפס או לטעון פרומפט קיים ישר לתוך שדות 7 השלבים.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#0b1116] border border-lime-400/70 p-3.5 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-lime-400 text-slate-950 flex items-center justify-center shrink-0">
                      <Maximize2 className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">חלון עריכה מוגדל</h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        פותחים את עורך הפרומפט בחלון גדול ונוח לעריכה ידנית מדויקת.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* איור שלט ארקייד ניאון */}
              <div className="lg:col-span-4 flex justify-center">
                <div className="w-full max-w-xs rounded-3xl border-2 border-pink-500 bg-[#0b1116] overflow-hidden shadow-[0_0_26px_rgba(236,72,153,0.22)]">
                  <svg
                    viewBox="0 0 420 215"
                    className="w-full h-auto block"
                    role="img"
                    aria-label="איור שלט ארקייד ואוזניות גיימינג"
                  >
                    <defs>
                      <linearGradient id="genBgWall" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#111921" />
                        <stop offset="100%" stopColor="#090e13" />
                      </linearGradient>
                      <linearGradient id="genLimePad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#b5f81d" />
                        <stop offset="100%" stopColor="#65a30d" />
                      </linearGradient>
                    </defs>
                    <rect width="420" height="215" fill="url(#genBgWall)" />
                    <circle cx="95" cy="85" r="60" fill="#22d3ee" opacity="0.18" />
                    <circle cx="310" cy="110" r="70" fill="#ec4899" opacity="0.2" />
                    <circle cx="215" cy="60" r="50" fill="#a8f01d" opacity="0.16" />

                    <path
                      d="M72 120 C72 65, 152 65, 152 120"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d="M76 120 C76 71, 148 71, 148 120"
                      fill="none"
                      stroke="#ec4899"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <rect
                      x="58"
                      y="108"
                      width="22"
                      height="36"
                      rx="10"
                      fill="#ec4899"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <rect
                      x="144"
                      y="108"
                      width="22"
                      height="36"
                      rx="10"
                      fill="#22d3ee"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />

                    <g transform="translate(185, 62) rotate(-8)">
                      <rect
                        x="0"
                        y="18"
                        width="165"
                        height="82"
                        rx="38"
                        fill="url(#genLimePad)"
                        stroke="#0b1116"
                        strokeWidth="4"
                      />
                      <rect x="36" y="43" width="12" height="32" rx="3" fill="#0b1116" />
                      <rect x="26" y="53" width="32" height="12" rx="3" fill="#0b1116" />
                      <circle cx="122" cy="48" r="7" fill="#ec4899" stroke="#0b1116" strokeWidth="2" />
                      <circle cx="138" cy="60" r="7" fill="#22d3ee" stroke="#0b1116" strokeWidth="2" />
                      <circle cx="106" cy="60" r="7" fill="#fbbf24" stroke="#0b1116" strokeWidth="2" />
                      <circle cx="122" cy="72" r="7" fill="#ffffff" stroke="#0b1116" strokeWidth="2" />
                    </g>
                  </svg>
                  <div className="grid grid-cols-4 h-2" aria-hidden="true">
                    <div className="bg-lime-400" />
                    <div className="bg-pink-500" />
                    <div className="bg-amber-400" />
                    <div className="bg-cyan-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* אזור העבודה המרכזי — אשף 7 השלבים (ימין) + תצוגה ועריכה (שמאל)        */}
      {/* ===================================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* עמודה ימנית: אשף 7 השלבים עם עומס כפתורים נקי וממוקד בכל שלב */}
        <section className="lg:col-span-7 space-y-4">
          <div className="bg-[#101b22] border-2 border-slate-800 rounded-3xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm font-black text-cyan-300">
                התקדמות בבניית המשחק
              </span>
              <span className="px-3 py-1 rounded-xl bg-lime-400/15 text-lime-300 border border-lime-400/50 text-xs font-black tabular-nums">
                שלב {wizard.currentStep} מתוך 7
              </span>
            </div>
            <div
              role="tablist"
              aria-label="שלבי בניית המשחק"
              className="grid grid-cols-7 gap-1.5 sm:gap-2"
            >
              {STEP_META.map((step) => {
                const isActive = step.num === wizard.currentStep;
                const isDone = step.num < wizard.currentStep;
                return (
                  <button
                    key={step.num}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => updateField('currentStep', step.num)}
                    className={`py-2 px-1 rounded-xl border font-black text-xs transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isActive
                        ? 'bg-lime-400 text-slate-950 border-lime-400 scale-[1.03] shadow-[0_0_12px_rgba(163,230,53,0.4)]'
                        : isDone
                          ? 'bg-cyan-400/15 text-cyan-300 border-cyan-400 hover:bg-cyan-400/25'
                          : 'bg-[#0b1116] text-slate-400 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <span className="tabular-nums">{step.num}</span>
                    <span className="text-[10px] hidden sm:inline font-bold">
                      {step.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#101b22] border-2 border-lime-400/70 rounded-3xl p-5 sm:p-6 shadow-[0_0_25px_rgba(163,230,53,0.1)]">
            <div className="border-b border-slate-800 pb-3 mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-lime-300">
                  {activeStepMeta.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  {activeStepMeta.subtitle}
                </p>
              </div>
              {wizard.currentStep === 1 && (
                <button
                  type="button"
                  onClick={() => setShowStep1Ideas((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-xs font-bold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{showStep1Ideas ? 'הסתר השראה' : 'צריכים השראה?'}</span>
                </button>
              )}
            </div>

            {wizard.currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="gen-game-name"
                    className="block text-xs font-black text-cyan-300 mb-1.5"
                  >
                    שם המשחק
                  </label>
                  <input
                    id="gen-game-name"
                    type="text"
                    value={wizard.gameName}
                    onChange={(e) => updateField('gameName', e.target.value)}
                    placeholder="למשל: הרפתקאות החתול המעופף"
                    className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-lime-400 text-white text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-game-summary"
                    className="block text-xs font-black text-cyan-300 mb-1.5"
                  >
                    מה עושים במשחק? (ב-1–2 משפטים)
                  </label>
                  <textarea
                    id="gen-game-summary"
                    rows={3}
                    value={wizard.gameSummary}
                    onChange={(e) => updateField('gameSummary', e.target.value)}
                    placeholder="למשל: השחקן שולט באסטרונאוט שקופץ בין כוכבים, אוסף יהלומים ומתחמק ממטאורים."
                    className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-lime-400 text-white text-sm outline-none"
                  />
                </div>

                {showStep1Ideas && (
                  <div className="p-3 rounded-2xl bg-[#0b1116] border border-slate-800 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-300 font-bold">
                      בחרו רעיון התחלתי:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        updateField(
                          'gameSummary',
                          'משחק פלטפורמה שבו קופצים מעל מכשולים ואוספים כוכבים זוהרים.'
                        );
                        setShowStep1Ideas(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-bold cursor-pointer"
                    >
                      איסוף כוכבים
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateField(
                          'gameSummary',
                          'משחק מרוצים מהיר שבו מתחמקים ממכשולים ומגיעים לקו הסיום לפני שהזמן נגמר.'
                        );
                        setShowStep1Ideas(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-bold cursor-pointer"
                    >
                      מרוץ נגד הזמן
                    </button>
                  </div>
                )}
              </div>
            )}

            {wizard.currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateField('isRealWorldBased', 'yes')}
                    className={`p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                      wizard.isRealWorldBased === 'yes'
                        ? 'border-lime-400 bg-lime-400/15 text-white'
                        : 'border-slate-800 bg-[#0b1116] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-black text-sm">כן, מבוסס על משחק אמיתי</div>
                    <div className="text-[11px] mt-1">למשל: תופסת, מחבואים, כדורגל, דמקה</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('isRealWorldBased', 'no')}
                    className={`p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                      wizard.isRealWorldBased === 'no'
                        ? 'border-cyan-400 bg-cyan-400/15 text-white'
                        : 'border-slate-800 bg-[#0b1116] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-black text-sm">לא, המצאה מקורית שלנו</div>
                    <div className="text-[11px] mt-1">עולם וחוקים שהמצאנו מאפס</div>
                  </button>
                </div>

                {wizard.isRealWorldBased === 'yes' ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label
                        htmlFor="gen-real-world-game"
                        className="block text-xs font-black text-cyan-300 mb-1"
                      >
                        איזה משחק מהעולם האמיתי?
                      </label>
                      <input
                        id="gen-real-world-game"
                        type="text"
                        value={wizard.realWorldGame}
                        onChange={(e) => updateField('realWorldGame', e.target.value)}
                        placeholder="למשל: תופסת / מחבואים / כדורגל / קלאס"
                        className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-lime-400 text-white text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="gen-digital-twist"
                        className="block text-xs font-black text-cyan-300 mb-1"
                      >
                        איזה שדרוג דיגיטלי הוספתם לו?
                      </label>
                      <input
                        id="gen-digital-twist"
                        type="text"
                        value={wizard.digitalTwist}
                        onChange={(e) => updateField('digitalTwist', e.target.value)}
                        placeholder="למשל: כוח-על להיעלמות ל-3 שניות, שערים זזים ובונוסים"
                        className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-lime-400 text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-[#0b1116] border border-slate-800 text-xs text-slate-300">
                    מעולה! המשחק ייבנה כרעיון מקורי ומיוחד שהמצאתם בעצמכם.
                  </div>
                )}
              </div>
            )}

            {wizard.currentStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateField('dimension', '2D')}
                    className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                      wizard.dimension === '2D'
                        ? 'border-lime-400 bg-lime-400/15 text-white'
                        : 'border-slate-800 bg-[#0b1116] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-lg font-black text-lime-300">2D דו-ממד</div>
                    <div className="text-xs mt-1">מסך שטוח וקלאסי (כמו מריו או פק-מן)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('dimension', '3D')}
                    className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                      wizard.dimension === '3D'
                        ? 'border-pink-500 bg-pink-500/15 text-white'
                        : 'border-slate-800 bg-[#0b1116] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-lg font-black text-pink-400">3D תלת-ממד</div>
                    <div className="text-xs mt-1">עולם עם עומק ומרחב (כמו מיינקראפט או רובלוקס)</div>
                  </button>
                </div>

                <div>
                  <span className="block text-xs font-black text-cyan-300 mb-1.5">
                    מאיזו זווית רואים את המשחק?
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {CAMERA_VIEWS.map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => updateField('cameraView', view)}
                        className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                          wizard.cameraView === view
                            ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
                            : 'border-slate-800 bg-[#0b1116] text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {wizard.currentStep === 4 && (
              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="gen-win-condition"
                    className="block text-xs font-black text-lime-300 mb-1"
                  >
                    איך מנצחים במשחק?
                  </label>
                  <input
                    id="gen-win-condition"
                    type="text"
                    value={wizard.winCondition}
                    onChange={(e) => updateField('winCondition', e.target.value)}
                    placeholder="למשל: אוספים 15 כוכבים או מגיעים לדגל בסוף השלב"
                    className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-lime-400 text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-conflict-obstacle"
                    className="block text-xs font-black text-pink-400 mb-1"
                  >
                    מהו הקונפליקט (האויב, המכשול או הזמן)?
                  </label>
                  <input
                    id="gen-conflict-obstacle"
                    type="text"
                    value={wizard.conflictObstacle}
                    onChange={(e) => updateField('conflictObstacle', e.target.value)}
                    placeholder="למשל: רובוטים שרודפים אחרי השחקן, בורות לבה וטיימר של 60 שניות"
                    className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-pink-400 text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-lose-condition"
                    className="block text-xs font-black text-amber-300 mb-1"
                  >
                    מתי נפסלים?
                  </label>
                  <input
                    id="gen-lose-condition"
                    type="text"
                    value={wizard.loseCondition}
                    onChange={(e) => updateField('loseCondition', e.target.value)}
                    placeholder="למשל: כשנגמרים כל 3 הלבבות או כשהזמן מגיע לאפס"
                    className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-amber-300 text-white text-sm outline-none"
                  />
                </div>
              </div>
            )}

            {wizard.currentStep === 5 && (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="gen-easy-level"
                    className="block text-xs font-black text-lime-300 mb-1"
                  >
                    רמה קלה
                  </label>
                  <input
                    id="gen-easy-level"
                    type="text"
                    value={wizard.easyLevel}
                    onChange={(e) => updateField('easyLevel', e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-lime-400 text-white text-xs sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-medium-level"
                    className="block text-xs font-black text-amber-300 mb-1"
                  >
                    רמה בינונית
                  </label>
                  <input
                    id="gen-medium-level"
                    type="text"
                    value={wizard.mediumLevel}
                    onChange={(e) => updateField('mediumLevel', e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-amber-300 text-white text-xs sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="gen-hard-level"
                    className="block text-xs font-black text-pink-400 mb-1"
                  >
                    רמה קשה
                  </label>
                  <input
                    id="gen-hard-level"
                    type="text"
                    value={wizard.hardLevel}
                    onChange={(e) => updateField('hardLevel', e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-pink-400 text-white text-xs sm:text-sm outline-none"
                  />
                </div>
              </div>
            )}

            {wizard.currentStep === 6 && (
              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-black text-cyan-300 mb-1.5">
                    סגנון חזותי
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ART_STYLES.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => updateField('artStyle', style)}
                        className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                          wizard.artStyle === style
                            ? 'border-pink-500 bg-pink-500/20 text-white'
                            : 'border-slate-800 bg-[#0b1116] text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="gen-character-bg"
                    className="block text-xs font-black text-cyan-300 mb-1.5"
                  >
                    איך נראית הדמות הראשית ומה רואים ברקע?
                  </label>
                  <textarea
                    id="gen-character-bg"
                    rows={3}
                    value={wizard.characterAndBg}
                    onChange={(e) => updateField('characterAndBg', e.target.value)}
                    placeholder="למשל: הדמות היא רובוט כחול עם גלימה צהובה, והרקע הוא עיר עתידנית בלילה עם כוכבים."
                    className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-lime-400 text-white text-sm outline-none"
                  />
                </div>
              </div>
            )}

            {wizard.currentStep === 7 && (
              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="gen-controls"
                    className="block text-xs font-black text-cyan-300 mb-1"
                  >
                    מקשי השליטה במשחק
                  </label>
                  <input
                    id="gen-controls"
                    type="text"
                    value={wizard.controls}
                    onChange={(e) => updateField('controls', e.target.value)}
                    placeholder="למשל: חצים ימינה/שמאלה לתזוזה, רווח לקפיצה"
                    className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-cyan-400 text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor="gen-tutorial-text"
                      className="text-xs font-black text-lime-300"
                    >
                      טקסט למסך ההדרכה (Tutorial)
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateTutorial}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-lime-400/20 hover:bg-lime-400/30 text-lime-300 text-[11px] font-black cursor-pointer"
                    >
                      <Wand2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>נסח לי הדרכה אוטומטית</span>
                    </button>
                  </div>
                  <textarea
                    id="gen-tutorial-text"
                    rows={3}
                    value={wizard.tutorialText}
                    onChange={(e) => updateField('tutorialText', e.target.value)}
                    placeholder="כתבו 2 משפטים קצרים שמסבירים לחבר איך לשחק..."
                    className="w-full p-3 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-lime-400 text-white text-sm outline-none"
                  />
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={wizard.currentStep <= 1}
                onClick={() =>
                  updateField('currentStep', Math.max(1, wizard.currentStep - 1))
                }
                className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-3 rounded-2xl bg-[#0b1116] hover:bg-slate-800 text-slate-200 border border-slate-700 font-extrabold text-xs sm:text-sm transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>לשלב הקודם</span>
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex items-center gap-1.5 px-5 sm:px-7 py-3 rounded-2xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_18px_rgba(163,230,53,0.3)] transition-all active:scale-95 cursor-pointer"
              >
                <span>
                  {wizard.currentStep >= 7 ? 'סיימתי! פתח חלון סיום ושמירה' : 'לשלב הבא'}
                </span>
                {wizard.currentStep < 7 ? (
                  <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* חלון הגשה לפורטל מופיע כאן במיוחד בשלב הסיום כדי להפחית עומס בשלבים 1–6 */}
          {wizard.currentStep === 7 && (
            <div className="rounded-2xl bg-slate-900 border-2 border-cyan-400/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-slate-200">
                <strong className="text-cyan-300 font-black">
                  סיימתם לבנות והטמעתם ב-Google Sites?
                </strong>{' '}
                הגישו את המשחק לפורטל בית הספר!
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onOpenSubmit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>הגשת משחק לפורטל</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenCatalog}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600 cursor-pointer"
                >
                  <span>דף האתרים</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* עמודה שמאלית: סימולטור מסכים חי + תיבת הפרומפט (עם כפתור הגדלת חלון עריכה ופחות עומס) */}
        <aside className="lg:col-span-5 space-y-5">
          {/* כרטיס 1: סימולטור מסכים חי */}
          <div className="bg-[#101b22] border-2 border-cyan-400 rounded-3xl p-4 sm:p-5 shadow-[0_0_22px_rgba(34,211,238,0.14)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm sm:text-base font-black text-cyan-300 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>תצוגה מקדימה של מסכי המשחק</span>
              </h3>

              <div
                role="tablist"
                aria-label="לשוניות סימולטור מסכי המשחק"
                className="flex bg-[#0b1116] p-1 rounded-xl border border-slate-800 text-[11px] font-extrabold"
              >
                {(
                  [
                    { id: 'menu', label: 'תפריט' },
                    { id: 'tutorial', label: 'הדרכה' },
                    { id: 'pause', label: 'השהיה' },
                  ] as Array<{ id: GameSimulatorTab; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={wizard.simulatorTab === tab.id}
                    onClick={() => updateField('simulatorTab', tab.id)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      wizard.simulatorTab === tab.id
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-slate-700 bg-[#0b1116] p-4 min-h-[210px] flex flex-col justify-between relative overflow-hidden">
              {wizard.simulatorTab === 'menu' && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                      {wizard.dimension} · {wizard.cameraView}
                    </span>
                    <span>{wizard.artStyle}</span>
                  </div>
                  <div className="text-center my-3 space-y-2">
                    <div className="text-xl sm:text-2xl font-black text-lime-300">
                      {simGameTitle}
                    </div>
                    <div className="flex justify-center gap-1.5 text-[11px] font-bold text-slate-300">
                      <span>קל</span>
                      <span aria-hidden="true">·</span>
                      <span>בינוני</span>
                      <span aria-hidden="true">·</span>
                      <span>קשה</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="py-2 rounded-xl bg-lime-400 text-slate-950 text-center font-black text-xs inline-flex items-center justify-center gap-1">
                      <Play className="w-3 h-3 fill-slate-950" aria-hidden="true" />
                      <span>התחל משחק</span>
                    </div>
                    <div className="py-2 rounded-xl bg-slate-800 text-white text-center font-bold text-xs inline-flex items-center justify-center gap-1">
                      <BookOpen className="w-3 h-3" aria-hidden="true" />
                      <span>איך משחקים?</span>
                    </div>
                  </div>
                </>
              )}

              {wizard.simulatorTab === 'tutorial' && (
                <>
                  <div className="text-xs font-black text-cyan-300 inline-flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>הדרכה למשחק: {simGameTitle}</span>
                  </div>
                  <div className="my-2 p-3 rounded-xl bg-[#101b22] border border-slate-800 text-xs text-slate-200 leading-relaxed">
                    <p>
                      {wizard.tutorialText.trim() ||
                        `שולטים בדמות בעזרת ${wizard.controls || 'מקשי החצים'} כדי לנצח!`}
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-amber-300 font-bold">
                      מקשים: {wizard.controls || 'מקשי החצים'}
                    </div>
                  </div>
                  <div className="py-2 rounded-xl bg-cyan-400 text-slate-950 text-center font-black text-xs">
                    הבנתי, בואו נשחק!
                  </div>
                </>
              )}

              {wizard.simulatorTab === 'pause' && (
                <>
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-lime-300 tabular-nums">ניקוד: 120</span>
                    <span className="text-pink-400" aria-label="3 לבבות חיים">
                      ♥♥♥
                    </span>
                  </div>
                  <div className="my-2 p-3 rounded-2xl bg-[#101b22]/95 border-2 border-amber-400 text-center space-y-2">
                    <div className="text-sm font-black text-amber-300 inline-flex items-center justify-center gap-1.5">
                      <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>המשחק מושהה</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px] font-black">
                      <div className="py-1.5 rounded-lg bg-lime-400 text-slate-950">המשך</div>
                      <div className="py-1.5 rounded-lg bg-cyan-400 text-slate-950">התחל מחדש</div>
                      <div className="py-1.5 rounded-lg bg-slate-800 text-white">תפריט</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-center text-slate-400">
                    לחיצה על Esc או P עוצרת וממשיכה את המשחק
                  </div>
                </>
              )}
            </div>
          </div>

          {/* כרטיס 2: הפרומפט המוכן + כפתור הגדלת חלון עריכה + כפתורי פעולה נקיים */}
          <div className="bg-[#101b22] border-2 border-lime-400 rounded-3xl p-4 sm:p-5 shadow-[0_0_22px_rgba(163,230,53,0.14)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="space-y-0.5">
                <h3 className="text-sm sm:text-base font-black text-lime-300">
                  הפרומפט המוכן (עריכה ידנית)
                </h3>
                <div className="text-[11px] text-slate-400">
                  {isManualEdited ? (
                    <span className="text-amber-300 font-bold">
                      מצב עריכה ידנית פעיל
                    </span>
                  ) : (
                    <span>מסונכרן אוטומטית עם 7 השלבים</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExpandedEditorOpen(true)}
                className="min-h-9 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow transition-all cursor-pointer shrink-0"
              >
                <Maximize2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>הגדל חלון עריכה</span>
              </button>
            </div>

            {activeLoadedPrompt && (
              <div className="mb-2.5 px-3 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/40 text-xs text-cyan-200 flex items-center justify-between gap-2">
                <span className="truncate">
                  עורך כעת: <strong>{activeLoadedPrompt.promptName}</strong>
                </span>
                <button
                  type="button"
                  disabled={isSavingAction}
                  onClick={() => void handleOverwriteFromGenerator(activeLoadedPrompt)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-400 text-slate-950 font-black hover:bg-cyan-300 cursor-pointer shrink-0 text-[11px]"
                >
                  שמור עדכון בפרומפט
                </button>
              </div>
            )}

            <label htmlFor="final-prompt-output" className="sr-only">
              תוכן הפרומפט (אפשר לערוך ידנית)
            </label>
            <textarea
              id="final-prompt-output"
              ref={promptTextareaRef}
              rows={11}
              value={effectivePromptText}
              onChange={(e) => handleManualPromptChange(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-cyan-400 text-slate-100 text-xs sm:text-sm leading-relaxed focus:outline-none resize-y"
            />

            {/* כפתורים עיקריים נקיים ללא עומס (3 פעולות ברורות + חלון פעולות נוספות) */}
            <div className="mt-4 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleCopyPrompt()}
                  className="min-h-11 py-2.5 px-3 rounded-2xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_16px_rgba(163,230,53,0.3)] transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {copiedJustNow ? (
                    <>
                      <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>הועתק!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>העתק פרומפט</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => openLibraryModal('save-current')}
                  className="min-h-11 py-2.5 px-3 rounded-2xl bg-gradient-to-l from-pink-500 to-amber-500 hover:opacity-95 text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>שמור בספרייה</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="w-full min-h-10 py-2 px-3 rounded-xl bg-[#0b1116] hover:bg-slate-800 text-cyan-300 border border-slate-700 hover:border-cyan-400 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>עוד פעולות: הורדה, טעינה ל-7 השלבים ובניית המשחק</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ===================================================================== */}
      {/* חלון התחברות בחזית מעל חלון הדפדפן וכל החלונות הפתוחים (z-[100])      */}
      {/* ===================================================================== */}
      {isAuthDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-signin-topmost-title"
          className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="bg-[#101b22] border-2 border-cyan-400 rounded-3xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(34,211,238,0.35)] space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-400 text-slate-950 border-2 border-white shadow-[4px_4px_0px_#ec4899] flex items-center justify-center">
              {isSigningIn ? (
                <RefreshCw className="w-8 h-8 animate-spin" aria-hidden="true" />
              ) : authDialogError ? (
                <AlertTriangle className="w-8 h-8 text-rose-700" aria-hidden="true" />
              ) : (
                <LogIn className="w-8 h-8" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3
                id="google-signin-topmost-title"
                className="text-xl font-black text-white"
              >
                {isSigningIn
                  ? 'חלון ההתחברות של Google נפתח בחזית'
                  : authDialogError
                    ? 'השלמת ההתחברות לחשבון Google'
                    : 'התחברות לחשבון Google הארגוני'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {authDialogError
                  ? authDialogError
                  : 'אם חלון Google מוסתר מאחורי חלון הדפדפן או נדחה, לחצו על הכפתור למטה כדי להעלות אותו בחזית מעל חלון הדפדפן.'}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => void handleTriggerGoogleSignIn()}
                className="w-full min-h-12 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-sm border-2 border-slate-950 shadow-[3px_3px_0px_#06b6d4] cursor-pointer"
              >
                <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {isSigningIn
                    ? 'העלה חלון התחברות לחזית / פתח מחדש'
                    : 'פתח חלון התחברות Google בחזית'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAuthDialogOpen(false);
                  setAuthDialogError(null);
                }}
                className="w-full min-h-10 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                סגירת חלון זה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* חלון עריכת פרומפט ידני מוגדל ומרווח                                   */}
      {/* ===================================================================== */}
      {isExpandedEditorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="expanded-prompt-editor-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsExpandedEditorOpen(false);
          }}
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
        >
          <div className="bg-[#101b22] border-2 border-lime-400 rounded-3xl max-w-5xl w-full h-[88vh] p-5 sm:p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3
                  id="expanded-prompt-editor-title"
                  className="text-lg sm:text-2xl font-black text-lime-300 flex items-center gap-2"
                >
                  <Pencil className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>עורך פרומפט ידני מוגדל</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5 tabular-nums">
                  {isManualEdited ? 'מצב עריכה ידנית פעיל' : 'מסונכרן חי מהאשף'} ·{' '}
                  {promptLineCount} שורות · {effectivePromptText.length} תווים
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isManualEdited && (
                  <button
                    type="button"
                    onClick={handleResetToWizardAuto}
                    className="min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>סנכרן חזרה מהאשף</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    loadTextIntoSevenSteps(effectivePromptText, wizard.gameName)
                  }
                  className="min-h-9 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>טען טקסט זה ל-7 השלבים</span>
                </button>

                <button
                  type="button"
                  aria-label="סגירת העורך המוגדל"
                  onClick={() => setIsExpandedEditorOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <label htmlFor="expanded-manual-prompt-textarea" className="sr-only">
              עריכת טקסט הפרומפט בחלון מוגדל
            </label>
            <textarea
              id="expanded-manual-prompt-textarea"
              ref={expandedTextareaRef}
              value={effectivePromptText}
              onChange={(e) => handleManualPromptChange(e.target.value)}
              className="flex-1 w-full p-4 sm:p-5 rounded-2xl bg-[#0b1116] border-2 border-slate-700 focus:border-cyan-400 text-slate-100 text-sm sm:text-base leading-relaxed focus:outline-none resize-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyPrompt()}
                  className="min-h-10 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                >
                  <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>העתק פרומפט</span>
                </button>

                <button
                  type="button"
                  onClick={() => openLibraryModal('save-current')}
                  className="min-h-10 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black text-xs sm:text-sm cursor-pointer"
                >
                  <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>שמור בספרייה</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTxt()}
                  className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-600 font-bold text-xs sm:text-sm cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>הורד כקובץ TXT</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsExpandedEditorOpen(false)}
                className="min-h-10 px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
              >
                סיום וחזרה למחולל
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* חלון אפשרויות אשף (דוגמה ואיפוס — נפתח רק כשמבקשים כדי לא להעמיס)     */}
      {/* ===================================================================== */}
      {isWizardToolsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wizard-tools-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsWizardToolsOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#101b22] border-2 border-cyan-400 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <h3 id="wizard-tools-title" className="text-lg font-black text-cyan-300">
                אפשרויות אשף 7 השלבים
              </h3>
              <button
                type="button"
                aria-label="סגירת אפשרויות אשף"
                onClick={() => setIsWizardToolsOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleFillDemoExample}
                className="w-full p-3.5 rounded-2xl bg-lime-400/15 hover:bg-lime-400/25 border border-lime-400/60 text-right flex items-center gap-3 cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-lime-300 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-sm font-black text-lime-300">מלא דוגמה: תופסת בחלל</div>
                  <div className="text-xs text-slate-300">
                    ממלא אוטומטית את כל 7 השלבים בדוגמה מוכנה ללמידה
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleResetWizard}
                className="w-full p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-right flex items-center gap-3 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-sm font-black text-white">התחל מחדש (נקה שדות)</div>
                  <div className="text-xs text-slate-400">
                    מאפס את כל 7 השלבים ואת העריכה הידנית
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsWizardToolsOpen(false);
                  onOpenCatalog();
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-right flex items-center gap-3 cursor-pointer"
              >
                <Gamepad2 className="w-5 h-5 text-cyan-300 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-sm font-black text-white">מעבר לדף האתרים והמשחקים</div>
                  <div className="text-xs text-slate-400">
                    צפייה במשחקים ובאתרים שיצרו תלמידי בית הספר
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* חלון פעולות וייצוא (נפתח מהכפתור המשני בתיבת הפרומפט)                  */}
      {/* ===================================================================== */}
      {isExportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-actions-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsExportModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#101b22] border-2 border-lime-400 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <h3 id="export-actions-modal-title" className="text-lg font-black text-lime-300">
                פעולות, ייצוא ובניית המשחק
              </h3>
              <button
                type="button"
                aria-label="סגירת חלון פעולות"
                onClick={() => setIsExportModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  handleDownloadTxt();
                  setIsExportModalOpen(false);
                }}
                className="w-full min-h-11 px-4 py-2.5 rounded-2xl bg-[#0b1116] hover:bg-slate-800 text-cyan-300 border border-cyan-400/60 font-black text-sm flex items-center justify-between cursor-pointer"
              >
                <span>הורדת הפרומפט כקובץ TXT למחשב</span>
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() =>
                  loadTextIntoSevenSteps(effectivePromptText, wizard.gameName)
                }
                className="w-full min-h-11 px-4 py-2.5 rounded-2xl bg-[#0b1116] hover:bg-slate-800 text-amber-300 border border-amber-400/60 font-black text-sm flex items-center justify-between cursor-pointer"
              >
                <span>פענוח וטעינת הפרומפט לתוך 7 השלבים</span>
                <Wand2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              {isManualEdited && (
                <button
                  type="button"
                  onClick={() => {
                    handleResetToWizardAuto();
                    setIsExportModalOpen(false);
                  }}
                  className="w-full min-h-11 px-4 py-2.5 rounded-2xl bg-[#0b1116] hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-sm flex items-center justify-between cursor-pointer"
                >
                  <span>ביטול עריכה ידנית וסנכרון מהאשף</span>
                  <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              )}

              <a
                href={GAME_GENERATOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-11 px-4 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm flex items-center justify-between"
              >
                <span>פתיחת כלי בניית המשחקים של בית הספר</span>
                <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setIsExportModalOpen(false);
                  onOpenSubmit();
                }}
                className="w-full min-h-11 px-4 py-2.5 rounded-2xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-sm flex items-center justify-between cursor-pointer"
              >
                <span>הגשת משחק מוכן לפורטל חנה סנש</span>
                <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* חלון סיום שלב 7 (נפתח בלחיצה על "סיימתי!" עם כל הצעדים הבאים)         */}
      {/* ===================================================================== */}
      {isCompletionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCompletionModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#101b22] border-2 border-lime-400 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-[0_0_40px_rgba(163,230,53,0.3)] space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3
                  id="completion-modal-title"
                  className="text-xl sm:text-2xl font-black text-lime-300 flex items-center gap-2"
                >
                  <Sparkles className="w-6 h-6 shrink-0" aria-hidden="true" />
                  <span>כל הכבוד! הפרומפט שלכם מוכן</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  בחרו איך תרצו להמשיך עם המשחק &quot;{simGameTitle}&quot;:
                </p>
              </div>
              <button
                type="button"
                aria-label="סגירת חלון סיום"
                onClick={() => setIsCompletionModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <pre className="p-3.5 rounded-2xl bg-[#0b1116] border border-slate-700 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
              {effectivePromptText}
            </pre>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void handleCopyPrompt()}
                className="min-h-11 px-4 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>העתק פרומפט למחולל</span>
              </button>

              <button
                type="button"
                onClick={() => openLibraryModal('save-current')}
                className="min-h-11 px-4 py-2.5 rounded-xl bg-gradient-to-l from-pink-500 to-amber-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>שמור בספרייה שלי</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCompletionModalOpen(false);
                  setIsExpandedEditorOpen(true);
                }}
                className="min-h-11 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-400/50 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>פתח עורך ידני מוגדל</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadTxt()}
                className="min-h-11 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>הורד כקובץ TXT</span>
              </button>
            </div>

            <a
              href={GAME_GENERATOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-11 px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2"
            >
              <span>פתח את כלי בניית המשחקים של בית הספר</span>
              <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* מודאל הספרייה שלי: שמירה, טעינה ל-7 השלבים, עריכה, מחיקה, סטטוס וקישור */}
      {/* ===================================================================== */}
      {isLibraryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-library-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsLibraryOpen(false);
              setPendingDeleteId(null);
              setEditingCardId(null);
            }
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-[#101b22] border-2 border-lime-400 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-7 h-7" aria-hidden="true" />
                </div>
                <div>
                  <h3
                    id="prompt-library-title"
                    className="text-lg sm:text-xl font-black text-lime-300"
                  >
                    הספרייה שלי — פרומפטים, סטטוס הפקה וקישורים לאתרים
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isCloudUser
                      ? `מחובר לענן (${userEmail}) — כל שמירה, טעינה, סטטוס וקישור נשמרים ב-Firestore.`
                      : 'מצב אורח מקומי (נשמר בדפדפן). התחברו עם Google לשמירה בענן וצפיית המורה.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="סגירת הספרייה"
                onClick={() => {
                  setIsLibraryOpen(false);
                  setPendingDeleteId(null);
                  setEditingCardId(null);
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {!isCloudUser && isFirebaseConfigured && (
              <div className="rounded-2xl bg-amber-400/15 border border-amber-400/60 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100">
                <span>
                  כדי לשמור בענן ושגם המורה/המנהל יראו את הפרומפטים שלך, התחברו עם Google.
                </span>
                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={() => void handleTriggerGoogleSignIn()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isSigningIn ? 'מתחבר...' : 'התחבר עם Google בחזית'}</span>
                </button>
              </div>
            )}

            {isCloudUser && localPrompts.length > 0 && (
              <div className="rounded-2xl bg-cyan-400/10 border border-cyan-400/50 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-cyan-200">
                <span>
                  נמצאו <strong>{localPrompts.length}</strong> פרומפטים מקומיים מהמכשיר שטרם הועברו לענן.
                </span>
                <button
                  type="button"
                  disabled={isSavingAction}
                  onClick={() => void handleMigrateLocalToCloud()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black cursor-pointer shrink-0"
                >
                  <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>העבר פרומפטים לענן</span>
                </button>
              </div>
            )}

            {libraryAlert && (
              <div
                role={libraryAlert.type === 'error' ? 'alert' : 'status'}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
                  libraryAlert.type === 'error'
                    ? 'bg-rose-950/80 border-rose-500 text-rose-100'
                    : 'bg-emerald-950/80 border-emerald-500 text-emerald-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {libraryAlert.type === 'error' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
                  )}
                  <span>{libraryAlert.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLibraryAlert(null)}
                  className="p-1 hover:bg-white/10 rounded cursor-pointer"
                  aria-label="סגירת התראה"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* לשוניות פעולה עליונות: שמירת הפרומפט מהמחולל או טעינת פרומפט לספרייה / ל-7 השלבים */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLibraryActionTab('save-current')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                  libraryActionTab === 'save-current'
                    ? 'bg-lime-400 text-slate-950 border-lime-400'
                    : 'bg-[#0b1116] text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>שמירת הפרומפט הנוכחי מהמחולל</span>
              </button>
              <button
                type="button"
                onClick={() => setLibraryActionTab('import-prompt')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                  libraryActionTab === 'import-prompt'
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'bg-[#0b1116] text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>טעינת פרומפט לספרייה / ל-7 השלבים</span>
              </button>
            </div>

            {libraryActionTab === 'save-current' ? (
              <form
                onSubmit={handleSaveCurrentPrompt}
                className="bg-[#0b1116] border-2 border-lime-400/50 rounded-2xl p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="library-prompt-name"
                      className="block text-[11px] font-black text-slate-300 mb-1"
                    >
                      שם הפרומפט
                    </label>
                    <input
                      id="library-prompt-name"
                      type="text"
                      value={libraryPromptName}
                      onChange={(e) => setLibraryPromptName(e.target.value)}
                      placeholder="הזן שם לפרומפט..."
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 focus:border-lime-400 text-white text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="library-creator-first-name"
                      className="block text-[11px] font-black text-slate-300 mb-1"
                    >
                      שם פרטי (ללא שם משפחה)
                    </label>
                    <input
                      id="library-creator-first-name"
                      type="text"
                      value={creatorFirstName}
                      onChange={(e) => setCreatorFirstName(e.target.value)}
                      placeholder="למשל: נועם"
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 focus:border-lime-400 text-white text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="library-creator-class"
                      className="block text-[11px] font-black text-slate-300 mb-1"
                    >
                      כיתה
                    </label>
                    <input
                      id="library-creator-class"
                      type="text"
                      value={creatorClassName}
                      onChange={(e) => setCreatorClassName(e.target.value)}
                      placeholder="ה׳2"
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 focus:border-lime-400 text-white text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[11px] font-black text-slate-300 mb-1">
                      סטטוס
                    </span>
                    <select
                      aria-label="סטטוס הפרומפט"
                      value={saveProductionStatus}
                      onChange={(e) =>
                        setSaveProductionStatus(e.target.value as PromptProductionStatus)
                      }
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 text-white text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="ממתין">ממתין</option>
                      <option value="הופק">הופק</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-8">
                    <label
                      htmlFor="library-save-site-url"
                      className="block text-[11px] font-black text-slate-300 mb-1"
                    >
                      קישור לאתר שנוצר (אופציונלי — אפשר להוסיף גם מאוחר יותר)
                    </label>
                    <input
                      id="library-save-site-url"
                      type="url"
                      dir="ltr"
                      value={saveSiteUrl}
                      onChange={(e) => setSaveSiteUrl(e.target.value)}
                      placeholder="https://sites.google.com/..."
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 focus:border-cyan-400 text-white text-xs font-mono outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingAction}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-xs shadow-[0_0_14px_rgba(163,230,53,0.3)] transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{isSavingAction ? 'שומר...' : 'שמור כפרומפט חדש'}</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleSubmitImportPrompt}
                className="bg-[#0b1116] border-2 border-pink-500/60 rounded-2xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-pink-300">
                    טעינת פרומפט מוכן (.txt או הדבקה) לספרייה או ישר לתוך 7 השלבים
                  </span>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleImportTxtFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-400/60 text-xs font-black cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>בחירת קובץ .txt מהמחשב</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="import-prompt-name"
                      className="block text-[11px] font-black text-slate-300 mb-1"
                    >
                      שם הפרומפט *
                    </label>
                    <input
                      id="import-prompt-name"
                      type="text"
                      required
                      value={importPromptName}
                      onChange={(e) => setImportPromptName(e.target.value)}
                      placeholder="שם המשחק או הפרומפט"
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 focus:border-pink-400 text-white text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="import-class-name"
                      className="block text-[11px] font-black text-slate-300 mb-1"
                    >
                      כיתה
                    </label>
                    <input
                      id="import-class-name"
                      type="text"
                      value={importClassName}
                      onChange={(e) => setImportClassName(e.target.value)}
                      placeholder="ה׳2"
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 text-white text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="import-status"
                      className="block text-[11px] font-black text-slate-300 mb-1"
                    >
                      סטטוס
                    </label>
                    <select
                      id="import-status"
                      value={importStatus}
                      onChange={(e) =>
                        setImportStatus(e.target.value as PromptProductionStatus)
                      }
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 text-white text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="ממתין">ממתין</option>
                      <option value="הופק">הופק</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="import-site-url"
                      className="block text-[11px] font-black text-slate-300 mb-1"
                    >
                      קישור לאתר שנוצר
                    </label>
                    <input
                      id="import-site-url"
                      type="url"
                      dir="ltr"
                      value={importSiteUrl}
                      onChange={(e) => setImportSiteUrl(e.target.value)}
                      placeholder="https://sites.google.com/..."
                      className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 text-white text-xs font-mono outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="import-prompt-text"
                    className="block text-[11px] font-black text-slate-300 mb-1"
                  >
                    תוכן הפרומפט *
                  </label>
                  <textarea
                    id="import-prompt-text"
                    rows={4}
                    required
                    value={importPromptText}
                    onChange={(e) => setImportPromptText(e.target.value)}
                    placeholder="הדביקו כאן טקסט של פרומפט או העלו קובץ .txt למעלה..."
                    className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 focus:border-pink-400 text-white text-xs leading-relaxed outline-none"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={!importPromptText.trim()}
                    onClick={() =>
                      loadTextIntoSevenSteps(importPromptText, importPromptName)
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>טען מיד לחלונות 7 השלבים</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingAction}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-black text-xs transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isSavingAction ? 'טוען...' : 'טען ושמור בספרייה'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* כותרת וחיפוש בספרייה */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-cyan-300">
                  הפרומפטים השמורים שלי
                </h4>
                <span className="text-xs font-black text-slate-300 tabular-nums">
                  ({filteredMyPrompts.length} / {myPrompts.length})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="חיפוש בספרייה שלי"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="חיפוש לפי שם או קישור..."
                    className="ps-8 pe-3 py-1.5 rounded-xl bg-[#0b1116] border border-slate-700 text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex bg-[#0b1116] p-0.5 rounded-xl border border-slate-700 text-[11px] font-bold">
                  {(['הכל', 'ממתין', 'הופק'] as const).map((statusTab) => (
                    <button
                      key={statusTab}
                      type="button"
                      onClick={() => setLibraryStatusFilter(statusTab)}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                        libraryStatusFilter === statusTab
                          ? 'bg-cyan-400 text-slate-950 font-black'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {statusTab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 min-h-[180px] pe-1">
              {isCloudLoading && myPrompts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  טוען את הפרומפטים שלך מ-Firestore...
                </div>
              ) : filteredMyPrompts.length === 0 ? (
                <div className="text-center py-8 rounded-2xl bg-[#0b1116] border border-slate-800 text-slate-400 text-xs sm:text-sm">
                  {myPrompts.length === 0
                    ? 'עדיין לא נשמרו פרומפטים בספרייה. שמרו את הפרומפט הנוכחי או טענו קובץ למעלה!'
                    : 'לא נמצאו פרומפטים התואמים לחיפוש או לסטטוס שנבחר.'}
                </div>
              ) : (
                filteredMyPrompts.map((item) => {
                  const title = item.promptName || item.gameName || 'ללא שם';
                  const isConfirmingDelete = pendingDeleteId === item.id;
                  const isEditingThis = editingCardId === item.id;
                  const isMoreOpen = expandedMoreActionsId === item.id;
                  const siteDraft = siteUrlDrafts[item.id] ?? item.createdSiteUrl;
                  const isSiteDraftDirty =
                    siteUrlDrafts[item.id] !== undefined &&
                    siteUrlDrafts[item.id].trim() !== item.createdSiteUrl;

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[#0b1116] border border-slate-800 hover:border-cyan-400/40 transition-all space-y-3"
                    >
                      {isEditingThis ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            <div className="sm:col-span-5">
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                שם הפרומפט
                              </label>
                              <input
                                type="text"
                                value={editCardName}
                                onChange={(e) => setEditCardName(e.target.value)}
                                className="w-full p-2 rounded-xl bg-[#101b22] border border-slate-700 text-xs font-bold text-white"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                כיתה
                              </label>
                              <input
                                type="text"
                                value={editCardClass}
                                onChange={(e) => setEditCardClass(e.target.value)}
                                className="w-full p-2 rounded-xl bg-[#101b22] border border-slate-700 text-xs font-bold text-white"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                סטטוס הפקה
                              </label>
                              <select
                                value={editCardStatus}
                                onChange={(e) =>
                                  setEditCardStatus(e.target.value as PromptProductionStatus)
                                }
                                className="w-full p-2 rounded-xl bg-[#101b22] border border-slate-700 text-xs font-bold text-white"
                              >
                                <option value="ממתין">ממתין</option>
                                <option value="הופק">הופק</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">
                              קישור לאתר שנוצר
                            </label>
                            <input
                              type="url"
                              dir="ltr"
                              value={editCardSiteUrl}
                              onChange={(e) => setEditCardSiteUrl(e.target.value)}
                              placeholder="https://sites.google.com/..."
                              className="w-full p-2 rounded-xl bg-[#101b22] border border-slate-700 text-xs font-mono text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1">
                              טקסט הפרומפט (עריכה ידנית)
                            </label>
                            <textarea
                              rows={6}
                              value={editCardText}
                              onChange={(e) => setEditCardText(e.target.value)}
                              className="w-full p-2.5 rounded-xl bg-[#101b22] border border-slate-700 text-xs text-slate-100 leading-relaxed"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingCardId(null)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                            >
                              ביטול
                            </button>
                            <button
                              type="button"
                              disabled={isSavingAction}
                              onClick={() => void handleSaveInlineEdit(item)}
                              className="px-4 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-slate-950 text-xs font-black cursor-pointer"
                            >
                              שמור שינויים
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="font-black text-sm sm:text-base text-lime-300">
                                {title}
                              </div>
                              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
                                <span>יוצר/ת: {item.creatorFirstName}</span>
                                <span aria-hidden="true">·</span>
                                <span>כיתה {item.className}</span>
                                <span aria-hidden="true">·</span>
                                <span>{formatHebrewDate(item.updatedAt || item.createdAt)}</span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 text-slate-300 font-bold">
                                  {item.storageScope === 'cloud' ? (
                                    <>
                                      <Cloud className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                                      <span>בענן</span>
                                    </>
                                  ) : (
                                    <>
                                      <HardDrive className="w-3 h-3 text-amber-300" aria-hidden="true" />
                                      <span>במכשיר</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* סימון סטטוס הפקה: ממתין / הופק */}
                            <div
                              role="group"
                              aria-label={`סטטוס הפקה עבור ${title}`}
                              className="inline-flex bg-[#101b22] p-1 rounded-xl border border-slate-700 text-[11px] font-black shrink-0"
                            >
                              <button
                                type="button"
                                disabled={isSavingAction}
                                onClick={() => void handleTogglePromptStatus(item, 'ממתין')}
                                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                  item.productionStatus === 'ממתין'
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                ממתין
                              </button>
                              <button
                                type="button"
                                disabled={isSavingAction}
                                onClick={() => void handleTogglePromptStatus(item, 'הופק')}
                                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                  item.productionStatus === 'הופק'
                                    ? 'bg-emerald-400 text-slate-950'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                הופק
                              </button>
                            </div>
                          </div>

                          {/* שדה להוספת / עריכת קישור לאתר שנוצר */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#101b22] border border-slate-800 rounded-xl p-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300 shrink-0">
                              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>קישור לאתר שנוצר:</span>
                            </div>
                            <input
                              type="url"
                              dir="ltr"
                              aria-label={`קישור לאתר שנוצר עבור ${title}`}
                              value={siteDraft}
                              onChange={(e) =>
                                setSiteUrlDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="הדביקו כאן קישור https://sites.google.com/..."
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0b1116] border border-slate-700 focus:border-cyan-400 text-xs font-mono text-white outline-none"
                            />
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={isSavingAction}
                                onClick={() => void handleSaveCardSiteUrl(item)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                                  isSiteDraftDirty
                                    ? 'bg-lime-400 text-slate-950 hover:bg-lime-300'
                                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                }`}
                              >
                                שמור קישור
                              </button>
                              {item.createdSiteUrl && (
                                <a
                                  href={item.createdSiteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-300 border border-cyan-400/50 text-xs font-black"
                                >
                                  <span>פתח אתר</span>
                                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </div>

                          {/* שורת פעולות נקייה ללא עומס: 2 פעולות עיקריות + תפריט עוד פעולות */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleLoadPromptToGenerator(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs cursor-pointer"
                              >
                                <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>טען ל-7 השלבים</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleStartInlineEdit(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-bold text-xs cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" aria-hidden="true" />
                                <span>עריכה</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedMoreActionsId(isMoreOpen ? null : item.id)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold cursor-pointer"
                            >
                              <span>פעולות נוספות</span>
                              {isMoreOpen ? (
                                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                          </div>

                          {isMoreOpen && (
                            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isSavingAction}
                                  onClick={() => void handleOverwriteFromGenerator(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/50 font-black text-xs cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                                  <span>עדכן מהמחולל</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleCopyPrompt(item.promptText)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" aria-hidden="true" />
                                  <span>העתק</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadTxt(item.promptText, title)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-lime-300 border border-lime-400/40 font-black text-xs cursor-pointer"
                                >
                                  <Download className="w-3 h-3" aria-hidden="true" />
                                  <span>הורד TXT</span>
                                </button>
                              </div>

                              {isConfirmingDelete ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={isSavingAction}
                                    onClick={() => void handleConfirmDeletePrompt(item)}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer"
                                  >
                                    אישור מחיקה
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPendingDeleteId(null)}
                                    className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                                  >
                                    ביטול
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteId(item.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border border-pink-500/60 font-black text-xs cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                                  <span>מחק פרומפט</span>
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* מודאל כל הפרומפטים למנהל / מורשים (גישה מלאה לכל פרומפטים התלמידים)   */}
      {/* ===================================================================== */}
      {isAllPromptsOpen && isAdminOrEditor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="all-prompts-admin-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAllPromptsOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        >
          <div className="bg-[#101b22] border-2 border-amber-400 rounded-3xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3
                  id="all-prompts-admin-title"
                  className="text-lg sm:text-xl font-black text-amber-300 flex items-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>מאגר כל הפרומפטים של התלמידים (תצוגת מנהל/מורשים)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  כל הפרומפטים שנשמרו בענן על ידי תלמידי בית הספר, כולל סטטוס הפקה וקישור לאתר שנוצר.
                </p>
              </div>
              <button
                type="button"
                aria-label="סגירת מאגר כל הפרומפטים"
                onClick={() => setIsAllPromptsOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search
                  className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="חיפוש לפי שם משחק, פרומפט, תלמיד, כיתה או אימייל..."
                  className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#0b1116] border border-slate-700 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex bg-[#0b1116] p-1 rounded-xl border border-slate-700 text-xs font-bold">
                {(['הכל', 'ממתין', 'הופק'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setAdminStatusFilter(tab)}
                    className={`px-3 py-1 rounded-lg cursor-pointer ${
                      adminStatusFilter === tab
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 min-h-[200px] pe-1">
              {filteredAdminPrompts.length === 0 ? (
                <div className="text-center py-10 rounded-2xl bg-[#0b1116] border border-slate-800 text-slate-400 text-sm">
                  לא נמצאו פרומפטים תואמים במסד הנתונים.
                </div>
              ) : (
                filteredAdminPrompts.map((item) => {
                  const isExpanded = expandedAdminPromptId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[#0b1116] border border-slate-800 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-sm text-lime-300">
                              {item.promptName}
                            </span>
                            <span
                              className={`text-xs font-black ${
                                item.productionStatus === 'הופק'
                                  ? 'text-emerald-300'
                                  : 'text-amber-300'
                              }`}
                            >
                              · {item.productionStatus}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300">
                            {item.creatorFirstName} (כיתה {item.className})
                            {item.ownerEmail && (
                              <span className="text-slate-400 font-mono ms-2" dir="ltr">
                                {item.ownerEmail}
                              </span>
                            )}
                            {' · '}
                            {formatHebrewDate(item.updatedAt || item.createdAt)}
                          </div>
                          {item.createdSiteUrl && (
                            <a
                              href={item.createdSiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              dir="ltr"
                              className="inline-flex items-center gap-1 text-xs font-mono text-cyan-300 hover:underline"
                            >
                              <span>{item.createdSiteUrl}</span>
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAdminPromptId(isExpanded ? null : item.id)
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                          >
                            {isExpanded ? 'הסתר תוכן' : 'צפה בפרומפט'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadPromptToGenerator(item)}
                            className="px-2.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black cursor-pointer"
                          >
                            טען ל-7 השלבים
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyPrompt(item.promptText)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-lime-300 text-xs font-bold cursor-pointer"
                          >
                            העתק
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadTxt(item.promptText, item.promptName)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold cursor-pointer"
                          >
                            הורד
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <pre className="p-3 rounded-xl bg-[#101b22] border border-slate-700 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                          {item.promptText}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
