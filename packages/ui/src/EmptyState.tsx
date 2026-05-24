import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
      {icon ? (
        <div className="text-border flex items-center justify-center">
          {icon}
        </div>
      ) : null}

      <h3 className="font-display text-lg text-secondary">{title}</h3>

      {description ? (
        <p className="font-mono text-xs text-tertiary max-w-sm">
          {description}
        </p>
      ) : null}

      {action ? (
        <a
          href={action.href}
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold hover:opacity-70 transition-opacity duration-200 mt-2"
        >
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
