import React from 'react';

interface DYPatilLogoProps {
  className?: string;
  variant?: 'full' | 'emblem';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const DYPatilLogo: React.FC<DYPatilLogoProps> = ({
  className = '',
  variant = 'full',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-8 h-9 sm:w-9 sm:h-10',
    md: 'w-16 h-18 sm:w-20 sm:h-22',
    lg: 'w-28 h-32',
    xl: 'w-40 h-44'
  };

  const finalClass = className || sizeClasses[size];

  if (variant === 'emblem') {
    return (
      <img
        src="/dypatil-logo-exact.png"
        srcSet="/dypatil-logo-exact.png 1x, /dypatil-logo-exact@2x.png 2x"
        alt="Dr. D.Y. Patil Official Crest"
        className={`object-contain select-none shrink-0 ${finalClass}`}
        loading="eager"
      />
    );
  }

  return (
    <div className={`flex flex-col items-center select-none text-center ${className}`}>
      <img
        src="/dypatil-logo-exact.png"
        srcSet="/dypatil-logo-exact.png 1x, /dypatil-logo-exact@2x.png 2x"
        alt="Dr. D.Y. Patil Official Crest"
        className="w-20 h-auto object-contain shrink-0 drop-shadow-xs"
        loading="eager"
      />
      <div className="mt-2 flex flex-col items-center">
        <h2 className="text-xl sm:text-2xl font-black text-[#0B2545] tracking-tight leading-none">
          Dr.D.Y. PATIL
        </h2>
        <p className="text-[12px] sm:text-[13px] font-bold text-[#0B2545] tracking-tight mt-1 leading-tight">
          Academic Education Excellence
        </p>
        <p className="text-[11px] sm:text-[12px] font-bold text-[#0B2545] tracking-wide uppercase leading-tight">
          Federation
        </p>
      </div>
    </div>
  );
};
