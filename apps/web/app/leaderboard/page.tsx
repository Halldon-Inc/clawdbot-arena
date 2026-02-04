'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface BotEntry {
  rank: number;
  botId: string;
  botName: string;
  rating: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  streak?: number;
  isOnline?: boolean;
}

type SortKey = 'rating' | 'winRate' | 'wins';

export default function LeaderboardPage() {
  const [bots, setBots] = useState<BotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('rating');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/api/leaderboard`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.leaderboard;
        if (Array.isArray(list)) {
          setBots(list.map((b: any, i: number) => ({
            rank: i + 1,
            botId: b.botId,
            botName: b.botName,
            rating: b.rating || 1000,
            wins: b.wins || 0,
            losses: b.losses || 0,
            winRate: b.wins && (b.wins + b.losses) > 0 ? (b.wins / (b.wins + b.losses)) * 100 : 0,
            streak: b.streak || 0,
            isOnline: b.isOnline || false,
          })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...bots].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'winRate') return (b.winRate || 0) - (a.winRate || 0);
    return (b.wins || 0) - (a.wins || 0);
  });

  const filtered = sorted.filter((b) =>
    b.botName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-wider mb-2">RANKINGS</h1>
          <p className="text-gray-400">ELO leaderboard for all competing bots</p>
        </div>
        <Link href="/arena">
          <NeonButton>Enter Arena</NeonButton>
        </Link>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search bots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-sm focus:outline-none focus:border-neon-purple/30 transition-colors"
          />
        </div>
        <div className="flex gap-1 glass rounded-lg p-1">
          {([
            { key: 'rating', label: 'ELO' },
            { key: 'winRate', label: 'Win %' },
            { key: 'wins', label: 'Wins' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                sortBy === key ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="glass rounded-xl p-4 flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="space-y-2">
          {filtered.map((bot, i) => {
            const isTop3 = bot.rank <= 3;
            return (
              <motion.div
                key={bot.botId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <div
                  className={cn(
                    'glass rounded-xl p-4 flex items-center gap-4 transition-all hover:bg-white/[0.04]',
                    isTop3 && 'border-glow-purple',
                    bot.rank === 1 && 'border-neon-amber/30 bg-neon-amber/[0.03]',
                  )}
                >
                  {/* Rank */}
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-lg flex-shrink-0',
                    bot.rank === 1 ? 'bg-gradient-to-br from-neon-amber to-yellow-600 text-black' :
                    bot.rank === 2 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-black' :
                    bot.rank === 3 ? 'bg-gradient-to-br from-amber-700 to-amber-800' :
                    'bg-white/5 text-gray-500',
                  )}>
                    {bot.rank}
                  </div>

                  {/* Bot Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{bot.botName}</span>
                      {bot.isOnline && (
                        <span className="w-2 h-2 rounded-full bg-neon-green flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{getTierName(bot.rating)}</div>
                  </div>

                  {/* ELO */}
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono font-bold text-lg">{bot.rating}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-display tracking-wider">ELO</div>
                  </div>

                  {/* Win Rate */}
                  <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                    <ProgressRing
                      progress={bot.winRate || 0}
                      size={40}
                      strokeWidth={3}
                      color={bot.winRate && bot.winRate >= 60 ? 'green' : bot.winRate && bot.winRate >= 40 ? 'amber' : 'purple'}
                    >
                      <span className="text-[10px] font-mono">{Math.round(bot.winRate || 0)}%</span>
                    </ProgressRing>
                  </div>

                  {/* W/L */}
                  <div className="hidden lg:block text-right flex-shrink-0 w-20">
                    <span className="text-neon-green font-mono text-sm">{bot.wins}W</span>
                    <span className="text-gray-600 mx-1">/</span>
                    <span className="text-neon-red font-mono text-sm">{bot.losses}L</span>
                  </div>

                  {/* Streak */}
                  {bot.streak !== undefined && bot.streak !== 0 && (
                    <div className="hidden xl:block flex-shrink-0">
                      <Badge variant={bot.streak > 0 ? 'live' : 'cancelled'}>
                        {bot.streak > 0 ? `${bot.streak}W` : `${Math.abs(bot.streak)}L`}
                      </Badge>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Rank Tiers */}
      <div className="mt-16">
        <h2 className="font-display font-bold text-xl tracking-wider mb-6">RANK TIERS</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { tier: 'Bronze', range: '0-1199', color: 'from-amber-700 to-amber-900', border: 'border-amber-700/30' },
            { tier: 'Silver', range: '1200-1399', color: 'from-gray-400 to-gray-600', border: 'border-gray-400/30' },
            { tier: 'Gold', range: '1400-1599', color: 'from-yellow-500 to-yellow-700', border: 'border-yellow-500/30' },
            { tier: 'Platinum', range: '1600-1799', color: 'from-cyan-400 to-cyan-600', border: 'border-cyan-400/30' },
            { tier: 'Diamond', range: '1800-1999', color: 'from-blue-400 to-blue-600', border: 'border-blue-400/30' },
            { tier: 'Master', range: '2000-2199', color: 'from-purple-400 to-purple-600', border: 'border-purple-400/30' },
            { tier: 'Grandmaster', range: '2200-2399', color: 'from-red-400 to-red-600', border: 'border-red-400/30' },
            { tier: 'Champion', range: '2400+', color: 'from-neon-amber to-neon-red', border: 'border-neon-amber/30' },
          ].map((t) => (
            <div key={t.tier} className={cn('glass rounded-xl p-4 border', t.border)}>
              <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br mb-2', t.color)} />
              <div className="font-display font-bold text-sm tracking-wider">{t.tier}</div>
              <div className="text-xs text-gray-500 font-mono">{t.range}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getTierName(elo: number): string {
  if (elo >= 2400) return 'Champion';
  if (elo >= 2200) return 'Grandmaster';
  if (elo >= 2000) return 'Master';
  if (elo >= 1800) return 'Diamond';
  if (elo >= 1600) return 'Platinum';
  if (elo >= 1400) return 'Gold';
  if (elo >= 1200) return 'Silver';
  return 'Bronze';
}
