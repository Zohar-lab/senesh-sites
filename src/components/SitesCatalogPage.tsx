import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  Clock,
  ExternalLink,
  Gamepad2,
  Globe,
  PlusCircle,
  Search,
  Star,
  Tags,
  X,
} from 'lucide-react';
import {
  GradeFilter,
  SiteFeedback,
  SiteSortMode,
  StudentSiteItem,
  TagFilter,
} from '../types/portal';
import {
  GAME_GENERATOR_URL,
  matchesGradeFilter,
  SITE_TAGS,
  sortSites,
} from '../utils/portalUtils';
import { SiteCard } from './SiteCard';

interface SitesCatalogPageProps {
  sites: StudentSiteItem[];
  isLoading: boolean;
  feedbackBySite: Record<string, SiteFeedback[]>;
  onOpenSite: (site: StudentSiteItem) => void;
  onBackHome: () => void;
  onOpenSubmit: () => void;
}

const GRADES: GradeFilter[] = ['כל השכבות', "א'-ב'", "ג'-ד'", "ה'-ו'"];

const TAG_FILTERS: TagFilter[] = ['הכל', ...SITE_TAGS];

const TAG_ACTIVE_STYLES: Record<TagFilter, string> = {
  הכל: 'bg-slate-950 text-lime-300 border-slate-950 shadow-[3px_3px_0px_#06b6d4]',
  'משחק תחביב': 'bg-amber-400 text-slate-950 border-slate-950 shadow-[3px_3px_0px_#020617]',
  חקר: 'bg-lime-400 text-slate-950 border-slate-950 shadow-[3px_3px_0px_#020617]',
  מידע: 'bg-cyan-400 text-slate-950 border-slate-950 shadow-[3px_3px_0px_#020617]',
  חברה: 'bg-pink-500 text-white border-slate-950 shadow-[3px_3px_0px_#020617]',
  'מועצת תלמידים': 'bg-violet-500 text-white border-slate-950 shadow-[3px_3px_0px_#020617]',
  'מחשבים ורשת': 'bg-blue-600 text-white border-slate-950 shadow-[3px_3px_0px_#020617]',
};

export const SitesCatalogPage: React.FC<SitesCatalogPageProps> = ({
  sites,
  isLoading,
  feedbackBySite,
  onOpenSite,
  onBackHome,
  onOpenSubmit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<TagFilter>('הכל');
  const [selectedGrade, setSelectedGrade] = useState<GradeFilter>('כל השכבות');
  const [sortMode, setSortMode] = useState<SiteSortMode>('tag-order');

  // 1. חדשים: 6 האתרים החדשים ביותר
  const newestSites = useMemo(
    () => sortSites(sites, 'newest').slice(0, 6),
    [sites]
  );

  // 2. נבחרים: 6 האתרים הנבחרים
  const featuredSites = useMemo(() => {
    const marked = sites.filter((s) => s.isFeatured);
    return sortSites(marked, 'newest').slice(0, 6);
  }, [sites]);

  // 3. חיפוש לפי תוויות + מיון תצוגה לפי התוויות
  const filteredAndSortedSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = sites.filter((site) => {
      const matchesTag =
        selectedTag === 'הכל' || (site.tags || []).includes(selectedTag);

      const matchesGrade = matchesGradeFilter(site.grade, selectedGrade);

      const creatorsJoined = site.creators.join(' ').toLowerCase();
      const tagsJoined = (site.tags || []).join(' ').toLowerCase();
      const matchesSearch =
        !q ||
        site.title.toLowerCase().includes(q) ||
        creatorsJoined.includes(q) ||
        tagsJoined.includes(q) ||
        site.creatorNote.toLowerCase().includes(q) ||
        site.description.toLowerCase().includes(q);

      return matchesTag && matchesGrade && matchesSearch;
    });

    return sortSites(filtered, sortMode, selectedTag);
  }, [sites, searchQuery, selectedTag, selectedGrade, sortMode]);

  const tagCounts = useMemo(() => {
    const map: Record<TagFilter, number> = {
      הכל: sites.length,
      'משחק תחביב': 0,
      חקר: 0,
      מידע: 0,
      חברה: 0,
      'מועצת תלמידים': 0,
      'מחשבים ורשת': 0,
    };
    for (const s of sites) {
      for (const t of s.tags || []) {
        if (t in map) {
          map[t] += 1;
        }
      }
    }
    return map;
  }, [sites]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedTag !== 'הכל' ||
    selectedGrade !== 'כל השכבות';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTag('הכל');
    setSelectedGrade('כל השכבות');
  };

  const renderSiteCard = (site: StudentSiteItem) => {
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
        onOpen={onOpenSite}
      />
    );
  };

  const renderSkeletonGrid = (count: number) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
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
  );

  return (
    <div className="space-y-10 pb-14">
      {/* כותרת דף האתרים הנפרד */}
      <section className="bg-dark-wall text-white border-b-4 border-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-cyan-300 hover:text-lime-300 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>חזרה לדף הראשי</span>
            </button>

            <h1 className="font-display text-3xl sm:text-4xl font-black text-white">
              דף האתרים והמשחקים · חנה סנש
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl">
              כאן מרוכזים כל האתרים והמשחקים של תלמידי בית הספר (המשחקים גם הם אתרים ב-Google Sites): האתרים החדשים ביותר, האתרים הנבחרים וחיפוש ומיון לפי תוויות.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="px-4 py-2 rounded-xl bg-slate-900 border-2 border-cyan-400 text-xs sm:text-sm text-slate-200 tabular-nums">
              <strong className="text-lime-300 font-black text-base ms-1">{sites.length}</strong>{' '}
              אתרים ומשחקים בגלריה
            </div>
            <a
              href={GAME_GENERATOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-white bg-amber-400 text-slate-950 text-sm font-extrabold shadow-[3px_3px_0px_#06b6d4] hover:bg-amber-300 transition-colors"
            >
              <Gamepad2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>מחולל משחקים</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={onOpenSubmit}
              className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-white bg-lime-400 text-slate-950 text-sm font-extrabold shadow-[3px_3px_0px_#ec4899] hover:bg-lime-300 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>הגשת אתר חדש</span>
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* 1. חדשים: 6 אתרים */}
        <section aria-labelledby="newest-sites-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-950 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-400 border-2 border-slate-950 shadow-[3px_3px_0px_#020617] text-slate-950 inline-flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="newest-sites-heading"
                  className="font-display text-2xl sm:text-3xl font-black text-slate-950"
                >
                  חדשים
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  6 האתרים החדשים ביותר שעלו לפורטל
                </p>
              </div>
            </div>

            <span className="text-xs sm:text-sm font-extrabold text-slate-700 tabular-nums">
              מציג {newestSites.length} אתרים חדשים
            </span>
          </div>

          {isLoading ? (
            renderSkeletonGrid(6)
          ) : newestSites.length === 0 ? (
            <div className="bg-white border-2 border-slate-950 rounded-xl p-8 text-center text-sm text-slate-600">
              עדיין אין אתרים חדשים להצגה.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {newestSites.map(renderSiteCard)}
            </div>
          )}
        </section>

        {/* 2. נבחרים: 6 אתרים */}
        <section aria-labelledby="featured-sites-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-950 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 border-2 border-slate-950 shadow-[3px_3px_0px_#020617] text-slate-950 inline-flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-slate-950" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="featured-sites-heading"
                  className="font-display text-2xl sm:text-3xl font-black text-slate-950"
                >
                  נבחרים
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  6 אתרים נבחרים ומומלצים של תלמידי בית הספר
                </p>
              </div>
            </div>

            <span className="text-xs sm:text-sm font-extrabold text-slate-700 tabular-nums">
              מציג {featuredSites.length} אתרים נבחרים
            </span>
          </div>

          {isLoading ? (
            renderSkeletonGrid(6)
          ) : featuredSites.length === 0 ? (
            <div className="bg-white border-2 border-slate-950 rounded-xl p-8 text-center text-sm text-slate-600">
              טרם סומנו אתרים נבחרים במסוף הניהול. מנהלי הפורטל יכולים לסמן כל אתר מאושר כ&quot;נבחר&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredSites.map(renderSiteCard)}
            </div>
          )}
        </section>

        {/* 3. חיפוש לפי תוויות + מיון תצוגה */}
        <section
          id="tag-search-section"
          aria-labelledby="tag-search-heading"
          className="space-y-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-950 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime-400 border-2 border-slate-950 shadow-[3px_3px_0px_#020617] text-slate-950 inline-flex items-center justify-center shrink-0">
                <Tags className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="tag-search-heading"
                  className="font-display text-2xl sm:text-3xl font-black text-slate-950"
                >
                  חיפוש לפי תוויות
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  סננו ומיינו את כל האתרים לפי תווית, שכבה ומילת חיפוש
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-950 rounded-xl shadow-[5px_5px_0px_#020617] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="sites-page-search" className="sr-only">
                  חיפוש אתר לפי שם, יוצר, תווית או תיאור
                </label>
                <Search
                  className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="sites-page-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חפשו לפי שם האתר, יוצרים, תווית או נושא..."
                  className="w-full min-h-11 ps-10 pe-10 py-2.5 rounded-lg border-2 border-slate-300 bg-slate-50 text-sm text-slate-950 placeholder:text-slate-500 focus:bg-white focus:outline-none focus:border-slate-950 focus:ring-2 focus:ring-cyan-400 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="ניקוי חיפוש"
                    className="absolute top-1/2 -translate-y-1/2 end-2.5 w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-950"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="relative sm:w-44 shrink-0">
                <label htmlFor="sites-page-grade" className="sr-only">
                  סינון לפי שכבת גיל
                </label>
                <select
                  id="sites-page-grade"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value as GradeFilter)}
                  className="w-full min-h-11 appearance-none ps-4 pe-10 py-2.5 rounded-lg border-2 border-slate-300 bg-slate-50 text-sm font-bold text-slate-950 focus:bg-white focus:outline-none focus:border-slate-950 focus:ring-2 focus:ring-cyan-400 cursor-pointer"
                >
                  {GRADES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade === 'כל השכבות' ? 'כל השכבות' : `שכבת ${grade}`}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="w-4 h-4 text-slate-700 absolute top-1/2 -translate-y-1/2 end-3.5 pointer-events-none"
                  aria-hidden="true"
                />
              </div>

              <div className="relative sm:w-56 shrink-0">
                <label htmlFor="sites-page-sort" className="sr-only">
                  מיון תצוגה
                </label>
                <ArrowUpDown
                  className="w-4 h-4 text-slate-600 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                  aria-hidden="true"
                />
                <select
                  id="sites-page-sort"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SiteSortMode)}
                  className="w-full min-h-11 appearance-none ps-9 pe-10 py-2.5 rounded-lg border-2 border-slate-300 bg-slate-50 text-sm font-bold text-slate-950 focus:bg-white focus:outline-none focus:border-slate-950 focus:ring-2 focus:ring-cyan-400 cursor-pointer"
                >
                  <option value="tag-order">מיון: לפי תוויות</option>
                  <option value="newest">מיון: מהחדש לישן</option>
                  <option value="featured">מיון: נבחרים קודם</option>
                  <option value="title-az">מיון: לפי א&apos;-ת&apos;</option>
                </select>
                <ChevronDown
                  className="w-4 h-4 text-slate-700 absolute top-1/2 -translate-y-1/2 end-3.5 pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div
                role="tablist"
                aria-label="סינון לפי תוויות"
                className="flex flex-wrap items-center gap-2"
              >
                {TAG_FILTERS.map((tag) => {
                  const isActive = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setSelectedTag(tag)}
                      className={`min-h-9 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-extrabold rounded-lg border-2 transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                        isActive
                          ? TAG_ACTIVE_STYLES[tag]
                          : 'border-slate-300 bg-slate-100 text-slate-800 hover:border-slate-950 hover:bg-white'
                      }`}
                    >
                      <span>{tag}</span>
                      <span className="text-xs opacity-75 tabular-nums">({tagCounts[tag]})</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 tabular-nums">
                <span>
                  מציג <strong className="font-bold text-slate-950">{filteredAndSortedSites.length}</strong>{' '}
                  מתוך {sites.length} אתרים
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-blue-700 font-bold hover:underline whitespace-nowrap cursor-pointer"
                  >
                    איפוס סינון
                  </button>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            renderSkeletonGrid(6)
          ) : filteredAndSortedSites.length === 0 ? (
            <div className="bg-white border-2 border-slate-950 rounded-xl shadow-[5px_5px_0px_#020617] p-10 text-center space-y-3">
              <Globe className="w-10 h-10 text-slate-400 mx-auto" aria-hidden="true" />
              <h3 className="font-display text-lg font-bold text-slate-950">
                לא נמצאו אתרים מתאימים
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {sites.length === 0
                  ? 'עדיין לא אושרו אתרים בפורטל. הגישו אתר Google Sites חדש או אשרו אתרים במסוף הניהול!'
                  : 'נסו לשנות את מילות החיפוש או לבחור תווית ושכבת גיל אחרות.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-2 min-h-10 inline-flex items-center justify-center px-4 py-2 rounded-lg border-2 border-slate-950 bg-lime-400 text-slate-950 text-sm font-extrabold shadow-[3px_3px_0px_#020617] hover:bg-lime-300 cursor-pointer"
                >
                  הצגת כל האתרים
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedSites.map(renderSiteCard)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
