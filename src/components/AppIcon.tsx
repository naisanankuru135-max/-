import { useState, useEffect } from 'react';
import { Coins } from 'lucide-react';

interface AppIconProps {
  src?: string;
  name: string;
  brandColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AppIconProps['size']>, string> = {
  xs: 'w-6 h-6 rounded-[6px]',
  sm: 'w-8 h-8 rounded-[8px]',
  md: 'w-11 h-11 rounded-[11px]',
  lg: 'w-14 h-14 rounded-[14px]',
  xl: 'w-16 h-16 rounded-[16px]',
};

const TEXT_CLASSES: Record<NonNullable<AppIconProps['size']>, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

export function AppIcon({
  src,
  name,
  brandColor = '#334155',
  size = 'md',
  className = '',
}: AppIconProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const showImage = Boolean(src) && !hasError;
  const isGeneratedJpg = Boolean(src && src.includes('/src/assets/images/'));

  return (
    <div
      className={`relative shrink-0 overflow-hidden select-none border border-slate-900/10 bg-slate-100 ${SIZE_CLASSES[size]} ${className}`}
      style={!showImage ? { backgroundColor: brandColor } : undefined}
      aria-label={`${name}のアイコン`}
    >
      {showImage ? (
        <img
          src={src}
          alt={`${name} アプリアイコン`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover ${isGeneratedJpg ? 'scale-[1.06]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-white font-semibold">
          {name ? (
            <span className={TEXT_CLASSES[size]}>{name.slice(0, 2)}</span>
          ) : (
            <Coins className="w-1/2 h-1/2" />
          )}
        </div>
      )}
    </div>
  );
}
