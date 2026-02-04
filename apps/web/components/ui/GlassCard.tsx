'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glowColor?: 'purple' | 'blue' | 'pink' | 'green' | 'amber';
  onClick?: () => void;
}

const glowColors = {
  purple: 'hover:border-neon-purple/30 hover:shadow-glow-purple',
  blue: 'hover:border-neon-blue/30 hover:shadow-glow-blue',
  pink: 'hover:border-neon-pink/30 hover:shadow-glow-pink',
  green: 'hover:border-neon-green/30 hover:shadow-glow-green',
  amber: 'hover:border-neon-amber/30 hover:shadow-glow-amber',
};

export function GlassCard({
  children,
  className,
  hover = true,
  glowColor = 'purple',
  onClick,
}: GlassCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={cn(
        'glass rounded-2xl p-6 transition-all duration-300',
        hover && glowColors[glowColor],
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
