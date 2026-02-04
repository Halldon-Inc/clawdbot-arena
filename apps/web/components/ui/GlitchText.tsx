'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface GlitchTextProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'span' | 'div';
  glitchOnHover?: boolean;
}

export function GlitchText({ text, className, as: Tag = 'span', glitchOnHover = false }: GlitchTextProps) {
  const [isGlitching, setIsGlitching] = useState(!glitchOnHover);
  const [displayText, setDisplayText] = useState(text);

  const glitch = useCallback(() => {
    const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const glitched = text
      .split('')
      .map((char) => (Math.random() < 0.1 ? chars[Math.floor(Math.random() * chars.length)] : char))
      .join('');
    setDisplayText(glitched);
  }, [text]);

  useEffect(() => {
    if (!isGlitching) {
      setDisplayText(text);
      return;
    }

    const interval = setInterval(() => {
      if (Math.random() < 0.8) {
        setDisplayText(text);
      } else {
        glitch();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isGlitching, text, glitch]);

  return (
    <Tag
      className={cn('relative inline-block', className)}
      onMouseEnter={glitchOnHover ? () => setIsGlitching(true) : undefined}
      onMouseLeave={glitchOnHover ? () => { setIsGlitching(false); setDisplayText(text); } : undefined}
    >
      <span className="relative z-10">{displayText}</span>
      {isGlitching && (
        <>
          <span className="absolute inset-0 text-neon-pink opacity-70 z-0" style={{ clipPath: 'inset(10% 0 60% 0)', transform: 'translate(-2px, -1px)' }} aria-hidden>
            {displayText}
          </span>
          <span className="absolute inset-0 text-neon-cyan opacity-70 z-0" style={{ clipPath: 'inset(50% 0 10% 0)', transform: 'translate(2px, 1px)' }} aria-hidden>
            {displayText}
          </span>
        </>
      )}
    </Tag>
  );
}
