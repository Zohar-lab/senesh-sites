import React from 'react';
import { Info } from 'lucide-react';
import { GuideSectionId, PORTAL_GUIDE_SECTION_MAP } from '../data/portalGuide';

interface GuideInfoButtonProps {
  sectionId: GuideSectionId;
  onOpenGuide?: (sectionId: GuideSectionId) => void;
  label?: string;
  variant?: 'light' | 'dark' | 'neon';
  size?: 'sm' | 'md';
  showText?: boolean;
  className?: string;
}

export const GuideInfoButton: React.FC<GuideInfoButtonProps> = ({
  sectionId,
  onOpenGuide,
  label,
  variant = 'light',
  size = 'sm',
  showText = false,
  className = '',
}) => {
  if (!onOpenGuide) return null;

  const section = PORTAL_GUIDE_SECTION_MAP[sectionId];
  const resolvedTitle = label || `הסבר ורציונל במדריך: ${section.shortTitle}`;

  const variantClasses =
    variant === 'neon'
      ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 focus-visible:outline-cyan-300'
      : variant === 'dark'
        ? 'border-slate-600 bg-slate-900/90 text-cyan-300 hover:border-cyan-400 hover:bg-slate-800 hover:text-white focus-visible:outline-cyan-300'
        : 'border-slate-300 bg-white text-blue-700 hover:border-slate-950 hover:bg-cyan-50 hover:text-slate-950 focus-visible:outline-blue-600';

  const sizeClasses = showText
    ? 'min-h-8 px-2.5 py-1 text-xs font-extrabold gap-1.5 rounded-lg'
    : size === 'md'
      ? 'w-8 h-8 rounded-full'
      : 'w-7 h-7 rounded-full';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenGuide(sectionId);
      }}
      title={resolvedTitle}
      aria-label={resolvedTitle}
      className={`inline-flex items-center justify-center border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${variantClasses} ${sizeClasses} ${className}`}
    >
      <Info className={size === 'md' ? 'w-4 h-4 shrink-0' : 'w-3.5 h-3.5 shrink-0'} aria-hidden="true" />
      {showText && <span>{label || 'הסבר'}</span>}
    </button>
  );
};
