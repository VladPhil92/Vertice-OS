'use client';

import React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  id,
  className = '',
  ...rest
}: SelectProps) {
  const selectId =
    id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={selectId}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary"
        >
          {label}
        </label>
      ) : null}

      <select
        id={selectId}
        {...rest}
        className={[
          'border bg-bg px-4 py-3 font-mono text-sm text-primary',
          'focus:outline-none w-full transition-colors duration-200 cursor-pointer',
          error
            ? 'border-red focus:border-red'
            : 'border-border focus:border-gold',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}

        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-surface text-primary"
          >
            {opt.label}
          </option>
        ))}
      </select>

      {error ? (
        <span className="font-mono text-[11px] text-red">{error}</span>
      ) : null}
    </div>
  );
}
