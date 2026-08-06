'use client';

import React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'py-1.5 px-3 text-[10px]',
  md: 'py-2.5 px-5 text-[11px]',
  lg: 'py-3 px-8 text-sm',
};

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger:
    'inline-flex items-center justify-center border border-red text-red bg-transparent hover:bg-red/10 transition-all duration-200',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled ?? loading;

  // For primary and ghost variants, the btn-* classes handle padding/font from globals.css.
  // For danger or when a non-default size is requested, we layer in explicit sizing.
  const usesGlobalBtnClass = variant !== 'danger';
  const sizeClass =
    !usesGlobalBtnClass || size !== 'md' ? SIZE_CLASSES[size] : '';

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={[
        VARIANT_CLASSES[variant],
        'font-mono uppercase tracking-[0.1em]',
        sizeClass,
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-t-transparent mr-2"
          aria-hidden="true"
        />
      ) : icon ? (
        <span className="mr-2 inline-flex items-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
