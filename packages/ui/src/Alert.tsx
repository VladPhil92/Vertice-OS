import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export interface AlertProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  className?: string;
}

interface AlertConfig {
  containerClass: string;
  textClass: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ALERT_CONFIG: Record<AlertProps['type'], AlertConfig> = {
  error: {
    containerClass: 'border border-red/30 bg-red/5',
    textClass: 'text-red',
    Icon: AlertCircle,
  },
  success: {
    containerClass: 'border border-gold/30 bg-gold/5',
    textClass: 'text-gold',
    Icon: CheckCircle,
  },
  warning: {
    containerClass: 'border border-yellow-500/30 bg-yellow-500/5',
    textClass: 'text-yellow-400',
    Icon: AlertTriangle,
  },
  info: {
    containerClass: 'border border-cyan/30 bg-cyan/5',
    textClass: 'text-cyan',
    Icon: Info,
  },
};

export function Alert({ type, message, className = '' }: AlertProps) {
  const { containerClass, textClass, Icon } = ALERT_CONFIG[type];

  return (
    <div
      role="alert"
      className={[
        'flex items-start gap-3 px-4 py-3',
        containerClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon size={13} className={['mt-0.5 shrink-0', textClass].join(' ')} />
      <p className={['font-mono text-[11px]', textClass].join(' ')}>
        {message}
      </p>
    </div>
  );
}
