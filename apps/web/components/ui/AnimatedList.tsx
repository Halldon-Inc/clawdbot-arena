'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedListProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export function AnimatedList({ children, className, staggerDelay = 0.05 }: AnimatedListProps) {
  return (
    <motion.div
      className={cn('', className)}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: staggerDelay },
        },
      }}
    >
      {children.map((child, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
