'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  cursor?: boolean;
  onComplete?: () => void;
}

export function TypewriterText({
  text,
  speed = 50,
  delay = 0,
  className,
  cursor = true,
  onComplete,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(delayTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    if (displayed.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayed(text.slice(0, displayed.length + 1));
      }, speed);
      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [started, displayed, text, speed, onComplete]);

  return (
    <span className={cn('', className)}>
      {displayed}
      {cursor && displayed.length < text.length && (
        <span className="inline-block w-[2px] h-[1em] bg-neon-purple animate-pulse ml-0.5 align-middle" />
      )}
    </span>
  );
}
