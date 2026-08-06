import React from 'react';

export interface BadgeProps {
  variant?: 'gold' | 'cyan' | 'red' | 'default';
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps['variant']>, string> = {
  gold: 'border-gold/40 bg-gold/10 text-gold',
  cyan: 'border-cyan/40 bg-cyan/10 text-cyan',
  red: 'border-red/40 bg-red/10 text-red',
  default: 'border-border text-tertiary',
};

export function Badge({
  variant = 'default',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'font-mono text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 border',
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
