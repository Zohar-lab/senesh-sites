import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Globe,
  Info,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { submitStudentSite } from '../services/firestorePortal';
import { SiteTag } from '../types/portal';
import { checkFeedbackModeration } from '../utils/moderation';
import {
  formatStudentFirstNameAndNickname,
  inspectGoogleSiteUrl,
  normalizeHttpUrl,
  SITE_TAGS,
} from '../utils/portalUtils';

interface SubmitSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CreatorDraftRow {
  firstName: string;
  nickname: string;
}

export const SubmitSiteModal: React.FC<SubmitSiteModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [creatorRows, setCreatorRows] = useState<CreatorDraftRow[]>([
    { firstName: '', nickname: '' },
  ]);
  const [creatorNote, setCreatorNote] = useState('');
  const [grade, setGrade] = useState("ג'-ד'");
  const [selectedTags, setSelectedTags] = useState<SiteTag[]>(['חקר']);
  const [siteUrl, setSiteUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const liveUrlCheck = siteUrl.trim() ? inspectGoogleSiteUrl(siteUrl, true) : null;

  const toggleTag = (tag: SiteTag) => {
    setErrorMsg(null);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const updateCreatorRow = (
    index: number,
    field: keyof CreatorDraftRow,
    value: string
  ) => {
    setErrorMsg(null);
    setCreatorRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const addCreatorRow = () => {
    if (creatorRows.length >= 10) return;
    setCreatorRows((prev) => [...prev, { firstName: '', nickname: '' }]);
  };

  const removeCreatorRow = (index: number) => {
    if (creatorRows.length <= 1) return;
    setCreatorRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setTitle('');
    setCreatorRows([{ firstName: '', nickname: '' }]);
    setCreatorNote('');
    setGrade("ג'-ד'");
    setSelectedTags(['חקר']);
    setSiteUrl('');
    setImageUrl('');
    setDescription('');
    setErrorMsg(null);
  };

  const handleClose = () => {
    setSubmittedTitle(null);
    setErrorMsg(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = title.trim();
    const linkCheck = inspectGoogleSiteUrl(siteUrl, true);
    const normalizedImage = imageUrl.trim() ? normalizeHttpUrl(imageUrl) : '';

    if (!trimmedTitle) {
      setErrorMsg('אנא כתבו את שם האתר.');
      return;
    }

    const nonEmptyRows = creatorRows.filter(
      (r) => r.firstName.trim() !== '' || r.nickname.trim() !== ''
    );

    if (nonEmptyRows.length === 0) {
      setErrorMsg('אנא כתבו שם פרטי של לפחות יוצר/ת אחת בצוות (ללא שם משפחה).');
      return;
    }

    const hasLastNameAttempt = nonEmptyRows.some((r) =>
      /\s+/.test(r.firstName.trim())
    );
    if (hasLastNameAttempt) {
      setErrorMsg(
        'לשמירה על פרטיותכם, בשדה "שם פרטי" יש לכתוב מילה אחת בלבד (ללא שם משפחה). ניתן להוסיף כינוי בשדה שליד.'
      );
      return;
    }

    const formattedCreators = nonEmptyRows
      .map((r) => formatStudentFirstNameAndNickname(r.firstName, r.nickname))
      .filter(Boolean);

    if (formattedCreators.length === 0) {
      setErrorMsg('אנא הזינו שם פרטי תקין (ללא שם משפחה).');
      return;
    }

    if (selectedTags.length === 0) {
      setErrorMsg('בחרו לפחות תווית אחת המתארת את נושא האתר.');
      return;
    }

    if (!linkCheck.isValid) {
      setErrorMsg(
        linkCheck.errorMessage ||
          'אנא הדביקו קישור מפורסם ותקין של Google Sites (https://sites.google.com/...).'
      );
      return;
    }

    if (imageUrl.trim() && !normalizedImage) {
      setErrorMsg('הקישור לתמונת השער אינו תקין. השאירו ריק או הזינו קישור המתחיל ב-https://.');
      return;
    }

    const modCheck = checkFeedbackModeration(
      `${trimmedTitle} ${formattedCreators.join(' ')}`,
      `${creatorNote} ${description}`
    );
    if (!modCheck.isAllowed) {
      setErrorMsg(modCheck.reasonMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      await submitStudentSite({
        title: trimmedTitle,
        creators: formattedCreators,
        creatorNote:
          creatorNote.trim() ||
          `האתר "${trimmedTitle}" נבנה ב-Google Sites במסגרת שיעורי המחשבים בבית הספר חנה סנש.`,
        grade,
        category: selectedTags[0],
        tags: selectedTags,
        description:
          description.trim() ||
          'אתר Google Sites שנוצר על ידי תלמידי בית הספר חנה סנש. לחצו לצפייה!',
        siteUrl: linkCheck.normalizedUrl,
        imageUrl: normalizedImage,
      });
      setSubmittedTitle(trimmedTitle);
      resetForm();
    } catch (err) {
      setErrorMsg(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'לא הצלחנו לשלוח את האתר כרגע. נסו שוב בעוד רגע.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-site-title"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-white border-2 border-slate-950 rounded-2xl shadow-[8px_8px_0px_#ec4899] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-slate-950 text-white border-b-2 border-lime-400">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-lime-400 text-slate-950 inline-flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="submit-site-title" className="font-display text-lg font-extrabold">
                הגשת אתר Google Sites חדש
              </h2>
              <p className="text-xs text-slate-300">
                האתר יישלח לבדיקת קבוצת המצויינות והמורה לפני פרסומו בדף האתרים של חנה סנש
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="סגירת טופס הגשת אתר"
            className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {submittedTitle ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 inline-flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-black text-slate-950">
                כל הכבוד! האתר &quot;{submittedTitle}&quot; נשלח לבדיקה
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                האתר נקלט בסטטוס <strong>&quot;ממתין לאישור&quot;</strong>. ברגע שקבוצת המצויינות או המורה יבדקו שהקישור פתוח לציבור ויאשרו אותו במסוף הניהול, האתר יופיע בדף האתרים!
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmittedTitle(null)}
                  className="min-h-10 px-4 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-sm font-extrabold hover:bg-lime-300 cursor-pointer"
                >
                  הגשת אתר נוסף
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-10 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-100 cursor-pointer"
                >
                  חזרה לפורטל
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 text-xs text-cyan-950 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <div>
                    <strong className="font-bold">חשוב לפני ההגשה:</strong> בתוך Google Sites לחצו על{' '}
                    <strong>&quot;פרסום&quot; (Publish)</strong>, ובסעיף <em>&quot;מי יכול לראות את האתר&quot;</em>{' '}
                    בחרו <strong>&quot;כל אחד (ציבורי)&quot;</strong> כדי שגם אורחים מחוץ לחשבון הארגוני יוכלו לצפות באתר.
                  </div>
                  <div className="font-semibold text-cyan-900">
                    שמירה על פרטיות התלמידים: יש להזין שם פרטי וכינוי בלבד — ללא שמות משפחה.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="sub-title" className="block text-xs font-bold text-slate-800 mb-1">
                    שם האתר *
                  </label>
                  <input
                    id="sub-title"
                    type="text"
                    required
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="למשל: שומרי הים התיכון"
                    className="w-full min-h-10 px-3 py-2 rounded-lg border-2 border-slate-300 text-sm focus:outline-none focus:border-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="sub-grade" className="block text-xs font-bold text-slate-800 mb-1">
                    שכבת גיל
                  </label>
                  <select
                    id="sub-grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full min-h-10 px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:border-slate-950"
                  >
                    <option value="א'-ב'">א&apos;-ב&apos;</option>
                    <option value="ג'-ד'">ג&apos;-ד&apos;</option>
                    <option value="ה'-ו'">ה&apos;-ו&apos;</option>
                  </select>
                </div>

                {/* יוצרי האתר: שם פרטי + כינוי בלבד */}
                <div className="sm:col-span-2 space-y-2 rounded-xl border-2 border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs font-bold text-slate-900">
                        יוצרי האתר (שם פרטי וכינוי בלבד — ללא שם משפחה) *
                      </span>
                      <span className="text-[11px] text-slate-600">
                        בשדה השם הפרטי רושמים מילה אחת בלבד. שדה הכינוי הוא אופציונלי.
                      </span>
                    </div>

                    {creatorRows.length < 10 && (
                      <button
                        type="button"
                        onClick={addCreatorRow}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 hover:border-slate-950 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>הוספת יוצר/ת</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {creatorRows.map((row, idx) => {
                      const hasSpaceInFirst = /\s+/.test(row.firstName.trim());
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                            <div className="sm:col-span-5">
                              <input
                                type="text"
                                required={idx === 0}
                                maxLength={16}
                                aria-label={`שם פרטי של יוצר ${idx + 1}`}
                                value={row.firstName}
                                onChange={(e) =>
                                  updateCreatorRow(idx, 'firstName', e.target.value)
                                }
                                placeholder="שם פרטי בלבד (למשל: נועה)"
                                className={`w-full min-h-10 px-3 py-2 rounded-lg border-2 bg-white text-sm focus:outline-none ${
                                  hasSpaceInFirst
                                    ? 'border-rose-500 focus:border-rose-600'
                                    : 'border-slate-300 focus:border-slate-950'
                                }`}
                              />
                            </div>
                            <div className="sm:col-span-6">
                              <input
                                type="text"
                                maxLength={16}
                                aria-label={`כינוי של יוצר ${idx + 1} (לא חובה)`}
                                value={row.nickname}
                                onChange={(e) =>
                                  updateCreatorRow(idx, 'nickname', e.target.value)
                                }
                                placeholder="כינוי — לא חובה (למשל: אלופת הקוד)"
                                className="w-full min-h-10 px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-sm focus:outline-none focus:border-slate-950"
                              />
                            </div>
                            <div className="sm:col-span-1 flex justify-end">
                              {creatorRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCreatorRow(idx)}
                                  aria-label={`הסרת יוצר ${idx + 1}`}
                                  className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>
                          {hasSpaceInFirst && (
                            <p className="text-[11px] font-semibold text-rose-700">
                              יש לרשום שם פרטי בלבד במילה אחת (ללא שם משפחה).
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <span className="block text-xs font-bold text-slate-800 mb-1.5">
                    תיוג האתר (ניתן לבחור תווית אחת או יותר) *
                  </span>
                  <div
                    role="group"
                    aria-label="בחירת תוויות לאתר"
                    className="flex flex-wrap gap-2"
                  >
                    {SITE_TAGS.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleTag(tag)}
                          className={`min-h-9 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                            active
                              ? 'border-slate-950 bg-lime-400 text-slate-950 shadow-[2px_2px_0px_#020617]'
                              : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-950 hover:bg-white'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="sub-url" className="block text-xs font-bold text-slate-800">
                    קישור לאתר Google Sites המפורסם *
                  </label>
                  <input
                    id="sub-url"
                    type="text"
                    required
                    dir="ltr"
                    maxLength={500}
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://sites.google.com/edu-haifa.org.il/my-site"
                    className="w-full min-h-10 px-3 py-2 rounded-lg border-2 border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-950"
                  />
                  {liveUrlCheck && (
                    <div
                      className={`flex items-start gap-1.5 text-xs ${
                        !liveUrlCheck.isValid
                          ? 'text-rose-700 font-semibold'
                          : liveUrlCheck.isOrgScopedUrl
                            ? 'text-amber-800'
                            : 'text-emerald-700 font-semibold'
                      }`}
                    >
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        {!liveUrlCheck.isValid
                          ? liveUrlCheck.errorMessage
                          : liveUrlCheck.warningMessage || 'קישור Google Sites תקין ומוכן לפרסום ✓'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="sub-image" className="block text-xs font-bold text-slate-800 mb-1">
                    קישור לתמונת שער / צילום מסך (Google Drive או URL — לא חובה)
                  </label>
                  <input
                    id="sub-image"
                    type="text"
                    dir="ltr"
                    maxLength={500}
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full min-h-10 px-3 py-2 rounded-lg border-2 border-slate-300 text-sm font-mono focus:outline-none focus:border-slate-950"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sub-note" className="block text-xs font-bold text-slate-800 mb-1">
                  כמה מילים מאת היוצרים (יוקרן במסך ההקדמה לפני המעבר לאתר)
                </label>
                <textarea
                  id="sub-note"
                  rows={2}
                  maxLength={1000}
                  value={creatorNote}
                  onChange={(e) => setCreatorNote(e.target.value)}
                  placeholder="ספרו למבקרים מה חקרתם, איך עיצבתם את האתר ומה הכי מעניין בו..."
                  className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 text-sm focus:outline-none focus:border-slate-950"
                />
              </div>

              <div>
                <label htmlFor="sub-desc" className="block text-xs font-bold text-slate-800 mb-1">
                  תיאור קצר של האתר לכרטיסייה בגלריה
                </label>
                <textarea
                  id="sub-desc"
                  rows={2}
                  maxLength={1500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="סיכום קצר של הנושאים, הסרטונים או הגלריות שבאתר..."
                  className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 text-sm focus:outline-none focus:border-slate-950"
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-950 text-xs"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-10 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-10 inline-flex items-center gap-2 px-5 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-sm font-extrabold shadow-[3px_3px_0px_#020617] hover:bg-lime-300 disabled:opacity-60 cursor-pointer"
                >
                  <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{isSubmitting ? 'שולח לבדיקה...' : 'שליחת אתר לאישור'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
