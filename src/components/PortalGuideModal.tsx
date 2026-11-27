import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Lightbulb,
  ListTree,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  GUIDE_GROUPS,
  GuideAudience,
  GuideSectionId,
  PORTAL_GUIDE_SECTIONS,
  PortalGuideSection,
} from '../data/portalGuide';

interface PortalGuideModalProps {
  isOpen: boolean;
  targetSectionId: GuideSectionId | null;
  onClose: () => void;
}

export const PortalGuideModal: React.FC<PortalGuideModalProps> = ({
  isOpen,
  targetSectionId,
  onClose,
}) => {
  const [audience, setAudience] = useState<GuideAudience>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState<GuideSectionId | null>(null);
  const [isMobileIndexOpen, setIsMobileIndexOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Partial<Record<GuideSectionId, HTMLElement | null>>>({});

  // בכל פתיחה דרך כפתור (i) ייעודי: מאפסים חיפוש אם הסעיף מוסתר, גוללים אליו ומדגישים אותו
  useEffect(() => {
    if (!isOpen) return;
    setIsMobileIndexOpen(false);

    if (targetSectionId) {
      setAudience('all');
      setSearchQuery('');
      setHighlightedId(targetSectionId);

      const timer = window.setTimeout(() => {
        const el = sectionRefs.current[targetSectionId];
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);

      return () => window.clearTimeout(timer);
    }

    setHighlightedId(null);
    return undefined;
  }, [isOpen, targetSectionId]);

  // חסימת Escape בשכבת capture כדי שסגירת המדריך לא תסגור מודאל אחר מתחתיו
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return PORTAL_GUIDE_SECTIONS.filter((sec) => {
      if (audience === 'student' && !sec.audienceTags.includes('student')) {
        return false;
      }
      if (audience === 'teacher' && !sec.audienceTags.includes('teacher')) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        sec.title,
        sec.shortTitle,
        sec.groupLabel,
        sec.keywords.join(' '),
        sec.studentTitle,
        sec.studentSummary,
        sec.studentTips.join(' '),
        (sec.studentExamples || []).map((e) => `${e.title} ${e.body}`).join(' '),
        sec.teacherTitle,
        sec.teacherRationale,
        sec.teacherClassroomTips.join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [audience, searchQuery]);

  const groupedSections = useMemo(() => {
    const map = new Map<string, PortalGuideSection[]>();
    for (const group of GUIDE_GROUPS) {
      const items = filteredSections.filter((s) => s.group === group.id);
      if (items.length > 0) {
        map.set(group.id, items);
      }
    }
    return map;
  }, [filteredSections]);

  if (!isOpen) return null;

  const jumpToSection = (sectionId: GuideSectionId) => {
    setHighlightedId(sectionId);
    setIsMobileIndexOpen(false);
    requestAnimationFrame(() => {
      const el = sectionRefs.current[sectionId];
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-guide-title"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-6xl h-[100dvh] sm:h-[90vh] flex flex-col bg-white sm:border-2 border-slate-950 rounded-none sm:rounded-2xl sm:shadow-[8px_8px_0px_#a3e635] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת המדריך המצומצמת */}
        <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-2.5 sm:py-3.5 bg-slate-950 text-white border-b-2 border-cyan-400 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-cyan-400 text-slate-950 inline-flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="portal-guide-title"
                className="font-display text-sm sm:text-lg font-black text-white truncate"
              >
                מדריך הפורטל והרציונל הפדגוגי
              </h2>
              <p className="hidden sm:block text-xs text-slate-300 truncate">
                הסברים לתלמידים, דוגמאות ורציונל למורים
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="סגירת המדריך"
            className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* סרגל חיפוש, קהל יעד ופתיחת אינדקס במובייל */}
        <div className="px-3 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 lg:pb-0">
            <div
              role="tablist"
              aria-label="סינון תצוגת המדריך"
              className="flex items-center gap-1.5 shrink-0"
            >
              {(
                [
                  { id: 'all', label: 'הכל', icon: Sparkles },
                  { id: 'student', label: 'לתלמידים', icon: Users },
                  { id: 'teacher', label: 'למורים', icon: GraduationCap },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = audience === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAudience(tab.id)}
                    className={`min-h-8 inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg border text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-950 text-lime-300 border-slate-950'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-950'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsMobileIndexOpen((prev) => !prev)}
              aria-expanded={isMobileIndexOpen}
              className={`lg:hidden min-h-8 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ms-auto ${
                isMobileIndexOpen
                  ? 'bg-cyan-400 text-slate-950 border-slate-950'
                  : 'bg-white text-blue-800 border-blue-300'
              }`}
            >
              <ListTree className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>אינדקס ({filteredSections.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 lg:max-w-md">
            <div className="relative flex-1">
              <label htmlFor="portal-guide-search" className="sr-only">
                חיפוש במדריך וברציונל הפדגוגי
              </label>
              <Search
                className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id="portal-guide-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש במדריך..."
                className="w-full min-h-9 ps-8 pe-8 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-950 placeholder:text-slate-500 focus:outline-none focus:border-slate-950"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="ניקוי חיפוש במדריך"
                  className="absolute top-1/2 -translate-y-1/2 end-1.5 w-6 h-6 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-950 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <span className="hidden sm:inline text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap shrink-0">
              {filteredSections.length} נושאים
            </span>
          </div>
        </div>

        {/* גוף המדריך: אינדקס מוסתר במובייל עד לפתיחה + מקסימום שטח קריאה */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 relative overflow-hidden">
          <aside
            aria-label="אינדקס המדריך"
            className={`${
              isMobileIndexOpen
                ? 'block absolute inset-0 z-20 bg-slate-50 overflow-y-auto p-3'
                : 'hidden'
            } lg:block lg:static lg:col-span-4 border-e border-slate-200 bg-slate-50/70 overflow-y-auto p-3.5 space-y-3`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-950">
                <ListTree className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                <span>אינדקס מהיר</span>
              </div>
              {isMobileIndexOpen && (
                <button
                  type="button"
                  onClick={() => setIsMobileIndexOpen(false)}
                  className="lg:hidden text-xs font-extrabold text-blue-700 px-2 py-1 rounded bg-white border border-slate-300"
                >
                  סגור אינדקס
                </button>
              )}
            </div>

            {filteredSections.length === 0 ? (
              <p className="text-xs text-slate-500">אין נושאים התואמים לחיפוש.</p>
            ) : (
              <div className="space-y-4">
                {GUIDE_GROUPS.map((group) => {
                  const items = groupedSections.get(group.id);
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={group.id} className="space-y-1.5">
                      <div className="text-[11px] font-black text-slate-500 tracking-wide">
                        {group.label}
                      </div>
                      <ul className="space-y-1">
                        {items.map((item) => {
                          const isCurrent = highlightedId === item.id;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => jumpToSection(item.id)}
                                className={`w-full text-start px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                                  isCurrent
                                    ? 'bg-slate-950 text-lime-300 shadow-[2px_2px_0px_#06b6d4]'
                                    : 'bg-white text-slate-800 border border-slate-200 hover:border-slate-950 hover:bg-cyan-50'
                                }`}
                              >
                                <span className="truncate">{item.shortTitle}</span>
                                <span className="text-[10px] opacity-75 shrink-0">
                                  {item.audienceTags.includes('student') &&
                                  item.audienceTags.includes('teacher')
                                    ? 'ת+מ'
                                    : item.audienceTags.includes('student')
                                      ? 'תלמיד'
                                      : 'מורה'}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* תוכן הסעיפים */}
          <div className="lg:col-span-8 overflow-y-auto p-3 sm:p-5 space-y-4 bg-white">
            {filteredSections.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center space-y-3">
                <Search className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
                <h3 className="font-display text-lg font-extrabold text-slate-950">
                  לא נמצאו סעיפים התואמים ל־&quot;{searchQuery}&quot;
                </h3>
                <p className="text-sm text-slate-600">
                  נסו מילת חיפוש קצרה יותר (כמו &quot;פרומפט&quot;, &quot;תוויות&quot;, &quot;שלב 4&quot; או &quot;פרטיות&quot;) או נקו את הסינון.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setAudience('all');
                  }}
                  className="min-h-10 px-4 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-xs sm:text-sm font-extrabold cursor-pointer hover:bg-lime-300"
                >
                  איפוס חיפוש והצגת כל המדריך
                </button>
              </div>
            ) : (
              filteredSections.map((section) => {
                const isHighlighted = highlightedId === section.id;
                const showStudent = audience === 'all' || audience === 'student';
                const showTeacher = audience === 'all' || audience === 'teacher';

                return (
                  <article
                    key={section.id}
                    ref={(el) => {
                      sectionRefs.current[section.id] = el;
                    }}
                    className={`rounded-2xl border-2 p-4 sm:p-5 space-y-4 transition-all scroll-mt-4 ${
                      isHighlighted
                        ? 'border-slate-950 bg-cyan-50/40 ring-4 ring-lime-400 shadow-[5px_5px_0px_#020617]'
                        : 'border-slate-200 bg-white hover:border-slate-400'
                    }`}
                  >
                    <header className="border-b border-slate-200 pb-3 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-blue-700">
                          {section.groupLabel}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {section.audienceTags.includes('student') &&
                          section.audienceTags.includes('teacher')
                            ? 'מותאם לתלמידים ולמורים'
                            : section.audienceTags.includes('student')
                              ? 'מדריך לתלמיד'
                              : 'למורים ולצוות הניהול'}
                        </span>
                      </div>
                      <h3 className="font-display text-lg sm:text-xl font-black text-slate-950">
                        {section.title}
                      </h3>
                    </header>

                    <div className="space-y-3.5">
                      {showStudent && (
                        <div className="rounded-xl border-2 border-cyan-300 bg-cyan-50/75 p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-sm font-black text-cyan-950">
                            <Users className="w-4 h-4 text-cyan-700 shrink-0" aria-hidden="true" />
                            <span>לתלמידים · {section.studentTitle}</span>
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed">
                            {section.studentSummary}
                          </p>
                          {section.studentTips.length > 0 && (
                            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800 list-disc ps-5">
                              {section.studentTips.map((tip, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          )}
                          {section.studentExamples && section.studentExamples.length > 0 && (
                            <div className="pt-1 space-y-2">
                              {section.studentExamples.map((ex, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-lg border border-cyan-200 bg-white p-3 text-xs text-slate-800 space-y-1"
                                >
                                  <div className="inline-flex items-center gap-1.5 font-extrabold text-cyan-900">
                                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                                    <span>{ex.title}</span>
                                  </div>
                                  <p className="leading-relaxed">{ex.body}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {showTeacher && (
                        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/70 p-4 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-black text-indigo-950">
                            <GraduationCap
                              className="w-4 h-4 text-indigo-700 shrink-0"
                              aria-hidden="true"
                            />
                            <span>למורים · {section.teacherTitle}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                            {section.teacherRationale}
                          </p>
                          {section.teacherClassroomTips.length > 0 && (
                            <ul className="space-y-1 text-xs text-indigo-950 list-disc ps-5">
                              {section.teacherClassroomTips.map((tip, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
