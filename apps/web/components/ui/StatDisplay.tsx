'use client';

import { cn } from '@/lib/utils';
import { CountUpNumber } from './CountUpNumber';

interface StatDisplayProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  trend?: { value: number; positive: boolean } | null;
}

export function StatDisplay({ label, value, prefix, suffix, className, trend }: StatDisplayProps) {
  return (
    <div className={cn('text-center', className)}>
      <div className="text-3xl font-bold font-mono text-white mb-1">
        <CountUpNumber end={value} prefix={prefix} suffix={suffix} />
      </div>
      <div className="text-sm text-gray-500 uppercase tracking-wider font-display">{label}</div>
      {trend && (
        <div className={cn('text-xs mt-1 font-mono', trend.positive ? 'text-neon-green' : 'text-neon-red')}>
          {trend.positive ? '+' : ''}{trend.value}%
        </div>
      )}
    </div>
  );
}
