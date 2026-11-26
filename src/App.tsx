import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  Gamepad2,
  Info,
  Laptop,
  LayoutGrid,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import heroShowcaseImg from './assets/images/hero_sites_showcase_1795618553325.jpg';
import { AdminConsoleModal } from './components/AdminConsoleModal';
import { GamePromptGeneratorPage } from './components/GamePromptGeneratorPage';
import { SiteCard } from './components/SiteCard';
import { SitesCatalogPage } from './components/SitesCatalogPage';
import { SiteShowcaseModal } from './components/SiteShowcaseModal';
import { SubmitSiteModal } from './components/SubmitSiteModal';
import { DEMO_SITES, INITIAL_DEMO_FEEDBACK } from './data/mockSites';
import { firebaseConfigError, isFirebaseConfigured } from './services/firebaseApp';
import {
  addFeedbackToFirestore,
  subscribeApprovedSites,
  subscribeFeedbacks,
} from './services/firestorePortal';
import { googleSignIn, initAuth, logout } from './services/googleAuth';
import { PortalPage, SiteFeedback, StudentSiteItem } from './types/portal';
import { sortSites } from './utils/portalUtils';

function resolvePageFromHash(): PortalPage {
  if (typeof window === 'undefined') return 'home';
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'sites' || hash.startsWith('sites/')) {
    return 'sites';
  }
  if (hash === 'generator' || hash.startsWith('generator/')) {
    return 'generator';
  }
  return 'home';
}

function formatFirestoreLoadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed?.error) detail = parsed.error;
  } catch {
    // שימוש בהודעה המקורית אם אינה JSON
  }

  const lower = detail.toLowerCase();
  if (lower.includes('quota exceeded')) {
    return 'מכסת הקריאות היומית של Firestore הסתיימה להיום ותתאפס מחר.';
  }
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return 'חסימת הרשאה בקריאה מ-Firestore. בדקו את כללי האבטחה או את אישור הדומיין.';
  }
  if (lower.includes('offline') || lower.includes('unavailable') || lower.includes('network')) {
    return 'לא הצלחנו להתחבר למסד הנתונים ב-Firestore. בדקו את החיבור לרשת ונסו שוב.';
  }
  return 'טעינת אתרי התלמידים מ-Firestore נכשלה זמנית. מוצגים בינתיים אתרי פתיחה לדוגמה.';
}

export default function App() {
  const [activePage, setActivePage] = useState<PortalPage>(() => resolvePageFromHash());

  const [firestoreSites, setFirestoreSites] = useState<StudentSiteItem[]>([]);
  const [hasLoadedFirestore, setHasLoadedFirestore] = useState<boolean>(false);
  const [firestoreLoadError, setFirestoreLoadError] = useState<string | null>(null);
  const [subscriptionNonce, setSubscriptionNonce] = useState<number>(0);
  const [firestoreFeedbacks, setFirestoreFeedbacks] = useState<Record<string, SiteFeedback[]>>({});
  const [localDemoFeedbacks, setLocalDemoFeedbacks] = useState<Record<string, SiteFeedback[]>>(
    () => INITIAL_DEMO_FEEDBACK
  );

  const [activeSite, setActiveSite] = useState<StudentSiteItem | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState<boolean>(false);

  // מצב Google Auth (Firebase Auth בלבד) + מסוף ניהול
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  useEffect(() => {
    const onHashChange = () => {
      setActivePage(resolvePageFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = (page: PortalPage, sectionAnchor?: string) => {
    setActivePage(page);
    if (page === 'sites' || page === 'generator') {
      window.location.hash = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.location.hash = sectionAnchor || 'top';
    if (sectionAnchor) {
      requestAnimationFrame(() => {
        document.getElementById(sectionAnchor)?.scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setAuthUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // האזנה בזמן אמת ל-Firestore לקטלוג אתרי התלמידים המאושרים ולמשובים
  useEffect(() => {
    if (!isAuthReady) return;
    if (!isFirebaseConfigured) {
      setFirestoreLoadError(null);
      setHasLoadedFirestore(true);
      return;
    }

    setFirestoreLoadError(null);

    const unsubSites = subscribeApprovedSites(
      (loaded) => {
        setFirestoreSites(loaded);
        setFirestoreLoadError(null);
        setHasLoadedFirestore(true);
      },
      (err) => {
        setFirestoreLoadError(formatFirestoreLoadError(err));
        setHasLoadedFirestore(true);
      }
    );

    const unsubFeedbacks = subscribeFeedbacks(
      (grouped) => {
        setFirestoreFeedbacks(grouped);
      },
      () => {
        // שמירה על תצוגה נקייה אם יש מגבלת רשת
      }
    );

    return () => {
      unsubSites();
      unsubFeedbacks();
    };
  }, [isAuthReady, subscriptionNonce]);

  const handleRetryFirestoreLoad = () => {
    if (!isFirebaseConfigured) return;
    setHasLoadedFirestore(false);
    setFirestoreLoadError(null);
    setSubscriptionNonce((prev) => prev + 1);
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const user = await googleSignIn();
      setAuthUser(user);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await logout();
    setAuthUser(null);
  };

  const isLoading = !hasLoadedFirestore;
  const usingDemoFallback = hasLoadedFirestore && firestoreSites.length === 0;
  const sites = usingDemoFallback ? DEMO_SITES : firestoreSites;

  const feedbackBySite = useMemo(() => {
    if (usingDemoFallback) {
      return localDemoFeedbacks;
    }
    return firestoreFeedbacks;
  }, [usingDemoFallback, localDemoFeedbacks, firestoreFeedbacks]);

  // בדף הראשי מפרסמים אתרים נבחרים בלבד
  const homeFeaturedSites = useMemo(() => {
    const marked = sites.filter((s) => s.isFeatured);
    return sortSites(marked, 'newest');
  }, [sites]);

  const handleAddFeedback = async (newItem: Omit<SiteFeedback, 'id' | 'createdAt'>) => {
    const existsInFirestore = firestoreSites.some((s) => s.id === newItem.siteId);

    if (existsInFirestore) {
      await addFeedbackToFirestore(newItem);
      return;
    }

    const entry: SiteFeedback = {
      ...newItem,
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setLocalDemoFeedbacks((prev) => {
      const existing = prev[newItem.siteId] || [];
      return {
        ...prev,
        [newItem.siteId]: [entry, ...existing],
      };
    });
  };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-street-concrete text-slate-950">
      {/* סרגל ניווט עליון — 3 אזורים בשורה אחת */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-xs text-white border-b-2 border-lime-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('home');
            }}
            className="inline-flex items-center gap-2.5 font-display text-base sm:text-lg font-black text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 rounded-md"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-8 h-8 shrink-0 border-2 border-white rounded-md shadow-[2px_2px_0px_#ec4899]"
              shapeRendering="crispEdges"
              aria-hidden="true"
            >
              <rect width="24" height="6" fill="#06b6d4" />
              <rect y="6" width="24" height="18" fill="#0f172a" />
              <rect x="3" y="2" width="3" height="2" fill="#facc15" />
              <rect x="8" y="2" width="3" height="2" fill="#a3e635" />
              <rect x="4" y="10" width="16" height="4" fill="#a3e635" />
              <rect x="4" y="17" width="10" height="3" fill="#ec4899" />
            </svg>
            <span className="text-lime-300">פורטל אתרים ומשחקים</span>
            <span aria-hidden="true" className="text-slate-600 font-normal hidden sm:inline">
              |
            </span>
            <span className="text-amber-300 hidden sm:inline">חנה סנש</span>
          </a>

          <nav
            aria-label="ניווט ראשי"
            className="flex items-center gap-4 sm:gap-5 text-xs sm:text-sm font-bold text-slate-200"
          >
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className={`hover:text-lime-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activePage === 'home' ? 'text-lime-300 underline underline-offset-4' : ''
              }`}
            >
              דף ראשי
            </button>
            <button
              type="button"
              onClick={() => navigateTo('sites')}
              className={`hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activePage === 'sites' ? 'text-cyan-300 underline underline-offset-4' : ''
              }`}
            >
              דף האתרים
            </button>
            <button
              type="button"
              onClick={() => navigateTo('generator')}
              className={`lg:hidden hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activePage === 'generator' ? 'text-amber-300 underline underline-offset-4' : ''
              }`}
            >
              מחולל משחקים
            </button>
            <button
              type="button"
              onClick={() => navigateTo('home', 'how-to-submit')}
              className="hidden md:inline-block hover:text-pink-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              איך מגישים אתר
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('generator')}
              className={`hidden lg:inline-flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs sm:text-sm font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                activePage === 'generator'
                  ? 'border-white bg-amber-400 text-slate-950'
                  : 'border-amber-400 bg-slate-900 text-amber-300 hover:bg-amber-400 hover:text-slate-950'
              }`}
            >
              <Gamepad2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>מחולל משחקים</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              aria-label="ניהול הפורטל"
              className="min-h-10 inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg border-2 border-cyan-400 bg-slate-900 text-cyan-300 text-xs sm:text-sm font-bold hover:bg-cyan-400 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>ניהול</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSubmitOpen(true)}
              className="min-h-10 inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-xs sm:text-sm font-extrabold shadow-[3px_3px_0px_#ec4899] hover:bg-lime-300 hover:-translate-y-0.5 active:translate-y-0 transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
            >
              <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">הגשת אתר חדש</span>
              <span className="sm:hidden">הגשה</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {activePage === 'sites' ? (
          <SitesCatalogPage
            sites={sites}
            isLoading={isLoading}
            isFirebaseConfigured={isFirebaseConfigured}
            firebaseConfigError={firebaseConfigError}
            firestoreLoadError={firestoreLoadError}
            usingDemoFallback={usingDemoFallback}
            feedbackBySite={feedbackBySite}
            onOpenSite={setActiveSite}
            onBackHome={() => navigateTo('home')}
            onOpenGenerator={() => navigateTo('generator')}
            onOpenSubmit={() => setIsSubmitOpen(true)}
            onRetryLoad={handleRetryFirestoreLoad}
            onOpenAdmin={() => setIsAdminOpen(true)}
          />
        ) : activePage === 'generator' ? (
          <GamePromptGeneratorPage
            user={authUser}
            isSigningIn={isSigningIn}
            onSignIn={handleGoogleSignIn}
            onSignOut={handleGoogleSignOut}
            onBackHome={() => navigateTo('home')}
            onOpenCatalog={() => navigateTo('sites')}
            onOpenSubmit={() => setIsSubmitOpen(true)}
          />
        ) : (
          <>
            {/* קיר פתיחה אורבני + כותרת MINECRAFT */}
            <section className="relative overflow-hidden bg-dark-wall text-white border-b-4 border-slate-950">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -start-24 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/3 end-1/4 w-80 h-80 rounded-full bg-pink-500/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-24 start-1/3 w-80 h-80 rounded-full bg-lime-400/15 blur-3xl"
              />

              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-12 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                  <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                    <div className="space-y-5">
                      <h1 className="space-y-3">
                        <span className="block minecraft-title text-4xl sm:text-5xl xl:text-6xl leading-none tracking-tight">
                          פורטל אתרים ומשחקים
                        </span>

                        <span className="inline-flex flex-wrap items-center gap-3 pt-1">
                          <span className="text-sm sm:text-base font-bold text-slate-300">
                            אתרי Google Sites ומשחקי בית הספר
                          </span>
                          <span className="inline-block px-4 py-1.5 rounded-lg border-2 border-white bg-amber-400 text-slate-950 font-display text-2xl sm:text-3xl font-black shadow-[5px_5px_0px_#ec4899] -rotate-2">
                            חנה סנש
                          </span>
                        </span>
                      </h1>

                      <p className="text-base sm:text-lg font-bold text-cyan-300 leading-snug max-w-2xl">
                        המשחקים גם הם אתרים — כל התוצרים נוצרים ב-Google Sites ובמחולל המשחקים במסגרת שיעורי המחשבים, והפורטל מנוהל על-ידי קבוצת המצויינות.
                      </p>

                      <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                        ברוכים הבאים לפורטל אתרים ומשחקים של חנה סנש! בדף הראשי מוצגים האתרים הנבחרים, ובדף האתרים המלא תוכלו לצפות בחדשים ולחפש לפי תוויות.
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => navigateTo('sites')}
                          className="min-h-12 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-white bg-cyan-400 text-slate-950 text-sm sm:text-base font-black shadow-[4px_4px_0px_#ec4899] hover:bg-cyan-300 hover:-translate-y-0.5 transition-all cursor-pointer"
                        >
                          <LayoutGrid className="w-5 h-5 shrink-0" aria-hidden="true" />
                          <span>מעבר לדף האתרים המלא ({sites.length})</span>
                          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => navigateTo('generator')}
                          className="min-h-12 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-white bg-amber-400 text-slate-950 text-sm sm:text-base font-black shadow-[4px_4px_0px_#06b6d4] hover:bg-amber-300 hover:-translate-y-0.5 transition-all cursor-pointer"
                        >
                          <Gamepad2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                          <span>מחולל משחקים</span>
                          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsSubmitOpen(true)}
                          className="min-h-12 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-700 bg-slate-900/90 text-lime-300 text-sm sm:text-base font-extrabold hover:border-lime-400 transition-colors cursor-pointer"
                        >
                          <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>הגשת אתר חדש</span>
                        </button>
                      </div>
                    </div>

                    {/* כרטיסי מידע */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/90 border-2 border-cyan-400 shadow-[4px_4px_0px_#06b6d4]">
                          <div className="w-9 h-9 rounded-lg bg-cyan-400 text-slate-950 inline-flex items-center justify-center shrink-0">
                            <Laptop className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <div className="space-y-0.5">
                            <h2 className="font-display text-sm font-bold text-white">
                              אתרים ומשחקים ב-Google Sites
                            </h2>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              המשחקים גם הם אתרים — תוצרי חקר, מידע, חברה, מועצת תלמידים ומשחקי תחביב שנבנו בשיעורים.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/90 border-2 border-pink-500 shadow-[4px_4px_0px_#ec4899]">
                          <div className="w-9 h-9 rounded-lg bg-pink-500 text-white inline-flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <div className="space-y-0.5">
                            <h2 className="font-display text-sm font-bold text-white">
                              צפייה ציבורית ובטוחה
                            </h2>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              קבוצת המצויינות בודקת שכל קישור פתוח לציבור מחוץ לארגון ושומרת על משובים מכבדים.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-slate-300 tabular-nums">
                        <span>
                          <strong className="font-extrabold text-lime-300">{sites.length}</strong> אתרי תלמידים מאושרים
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>שכבות א׳ עד ו׳</span>
                        <span aria-hidden="true">·</span>
                        <span>פתוח לצפייה ציבורית</span>
                      </div>
                    </div>
                  </div>

                  {/* איור קיר רחוב וחלונות אתרים */}
                  <div className="lg:col-span-5">
                    <div className="relative h-64 sm:h-80 lg:h-full min-h-[260px] rounded-2xl border-2 border-lime-400 shadow-[8px_8px_0px_#ec4899] overflow-hidden bg-slate-900">
                      <img
                        src={heroShowcaseImg}
                        alt="ציור קיר צבעוני של חלונות אתרי תלמידים בנושאי טבע, מדע, ספרים ויצירה"
                        className="w-full h-full object-cover"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-2 flex"
                      >
                        <span className="flex-1 bg-lime-400" />
                        <span className="flex-1 bg-cyan-400" />
                        <span className="flex-1 bg-amber-400" />
                        <span className="flex-1 bg-pink-500" />
                        <span className="flex-1 bg-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {firestoreLoadError ? (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-50 text-rose-950 border-2 border-rose-500 shadow-[4px_4px_0px_#e11d48] text-sm font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                      <span>{firestoreLoadError}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleRetryFirestoreLoad}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-slate-950 bg-white text-slate-950 text-xs font-extrabold hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>ניסיון טעינה מחדש</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAdminOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-xs font-extrabold hover:bg-lime-300 whitespace-nowrap cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>פתיחת מסוף הניהול</span>
                      </button>
                    </div>
                  </div>
                ) : usingDemoFallback && (
                  <div
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-400 text-slate-950 border-2 border-white shadow-[4px_4px_0px_#06b6d4] text-sm font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <Info className="w-4 h-4 text-slate-950 shrink-0" aria-hidden="true" />
                      <span>
                        {!isFirebaseConfigured && firebaseConfigError
                          ? 'תצורת Firebase חסרה בסביבה זו — מוצגים אתרי פתיחה לדוגמה במקום אתרי התלמידים השמורים.'
                          : 'מוצגים כעת אתרי פתיחה לדוגמה. התחברו במסוף הניהול כדי לאשר אתרי Google Sites שהגישו תלמידים או לייבא קובץ CSV.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdminOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-xs font-extrabold hover:bg-lime-300 whitespace-nowrap cursor-pointer shrink-0"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>פתיחת מסוף הניהול</span>
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* בדף הראשי מפרסמים אתרים נבחרים בלבד */}
            <section
              aria-labelledby="home-featured-heading"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-7"
            >
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-slate-950 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-400 border-2 border-slate-950 shadow-[3px_3px_0px_#020617] text-slate-950 inline-flex items-center justify-center shrink-0">
                    <Star className="w-5 h-5 fill-slate-950" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="home-featured-heading"
                      className="font-display text-2xl sm:text-3xl font-black text-slate-950"
                    >
                      אתרים נבחרים
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600">
                      אתרי ה-Google Sites המומלצים של תלמידי חנה סנש
                    </p>
                    {isLoading && (
                      <p aria-live="polite" className="text-xs font-bold text-blue-700 mt-1">
                        טוען אתרי תלמידים ממסד הנתונים...
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigateTo('sites')}
                  className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-950 bg-lime-400 text-slate-950 text-sm font-extrabold shadow-[3px_3px_0px_#020617] hover:bg-lime-300 transition-colors cursor-pointer"
                >
                  <span>לכל האתרים והחיפוש לפי תוויות</span>
                  <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="bg-white border-2 border-slate-950 rounded-xl overflow-hidden animate-pulse"
                    >
                      <div className="aspect-video bg-slate-200" />
                      <div className="p-5 space-y-3">
                        <div className="h-5 bg-slate-200 rounded w-3/4" />
                        <div className="h-3.5 bg-slate-100 rounded w-1/2" />
                        <div className="h-10 bg-slate-100 rounded w-full" />
                        <div className="h-11 bg-slate-200 rounded-lg w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : homeFeaturedSites.length === 0 ? (
                <div className="bg-white border-2 border-slate-950 rounded-xl shadow-[5px_5px_0px_#020617] p-10 text-center space-y-3">
                  <Star className="w-10 h-10 text-amber-500 mx-auto" aria-hidden="true" />
                  <h3 className="font-display text-lg font-bold text-slate-950">
                    עדיין לא נבחרו אתרים להצגה בדף הראשי
                  </h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    מנהלי הפורטל יכולים לסמן אתרים כ&quot;נבחר&quot; במסוף הניהול. בינתיים אפשר לצפות בכל האתרים בדף האתרים המלא!
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateTo('sites')}
                    className="mt-2 min-h-10 inline-flex items-center gap-2 px-5 py-2 rounded-lg border-2 border-slate-950 bg-cyan-400 text-slate-950 text-sm font-extrabold shadow-[3px_3px_0px_#020617] hover:bg-cyan-300 cursor-pointer"
                  >
                    <span>לדף האתרים המלא</span>
                    <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {homeFeaturedSites.map((site) => {
                    const siteFeedbacks = feedbackBySite[site.id] || [];
                    const avg =
                      siteFeedbacks.length > 0
                        ? siteFeedbacks.reduce((sum, item) => sum + item.rating, 0) /
                          siteFeedbacks.length
                        : null;

                    return (
                      <SiteCard
                        key={site.id}
                        site={site}
                        feedbackCount={siteFeedbacks.length}
                        averageRating={avg}
                        onOpen={setActiveSite}
                      />
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-slate-950 text-white border-2 border-slate-950 shadow-[6px_6px_0px_#06b6d4]">
                <div className="space-y-1 text-center sm:text-start">
                  <div className="font-display text-lg font-black text-lime-300">
                    רוצים לראות עוד אתרים לפי תוויות?
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300">
                    בדף האתרים מחכים לכם מדורי חדשים (6), נבחרים (6) וחיפוש ומיון לפי כל 6 התוויות.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigateTo('sites')}
                  className="min-h-11 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-white bg-pink-500 text-white text-sm font-extrabold shadow-[3px_3px_0px_#a3e635] hover:bg-pink-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>מעבר לדף האתרים</span>
                  <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </section>

            {/* מדריך פרסום והגשת אתרי Google Sites */}
            <section
              id="how-to-submit"
              className="bg-dark-wall text-white border-t-4 border-slate-950 mt-4"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-black text-white">
                      בניתם אתר Google Sites? שתפו אותו עם כולם!
                    </h2>
                    <p className="mt-1.5 text-sm sm:text-base text-slate-300">
                      שלושה צעדים פשוטים מהחשבון הבית-ספרי אל הפורטל הפתוח של חנה סנש.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSubmitOpen(true)}
                    className="min-h-11 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border-2 border-white bg-pink-500 text-white text-sm font-extrabold shadow-[4px_4px_0px_#a3e635] hover:bg-pink-400 hover:-translate-y-0.5 transition-all whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>מעבר לטופס הגשת אתר</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-xl bg-slate-900 border-2 border-cyan-400 shadow-[5px_5px_0px_#06b6d4] space-y-2">
                    <div className="text-sm font-black text-cyan-300">01. מפרסמים לציבור</div>
                    <h3 className="font-display text-lg font-extrabold text-white">
                      לוחצים &quot;פרסום&quot; ומאפשרים צפייה ציבורית
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      ב-Google Sites לוחצים על <strong>פרסום</strong>, משנים את הרשאת הצפייה של האתר המפורסם ל<strong>&quot;כל אחד (ציבורי)&quot;</strong> ומעתיקים את הקישור לאתר שפורסם (לא קישור עריכה).
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-slate-900 border-2 border-amber-400 shadow-[5px_5px_0px_#facc15] space-y-2">
                    <div className="text-sm font-black text-amber-300">02. תוויות והקדמה</div>
                    <h3 className="font-display text-lg font-extrabold text-white">
                      בוחרים תוויות וכמה מילים מאת היוצר
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      לוחצים על &quot;הגשת אתר חדש&quot;, מדביקים את הקישור, בוחרים תוויות מתאימות וכותבים הקדמה אישית שתוקרן לפני המעבר לאתר.
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-slate-900 border-2 border-lime-400 shadow-[5px_5px_0px_#a3e635] space-y-2">
                    <div className="text-sm font-black text-lime-300">03. בדיקת קבוצת המצויינות</div>
                    <h3 className="font-display text-lg font-extrabold text-white">
                      וידוא צפייה ציבורית ועלייה לגלריה
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      קבוצת המצויינות והמורה בודקים שהאתר נפתח כראוי גם מחוץ לחשבון הארגוני ושהתוכן מכבד. לאחר האישור — האתר עולה מיד לפורטל!
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* כותרת תחתונה */}
      <footer
        id="about-portal"
        className="bg-slate-950 text-slate-300 border-t border-slate-800"
      >
        <div aria-hidden="true" className="h-2 flex">
          <span className="flex-1 bg-lime-400" />
          <span className="flex-1 bg-cyan-400" />
          <span className="flex-1 bg-amber-400" />
          <span className="flex-1 bg-pink-500" />
          <span className="flex-1 bg-blue-500" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm">
          <div>
            <p className="font-display font-bold text-white">פורטל אתרים ומשחקים · בית הספר חנה סנש</p>
            <p className="text-slate-400 text-xs mt-1">
              אתרי Google Sites ומשחקי תלמידים (המשחקים גם הם אתרים) · צפייה ציבורית פתוחה לכולם
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="hover:text-lime-300 transition-colors cursor-pointer"
            >
              דף ראשי
            </button>
            <button
              type="button"
              onClick={() => navigateTo('sites')}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              דף האתרים
            </button>
            <button
              type="button"
              onClick={() => navigateTo('generator')}
              className="hover:text-amber-300 transition-colors cursor-pointer"
            >
              מחולל משחקים
            </button>
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-amber-300 transition-colors cursor-pointer"
            >
              ניהול ומורשים
            </button>
          </div>
        </div>
      </footer>

      {/* מודאל מסך הקדמה + פתיחת Google Site בלשונית חדשה + משובים */}
      <SiteShowcaseModal
        site={activeSite}
        feedbacks={activeSite ? feedbackBySite[activeSite.id] || [] : []}
        onAddFeedback={handleAddFeedback}
        onClose={() => setActiveSite(null)}
      />

      {/* מודאל הגשת אתר Google Sites חדש לתלמידים */}
      <SubmitSiteModal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
      />

      {/* מסוף ניהול הפורטל (Firestore בלבד) */}
      <AdminConsoleModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        user={authUser}
        isSigningIn={isSigningIn}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
      />
    </div>
  );
}
