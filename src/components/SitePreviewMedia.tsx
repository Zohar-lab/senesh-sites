import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatDriveImage, getDriveThumbnailFallback } from '../utils/portalUtils';
import {
  buildAutoScreenshotUrl,
  getSmartCoverTheme,
  isPubliclyCapturableUrl,
  SmartCoverTheme,
} from '../utils/previewGenerator';

export type ResolvedPreviewKind = 'saved' | 'screenshot' | 'smart-cover';

interface SitePreviewMediaProps {
  title: string;
  creatorsText?: string;
  grade?: string;
  primaryTag?: string;
  siteUrl?: string;
  imageUrl?: string;
  allowAutoScreenshot?: boolean;
  variant?: 'card' | 'backdrop' | 'compact' | 'admin-preview';
  imgClassName?: string;
  alt?: string;
  onResolvedSourceChange?: (info: {
    kind: ResolvedPreviewKind;
    isLoading: boolean;
  }) => void;
}

const SmartMotifSvg: React.FC<{ theme: SmartCoverTheme; compact?: boolean }> = ({
  theme,
  compact = false,
}) => {
  return (
    <svg
      viewBox="0 0 640 360"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`cover-bg-${theme.motif}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor={theme.bgStart} />
          <stop offset="55%" stopColor={theme.bgMid} />
          <stop offset="100%" stopColor={theme.bgEnd} />
        </linearGradient>
        <pattern
          id={`cover-grid-${theme.motif}`}
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke={theme.gridColor}
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <rect width="640" height="360" fill={`url(#cover-bg-${theme.motif})`} />
      <rect width="640" height="360" fill={`url(#cover-grid-${theme.motif})`} />

      {theme.motif === 'arcade' && (
        <g transform={compact ? 'translate(45, 25) scale(0.95)' : 'translate(42, 34)'}>
          <rect
            x="0"
            y="0"
            width="190"
            height="120"
            rx="16"
            fill={theme.surfaceTint}
            stroke={theme.accentPrimary}
            strokeWidth="2.5"
          />
          <rect x="40" y="38" width="16" height="44" rx="4" fill={theme.accentPrimary} />
          <rect x="26" y="52" width="44" height="16" rx="4" fill={theme.accentPrimary} />
          <circle cx="132" cy="52" r="11" fill={theme.accentSecondary} />
          <circle cx="154" cy="70" r="9" fill="#ffffff" fillOpacity="0.9" />
        </g>
      )}

      {theme.motif === 'research' && (
        <g transform="translate(55, 32)">
          <circle
            cx="96"
            cy="72"
            r="54"
            fill={theme.surfaceTint}
            stroke={theme.accentPrimary}
            strokeWidth="2.5"
          />
          <circle
            cx="96"
            cy="72"
            r="34"
            fill="none"
            stroke={theme.accentSecondary}
            strokeWidth="2"
          />
          <line
            x1="136"
            y1="112"
            x2="174"
            y2="150"
            stroke={theme.accentPrimary}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="96" cy="72" r="7" fill={theme.accentPrimary} />
        </g>
      )}

      {theme.motif === 'info' && (
        <g transform="translate(46, 32)">
          <rect
            x="0"
            y="0"
            width="172"
            height="124"
            rx="12"
            fill={theme.surfaceTint}
            stroke={theme.accentPrimary}
            strokeWidth="2.5"
          />
          <rect x="20" y="22" width="76" height="12" rx="4" fill={theme.accentPrimary} />
          <rect x="20" y="46" width="130" height="8" rx="3" fill="#ffffff" fillOpacity="0.5" />
          <rect x="20" y="64" width="110" height="8" rx="3" fill="#ffffff" fillOpacity="0.4" />
          <rect x="20" y="82" width="96" height="8" rx="3" fill="#ffffff" fillOpacity="0.35" />
        </g>
      )}

      {theme.motif === 'community' && (
        <g transform="translate(52, 32)">
          <circle
            cx="68"
            cy="68"
            r="42"
            fill={theme.surfaceTint}
            stroke={theme.accentPrimary}
            strokeWidth="2.5"
          />
          <circle
            cx="122"
            cy="82"
            r="42"
            fill={theme.surfaceTint}
            stroke={theme.accentSecondary}
            strokeWidth="2.5"
          />
        </g>
      )}

      {theme.motif === 'council' && (
        <g transform="translate(52, 34)">
          <rect
            x="0"
            y="0"
            width="160"
            height="112"
            rx="14"
            fill={theme.surfaceTint}
            stroke={theme.accentPrimary}
            strokeWidth="2.5"
          />
          <circle cx="48" cy="56" r="16" fill={theme.accentSecondary} />
          <path
            d="M 76 34 A 28 28 0 0 1 76 78"
            fill="none"
            stroke={theme.accentPrimary}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 94 22 A 42 42 0 0 1 94 90"
            fill="none"
            stroke={theme.accentPrimary}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      )}

      {theme.motif === 'tech' && (
        <g transform="translate(46, 32)">
          <rect
            x="0"
            y="0"
            width="184"
            height="122"
            rx="12"
            fill={theme.surfaceTint}
            stroke={theme.accentPrimary}
            strokeWidth="2.5"
          />
          <line x1="0" y1="28" x2="184" y2="28" stroke={theme.accentSecondary} strokeWidth="2" />
          <polyline
            points="38,76 92,54 146,84"
            fill="none"
            stroke={theme.accentPrimary}
            strokeWidth="3"
          />
          <circle cx="38" cy="76" r="8" fill={theme.accentPrimary} />
          <circle cx="92" cy="54" r="8" fill={theme.accentSecondary} />
          <circle cx="146" cy="84" r="8" fill={theme.accentPrimary} />
        </g>
      )}
    </svg>
  );
};

export const SitePreviewMedia: React.FC<SitePreviewMediaProps> = ({
  title,
  creatorsText = '',
  grade = '',
  primaryTag = 'מידע',
  siteUrl = '',
  imageUrl = '',
  allowAutoScreenshot = true,
  variant = 'card',
  imgClassName = '',
  alt,
  onResolvedSourceChange,
}) => {
  const candidates = useMemo(() => {
    const list: { src: string; kind: 'saved' | 'screenshot' }[] = [];
    const primary = formatDriveImage(imageUrl);
    const driveFallback = getDriveThumbnailFallback(imageUrl);

    if (primary) {
      list.push({ src: primary, kind: 'saved' });
    }
    if (driveFallback && driveFallback !== primary) {
      list.push({ src: driveFallback, kind: 'saved' });
    }

    if (
      list.length === 0 &&
      allowAutoScreenshot &&
      isPubliclyCapturableUrl(siteUrl)
    ) {
      const screenshotUrl = buildAutoScreenshotUrl(siteUrl, 960, 540);
      if (screenshotUrl) {
        list.push({ src: screenshotUrl, kind: 'screenshot' });
      }
    }

    return list;
  }, [imageUrl, siteUrl, allowAutoScreenshot]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const sourceChangeRef = useRef(onResolvedSourceChange);
  sourceChangeRef.current = onResolvedSourceChange;

  useEffect(() => {
    setCandidateIndex(0);
    setIsImgLoaded(false);
  }, [candidates]);

  const activeCandidate =
    candidateIndex < candidates.length ? candidates[candidateIndex] : null;
  const resolvedKind: ResolvedPreviewKind = activeCandidate
    ? activeCandidate.kind
    : 'smart-cover';
  const isLoadingImage = Boolean(activeCandidate && !isImgLoaded);

  useEffect(() => {
    sourceChangeRef.current?.({
      kind: resolvedKind,
      isLoading: isLoadingImage,
    });
  }, [resolvedKind, isLoadingImage]);

  const theme = useMemo(
    () => getSmartCoverTheme(primaryTag, title),
    [primaryTag, title]
  );

  const advanceFallback = () => {
    setIsImgLoaded(false);
    setCandidateIndex((prev) => prev + 1);
  };

  if (activeCandidate) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        {/* רקע זמני נעים בזמן טעינת תצלום המסך או התמונה */}
        {!isImgLoaded && (
          <div className="absolute inset-0">
            <SmartMotifSvg theme={theme} compact={variant === 'compact'} />
            <div className="absolute inset-0 bg-slate-950/25 animate-pulse" />
          </div>
        )}

        <img
          src={activeCandidate.src}
          alt={alt ?? (variant === 'backdrop' ? '' : `תצוגה מקדימה של ${title}`)}
          referrerPolicy="no-referrer"
          loading={variant === 'admin-preview' ? 'eager' : 'lazy'}
          onLoad={(e) => {
            if (
              e.currentTarget.naturalWidth > 0 &&
              e.currentTarget.naturalWidth < 40
            ) {
              advanceFallback();
              return;
            }
            setIsImgLoaded(true);
          }}
          onError={advanceFallback}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isImgLoaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
        />
      </div>
    );
  }

  // עטיפת נושא חכמה מותאמת אישית (גיבוי מיידי כשאין תמונה או כשהכתובת ארגונית)
  const metaLine = [
    creatorsText.trim() ? `מאת ${creatorsText.trim()}` : '',
    grade.trim() ? `שכבת ${grade.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <SmartMotifSvg theme={theme} compact={variant === 'compact'} />

      {variant !== 'backdrop' && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent"
          />
          {variant === 'compact' ? (
            <div className="absolute inset-x-0 bottom-0 p-1.5 text-white">
              <div className="font-display text-[10px] font-extrabold leading-tight line-clamp-1">
                {title}
              </div>
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 text-white space-y-0.5">
              <div className="font-display text-sm sm:text-base font-black leading-tight line-clamp-2 [text-wrap:balance]">
                {title}
              </div>
              {metaLine && (
                <div className="text-[11px] font-semibold text-slate-200 line-clamp-1">
                  {metaLine}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
