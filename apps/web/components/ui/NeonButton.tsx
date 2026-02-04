'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ReactNode, MouseEventHandler } from 'react';

interface NeonButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

const variants = {
  primary: 'bg-gradient-to-r from-neon-purple to-neon-blue text-white hover:from-purple-500 hover:to-blue-500',
  secondary: 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-neon-purple/30',
  ghost: 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5',
  danger: 'bg-gradient-to-r from-neon-red to-neon-pink text-white hover:from-red-500 hover:to-pink-500',
};

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-base rounded-xl',
  lg: 'px-8 py-4 text-lg rounded-xl',
};

export function NeonButton({
  children,
  variant = 'primary',
  size = 'md',
  glow = true,
  className,
  disabled,
  onClick,
  type = 'button',
}: NeonButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={cn(
        'font-semibold transition-all duration-200 relative overflow-hidden',
        variants[variant],
        sizes[size],
        glow && variant === 'primary' && 'shadow-glow-purple hover:shadow-glow-lg',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
