'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useArenaSocket } from '@/lib/ws/useArenaSocket';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { Badge } from '@/components/ui/Badge';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { BettingPanel } from '@/components/betting/BettingPanel';
import { cn } from '@/lib/utils';

interface Match {
  id: string;
  matchId?: number;
  gameType: string;
  status: 'open' | 'live' | 'completed';
  bots: Array<{ name: string; index: number; elo: number }>;
  totalPool: string;
  startTime: number;
  odds: number[];
}

export default function ArenaPage() {
  const [filter, setFilter] = useState<'all' | 'open' | 'live'>('all');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const { status, subscribe, send } = useArenaSocket();

  // Fetch matches from API
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/api/matches?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.matches;
        if (Array.isArray(list)) {
          setMatches(list.map(mapMatchData));
        }
      })
      .catch(() => {});
  }, []);

  // Subscribe to live match updates
  useEffect(() => {
    const unsub1 = subscribe('MATCH_STATE', (data: any) => {
      setMatches((prev) =>
        prev.map((m) => (m.id === data.matchId ? { ...m, status: 'live' as const } : m)),
      );
    });

    const unsub2 = subscribe('MATCH_CREATED', (data: any) => {
      const newMatch = mapMatchData(data);
      setMatches((prev) => [newMatch, ...prev]);
    });

    const unsub3 = subscribe('MATCH_END', (data: any) => {
      setMatches((prev) =>
        prev.map((m) => (m.id === data.matchId ? { ...m, status: 'completed' as const } : m)),
      );
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [subscribe]);

  const filteredMatches = matches.filter((m) => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-wider mb-2">ARENA</h1>
          <p className="text-gray-400">Browse matches and place your bets</p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionStatus status={status} />
          <div className="flex gap-1 glass rounded-lg p-1">
            {(['all', 'open', 'live'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium capitalize transition-all',
                  filter === f
                    ? 'bg-neon-purple/20 text-neon-purple'
                    : 'text-gray-400 hover:text-white',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Match Grid */}
        <div className="xl:col-span-2">
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredMatches.map((match, i) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <MatchCard
                    match={match}
                    selected={selectedMatch?.id === match.id}
                    onSelect={() => setSelectedMatch(match)}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>

          {filteredMatches.length === 0 && (
            <div className="text-center py-20">
              <div className="text-gray-600 mb-4 text-6xl">
                <svg className="w-16 h-16 mx-auto text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-gray-500 font-display tracking-wider">NO MATCHES FOUND</p>
              <p className="text-gray-600 text-sm mt-2">Matches will appear here when bots start fighting</p>
            </div>
          )}
        </div>

        {/* Betting Sidebar */}
        <div className="xl:col-span-1">
          {selectedMatch ? (
            <div className="sticky top-24">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display font-bold tracking-wider">PLACE BET</h2>
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="text-gray-500 hover:text-white text-sm"
                >
                  Close
                </button>
              </div>
              <BettingPanel
                matchId={selectedMatch.matchId || parseInt(selectedMatch.id)}
                bots={selectedMatch.bots.map((b, i) => ({
                  index: b.index,
                  name: b.name,
                  odds: selectedMatch.odds[i] || 2.0,
                }))}
              />
            </div>
          ) : (
            <GlassCard hover={false} className="text-center py-12">
              <div className="text-gray-600 mb-3">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <p className="text-gray-500 font-display text-sm tracking-wider">SELECT A MATCH TO BET</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, selected, onSelect }: { match: Match; selected: boolean; onSelect: () => void }) {
  const isLive = match.status === 'live';

  return (
    <GlassCard
      className={cn(
        'cursor-pointer',
        selected && 'border-neon-purple/50 shadow-glow-purple',
      )}
      glowColor={isLive ? 'green' : 'purple'}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-sm tracking-wider uppercase">{match.gameType}</h3>
          <p className="text-xs text-gray-500 font-mono">#{match.id}</p>
        </div>
        <Badge variant={match.status === 'live' ? 'live' : match.status === 'open' ? 'open' : 'completed'} pulse={isLive}>
          {match.status}
        </Badge>
      </div>

      {/* Fighters */}
      <div className="space-y-2 mb-4">
        {match.bots.map((bot, idx) => (
          <div key={bot.name} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                idx === 0 ? 'bg-gradient-to-br from-neon-purple to-neon-pink' : 'bg-gradient-to-br from-neon-blue to-neon-cyan',
              )}>
                {idx + 1}
              </div>
              <div>
                <span className="font-medium text-sm">{bot.name}</span>
                {bot.elo > 0 && <span className="ml-2 text-xs text-gray-500 font-mono">{bot.elo}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-bold">{(match.odds[idx] || 2.0).toFixed(2)}x</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-display">Pool</div>
          <div className="font-mono font-bold text-sm">{match.totalPool} COMP</div>
        </div>
        {isLive ? (
          <Link href={`/spectate/${match.id}`}>
            <NeonButton size="sm" variant="secondary">Watch</NeonButton>
          </Link>
        ) : (
          <NeonButton size="sm" onClick={onSelect}>Bet</NeonButton>
        )}
      </div>
    </GlassCard>
  );
}

function mapMatchData(data: any): Match {
  return {
    id: data.matchId || data.id || String(Math.random()),
    matchId: data.matchId ? Number(data.matchId) : undefined,
    gameType: data.gameType || 'beat-em-up',
    status: data.status || 'open',
    bots: data.bots || [
      { name: data.player1Name || 'Fighter 1', index: 0, elo: 0 },
      { name: data.player2Name || 'Fighter 2', index: 1, elo: 0 },
    ],
    totalPool: data.totalPool || '0',
    startTime: data.startTime || Date.now(),
    odds: data.odds || [2.0, 2.0],
  };
}
