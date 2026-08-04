import React from 'react';

interface CPALogoProps {
  className?: string;
  variant?: 'full' | 'emblem';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  subtitle?: string;
  lightText?: boolean;
}

export const CPALogo: React.FC<CPALogoProps> = ({ 
  className = '', 
  variant = 'full',
  size = 'md',
  subtitle = 'Client Portal',
  lightText = true
}) => {
  const badgeSizes = {
    sm: 'w-8 h-8 text-xs rounded-lg',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-14 h-14 text-xl rounded-2xl',
    xl: 'w-18 h-18 text-2xl rounded-2xl'
  };

  const textSizes = {
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-lg',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl'
  };

  const selectedBadgeClass = badgeSizes[size] || badgeSizes.md;
  const selectedTextClass = textSizes[size] || textSizes.md;

  if (variant === 'emblem') {
    return (
      <div className={`w-14 h-14 bg-gold text-navy-dark rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-md border border-gold/40 ${className}`}>
        JM
      </div>
    );
  }

  const titleColorClass = lightText 
    ? 'text-sand' 
    : 'text-navy dark:text-sand';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div className={`${selectedBadgeClass} bg-gold text-navy-dark flex items-center justify-center font-extrabold shadow-sm flex-shrink-0 tracking-wider`}>
        JM
      </div>
      <div className="flex flex-col justify-center text-left">
        <span className={`font-bold tracking-tight leading-none ${titleColorClass} ${selectedTextClass}`}>
          Jan Michael Maglinao, CPA
        </span>
        {subtitle && (
          <span className="text-[10px] font-semibold text-gold tracking-wider uppercase mt-1">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
