'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  variant: 'live' | 'completed' | 'upcoming' | 'open' | 'locked' | 'cancelled';
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

const badgeStyles = {
  live: 'bg-neon-green/20 text-neon-green border-neon-green/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  upcoming: 'bg-neon-amber/20 text-neon-amber border-neon-amber/30',
  open: 'bg-neon-blue/20 text-neon-blue border-neon-blue/30',
  locked: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
  cancelled: 'bg-neon-red/20 text-neon-red border-neon-red/30',
};

export function Badge({ variant, children, className, pulse }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider',
        badgeStyles[variant],
        className,
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            variant === 'live' ? 'bg-neon-green' : 'bg-current',
          )} />
          <span className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            variant === 'live' ? 'bg-neon-green' : 'bg-current',
          )} />
        </span>
      )}
      {children}
    </span>
  );
}
