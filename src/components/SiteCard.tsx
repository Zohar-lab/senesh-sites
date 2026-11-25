import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Compass,
  Cpu,
  ExternalLink,
  Gamepad2,
  Globe,
  Megaphone,
  Star,
  Users,
} from 'lucide-react';
import { StudentSiteItem } from '../types/portal';
import { formatDriveImage, getDriveThumbnailFallback } from '../utils/portalUtils';

interface SiteCardProps {
  site: StudentSiteItem;
  feedbackCount?: number;
  averageRating?: number | null;
  onOpen: (site: StudentSiteItem) => void;
}

interface TagStyle {
  badgeBg: string;
  badgeText: string;
  fallbackBg: string;
  hoverShadow: string;
  bottomAccent: string;
  icon: React.ReactNode;
}

function getTagStyle(tag: string): TagStyle {
  switch (tag) {
    case 'משחק תחביב':
      return {
        badgeBg: 'bg-amber-400',
        badgeText: 'text-slate-950',
        fallbackBg: 'from-amber-500 to-orange-700',
        hoverShadow: 'hover:shadow-[6px_6px_0px_#f59e0b]',
        bottomAccent: 'bg-amber-400',
        icon: <Gamepad2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      };
    case 'חקר':
      return {
        badgeBg: 'bg-lime-400',
        badgeText: 'text-slate-950',
        fallbackBg: 'from-emerald-600 to-teal-900',
        hoverShadow: 'hover:shadow-[6px_6px_0px_#84cc16]',
        bottomAccent: 'bg-lime-400',
        icon: <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      };
    case 'מידע':
      return {
        badgeBg: 'bg-cyan-400',
        badgeText: 'text-slate-950',
        fallbackBg: 'from-cyan-600 to-blue-900',
        hoverShadow: 'hover:shadow-[6px_6px_0px_#06b6d4]',
        bottomAccent: 'bg-cyan-400',
        icon: <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      };
    case 'חברה':
      return {
        badgeBg: 'bg-pink-500',
        badgeText: 'text-white',
        fallbackBg: 'from-pink-600 to-rose-900',
        hoverShadow: 'hover:shadow-[6px_6px_0px_#ec4899]',
        bottomAccent: 'bg-pink-500',
        icon: <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      };
    case 'מועצת תלמידים':
      return {
        badgeBg: 'bg-violet-500',
        badgeText: 'text-white',
        fallbackBg: 'from-violet-600 to-indigo-950',
        hoverShadow: 'hover:shadow-[6px_6px_0px_#8b5cf6]',
        bottomAccent: 'bg-violet-500',
        icon: <Megaphone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      };
    case 'מחשבים ורשת':
      return {
        badgeBg: 'bg-blue-600',
        badgeText: 'text-white',
        fallbackBg: 'from-blue-600 to-slate-950',
        hoverShadow: 'hover:shadow-[6px_6px_0px_#2563eb]',
        bottomAccent: 'bg-blue-600',
        icon: <Cpu className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      };
    default:
      return {
        badgeBg: 'bg-slate-900',
        badgeText: 'text-white',
        fallbackBg: 'from-slate-700 to-slate-900',
        hoverShadow: 'hover:shadow-[6px_6px_0px_#06b6d4]',
        bottomAccent: 'bg-cyan-500',
        icon: <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      };
  }
}

export const SiteCard: React.FC<SiteCardProps> = ({
  site,
  feedbackCount = 0,
  averageRating = null,
  onOpen,
}) => {
  const primarySrc = formatDriveImage(site.imageUrl);
  const secondarySrc = getDriveThumbnailFallback(site.imageUrl);

  const [imgSrc, setImgSrc] = useState<string>(primarySrc);
  const [triedFallback, setTriedFallback] = useState(false);
  const [imageFailed, setImageFailed] = useState(!primarySrc);

  useEffect(() => {
    const nextPrimary = formatDriveImage(site.imageUrl);
    setImgSrc(nextPrimary);
    setTriedFallback(false);
    setImageFailed(!nextPrimary);
  }, [site.imageUrl]);

  const primaryTag = site.tags[0] || site.category || 'מידע';
  const tagStyle = getTagStyle(primaryTag);
  const creatorsText = site.creators.join(', ');
  const tagsLine = (site.tags.length > 0 ? site.tags : [primaryTag]).join(' · ');

  const handleImageError = () => {
    if (!triedFallback && secondarySrc && imgSrc !== secondarySrc) {
      setTriedFallback(true);
      setImgSrc(secondarySrc);
      return;
    }
    setImageFailed(true);
  };

  return (
    <article
      onClick={() => onOpen(site)}
      className={`group flex flex-col bg-white border-2 border-slate-950 rounded-xl overflow-hidden cursor-pointer shadow-[5px_5px_0px_#020617] transition-all duration-200 hover:-translate-y-1 ${tagStyle.hoverShadow} focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-offset-2`}
    >
      {/* 16:9 תמונת שער של האתר */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900 border-b-2 border-slate-950">
        {!imageFailed && imgSrc ? (
          <img
            src={imgSrc}
            alt={`תצוגה מקדימה של האתר ${site.title}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${tagStyle.fallbackBg} flex flex-col items-center justify-center p-4 text-white text-center select-none`}
          >
            <svg
              viewBox="0 0 64 48"
              className="w-12 h-9 mb-2 opacity-90"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="4"
                y="4"
                width="56"
                height="40"
                rx="6"
                stroke="currentColor"
                strokeWidth="3"
              />
              <line x1="4" y1="14" x2="60" y2="14" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="11" cy="9" r="1.5" fill="currentColor" />
              <circle cx="17" cy="9" r="1.5" fill="currentColor" />
              <circle cx="23" cy="9" r="1.5" fill="currentColor" />
              <rect x="12" y="21" width="22" height="6" rx="2" fill="currentColor" opacity="0.8" />
              <rect x="12" y="31" width="40" height="5" rx="2" fill="currentColor" opacity="0.45" />
            </svg>
            <span className="font-display font-bold text-sm leading-tight line-clamp-1 max-w-[90%]">
              {site.title}
            </span>
          </div>
        )}

        {/* תגית ראשית אחת בלבד על התמונה */}
        <div
          className={`absolute top-3 start-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border-2 border-slate-950 shadow-[2px_2px_0px_#020617] text-xs font-extrabold -rotate-2 group-hover:rotate-0 transition-transform ${tagStyle.badgeBg} ${tagStyle.badgeText}`}
        >
          {tagStyle.icon}
          <span className="whitespace-nowrap">{primaryTag}</span>
        </div>

        {site.isFeatured && (
          <div className="absolute top-3 end-3 inline-flex items-center gap-1 px-2 py-1 rounded-md border-2 border-slate-950 bg-white text-slate-950 shadow-[2px_2px_0px_#020617] text-[11px] font-black">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
            <span>נבחר</span>
          </div>
        )}
      </div>

      {/* גוף הכרטיס */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div>
          <h3 className="font-display text-lg font-black text-slate-950 leading-snug line-clamp-1 group-hover:text-blue-700 transition-colors">
            {site.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span className="line-clamp-1">מאת {creatorsText}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">שכבת {site.grade}</span>
          </div>
          <div className="mt-1 text-xs font-bold text-slate-500 line-clamp-1">
            {tagsLine}
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
          {site.description}
        </p>

        <div className="mt-auto pt-2 space-y-2.5">
          {feedbackCount > 0 && averageRating !== null && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 tabular-nums">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
              <span className="font-bold text-slate-900">{averageRating.toFixed(1)}</span>
              <span aria-hidden="true">·</span>
              <span>{feedbackCount} תגובות מבקרים</span>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(site);
            }}
            className="w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-slate-950 bg-slate-950 text-lime-300 text-sm font-extrabold shadow-[2px_2px_0px_#06b6d4] hover:bg-lime-400 hover:text-slate-950 active:translate-y-0.5 transition-all whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>כניסה להקדמה ולאתר</span>
          </button>
        </div>
      </div>

      <div aria-hidden="true" className={`h-1.5 w-full ${tagStyle.bottomAccent}`} />
    </article>
  );
};
