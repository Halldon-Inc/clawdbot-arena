'use client';

import { cn } from '@/lib/utils';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: 'purple' | 'blue' | 'green' | 'amber' | 'pink';
  children?: React.ReactNode;
}

const colorMap = {
  purple: 'stroke-neon-purple',
  blue: 'stroke-neon-blue',
  green: 'stroke-neon-green',
  amber: 'stroke-neon-amber',
  pink: 'stroke-neon-pink',
};

const glowMap = {
  purple: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))',
  blue: 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))',
  green: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.5))',
  amber: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.5))',
  pink: 'drop-shadow(0 0 6px rgba(236, 72, 153, 0.5))',
};

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 4,
  className,
  color = 'purple',
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90" style={{ filter: glowMap[color] }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={colorMap[color]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
