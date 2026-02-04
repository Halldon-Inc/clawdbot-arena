'use client';

import { cn } from '@/lib/utils';
import type { ConnectionStatus as Status } from '@/lib/ws/useArenaSocket';

interface ConnectionStatusProps {
  status: Status;
  className?: string;
}

const statusConfig = {
  connected: { label: 'Connected', color: 'bg-neon-green', textColor: 'text-neon-green' },
  connecting: { label: 'Connecting', color: 'bg-neon-amber', textColor: 'text-neon-amber' },
  reconnecting: { label: 'Reconnecting', color: 'bg-neon-amber', textColor: 'text-neon-amber' },
  disconnected: { label: 'Disconnected', color: 'bg-neon-red', textColor: 'text-neon-red' },
};

export function ConnectionStatus({ status, className }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <span className="relative flex h-2 w-2">
        {(status === 'connected' || status === 'connecting' || status === 'reconnecting') && (
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', config.color)} />
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', config.color)} />
      </span>
      <span className={cn('font-mono', config.textColor)}>{config.label}</span>
    </div>
  );
}
