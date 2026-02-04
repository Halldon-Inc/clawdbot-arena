'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountUpNumberProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
  separator?: string;
}

export function CountUpNumber({
  end,
  duration = 2000,
  prefix = '',
  suffix = '',
  className,
  decimals = 0,
  separator = ',',
}: CountUpNumberProps) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          const startTime = performance.now();

          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(eased * end);

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  const formatted = value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return (
    <span ref={ref} className={cn('font-mono tabular-nums', className)}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
