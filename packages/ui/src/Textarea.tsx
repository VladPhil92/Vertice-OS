'use client';

import React from 'react';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  rows?: number;
}

export function Textarea({
  label,
  error,
  hint,
  rows = 4,
  id,
  className = '',
  ...rest
}: TextareaProps) {
  const textareaId =
    id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={textareaId}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary"
        >
          {label}
        </label>
      ) : null}

      <textarea
        id={textareaId}
        rows={rows}
        {...rest}
        className={[
          'border bg-bg px-4 py-3 font-mono text-sm text-primary resize-none',
          'placeholder:text-tertiary focus:outline-none w-full transition-colors duration-200',
          error
            ? 'border-red focus:border-red'
            : 'border-border focus:border-gold',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      />

      {error ? (
        <span className="font-mono text-[11px] text-red">{error}</span>
      ) : hint ? (
        <span className="font-mono text-[10px] text-tertiary">{hint}</span>
      ) : null}
    </div>
  );
}
