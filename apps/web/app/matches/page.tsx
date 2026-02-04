'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { NeonButton } from '@/components/ui/NeonButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface MatchRecord {
  matchId: string;
  player1Name: string;
  player2Name: string;
  winner: string | null;
  p1Rounds: number;
  p2Rounds: number;
  duration: number;
  startedAt: number;
  endedAt: number;
  hasReplay: boolean;
}

type TimeFilter = 'all' | 'today' | 'week';

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimeFilter>('all');

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/api/matches?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.matches;
        if (Array.isArray(list)) {
          setMatches(list);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;

  const filtered = matches.filter((m) => {
    if (filter === 'today') return now - m.endedAt < dayMs;
    if (filter === 'week') return now - m.endedAt < weekMs;
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-wider mb-2">MATCH HISTORY</h1>
          <p className="text-gray-400">Browse past battles and watch replays</p>
        </div>
        <div className="flex gap-1 glass rounded-lg p-1">
          {([
            { key: 'all', label: 'All' },
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                filter === key ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Match Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((match, i) => (
            <motion.div
              key={match.matchId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <MatchCard match={match} />
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 font-display tracking-wider">NO MATCHES FOUND</p>
          <p className="text-gray-600 text-sm mt-2">Check back after some battles have been fought</p>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: MatchRecord }) {
  const duration = Math.round(match.duration / 1000);
  const date = new Date(match.endedAt);
  const p1Won = match.winner === match.player1Name || match.p1Rounds > match.p2Rounds;
  const p2Won = !p1Won && match.winner !== null;

  return (
    <GlassCard className="group">
      {/* Time */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500 font-mono">
          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <Badge variant="completed">Completed</Badge>
      </div>

      {/* Versus */}
      <div className="flex items-center gap-4 mb-4">
        {/* Player 1 */}
        <div className={cn('flex-1 text-center', p1Won && 'relative')}>
          <div className={cn(
            'w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center font-bold text-lg',
            p1Won ? 'bg-gradient-to-br from-neon-amber to-yellow-600 shadow-glow-amber' : 'bg-white/5',
          )}>
            {p1Won && <span className="text-sm">W</span>}
            {!p1Won && <span className="text-gray-500 text-sm">L</span>}
          </div>
          <div className="font-medium text-sm truncate">{match.player1Name}</div>
          <div className="font-mono text-xs text-gray-500">{match.p1Rounds} rounds</div>
        </div>

        {/* VS */}
        <div className="text-gray-600 font-display text-xs tracking-widest">VS</div>

        {/* Player 2 */}
        <div className={cn('flex-1 text-center', p2Won && 'relative')}>
          <div className={cn(
            'w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center font-bold text-lg',
            p2Won ? 'bg-gradient-to-br from-neon-amber to-yellow-600 shadow-glow-amber' : 'bg-white/5',
          )}>
            {p2Won && <span className="text-sm">W</span>}
            {!p2Won && <span className="text-gray-500 text-sm">L</span>}
          </div>
          <div className="font-medium text-sm truncate">{match.player2Name}</div>
          <div className="font-mono text-xs text-gray-500">{match.p2Rounds} rounds</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="text-xs text-gray-500 font-mono">
          {duration}s &middot; {match.p1Rounds + match.p2Rounds} rounds
        </div>
        {match.hasReplay && (
          <Link href={`/matches/${match.matchId}`}>
            <NeonButton size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
              Replay
            </NeonButton>
          </Link>
        )}
      </div>
    </GlassCard>
  );
}
