import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Info,
  MessageSquarePlus,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react';
import { SiteFeedback, StudentSiteItem } from '../types/portal';
import { checkFeedbackModeration } from '../utils/moderation';
import {
  formatStudentFirstNameAndNickname,
  inspectGoogleSiteUrl,
} from '../utils/portalUtils';
import { SitePreviewMedia } from './SitePreviewMedia';

interface SiteShowcaseModalProps {
  site: StudentSiteItem | null;
  feedbacks: SiteFeedback[];
  onAddFeedback: (feedback: Omit<SiteFeedback, 'id' | 'createdAt'>) => Promise<void> | void;
  onClose: () => void;
}

export const SiteShowcaseModal: React.FC<SiteShowcaseModalProps> = ({
  site,
  feedbacks,
  onAddFeedback,
  onClose,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // שדות טופס המשוב (שם פרטי + כינוי בלבד)
  const [firstName, setFirstName] = useState('');
  const [nickname, setNickname] = useState('');
  const [playerGrade, setPlayerGrade] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (!site) return;
    setFirstName('');
    setNickname('');
    setPlayerGrade('');
    setRating(5);
    setComment('');
    setModerationError(null);
    setSubmitSuccess(false);
  }, [site?.id, site?.imageUrl]);

  useEffect(() => {
    if (!site) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [site, onClose]);

  if (!site) return null;

  const linkInfo = inspectGoogleSiteUrl(site.siteUrl, false);
  const creatorsText = site.creators.join(', ');

  const averageRating =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, item) => sum + item.rating, 0) / feedbacks.length
      : null;

  const handleFeedbackSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitSuccess(false);

    const trimmedFirst = firstName.trim();
    const trimmedNickname = nickname.trim();
    const trimmedGrade = playerGrade.trim();
    const trimmedComment = comment.trim();

    if (!trimmedFirst) {
      setModerationError('אנא כתבו שם פרטי בלבד (ללא שם משפחה).');
      return;
    }

    if (/\s+/.test(trimmedFirst)) {
      setModerationError(
        'לשמירה על פרטיותכם, בשדה השם הפרטי יש לכתוב מילה אחת בלבד (ללא שם משפחה). ניתן להוסיף כינוי בשדה שליד.'
      );
      return;
    }

    const displayName = formatStudentFirstNameAndNickname(trimmedFirst, trimmedNickname);
    if (!displayName) {
      setModerationError('אנא כתבו שם פרטי תקין.');
      return;
    }

    if (trimmedComment.length < 3) {
      setModerationError('אנא כתבו משוב של לפחות 3 תווים.');
      return;
    }

    const moderationResult = checkFeedbackModeration(
      `${displayName} ${trimmedGrade}`,
      trimmedComment
    );

    if (!moderationResult.isAllowed) {
      setModerationError(moderationResult.reasonMessage);
      return;
    }

    setModerationError(null);
    setIsSubmittingFeedback(true);
    try {
      await onAddFeedback({
        siteId: site.id,
        playerName: displayName,
        playerGrade: trimmedGrade || undefined,
        rating,
        comment: trimmedComment,
      });

      setFirstName('');
      setNickname('');
      setPlayerGrade('');
      setRating(5);
      setComment('');
      setSubmitSuccess(true);
    } catch (err) {
      setModerationError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'לא הצלחנו לשמור את המשוב כרגע. נסו שוב בעוד רגע.'
      );
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const formatHebrewDate = (isoDate: string): string => {
    try {
      return new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(isoDate));
    } catch {
      return '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-site-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white border-2 border-slate-950 rounded-2xl shadow-[8px_8px_0px_#06b6d4] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת עליונה ופעולות */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b-2 border-slate-950 bg-slate-50">
          <div className="min-w-0 flex-1">
            <h2
              id="modal-site-title"
              className="font-display text-lg sm:text-xl font-black text-slate-950 truncate"
            >
              {site.title}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-slate-600">
              <span>יוצרים: {creatorsText}</span>
              <span aria-hidden="true">·</span>
              <span>שכבת {site.grade}</span>
              <span aria-hidden="true">·</span>
              <span>{(site.tags.length > 0 ? site.tags : [site.category]).join(' · ')}</span>
              {site.isFeatured && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                    <span>אתר נבחר</span>
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{linkInfo.domainLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {linkInfo.isValid && linkInfo.normalizedUrl && (
              <a
                href={linkInfo.normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-xs sm:text-sm font-extrabold shadow-[2px_2px_0px_#020617] hover:bg-lime-300 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span>פתיחת האתר בלשונית חדשה</span>
                <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              </a>
            )}

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="סגירת חלון האתר"
              className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-950 hover:text-slate-950 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* גוף המודאל: מסך הקדמה של היוצרים + פתיחה בלשונית חדשה -> תיאור -> משובים */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* כרטיס מסך הפתיחה של התלמיד */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-slate-950 bg-slate-950 text-white shadow-[5px_5px_0px_#020617]">
            <div className="absolute inset-0 opacity-40 pointer-events-none">
              <SitePreviewMedia
                title={site.title}
                creatorsText={creatorsText}
                grade={site.grade}
                primaryTag={site.tags[0] || site.category}
                siteUrl={site.siteUrl}
                imageUrl={site.imageUrl}
                variant="backdrop"
                alt=""
              />
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-900/75"
            />

            <div className="relative p-5 sm:p-8 flex flex-col justify-between gap-6 min-h-[300px]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-cyan-300">
                <span className="font-bold">
                  הקדמה לאתר · שיעורי המחשבים, בית הספר חנה סנש
                </span>
                <span className="font-semibold text-amber-300">שכבת {site.grade}</span>
              </div>

              <div className="max-w-3xl space-y-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-300">
                    <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {site.creators.length > 1 ? 'צוות היוצרים:' : 'יוצר/ת האתר:'}
                    </span>
                  </div>
                  <p className="font-display text-xl sm:text-2xl font-black text-white">
                    {creatorsText}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900/85 border border-white/20 p-4 sm:p-5 space-y-1.5 backdrop-blur-xs">
                  <div className="text-xs font-bold text-cyan-300">
                    כמה מילים מאת {site.creators.length > 1 ? 'היוצרים' : 'היוצר'}:
                  </div>
                  <p className="text-sm sm:text-base text-slate-100 leading-relaxed whitespace-pre-line">
                    {site.creatorNote}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                {linkInfo.isValid && linkInfo.normalizedUrl ? (
                  <a
                    href={linkInfo.normalizedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-12 inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl border-2 border-white bg-lime-400 text-slate-950 text-sm sm:text-base font-black shadow-[4px_4px_0px_#ec4899] hover:bg-lime-300 hover:-translate-y-0.5 active:translate-y-0 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <Globe className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span>פתיחת אתר ה-Google Site בלשונית חדשה</span>
                    <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-sm font-semibold text-rose-300">
                    כתובת האתר אינה תקינה — יש לעדכנה במסוף הניהול.
                  </span>
                )}

                {linkInfo.normalizedUrl && (
                  <span
                    dir="ltr"
                    className="text-xs font-mono text-slate-300 bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-lg max-w-full sm:max-w-xs truncate"
                  >
                    {linkInfo.normalizedUrl}
                  </span>
                )}
              </div>
            </div>
          </div>

          {site.isDemo && (
            <div
              role="status"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs sm:text-sm leading-relaxed"
            >
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                זהו כרטיס דוגמה להמחשת התצוגה. ברגע שייאושרו אתרי Google Sites אמיתיים של תלמידי בית הספר במסוף הניהול, הקישורים יובילו ישירות לאתרים שפורסמו.
              </span>
            </div>
          )}

          {/* תיאור האתר ופרטים נוספים */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <h3 className="font-display text-base font-bold text-slate-950">
                מה תמצאו באתר?
              </h3>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
                {site.description}
              </p>
              <div className="pt-1 text-xs sm:text-sm text-slate-600">
                <span className="font-semibold text-slate-800">יוצרי האתר: </span>
                <span>{creatorsText}</span>
              </div>
            </div>

            <div className="sm:max-w-xs rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 leading-relaxed space-y-1">
              <div className="font-bold text-slate-900">צפייה ציבורית מכל מכשיר</div>
              <p>
                האתר נפתח בלשונית חדשה בגודל מלא כדי להבטיח תצוגה נקייה של כל הדפים והטמעות ה-Google Sites של התלמידים, גם מחוץ לחשבון הארגוני.
              </p>
            </div>
          </div>

          {/* אזור משובים עם בקרת תוכן */}
          <section
            aria-labelledby="feedback-section-title"
            className="pt-5 border-t border-slate-200 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                <h3
                  id="feedback-section-title"
                  className="font-display text-lg font-bold text-slate-950"
                >
                  משוב ומחמאות ליוצרים
                </h3>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 tabular-nums">
                {averageRating !== null ? (
                  <>
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
                    <span className="font-bold text-slate-900">{averageRating.toFixed(1)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{feedbacks.length} משובים</span>
                  </>
                ) : (
                  <span>עדיין אין משובים לאתר זה — היו הראשונים לפרגן!</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* טופס כתיבת משוב */}
              <form
                onSubmit={handleFeedbackSubmit}
                className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
              >
                <div className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    כתיבה מכבדת בלבד: לפני הפרסום מתבצעת בדיקה אוטומטית למניעת מילים פוגעניות, אלימות ותוכן מיני.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="fb-first-name"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      שם פרטי בלבד (ללא שם משפחה) *
                    </label>
                    <input
                      id="fb-first-name"
                      type="text"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        if (moderationError) setModerationError(null);
                      }}
                      maxLength={16}
                      placeholder="למשל: אורי"
                      className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="fb-nickname"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      כינוי (לא חובה)
                    </label>
                    <input
                      id="fb-nickname"
                      type="text"
                      value={nickname}
                      onChange={(e) => {
                        setNickname(e.target.value);
                        if (moderationError) setModerationError(null);
                      }}
                      maxLength={16}
                      placeholder="למשל: אלוף הקוד"
                      className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="fb-player-grade"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    שכבה / אורח (לא חובה)
                  </label>
                  <input
                    id="fb-player-grade"
                    type="text"
                    value={playerGrade}
                    onChange={(e) => {
                      setPlayerGrade(e.target.value);
                      if (moderationError) setModerationError(null);
                    }}
                    maxLength={15}
                    placeholder="למשל: שכבה ד׳ / הורה"
                    className="w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    דירוג האתר
                  </span>
                  <div className="flex items-center gap-1" role="group" aria-label="דירוג כוכבים">
                    {[1, 2, 3, 4, 5].map((starValue) => {
                      const active = starValue <= rating;
                      return (
                        <button
                          key={starValue}
                          type="button"
                          onClick={() => setRating(starValue)}
                          aria-label={`דירוג ${starValue} מתוך 5 כוכבים`}
                          aria-pressed={rating === starValue}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              active ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="fb-comment"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    המשוב שלך ליוצרים
                  </label>
                  <textarea
                    id="fb-comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => {
                      setComment(e.target.value);
                      if (moderationError) setModerationError(null);
                      if (submitSuccess) setSubmitSuccess(false);
                    }}
                    maxLength={350}
                    placeholder="מה אהבתם באתר? איזה עמוד היה הכי מעניין?"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
                  />
                </div>

                {moderationError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{moderationError}</span>
                  </div>
                )}

                {submitSuccess && (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>תודה רבה! המשוב נבדק ופורסם בהצלחה.</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingFeedback}
                  className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-950 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{isSubmittingFeedback ? 'בודק ושולח...' : 'בדיקה ושליחת משוב'}</span>
                </button>
              </form>

              {/* רשימת משובים שפורסמו */}
              <div className="lg:col-span-7 space-y-3">
                {feedbacks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    עדיין לא נכתבו משובים לאתר זה. כתבו פרגון או טיפ בונה ליוצרים!
                  </div>
                ) : (
                  feedbacks.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                          <span>{item.playerName}</span>
                          {item.playerGrade && (
                            <>
                              <span aria-hidden="true" className="text-slate-400 font-normal">
                                ·
                              </span>
                              <span className="text-xs font-medium text-slate-500">
                                {item.playerGrade}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                          <span
                            className="inline-flex items-center gap-0.5"
                            aria-label={`דירוג ${item.rating} מתוך 5`}
                          >
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star
                                key={idx}
                                className={`w-3.5 h-3.5 ${
                                  idx < item.rating
                                    ? 'text-amber-500 fill-amber-500'
                                    : 'text-slate-200'
                                }`}
                                aria-hidden="true"
                              />
                            ))}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatHebrewDate(item.createdAt)}</span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {item.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
