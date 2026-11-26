import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Info,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getActiveFirebaseSecretConfig } from '../services/firebaseApp';
import {
  addEditorToFirestore,
  checkEditorAuthorization,
  createSiteInFirestore,
  deleteGamePromptInFirestore,
  deleteSiteInFirestore,
  ensureSuperAdminBootstrapped,
  fetchAllPromptsForAdmin,
  fetchAllSitesForAdmin,
  fetchEditorsForAdmin,
  removeEditorFromFirestore,
  updateGamePromptInFirestore,
  updateSiteInFirestore,
  upsertImportedSitesToFirestore,
} from '../services/firestorePortal';
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from '../services/googleAuth';
import {
  AuthorizedEditor,
  PromptProductionStatus,
  SavedGamePromptItem,
  SiteTag,
  StudentSiteItem,
  TagFilter,
} from '../types/portal';
import {
  exportSitesToCSV,
  inspectGoogleSiteUrl,
  normalizeHttpUrl,
  normalizeTags,
  parseCSV,
  parseCreatorsList,
  SITE_TAGS,
} from '../utils/portalUtils';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isSigningIn: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  isDestructive?: boolean;
  execute: () => Promise<void>;
}

interface SiteFormState {
  title: string;
  creatorsText: string;
  creatorNote: string;
  grade: string;
  tags: SiteTag[];
  isFeatured: boolean;
  description: string;
  siteUrl: string;
  imageUrl: string;
  status: string;
}

const EMPTY_SITE_FORM: SiteFormState = {
  title: '',
  creatorsText: '',
  creatorNote: '',
  grade: "ג'-ד'",
  tags: ['חקר'],
  isFeatured: false,
  description: '',
  siteUrl: '',
  imageUrl: '',
  status: 'מאושר',
};

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({
  isOpen,
  onClose,
  user,
  isSigningIn,
  onSignIn,
  onSignOut,
}) => {
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'sites' | 'prompts' | 'editors' | 'deploy'>('sites');
  const [statusFilter, setStatusFilter] = useState<'הכל' | 'ממתין' | 'מאושר' | 'נדחה'>('הכל');
  const [tagFilter, setTagFilter] = useState<TagFilter>('הכל');
  const [onlyFeatured, setOnlyFeatured] = useState<boolean>(false);
  const [adminSites, setAdminSites] = useState<StudentSiteItem[]>([]);
  const [adminPrompts, setAdminPrompts] = useState<SavedGamePromptItem[]>([]);
  const [promptSearch, setPromptSearch] = useState<string>('');
  const [promptStatusFilter, setPromptStatusFilter] = useState<'הכל' | PromptProductionStatus>('הכל');
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [promptUrlDrafts, setPromptUrlDrafts] = useState<Record<string, string>>({});
  const [editors, setEditors] = useState<AuthorizedEditor[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const [newEditorEmail, setNewEditorEmail] = useState('');
  const [showSecretJson, setShowSecretJson] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [showSiteForm, setShowSiteForm] = useState(false);
  const [editingSite, setEditingSite] = useState<StudentSiteItem | null>(null);
  const [siteForm, setSiteForm] = useState<SiteFormState>(EMPTY_SITE_FORM);

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const userEmail = (user?.email || '').trim().toLowerCase();
  const isSuperAdmin = Boolean(user?.emailVerified && isSuperAdminEmail(userEmail));

  const loadConsoleData = async () => {
    if (!user?.email) {
      setIsAuthorized(false);
      setAdminSites([]);
      setAdminPrompts([]);
      setEditors([]);
      return;
    }

    setIsCheckingAuth(true);
    setIsLoadingData(true);
    try {
      if (isSuperAdmin) {
        await ensureSuperAdminBootstrapped(user.email);
      }

      const allowed = isSuperAdmin || (await checkEditorAuthorization(user.email));
      setIsAuthorized(allowed);

      if (!allowed) {
        setAdminSites([]);
        setAdminPrompts([]);
        setEditors([]);
        return;
      }

      const [sitesList, editorsList, promptsList] = await Promise.all([
        fetchAllSitesForAdmin(),
        isSuperAdmin
          ? fetchEditorsForAdmin()
          : Promise.resolve<AuthorizedEditor[]>([
              {
                email: SUPER_ADMIN_EMAIL,
                role: 'super_admin',
                addedBy: 'system',
                addedAt: '',
              },
              {
                email: userEmail,
                role: 'editor',
                addedBy: SUPER_ADMIN_EMAIL,
                addedAt: '',
              },
            ]),
        fetchAllPromptsForAdmin(),
      ]);

      setAdminSites(sitesList);
      setEditors(editorsList);
      setAdminPrompts(promptsList);
      setPromptUrlDrafts((prev) => {
        const next: Record<string, string> = {};
        for (const p of promptsList) {
          next[p.id] = prev[p.id] !== undefined ? prev[p.id] : p.createdSiteUrl || '';
        }
        return next;
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error && !err.message.startsWith('{')
            ? `לא ניתן לטעון את נתוני הניהול: ${err.message}`
            : 'לא ניתן לטעון את נתוני הניהול. ודאו שחשבון Google שלכם מאומת ומורשה.',
      });
    } finally {
      setIsCheckingAuth(false);
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      void loadConsoleData();
    }
  }, [isOpen, user?.uid]);

  useEffect(() => {
    if (!isOpen) {
      setShowSecretJson(false);
      setCopiedSecret(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingConfirm) {
          setPendingConfirm(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, pendingConfirm, onClose]);

  const activeFirebaseSecretConfig = useMemo(
    () => (isAuthorized ? getActiveFirebaseSecretConfig() : null),
    [isAuthorized]
  );

  const firebaseSecretJson = useMemo(() => {
    if (!activeFirebaseSecretConfig) return '';
    return JSON.stringify(activeFirebaseSecretConfig, null, 2);
  }, [activeFirebaseSecretConfig]);

  const maskedFirebaseSecretJson = useMemo(() => {
    if (!activeFirebaseSecretConfig) return '';
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(activeFirebaseSecretConfig)) {
      masked[k] = typeof v === 'string' && v.length > 6 ? `${v.slice(0, 4)}••••••••${v.slice(-3)}` : '••••••••';
    }
    return JSON.stringify(masked, null, 2);
  }, [activeFirebaseSecretConfig]);

  const handleCopyFirebaseSecret = async () => {
    if (!firebaseSecretJson) return;
    try {
      await navigator.clipboard.writeText(firebaseSecretJson);
      setCopiedSecret(true);
      setStatusMessage({
        type: 'success',
        text: 'הגדרות FIREBASE_APPLET_CONFIG הועתקו ללוח. הדביקו אותן ב-GitHub Secrets.',
      });
      window.setTimeout(() => setCopiedSecret(false), 2500);
    } catch {
      setShowSecretJson(true);
      setStatusMessage({
        type: 'error',
        text: 'לא ניתן להעתיק אוטומטית בדפדפן זה. הציגו את ההגדרה והעתיקו ידנית.',
      });
    }
  };

  const counts = useMemo(() => {
    return {
      all: adminSites.length,
      pending: adminSites.filter((s) => s.status === 'ממתין').length,
      approved: adminSites.filter((s) => s.status === 'מאושר').length,
      rejected: adminSites.filter((s) => s.status === 'נדחה').length,
      featured: adminSites.filter((s) => s.isFeatured).length,
    };
  }, [adminSites]);

  const filteredAdminSites = useMemo(() => {
    return adminSites.filter((s) => {
      const matchesStatus = statusFilter === 'הכל' || s.status === statusFilter;
      const matchesTag = tagFilter === 'הכל' || (s.tags || []).includes(tagFilter);
      const matchesFeatured = !onlyFeatured || s.isFeatured;
      return matchesStatus && matchesTag && matchesFeatured;
    });
  }, [adminSites, statusFilter, tagFilter, onlyFeatured]);

  const promptCounts = useMemo(() => {
    return {
      all: adminPrompts.length,
      waiting: adminPrompts.filter((p) => p.productionStatus === 'ממתין').length,
      produced: adminPrompts.filter((p) => p.productionStatus === 'הופק').length,
    };
  }, [adminPrompts]);

  const filteredAdminPrompts = useMemo(() => {
    const q = promptSearch.trim().toLowerCase();
    return adminPrompts.filter((p) => {
      const matchesStatus =
        promptStatusFilter === 'הכל' || p.productionStatus === promptStatusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        p.promptName.toLowerCase().includes(q) ||
        p.gameName.toLowerCase().includes(q) ||
        p.creatorFirstName.toLowerCase().includes(q) ||
        p.className.toLowerCase().includes(q) ||
        (p.ownerEmail || '').toLowerCase().includes(q) ||
        (p.createdSiteUrl || '').toLowerCase().includes(q)
      );
    });
  }, [adminPrompts, promptSearch, promptStatusFilter]);

  if (!isOpen) return null;

  const handleSignInClick = async () => {
    setStatusMessage(null);
    try {
      await onSignIn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('unauthorized-domain')) {
        const currentHost = window.location.hostname || 'zohar-lab.github.io';
        setStatusMessage({
          type: 'error',
          text: `הדומיין "${currentHost}" עדיין לא מאושר להתחברות ב-Firebase. היכנסו ל-Firebase Console → Authentication → Settings → Authorized domains והוסיפו את ${currentHost}.`,
        });
      } else if (msg.includes('popup-closed-by-user')) {
        setStatusMessage({
          type: 'error',
          text: 'חלון ההתחברות נסגר לפני השלמת הכניסה. נסו שוב.',
        });
      } else if (msg.includes('popup-blocked')) {
        setStatusMessage({
          type: 'error',
          text: 'הדפדפן חסם את חלון ההתחברות הקופץ. אפשרו חלונות קופצים עבור אתר זה ונסו שוב.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `ההתחברות נכשלה: ${msg}`,
        });
      }
    }
  };

  const handleCsvFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCSV(text, { includeAllStatuses: true });
      if (parsed.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'לא נמצאו שורות תקינות בקובץ ה-CSV. ודאו שקיימות עמודות title ו-siteUrl (או url).',
        });
        return;
      }

      setPendingConfirm({
        title: `ייבוא ${parsed.length} אתרים מהקובץ "${file.name}"?`,
        description:
          'האתרים מתוך קובץ ה-CSV יישמרו ב-Firestore (כולל תוויות וסטטוס) ויוצגו בהתאם לכלל המבקרים.',
        confirmLabel: `אישור וייבוא (${parsed.length})`,
        execute: async () => {
          const stats = await upsertImportedSitesToFirestore(parsed);
          await loadConsoleData();
          setStatusMessage({
            type: 'success',
            text: `ייבוא קובץ ה-CSV הושלם! נוספו ${stats.added} אתרים, עודכנו ${stats.updated}.`,
          });
        },
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'לא הצלחנו לקרוא את קובץ ה-CSV שנבחר.',
      });
    }
  };

  const handleExportCsvBackup = () => {
    const csvContent = exportSitesToCSV(adminSites);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hana-senesh-google-sites-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenAddSite = () => {
    setEditingSite(null);
    setSiteForm(EMPTY_SITE_FORM);
    setShowSiteForm(true);
  };

  const handleOpenEditSite = (site: StudentSiteItem) => {
    setEditingSite(site);
    setSiteForm({
      title: site.title,
      creatorsText: site.creators.join(', '),
      creatorNote: site.creatorNote,
      grade: site.grade,
      tags: normalizeTags(site.tags, site.category),
      isFeatured: Boolean(site.isFeatured),
      description: site.description,
      siteUrl: site.siteUrl,
      imageUrl: site.imageUrl.startsWith('http') ? site.imageUrl : '',
      status: site.status || 'מאושר',
    });
    setShowSiteForm(true);
  };

  const toggleFormTag = (tag: SiteTag) => {
    setSiteForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const requestSaveSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) return;

    const linkCheck = inspectGoogleSiteUrl(siteForm.siteUrl, false);
    if (!siteForm.title.trim() || !linkCheck.isValid) {
      setStatusMessage({
        type: 'error',
        text:
          linkCheck.errorMessage ||
          'יש למלא שם אתר וקישור תקין של Google Sites שפורסם.',
      });
      return;
    }

    if (siteForm.tags.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'בחרו לפחות תווית אחת לאתר (משחק תחביב, חקר, מידע, חברה, מועצת תלמידים או מחשבים ורשת).',
      });
      return;
    }

    const payload: Omit<StudentSiteItem, 'id' | 'isDemo'> = {
      title: siteForm.title.trim(),
      creators: parseCreatorsList(siteForm.creatorsText),
      creatorNote:
        siteForm.creatorNote.trim() ||
        `האתר "${siteForm.title.trim()}" נבנה ב-Google Sites במסגרת שיעורי המחשבים בבית הספר חנה סנש.`,
      grade: siteForm.grade.trim() || "ג'-ד'",
      category: siteForm.tags[0],
      tags: siteForm.tags,
      isFeatured: siteForm.isFeatured,
      description:
        siteForm.description.trim() ||
        'אתר Google Sites שנוצר על ידי תלמידי בית הספר חנה סנש.',
      siteUrl: linkCheck.normalizedUrl,
      imageUrl: siteForm.imageUrl.trim() ? normalizeHttpUrl(siteForm.imageUrl) : '',
      status: siteForm.status,
    };

    const isEditing = editingSite !== null;
    setPendingConfirm({
      title: isEditing ? `עדכון האתר "${payload.title}"?` : `הוספת האתר "${payload.title}" לפורטל?`,
      description: 'הנתונים יישמרו ישירות ב-Firestore ויתעדכנו מיד בדף הראשי ובדף האתרים.',
      confirmLabel: isEditing ? 'אישור ועדכון' : 'אישור והוספה',
      execute: async () => {
        if (isEditing && editingSite) {
          await updateSiteInFirestore(editingSite.id, payload);
        } else {
          await createSiteInFirestore(payload);
        }

        setShowSiteForm(false);
        setEditingSite(null);
        setSiteForm(EMPTY_SITE_FORM);
        await loadConsoleData();
        setStatusMessage({
          type: 'success',
          text: isEditing ? 'פרטי האתר עודכנו בהצלחה!' : 'האתר נוסף בהצלחה לפורטל!',
        });
      },
    });
  };

  const requestChangeSiteStatus = (site: StudentSiteItem, nextStatus: string) => {
    if (!isAuthorized) return;

    setPendingConfirm({
      title: `שינוי סטטוס האתר "${site.title}" ל-"${nextStatus}"?`,
      description:
        nextStatus === 'מאושר'
          ? 'לאחר האישור, האתר יופיע בדף האתרים הציבורי לכל אורח גם מחוץ לחשבון הארגוני. ודאו שלחצתם על "בדיקת האתר" והוא פתוח לצפייה ציבורית.'
          : `האתר יעודכן לסטטוס "${nextStatus}" ולא יוצג בדף האתרים הציבורי.`,
      confirmLabel: `עדכון ל-${nextStatus}`,
      execute: async () => {
        await updateSiteInFirestore(site.id, {
          title: site.title,
          creators: site.creators,
          creatorNote: site.creatorNote,
          grade: site.grade,
          category: site.category,
          tags: site.tags,
          isFeatured: site.isFeatured,
          description: site.description,
          siteUrl: site.siteUrl,
          imageUrl: site.imageUrl.startsWith('http') ? site.imageUrl : '',
          status: nextStatus,
        });

        await loadConsoleData();
        setStatusMessage({
          type: 'success',
          text: `האתר "${site.title}" עודכן לסטטוס "${nextStatus}".`,
        });
      },
    });
  };

  const requestToggleFeatured = (site: StudentSiteItem) => {
    if (!isAuthorized) return;
    const nextFeatured = !site.isFeatured;

    setPendingConfirm({
      title: nextFeatured
        ? `סימון "${site.title}" כאתר נבחר?`
        : `הסרת "${site.title}" מרשימת האתרים הנבחרים?`,
      description: nextFeatured
        ? 'אתר נבחר מופיע במדור "אתרים נבחרים" בדף הראשי ובאזור הנבחרים בדף האתרים.'
        : 'האתר ימשיך להופיע בדף האתרים הרגיל, אך יוסר ממדור הנבחרים.',
      confirmLabel: nextFeatured ? 'סמן כנבחר' : 'הסר מנבחרים',
      execute: async () => {
        await updateSiteInFirestore(site.id, {
          title: site.title,
          creators: site.creators,
          creatorNote: site.creatorNote,
          grade: site.grade,
          category: site.category,
          tags: site.tags,
          isFeatured: nextFeatured,
          description: site.description,
          siteUrl: site.siteUrl,
          imageUrl: site.imageUrl.startsWith('http') ? site.imageUrl : '',
          status: site.status,
        });

        await loadConsoleData();
        setStatusMessage({
          type: 'success',
          text: nextFeatured
            ? `"${site.title}" סומן כאתר נבחר ויוצג בדף הראשי!`
            : `"${site.title}" הוסר מרשימת הנבחרים.`,
        });
      },
    });
  };

  const requestDeleteSite = (site: StudentSiteItem) => {
    if (!isAuthorized) return;

    setPendingConfirm({
      title: `מחיקת האתר "${site.title}" מהפורטל?`,
      description: 'האתר יימחק לצמיתות ממסד הנתונים Firestore. פעולה זו אינה ניתנת לביטול.',
      confirmLabel: 'מחיקה לצמיתות',
      isDestructive: true,
      execute: async () => {
        await deleteSiteInFirestore(site.id);
        await loadConsoleData();
        setStatusMessage({
          type: 'success',
          text: `האתר "${site.title}" נמחק מהפורטל.`,
        });
      },
    });
  };

  const handleToggleAdminPromptStatus = async (prompt: SavedGamePromptItem) => {
    if (!isAuthorized) return;
    const nextStatus: PromptProductionStatus =
      prompt.productionStatus === 'הופק' ? 'ממתין' : 'הופק';
    setIsWorking(true);
    setStatusMessage(null);
    try {
      await updateGamePromptInFirestore(prompt.id, {
        promptName: prompt.promptName,
        gameName: prompt.gameName,
        creatorFirstName: prompt.creatorFirstName,
        className: prompt.className,
        promptText: prompt.promptText,
        productionStatus: nextStatus,
        createdSiteUrl: prompt.createdSiteUrl,
        isManualEdited: prompt.isManualEdited,
        wizardState: prompt.wizardState,
      });
      await loadConsoleData();
      setStatusMessage({
        type: 'success',
        text: `סטטוס הפרומפט "${prompt.promptName}" עודכן ל-"${nextStatus}".`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error && !err.message.startsWith('{')
            ? err.message
            : 'עדכון הסטטוס נכשל.',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveAdminPromptSiteUrl = async (prompt: SavedGamePromptItem) => {
    if (!isAuthorized) return;
    const draftUrl = (promptUrlDrafts[prompt.id] ?? prompt.createdSiteUrl ?? '').trim();
    if (draftUrl && !normalizeHttpUrl(draftUrl)) {
      setStatusMessage({
        type: 'error',
        text: 'הקישור לאתר אינו תקין. ודאו שהוא מתחיל ב-https://.',
      });
      return;
    }

    const nextUrl = draftUrl ? normalizeHttpUrl(draftUrl) : '';
    const nextStatus: PromptProductionStatus =
      nextUrl && prompt.productionStatus === 'ממתין' ? 'הופק' : prompt.productionStatus;

    setIsWorking(true);
    setStatusMessage(null);
    try {
      await updateGamePromptInFirestore(prompt.id, {
        promptName: prompt.promptName,
        gameName: prompt.gameName,
        creatorFirstName: prompt.creatorFirstName,
        className: prompt.className,
        promptText: prompt.promptText,
        productionStatus: nextStatus,
        createdSiteUrl: nextUrl,
        isManualEdited: prompt.isManualEdited,
        wizardState: prompt.wizardState,
      });
      await loadConsoleData();
      setStatusMessage({
        type: 'success',
        text: nextUrl
          ? `הקישור לאתר נשמר בפרומפט "${prompt.promptName}".`
          : `הקישור הוסר מהפרומפט "${prompt.promptName}".`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error && !err.message.startsWith('{')
            ? err.message
            : 'שמירת הקישור נכשלה.',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const requestDeleteAdminPrompt = (prompt: SavedGamePromptItem) => {
    if (!isAuthorized) return;
    setPendingConfirm({
      title: `מחיקת הפרומפט "${prompt.promptName}"?`,
      description: `הפרומפט של ${prompt.creatorFirstName} (${prompt.className}) יימחק לצמיתות ממסד הנתונים.`,
      confirmLabel: 'מחיקה לצמיתות',
      isDestructive: true,
      execute: async () => {
        await deleteGamePromptInFirestore(prompt.id);
        await loadConsoleData();
        setStatusMessage({
          type: 'success',
          text: `הפרומפט "${prompt.promptName}" נמחק.`,
        });
      },
    });
  };

  const handleCopyAdminPrompt = async (prompt: SavedGamePromptItem) => {
    try {
      await navigator.clipboard.writeText(prompt.promptText);
      setCopiedPromptId(prompt.id);
      window.setTimeout(() => setCopiedPromptId(null), 2000);
    } catch {
      setExpandedPromptId(prompt.id);
      setStatusMessage({
        type: 'error',
        text: 'הדפדפן חסם העתקה אוטומטית. פתחו את תצוגת הפרומפט והעתיקו ידנית.',
      });
    }
  };

  const handleDownloadAdminPrompt = (prompt: SavedGamePromptItem) => {
    const safeName = prompt.promptName.replace(/[^\u0590-\u05FFa-zA-Z0-9_-]+/g, '_') || 'prompt';
    const blob = new Blob([prompt.promptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const requestAddEditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

    const trimmed = newEditorEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatusMessage({
        type: 'error',
        text: 'אנא הזינו כתובת אימייל תקינה.',
      });
      return;
    }

    if (editors.some((ed) => ed.email.toLowerCase() === trimmed)) {
      setStatusMessage({
        type: 'error',
        text: 'כתובת אימייל זו כבר נמצאת ברשימת המורשים לעריכה.',
      });
      return;
    }

    setPendingConfirm({
      title: `הוספת ${trimmed} לרשימת המורשים לעריכה?`,
      description:
        'המשתמש יקבל הרשאת עריכה בפורטל ויוכל לבדוק, לאשר ולערוך אתרי תלמידים לאחר התחברות עם Google.',
      confirmLabel: 'אישור והוספת מורשה',
      execute: async () => {
        await addEditorToFirestore(trimmed, userEmail);
        setNewEditorEmail('');
        await loadConsoleData();
        setStatusMessage({
          type: 'success',
          text: `${trimmed} נוסף לרשימת המורשים לעריכה בהצלחה!`,
        });
      },
    });
  };

  const requestRemoveEditor = (editor: AuthorizedEditor) => {
    if (!isSuperAdmin) return;

    setPendingConfirm({
      title: `הסרת ${editor.email} מרשימת המורשים?`,
      description: 'המשתמש יאבד מיד את הרשאת העריכה בפורטל ויוסר מרשימת המורשים.',
      confirmLabel: 'אישור והסרה',
      isDestructive: true,
      execute: async () => {
        await removeEditorFromFirestore(editor.email);
        await loadConsoleData();
        setStatusMessage({
          type: 'success',
          text: `${editor.email} הוסר מרשימת המורשים לעריכה.`,
        });
      },
    });
  };

  const executeConfirmedAction = async () => {
    if (!pendingConfirm) return;
    setIsWorking(true);
    setStatusMessage(null);
    try {
      await pendingConfirm.execute();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error && !err.message.startsWith('{')
            ? `הפעולה נכשלה: ${err.message}`
            : 'אירעה שגיאה בביצוע הפעולה.',
      });
    } finally {
      setIsWorking(false);
      setPendingConfirm(null);
    }
  };

  const formLinkCheck = siteForm.siteUrl.trim()
    ? inspectGoogleSiteUrl(siteForm.siteUrl, false)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-console-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white border-2 border-slate-950 rounded-2xl shadow-[8px_8px_0px_#06b6d4] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת המסוף */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-950 text-white border-b-2 border-lime-400">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-lime-400 text-slate-950 inline-flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="admin-console-title" className="font-display text-lg font-extrabold">
                ניהול פורטל אתרי Google Sites ומורשים
              </h2>
              <p className="text-xs text-slate-300">
                ניהול ארגוני ב-Firestore בלבד · גישה למורשים
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={onSignOut}
                className="min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>התנתקות</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירת חלון ניהול"
              className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* תוכן */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6">
          {statusMessage && (
            <div
              role={statusMessage.type === 'error' ? 'alert' : 'status'}
              className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border-2 text-sm ${
                statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-500 text-rose-950'
                  : 'bg-emerald-50 border-emerald-600 text-emerald-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {statusMessage.type === 'error' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                aria-label="סגירת הודעה"
                className="p-0.5 rounded hover:bg-black/5"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {!user ? (
            <div className="rounded-2xl border-2 border-slate-950 bg-slate-50 p-6 sm:p-8 text-center space-y-4">
              <ShieldCheck className="w-11 h-11 text-blue-600 mx-auto" aria-hidden="true" />
              <div className="space-y-1.5 max-w-lg mx-auto">
                <h3 className="font-display text-xl font-extrabold text-slate-950">
                  התחברו עם חשבון Google הארגוני לניהול הפורטל
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  התחברו באמצעות חשבון מנהל או חשבון מורשה עריכה, כדי לבדוק, לתייג, לבחור אתרים מומלצים לדף הראשי ולאשר אתרי תלמידים. לאורחים וצופים אין צורך בהתחברות.
                </p>
              </div>
              <div className="pt-1">
                <GoogleSignInButton
                  onClick={handleSignInClick}
                  disabled={isSigningIn}
                  label={isSigningIn ? 'מתחבר לחשבון Google...' : 'התחברות עם Google'}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border-2 border-slate-200">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-slate-900">מחובר כעת:</span>
                  <span className="font-mono text-slate-700">{user.email}</span>
                  <span aria-hidden="true">·</span>
                  {isSuperAdmin ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      <span>סופר אדמין (שליטה מלאה)</span>
                    </span>
                  ) : isAuthorized ? (
                    <span className="inline-flex items-center gap-1 font-bold text-blue-700">
                      <Shield className="w-4 h-4" aria-hidden="true" />
                      <span>מורשה עריכה</span>
                    </span>
                  ) : isCheckingAuth ? (
                    <span className="text-slate-600">בודק הרשאות...</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                      <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                      <span>ללא הרשאת עריכה ברשימה</span>
                    </span>
                  )}
                </div>

                {isAuthorized && (
                  <button
                    type="button"
                    onClick={loadConsoleData}
                    disabled={isLoadingData}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>רענון נתונים</span>
                  </button>
                )}
              </div>

              {!isAuthorized && !isCheckingAuth ? (
                <div
                  role="alert"
                  className="p-5 rounded-xl border-2 border-rose-500 bg-rose-50 text-rose-950 text-sm space-y-1.5"
                >
                  <div className="font-bold">
                    לחשבון {user.email} אין הרשאת עריכה ברשימת המורשים של הפורטל.
                  </div>
                  <p>
                    בקשו ממנהל הפורטל להוסיף את כתובת האימייל שלכם בלשונית &quot;רשימת מורשים לעריכה&quot;.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl border-2 border-cyan-400 bg-cyan-50/70 text-xs sm:text-sm text-slate-800 flex items-start gap-3 leading-relaxed">
                    <Info className="w-4 h-4 text-cyan-800 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <div className="font-bold text-slate-950">
                        הגנת מידע ב-GitHub Pages + Firebase ושמירה על פרטיות התלמידים
                      </div>
                      <p>
                        הפורטל מתארח ב-<strong>GitHub Pages</strong> (<span className="font-mono" dir="ltr">zohar-lab.github.io/senesh-sites/</span>) עם הגדרות Firebase מאובטחות ב-GitHub Secrets (<span className="font-mono">FIREBASE_APPLET_CONFIG</span>) וללא קובץ סודות במאגר. שמות תלמידים נשמרים ומוצגים בפורמט <strong>שם פרטי וכינוי בלבד</strong> (ללא שמות משפחה).
                      </p>
                    </div>
                  </div>

                  {/* טאבים ראשיים */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('sites')}
                        className={`min-h-10 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          activeTab === 'sites'
                            ? 'bg-slate-950 text-lime-300 border-slate-950'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-950'
                        }`}
                      >
                        <Globe className="w-4 h-4" aria-hidden="true" />
                        <span>ניהול אתרי תלמידים ({adminSites.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('prompts')}
                        className={`min-h-10 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          activeTab === 'prompts'
                            ? 'bg-slate-950 text-pink-300 border-slate-950'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-950'
                        }`}
                      >
                        <FileText className="w-4 h-4" aria-hidden="true" />
                        <span>פרומטים מהמחולל ({adminPrompts.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('editors')}
                        className={`min-h-10 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          activeTab === 'editors'
                            ? 'bg-slate-950 text-cyan-300 border-slate-950'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-950'
                        }`}
                      >
                        <Users className="w-4 h-4" aria-hidden="true" />
                        <span>רשימת מורשים לעריכה ({editors.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('deploy')}
                        className={`min-h-10 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          activeTab === 'deploy'
                            ? 'bg-slate-950 text-amber-300 border-slate-950'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-950'
                        }`}
                      >
                        <KeyRound className="w-4 h-4" aria-hidden="true" />
                        <span>הגדרות פריסה ל-GitHub</span>
                      </button>
                    </div>

                    {activeTab === 'sites' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleCsvFileSelected}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => csvInputRef.current?.click()}
                          disabled={isWorking}
                          className="min-h-10 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-slate-950 bg-cyan-300 text-slate-950 text-xs sm:text-sm font-extrabold hover:bg-cyan-200 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" aria-hidden="true" />
                          <span>ייבוא CSV</span>
                        </button>

                        {adminSites.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExportCsvBackup}
                            className="min-h-10 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-bold hover:border-slate-950 cursor-pointer"
                          >
                            <Download className="w-4 h-4" aria-hidden="true" />
                            <span>גיבוי CSV</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleOpenAddSite}
                          className="min-h-10 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-xs sm:text-sm font-extrabold shadow-[2px_2px_0px_#020617] hover:bg-lime-300 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                          <span>הוספת אתר חדש</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* תוכן טאב אתרי תלמידים */}
                  {activeTab === 'sites' && (
                    <div className="space-y-4">
                      {/* סינון לפי סטטוס + תווית + נבחרים */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold tabular-nums">
                          {(
                            [
                              { id: 'הכל', label: `הכל (${counts.all})` },
                              { id: 'ממתין', label: `ממתינים לאישור (${counts.pending})` },
                              { id: 'מאושר', label: `מאושרים (${counts.approved})` },
                              { id: 'נדחה', label: `נדחו (${counts.rejected})` },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setStatusFilter(tab.id)}
                              className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                statusFilter === tab.id
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-400'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                          <select
                            aria-label="סינון לפי תווית"
                            value={tagFilter}
                            onChange={(e) => setTagFilter(e.target.value as TagFilter)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 cursor-pointer"
                          >
                            <option value="הכל">כל התוויות</option>
                            {SITE_TAGS.map((tag) => (
                              <option key={tag} value={tag}>
                                {tag}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setOnlyFeatured((prev) => !prev)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                              onlyFeatured
                                ? 'bg-amber-300 text-slate-950 border-slate-950'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-400'
                            }`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${onlyFeatured ? 'fill-slate-950' : ''}`}
                              aria-hidden="true"
                            />
                            <span>נבחרים בלבד ({counts.featured})</span>
                          </button>
                        </div>
                      </div>

                      {showSiteForm && (
                        <form
                          onSubmit={requestSaveSite}
                          className="p-5 rounded-xl border-2 border-slate-950 bg-slate-50 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-display text-base font-extrabold text-slate-950">
                              {editingSite
                                ? `עריכת אתר: ${editingSite.title}`
                                : 'הוספת אתר Google Sites חדש'}
                            </h3>
                            <button
                              type="button"
                              onClick={() => setShowSiteForm(false)}
                              className="text-xs font-bold text-slate-600 hover:text-slate-950"
                            >
                              סגירה
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                שם האתר *
                              </label>
                              <input
                                type="text"
                                required
                                maxLength={120}
                                value={siteForm.title}
                                onChange={(e) =>
                                  setSiteForm((f) => ({ ...f, title: e.target.value }))
                                }
                                className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                יוצרים — שם פרטי וכינוי בלבד (הפרידו בפסיקים)
                              </label>
                              <input
                                type="text"
                                value={siteForm.creatorsText}
                                onChange={(e) =>
                                  setSiteForm((f) => ({ ...f, creatorsText: e.target.value }))
                                }
                                placeholder="למשל: נועה (שומרת הים), דניאל"
                                className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-xs font-bold text-slate-700">
                                קישור ל-Google Site המפורסם *
                              </label>
                              <input
                                type="url"
                                required
                                dir="ltr"
                                maxLength={500}
                                value={siteForm.siteUrl}
                                onChange={(e) =>
                                  setSiteForm((f) => ({ ...f, siteUrl: e.target.value }))
                                }
                                placeholder="https://sites.google.com/edu-haifa.org.il/..."
                                className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono"
                              />
                              {formLinkCheck && !formLinkCheck.isValid && (
                                <p className="text-xs text-rose-700 font-semibold">
                                  {formLinkCheck.errorMessage}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                קישור לתמונת שער (Google Drive או URL)
                              </label>
                              <input
                                type="text"
                                dir="ltr"
                                maxLength={500}
                                value={siteForm.imageUrl}
                                onChange={(e) =>
                                  setSiteForm((f) => ({ ...f, imageUrl: e.target.value }))
                                }
                                placeholder="https://drive.google.com/file/d/..."
                                className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                שכבת גיל
                              </label>
                              <select
                                value={siteForm.grade}
                                onChange={(e) =>
                                  setSiteForm((f) => ({ ...f, grade: e.target.value }))
                                }
                                className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                              >
                                <option value="א'-ב'">א&apos;-ב&apos;</option>
                                <option value="ג'-ד'">ג&apos;-ד&apos;</option>
                                <option value="ה'-ו'">ה&apos;-ו&apos;</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                סטטוס מודרציה
                              </label>
                              <select
                                value={siteForm.status}
                                onChange={(e) =>
                                  setSiteForm((f) => ({ ...f, status: e.target.value }))
                                }
                                className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-bold"
                              >
                                <option value="מאושר">מאושר</option>
                                <option value="ממתין">ממתין</option>
                                <option value="נדחה">נדחה</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2">
                              <span className="block text-xs font-bold text-slate-700 mb-1.5">
                                תוויות האתר (בחרו לפחות אחת) *
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {SITE_TAGS.map((tag) => {
                                  const active = siteForm.tags.includes(tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      aria-pressed={active}
                                      onClick={() => toggleFormTag(tag)}
                                      className={`min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-extrabold transition-colors cursor-pointer ${
                                        active
                                          ? 'border-slate-950 bg-lime-400 text-slate-950'
                                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-950'
                                      }`}
                                    >
                                      {active && (
                                        <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                      )}
                                      <span>{tag}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="sm:col-span-2">
                              <label className="inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-xs sm:text-sm font-bold text-slate-900 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={siteForm.isFeatured}
                                  onChange={(e) =>
                                    setSiteForm((f) => ({ ...f, isFeatured: e.target.checked }))
                                  }
                                  className="w-4 h-4 accent-amber-500 rounded"
                                />
                                <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
                                <span>פרסם כאתר נבחר (יוצג בדף הראשי ובמדור נבחרים)</span>
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              כמה מילים מאת היוצר (מוקרן במסך ההקדמה)
                            </label>
                            <textarea
                              rows={2}
                              maxLength={1000}
                              value={siteForm.creatorNote}
                              onChange={(e) =>
                                setSiteForm((f) => ({ ...f, creatorNote: e.target.value }))
                              }
                              placeholder="מה חקרנו ובנינו באתר..."
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              תיאור קצר של האתר
                            </label>
                            <textarea
                              rows={2}
                              maxLength={1500}
                              value={siteForm.description}
                              onChange={(e) =>
                                setSiteForm((f) => ({ ...f, description: e.target.value }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowSiteForm(false)}
                              className="min-h-10 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              ביטול
                            </button>
                            <button
                              type="submit"
                              disabled={isWorking}
                              className="min-h-10 px-5 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-sm font-extrabold hover:bg-lime-300 cursor-pointer"
                            >
                              {editingSite ? 'שמירת עדכון' : 'הוספה לפורטל'}
                            </button>
                          </div>
                        </form>
                      )}

                      {isLoadingData ? (
                        <div className="py-10 text-center text-sm text-slate-500">
                          טוען אתרים מ-Firestore...
                        </div>
                      ) : filteredAdminSites.length === 0 ? (
                        <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
                          {adminSites.length === 0
                            ? 'אין עדיין אתרים במסד הנתונים. לחצו על "הוספת אתר חדש" או "ייבוא CSV".'
                            : 'אין אתרים התואמים לסינון שנבחר.'}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {filteredAdminSites.map((s) => (
                            <div
                              key={s.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition-colors"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-display font-bold text-slate-950">
                                    {s.title}
                                  </span>
                                  <span
                                    className={`text-xs font-extrabold px-2 py-0.5 rounded ${
                                      s.status === 'מאושר'
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : s.status === 'נדחה'
                                          ? 'bg-rose-100 text-rose-900'
                                          : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    סטטוס: {s.status}
                                  </span>
                                  {s.isFeatured && (
                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded bg-amber-300 text-slate-950">
                                      <Star className="w-3 h-3 fill-slate-950" aria-hidden="true" />
                                      <span>נבחר</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600">
                                  יוצרים: {s.creators.join(', ')} · שכבת {s.grade} · תוויות:{' '}
                                  {(s.tags.length > 0 ? s.tags : [s.category]).join(', ')}
                                </div>
                                <div
                                  dir="ltr"
                                  className="text-xs font-mono text-slate-500 truncate max-w-md"
                                >
                                  {s.siteUrl}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <a
                                  href={s.siteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-slate-50 text-slate-800 text-xs font-bold hover:bg-slate-100"
                                >
                                  <span>בדיקת האתר</span>
                                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>

                                <button
                                  type="button"
                                  onClick={() => requestToggleFeatured(s)}
                                  className={`min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-bold cursor-pointer ${
                                    s.isFeatured
                                      ? 'border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200'
                                      : 'border-slate-300 bg-white text-slate-700 hover:bg-amber-50'
                                  }`}
                                >
                                  <Star
                                    className={`w-3 h-3 ${s.isFeatured ? 'fill-amber-500 text-amber-600' : ''}`}
                                    aria-hidden="true"
                                  />
                                  <span>{s.isFeatured ? 'הסר מנבחרים' : 'סמן כנבחר'}</span>
                                </button>

                                {s.status !== 'מאושר' && (
                                  <button
                                    type="button"
                                    onClick={() => requestChangeSiteStatus(s, 'מאושר')}
                                    className="min-h-8 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                                  >
                                    אשר לפרסום
                                  </button>
                                )}
                                {s.status === 'מאושר' && (
                                  <button
                                    type="button"
                                    onClick={() => requestChangeSiteStatus(s, 'ממתין')}
                                    className="min-h-8 px-2.5 py-1 rounded-md border border-amber-400 bg-amber-50 text-amber-900 text-xs font-bold hover:bg-amber-100 cursor-pointer"
                                  >
                                    העבר להמתנה
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSite(s)}
                                  aria-label={`עריכת ${s.title}`}
                                  className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>עריכה</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteSite(s)}
                                  aria-label={`מחיקת ${s.title}`}
                                  className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>מחיקה</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* תוכן טאב פרומטים מהמחולל (צפייה בכל פרומטי התלמידים) */}
                  {activeTab === 'prompts' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold tabular-nums">
                          {(
                            [
                              { id: 'הכל', label: `הכל (${promptCounts.all})` },
                              { id: 'ממתין', label: `ממתין להפקה (${promptCounts.waiting})` },
                              { id: 'הופק', label: `הופק לאתר (${promptCounts.produced})` },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setPromptStatusFilter(tab.id)}
                              className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                promptStatusFilter === tab.id
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-400'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <div className="relative w-full sm:w-72">
                          <Search
                            className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            type="search"
                            value={promptSearch}
                            onChange={(e) => setPromptSearch(e.target.value)}
                            placeholder="חיפוש לפי תלמיד, כיתה, משחק או מייל..."
                            aria-label="חיפוש בפרומטי התלמידים"
                            className="w-full min-h-9 ps-9 pe-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-slate-950"
                          />
                        </div>
                      </div>

                      {isLoadingData ? (
                        <div className="py-10 text-center text-sm text-slate-500">
                          טוען פרומטים מ-Firestore...
                        </div>
                      ) : filteredAdminPrompts.length === 0 ? (
                        <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
                          {adminPrompts.length === 0
                            ? 'עדיין לא נשמרו פרומטים מהמחולל ב-Firestore.'
                            : 'לא נמצאו פרומטים התואמים לחיפוש או לסינון שנבחר.'}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredAdminPrompts.map((prompt) => {
                            const isExpanded = expandedPromptId === prompt.id;
                            const urlDraft =
                              promptUrlDrafts[prompt.id] ?? prompt.createdSiteUrl ?? '';
                            return (
                              <div
                                key={prompt.id}
                                className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 hover:border-slate-400 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-display font-extrabold text-slate-950">
                                        {prompt.promptName}
                                      </span>
                                      <span
                                        className={`text-xs font-extrabold px-2 py-0.5 rounded ${
                                          prompt.productionStatus === 'הופק'
                                            ? 'bg-emerald-100 text-emerald-900'
                                            : 'bg-amber-100 text-amber-900'
                                        }`}
                                      >
                                        סטטוס: {prompt.productionStatus}
                                      </span>
                                      {prompt.isManualEdited && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-900">
                                          נערך ידנית
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <span>
                                        יוצר: <strong>{prompt.creatorFirstName}</strong>
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span>כיתה: {prompt.className}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>משחק: {prompt.gameName}</span>
                                      {prompt.ownerEmail && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span dir="ltr" className="font-mono text-slate-500">
                                            {prompt.ownerEmail}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedPromptId(isExpanded ? null : prompt.id)
                                      }
                                      className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-slate-50 text-slate-800 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>{isExpanded ? 'הסתר טקסט' : 'הצג פרומפט'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCopyAdminPrompt(prompt)}
                                      className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                                    >
                                      {copiedPromptId === prompt.id ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                                          <span>הועתק</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                          <span>העתק</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDownloadAdminPrompt(prompt)}
                                      className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>TXT</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isWorking}
                                      onClick={() => handleToggleAdminPromptStatus(prompt)}
                                      className={`min-h-8 px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                                        prompt.productionStatus === 'הופק'
                                          ? 'border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                      }`}
                                    >
                                      {prompt.productionStatus === 'הופק'
                                        ? 'סמן כממתין'
                                        : 'סמן כהופק'}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isWorking}
                                      onClick={() => requestDeleteAdminPrompt(prompt)}
                                      className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>מחיקה</span>
                                    </button>
                                  </div>
                                </div>

                                {/* שדה קישור לאתר שנוצר */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
                                  <label
                                    htmlFor={`admin-prompt-url-${prompt.id}`}
                                    className="text-xs font-bold text-slate-700 shrink-0"
                                  >
                                    קישור לאתר שנוצר:
                                  </label>
                                  <input
                                    id={`admin-prompt-url-${prompt.id}`}
                                    type="url"
                                    dir="ltr"
                                    maxLength={500}
                                    value={urlDraft}
                                    onChange={(e) =>
                                      setPromptUrlDrafts((prev) => ({
                                        ...prev,
                                        [prompt.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="https://sites.google.com/..."
                                    className="flex-1 min-h-8 px-2.5 py-1 rounded-md border border-slate-300 bg-slate-50 text-xs font-mono focus:outline-none focus:border-slate-950"
                                  />
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isWorking}
                                      onClick={() => handleSaveAdminPromptSiteUrl(prompt)}
                                      className="min-h-8 px-3 py-1 rounded-md border border-slate-950 bg-lime-400 text-slate-950 text-xs font-extrabold hover:bg-lime-300 cursor-pointer"
                                    >
                                      שמור קישור
                                    </button>
                                    {prompt.createdSiteUrl && (
                                      <a
                                        href={prompt.createdSiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-cyan-500 bg-cyan-50 text-cyan-900 text-xs font-bold hover:bg-cyan-100"
                                      >
                                        <span>פתח אתר</span>
                                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {isExpanded && (
                                  <pre
                                    dir="rtl"
                                    className="p-3 rounded-lg bg-slate-950 text-slate-100 text-xs whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto"
                                  >
                                    {prompt.promptText}
                                  </pre>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* תוכן טאב רשימת מורשים לעריכה */}
                  {activeTab === 'editors' && (
                    <div className="space-y-5">
                      {isSuperAdmin ? (
                        <form
                          onSubmit={requestAddEditor}
                          className="p-4 sm:p-5 rounded-xl border-2 border-slate-950 bg-slate-50 space-y-3"
                        >
                          <div className="space-y-0.5">
                            <h3 className="font-display text-base font-extrabold text-slate-950">
                              הוספת מורשה עריכה חדש (סופר אדמין בלבד)
                            </h3>
                            <p className="text-xs text-slate-600">
                              הוספת כתובת Google ארגונית (<span className="font-mono">@edu-haifa.org.il</span>) תעניק לה הרשאת בדיקה, אישור ועריכה של אתרי תלמידים ב-Firestore.
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                              type="email"
                              dir="ltr"
                              required
                              value={newEditorEmail}
                              onChange={(e) => setNewEditorEmail(e.target.value)}
                              placeholder="teacher-or-student@edu-haifa.org.il"
                              className="flex-1 min-h-10 px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-sm font-mono focus:outline-none focus:border-slate-950"
                            />
                            <button
                              type="submit"
                              disabled={isWorking}
                              className="min-h-10 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-950 bg-cyan-400 text-slate-950 text-sm font-extrabold shadow-[2px_2px_0px_#020617] hover:bg-cyan-300 shrink-0 cursor-pointer"
                            >
                              <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>הוספה למורשים</span>
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                          רק מנהל הפורטל הראשי רשאי להוסיף או להסיר משתמשים מרשימת המורשים לעריכה.
                        </div>
                      )}

                      <div className="space-y-2.5">
                        {editors.map((editor) => {
                          const isOwner = isSuperAdminEmail(editor.email);
                          return (
                            <div
                              key={editor.email}
                              className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white"
                            >
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="font-mono text-sm font-bold text-slate-900">
                                  {editor.email}
                                </span>
                                {isOwner ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-300 text-slate-950 text-xs font-extrabold">
                                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>סופר אדמין (קבוע)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-cyan-100 text-cyan-950 text-xs font-bold">
                                    <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>מורשה עריכה</span>
                                  </span>
                                )}
                              </div>

                              {isSuperAdmin && !isOwner && (
                                <button
                                  type="button"
                                  onClick={() => requestRemoveEditor(editor)}
                                  className="min-h-8 inline-flex items-center gap-1 px-3 py-1 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>הסרה</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* תוכן טאב הגדרות פריסה ל-GitHub */}
                  {activeTab === 'deploy' && (
                    <div className="space-y-5">
                      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h3 className="font-display text-base font-extrabold text-slate-950">
                              העתקת JSON ל-GitHub Secret (<span className="font-mono" dir="ltr">FIREBASE_APPLET_CONFIG</span>)
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                              כדי שגרסת האתר ב-<span className="font-mono font-semibold" dir="ltr">senesh-sites</span> תתחבר למסד הנתונים Firestore ולהתחברות Google, הדביקו אובייקט זה תחת <span className="font-mono" dir="ltr">Settings → Secrets and variables → Actions</span>.
                            </p>
                          </div>

                          {firebaseSecretJson && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowSecretJson((prev) => !prev)}
                                className="min-h-10 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold hover:border-slate-950 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {showSecretJson ? (
                                  <>
                                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                                    <span>הסתרת ערכים</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-4 h-4" aria-hidden="true" />
                                    <span>הצגת ערכים</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={handleCopyFirebaseSecret}
                                className="min-h-10 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-xs sm:text-sm font-extrabold shadow-[2px_2px_0px_#020617] hover:bg-lime-300 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {copiedSecret ? (
                                  <>
                                    <Check className="w-4 h-4" aria-hidden="true" />
                                    <span>הועתק ללוח</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" aria-hidden="true" />
                                    <span>העתקת JSON ל-GitHub</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {firebaseSecretJson ? (
                          <div className="space-y-2">
                            <pre
                              dir="ltr"
                              className="p-4 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed select-all"
                            >
                              {showSecretJson ? firebaseSecretJson : maskedFirebaseSecretJson}
                            </pre>
                            <p className="text-xs text-slate-500">
                              כפתור ההעתקה מעתיק תמיד את ה-JSON המלא והתקין, גם כשהתצוגה מוסתרת למניעת צפייה מהצד.
                            </p>
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-950 text-xs sm:text-sm space-y-2">
                            <div className="font-bold">
                              תצורת Firebase אינה טעונה בסביבה זו
                            </div>
                            <p className="leading-relaxed">
                              פתחו את הפורטל מתוך סביבת הפיתוח ב-AI Studio כדי להעתיק מכאן בלחיצה, או העתיקו מ-Firebase Console תחת <span className="font-mono" dir="ltr">Project Settings → General → Your apps → firebaseConfig</span> והוסיפו את השדה <span className="font-mono" dir="ltr">firestoreDatabaseId</span>.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                        <h4 className="font-display text-sm sm:text-base font-extrabold text-slate-950">
                          4 שלבים להפעלת האתר ב-GitHub Pages (מאגר <span className="font-mono" dir="ltr">senesh-sites</span>)
                        </h4>
                        <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                          <li>
                            ב-GitHub כנסו ל-<span className="font-mono font-semibold" dir="ltr">Settings → Pages</span> ותחת <span className="font-mono" dir="ltr">Source</span> בחרו <span className="font-semibold">GitHub Actions</span>.
                          </li>
                          <li>
                            כנסו ל-<span className="font-mono font-semibold" dir="ltr">Settings → Secrets and variables → Actions</span>, לחצו על <span className="font-semibold">New repository secret</span>, הזינו שם <span className="font-mono font-semibold" dir="ltr">FIREBASE_APPLET_CONFIG</span> והדביקו את ה-JSON שהועתק למעלה.
                          </li>
                          <li>
                            עברו ללשונית <span className="font-mono font-semibold" dir="ltr">Actions</span>, בחרו ב-<span className="font-mono" dir="ltr">Deploy Portal to GitHub Pages</span> ולחצו על <span className="font-mono" dir="ltr">Run workflow</span> (ענף <span className="font-mono" dir="ltr">main</span>).
                          </li>
                          <li>
                            ב-Firebase Console כנסו ל-<span className="font-mono font-semibold" dir="ltr">Authentication → Settings → Authorized domains</span> והוסיפו את דומיין האתר שלכם ב-GitHub Pages (למשל <span className="font-mono" dir="ltr">zohar-lab.github.io</span>).
                          </li>
                        </ol>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* חלון אישור מפורש לפני כל פעולת שינוי או מחיקה */}
        {pendingConfirm && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-action-title"
          >
            <div className="w-full max-w-md bg-white border-2 border-slate-950 rounded-2xl shadow-[6px_6px_0px_#ec4899] p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0 ${
                    pendingConfirm.isDestructive
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 id="confirm-action-title" className="font-display text-base font-extrabold text-slate-950">
                    {pendingConfirm.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {pendingConfirm.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => setPendingConfirm(null)}
                  className="min-h-10 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={executeConfirmedAction}
                  className={`min-h-10 px-4 py-2 rounded-lg border-2 border-slate-950 text-sm font-extrabold cursor-pointer ${
                    pendingConfirm.isDestructive
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : 'bg-lime-400 text-slate-950 hover:bg-lime-300'
                  }`}
                >
                  {isWorking ? 'מבצע...' : pendingConfirm.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
