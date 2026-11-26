import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
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
  MonitorPlay,
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

  const [wizard, setWizard] = useState<GamePromptWizardState>(() =>
    createDefaultWizardState()
  );
  const [isManualEdited, setIsManualEdited] = useState(false);
  const [manualPromptText, setManualPromptText] = useState('');
  const [activeLoadedPromptId, setActiveLoadedPromptId] = useState<string | null>(null);

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

  // עדכון שם פרטי אוטומטי מהמשתמש המחובר
  useEffect(() => {
    const first = extractFirstNameFromUser(user);
    if (first && !creatorFirstName) {
      setCreatorFirstName(first);
    }
  }, [user, creatorFirstName]);

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
    if (!isLibraryOpen && !isAllPromptsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLibraryOpen(false);
        setIsAllPromptsOpen(false);
        setPendingDeleteId(null);
        setEditingCardId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLibraryOpen, isAllPromptsOpen]);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3400);
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

  // איחוד רשימת הפרומפטים של המשתמש (בענן + מקומיים שנוצרו כאורח)
  const myPrompts = useMemo(() => {
    return isCloudUser ? cloudPrompts : localPrompts;
  }, [isCloudUser, cloudPrompts, localPrompts]);

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
    launchConfetti();
    showToast('דוגמת "תופסת בחלל" מולאה בהצלחה!');
  };

  const handleResetWizard = () => {
    setWizard(createDefaultWizardState());
    setIsManualEdited(false);
    setManualPromptText('');
    setActiveLoadedPromptId(null);
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
        text: `הקובץ "${file.name}" נטען לטופס! בדקו את הפרטים ולחצו על "טען ושמור בספרייה".`,
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
      const scope = await createPromptRecord({
        promptName: promptTitle,
        gameName: promptTitle,
        creatorFirstName: creatorFirstName.trim() || 'תלמיד',
        className: importClassName.trim() || creatorClassName.trim() || 'כללי',
        promptText: importPromptText,
        productionStatus: importStatus,
        createdSiteUrl: importSiteUrl,
        isManualEdited: true,
      });

      setImportPromptName('');
      setImportPromptText('');
      setImportSiteUrl('');
      setImportStatus('ממתין');
      setLibraryAlert({
        type: 'success',
        text:
          scope === 'cloud'
            ? `הפרומפט "${promptTitle}" נטען ונשמר בהצלחה בספריית הענן שלך!`
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
      await updatePromptRecord(item, {
        promptName: editCardName,
        className: editCardClass,
        productionStatus: editCardStatus,
        createdSiteUrl: editCardSiteUrl,
        promptText: editCardText,
        isManualEdited: editCardText.trim() !== item.promptText.trim() ? true : item.isManualEdited,
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

  const handleLoadPromptToGenerator = (item: SavedGamePromptItem) => {
    if (item.wizardState) {
      setWizard({ ...createDefaultWizardState(), ...item.wizardState });
      const wizardBuilt = buildFinalPromptText({
        ...createDefaultWizardState(),
        ...item.wizardState,
      });
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
      setWizard({
        ...createDefaultWizardState(),
        gameName: item.gameName || item.promptName,
      });
      setIsManualEdited(true);
      setManualPromptText(item.promptText);
    }

    setActiveLoadedPromptId(item.storageScope === 'cloud' || !isCloudUser ? item.id : null);
    setIsLibraryOpen(false);
    setIsAllPromptsOpen(false);
    setPendingDeleteId(null);
    showToast(`הפרומפט "${item.promptName || item.gameName}" נטען לעריכה במחולל!`);
  };

  const handleNextStep = () => {
    if (wizard.currentStep < 7) {
      updateField('currentStep', wizard.currentStep + 1);
    } else {
      launchConfetti();
      showToast('כל הכבוד! הפרומפט שלכם מוכן להעתקה, עריכה, הורדה או שמירה!');
    }
  };

  const activeLoadedPrompt = useMemo(
    () => myPrompts.find((p) => p.id === activeLoadedPromptId) || null,
    [myPrompts, activeLoadedPromptId]
  );

  const simGameTitle = wizard.gameName.trim() || 'המשחק המגניב שלי';

  return (
    <div className="bg-dark-wall text-slate-100 min-h-[calc(100vh-4rem)] pb-14">
      <canvas
        ref={confettiCanvasRef}
        aria-hidden="true"
        className="fixed inset-0 w-screen h-screen pointer-events-none z-50"
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-950 border-2 border-lime-400 shadow-[0_0_24px_rgba(163,230,53,0.35)] flex items-center gap-2.5 text-sm font-black text-white"
        >
          <Sparkles className="w-4 h-4 text-lime-400 shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* סרגל כלים ובאנר פתיחה של מחולל המשחקים */}
      <section className="border-b-4 border-slate-950 bg-slate-950/75">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8 space-y-6">
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
              <button
                type="button"
                onClick={handleFillDemoExample}
                className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-lime-400/15 hover:bg-lime-400/25 text-lime-300 border border-lime-400/50 font-black text-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>מלא דוגמה (תופסת בחלל)</span>
              </button>

              <button
                type="button"
                onClick={handleResetWizard}
                className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>התחל מחדש</span>
              </button>

              <button
                type="button"
                onClick={() => openLibraryModal('save-current')}
                className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-400/15 hover:bg-cyan-400/25 text-cyan-300 border border-cyan-400 font-black text-xs transition-all cursor-pointer tabular-nums"
              >
                <FolderOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>הספרייה שלי ({myPrompts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => openLibraryModal('import-prompt')}
                className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500 font-black text-xs transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>טעינת פרומפט לספרייה</span>
              </button>

              {isAdminOrEditor && (
                <button
                  type="button"
                  onClick={() => setIsAllPromptsOpen(true)}
                  className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-white font-black text-xs transition-all cursor-pointer tabular-nums"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>כל הפרומפטים ({allAdminPrompts.length})</span>
                </button>
              )}

              {isCloudUser ? (
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-400/60 font-bold text-xs transition-all cursor-pointer"
                  title="מחובר לשמירה בענן — לחצו להתנתקות"
                >
                  <Cloud className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{creatorFirstName || 'מחובר בענן'}</span>
                  <LogOut className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSigningIn || !isFirebaseConfigured}
                  onClick={() => void onSignIn()}
                  className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs shadow transition-all cursor-pointer disabled:opacity-60"
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{isSigningIn ? 'מתחבר...' : 'התחבר עם Google לשמירה בענן'}</span>
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

          <div className="bg-[#101b22]/95 border-2 border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="minecraft-title text-3xl sm:text-5xl leading-tight tracking-tight">
                    מחולל המשחקים
                  </h1>
                  <span className="inline-block px-3.5 py-1.5 rounded-xl border-2 border-white bg-amber-400 text-slate-950 font-display text-sm sm:text-base font-black shadow-[4px_4px_0px_#ec4899] -rotate-2">
                    כיתות א׳–ו׳
                  </span>
                </div>

                <p className="text-cyan-300 font-extrabold text-base sm:text-lg leading-snug">
                  מתכננים משחק משלכם ב-7 שלבים פשוטים, עורכים ידנית אם רוצים, ושומרים בספרייה האישית!
                </p>

                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
                  ענו על השאלות שלב אחר שלב או טענו פרומפט קיים לספרייה. לכל פרומפט ניתן לסמן סטטוס (<strong>ממתין</strong> / <strong>הופק</strong>) ולהוסיף את קישור האתר שנוצר.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-2xl bg-[#0b1116] border-2 border-pink-500 p-3.5 flex items-start gap-3 shadow-[0_0_20px_rgba(236,72,153,0.14)]">
                    <div className="w-10 h-10 rounded-xl bg-pink-500 text-white flex items-center justify-center shrink-0">
                      <Wand2 className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-white">אשף + עריכה ידנית</h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        בונים ב-7 שלבים ועורכים חופשי כל שורה בפרומפט.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#0b1116] border-2 border-cyan-400 p-3.5 flex items-start gap-3 shadow-[0_0_20px_rgba(34,211,238,0.14)]">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0">
                      <MonitorPlay className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-white">ספרייה אישית בענן</h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        שמירה, טעינה, סימון &quot;הופק/ממתין&quot; וקישור לאתר שנוצר.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* איור שלט ארקייד ניאון */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="w-full max-w-sm rounded-3xl border-2 border-pink-500 bg-[#0b1116] overflow-hidden shadow-[0_0_30px_rgba(236,72,153,0.25)]">
                  <svg
                    viewBox="0 0 420 230"
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
                    <rect width="420" height="230" fill="url(#genBgWall)" />
                    <circle cx="95" cy="90" r="65" fill="#22d3ee" opacity="0.18" />
                    <circle cx="310" cy="115" r="75" fill="#ec4899" opacity="0.2" />
                    <circle cx="215" cy="65" r="55" fill="#a8f01d" opacity="0.16" />

                    <rect x="35" y="28" width="18" height="18" rx="3" fill="#22d3ee" />
                    <rect x="58" y="42" width="14" height="14" rx="3" fill="#fbbf24" />
                    <rect x="355" y="32" width="20" height="20" rx="4" fill="#a8f01d" />
                    <rect x="332" y="54" width="14" height="14" rx="3" fill="#ec4899" />
                    <rect x="42" y="168" width="22" height="22" rx="4" fill="#ec4899" />
                    <rect x="358" y="165" width="24" height="24" rx="4" fill="#22d3ee" />

                    <path
                      d="M72 125 C72 68, 152 68, 152 125"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d="M76 125 C76 74, 148 74, 148 125"
                      fill="none"
                      stroke="#ec4899"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <rect
                      x="58"
                      y="112"
                      width="22"
                      height="38"
                      rx="10"
                      fill="#ec4899"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <rect
                      x="144"
                      y="112"
                      width="22"
                      height="38"
                      rx="10"
                      fill="#22d3ee"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />

                    <g transform="translate(185, 68) rotate(-8)">
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
                      <rect
                        x="10"
                        y="24"
                        width="145"
                        height="68"
                        rx="32"
                        fill="none"
                        stroke="#ecfccb"
                        strokeWidth="2"
                        opacity="0.7"
                      />
                      <rect x="36" y="43" width="12" height="32" rx="3" fill="#0b1116" />
                      <rect x="26" y="53" width="32" height="12" rx="3" fill="#0b1116" />
                      <circle cx="122" cy="48" r="7" fill="#ec4899" stroke="#0b1116" strokeWidth="2" />
                      <circle cx="138" cy="60" r="7" fill="#22d3ee" stroke="#0b1116" strokeWidth="2" />
                      <circle cx="106" cy="60" r="7" fill="#fbbf24" stroke="#0b1116" strokeWidth="2" />
                      <circle cx="122" cy="72" r="7" fill="#ffffff" stroke="#0b1116" strokeWidth="2" />
                      <circle cx="68" cy="74" r="10" fill="#1e293b" stroke="#0b1116" strokeWidth="2.5" />
                      <circle cx="96" cy="74" r="10" fill="#1e293b" stroke="#0b1116" strokeWidth="2.5" />
                    </g>

                    <polygon
                      points="205,22 211,36 226,38 215,48 218,63 205,55 192,63 195,48 184,38 199,36"
                      fill="#fbbf24"
                    />
                  </svg>
                  <div className="grid grid-cols-4 h-2.5" aria-hidden="true">
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

      {/* אזור העבודה המרכזי */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* עמודה ימנית: אשף 7 השלבים */}
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
            <div className="border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-lg sm:text-xl font-black text-lime-300">
                {activeStepMeta.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                {activeStepMeta.subtitle}
              </p>
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-bold">
                    רעיונות מהירים:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateField(
                        'gameSummary',
                        'משחק פלטפורמה שבו קופצים מעל מכשולים ואוספים כוכבים זוהרים.'
                      )
                    }
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    איסוף כוכבים
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateField(
                        'gameSummary',
                        'משחק מרוצים מהיר שבו מתחמקים ממכשולים ומגיעים לקו הסיום לפני שהזמן נגמר.'
                      )
                    }
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    מרוץ נגד הזמן
                  </button>
                </div>
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
                  {wizard.currentStep >= 7 ? 'סיימתי! הפעל חגיגה' : 'לשלב הבא'}
                </span>
                {wizard.currentStep < 7 ? (
                  <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border-2 border-cyan-400/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-slate-200">
              <strong className="text-cyan-300 font-black">
                בניתם משחק בעזרת הפרומפט והטמעתם ב-Google Sites?
              </strong>{' '}
              הגישו אותו לפורטל כדי שכל בית הספר יוכל לשחק!
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
                <span>לדף האתרים והמשחקים</span>
              </button>
            </div>
          </div>
        </section>

        {/* עמודה שמאלית: סימולטור מסכים חי + תיבת הפרומפט לעריכה ידנית והעתקה */}
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

            <div className="rounded-2xl border-2 border-slate-700 bg-[#0b1116] p-4 min-h-[215px] flex flex-col justify-between relative overflow-hidden">
              {wizard.simulatorTab === 'menu' && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                      {wizard.dimension} • {wizard.cameraView}
                    </span>
                    <span>{wizard.artStyle}</span>
                  </div>
                  <div className="text-center my-3 space-y-2">
                    <div className="text-xl sm:text-2xl font-black text-lime-300">
                      {simGameTitle}
                    </div>
                    <div className="flex justify-center gap-1.5 text-[11px] font-bold">
                      <span className="px-2 py-0.5 rounded-lg bg-lime-400/20 text-lime-300">
                        קל
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
                        בינוני
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
                        קשה
                      </span>
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

          {/* כרטיס 2: תיבת הפרומפט הסופי — ניתנת לעריכה ידנית! */}
          <div className="bg-[#101b22] border-2 border-lime-400 rounded-3xl p-4 sm:p-5 shadow-[0_0_22px_rgba(163,230,53,0.14)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm sm:text-base font-black text-lime-300">
                הפרומפט המוכן (ניתן לעריכה ידנית)
              </h3>
              <div className="flex items-center gap-1.5">
                {isManualEdited ? (
                  <>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/50 text-[11px] font-black">
                      <Pencil className="w-3 h-3" aria-hidden="true" />
                      <span>נערך ידנית</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToWizardAuto}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold cursor-pointer"
                      title="חזרה לטקסט האוטומטי מתוך 7 שלבי האשף"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" />
                      <span>סנכרן מהאשף</span>
                    </button>
                  </>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-lg bg-lime-400/15 text-lime-300 text-[11px] font-black">
                    סנכרון חי מהאשף
                  </span>
                )}
              </div>
            </div>

            {activeLoadedPrompt && (
              <div className="mb-2 px-3 py-1.5 rounded-xl bg-cyan-400/10 border border-cyan-400/40 text-[11px] text-cyan-200 flex items-center justify-between gap-2">
                <span>
                  עורך כעת את: <strong>{activeLoadedPrompt.promptName}</strong>
                </span>
                <button
                  type="button"
                  disabled={isSavingAction}
                  onClick={() => void handleOverwriteFromGenerator(activeLoadedPrompt)}
                  className="px-2 py-0.5 rounded-lg bg-cyan-400 text-slate-950 font-black hover:bg-cyan-300 cursor-pointer shrink-0"
                >
                  שמור שינויים בפרומפט
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
              className="w-full p-3.5 rounded-2xl bg-[#0b1116] border border-slate-700 focus:border-cyan-400 text-slate-100 text-xs leading-relaxed focus:outline-none resize-y"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              אפשר ללחוץ ישירות בתוך התיבה ולערוך ידנית כל משפט בפרומפט.
            </p>

            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => openLibraryModal('save-current')}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-l from-pink-500 to-amber-500 hover:opacity-95 text-white font-black text-sm sm:text-base shadow-[0_0_18px_rgba(236,72,153,0.3)] transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {isCloudUser
                    ? 'שמור בספרייה שלי (בענן)'
                    : 'שמור בספרייה שלי'}
                </span>
              </button>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleCopyPrompt()}
                  className="flex-1 py-3 px-4 rounded-2xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-sm shadow-[0_0_18px_rgba(163,230,53,0.35)] transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  {copiedJustNow ? (
                    <>
                      <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>הפרומפט הועתק!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>העתק פרומפט למחולל</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTxt()}
                  className="py-3 px-4 rounded-2xl bg-[#0b1116] hover:bg-slate-800 text-cyan-300 border-2 border-cyan-400 font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>הורד כקובץ</span>
                </button>
              </div>

              <a
                href={GAME_GENERATOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-[#0b1116] hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>העתיקו את הפרומפט ופתחו את כלי בניית המשחקים של בית הספר</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </aside>
      </div>

      {/* ===================================================================== */}
      {/* מודאל הספרייה שלי: שמירה, טעינה, עריכה, מחיקה, סטטוס וקישור לאתר   */}
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
              <div>
                <h3
                  id="prompt-library-title"
                  className="text-lg sm:text-xl font-black text-lime-300 flex items-center gap-2"
                >
                  <FolderOpen className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>הספרייה שלי — פרומפטים, סטטוס הפקה וקישורים לאתרים</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isCloudUser
                    ? 'הספרייה מחוברת לענן: כל שמירה, עריכה, סימון סטטוס וקישור נשמרים אוטומטית ב-Firestore.'
                    : 'מצב אורח (נשמר בדפדפן). התחברו עם Google לשמירה קבועה בענן וצפיית המורה.'}
                </p>
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
              <div className="rounded-2xl bg-amber-400/10 border border-amber-400/50 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
                <span>
                  כדי שגם המורה/המנהל יוכלו לראות את הפרומפטים שלך ושיישמרו מכל מחשב, התחברו עם Google.
                </span>
                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={() => void onSignIn()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isSigningIn ? 'מתחבר...' : 'התחברות עם Google'}</span>
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

            {/* לשוניות פעולה עליונות: שמירת הפרומפט מהמחולל או טעינת פרומפט לספרייה */}
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
                <span>טעינת פרומפט לספרייה (.txt או הדבקה)</span>
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
                    טעינת פרומפט מוכן לספרייה שלך (מקובץ .txt או הדבקת טקסט)
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

                <div className="flex justify-end">
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
                <span className="px-2.5 py-0.5 rounded-lg bg-cyan-400/15 text-cyan-300 text-[11px] font-black tabular-nums">
                  {filteredMyPrompts.length} / {myPrompts.length}
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
                  const siteDraft = siteUrlDrafts[item.id] ?? item.createdSiteUrl;
                  const isSiteDraftDirty =
                    (siteUrlDrafts[item.id] !== undefined &&
                      siteUrlDrafts[item.id].trim() !== item.createdSiteUrl) ||
                    false;

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
                              rows={5}
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
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-sm sm:text-base text-lime-300">
                                  {title}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                    item.storageScope === 'cloud'
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                      : 'bg-slate-800 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  {item.storageScope === 'cloud' ? (
                                    <>
                                      <Cloud className="w-3 h-3" aria-hidden="true" />
                                      <span>בענן</span>
                                    </>
                                  ) : (
                                    <>
                                      <HardDrive className="w-3 h-3" aria-hidden="true" />
                                      <span>במכשיר</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                יוצר/ת: {item.creatorFirstName} • כיתה {item.className} •{' '}
                                {formatHebrewDate(item.updatedAt || item.createdAt)}
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

                          {/* כפתורי פעולה על הפרומפט */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleLoadPromptToGenerator(item)}
                                className="px-2.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs cursor-pointer"
                              >
                                פתח במחולל
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartInlineEdit(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-bold text-xs cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" aria-hidden="true" />
                                <span>עריכה</span>
                              </button>
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
                                <span>הורד</span>
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
                                <span>מחק</span>
                              </button>
                            )}
                          </div>
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
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                                item.productionStatus === 'הופק'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-400/20 text-amber-300'
                              }`}
                            >
                              {item.productionStatus}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300">
                            {item.creatorFirstName} (כיתה {item.className})
                            {item.ownerEmail && (
                              <span className="text-slate-400 font-mono ms-2" dir="ltr">
                                {item.ownerEmail}
                              </span>
                            )}
                            {' • '}
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
                            טען למחולל
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
