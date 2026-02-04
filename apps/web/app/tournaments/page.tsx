'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

type TournamentStatus = 'registration' | 'in_progress' | 'completed' | 'cancelled';

interface TournamentSummary {
  id: string;
  name: string;
  format: string;
  maxBots: number;
  buyIn: number;
  prizePool: number;
  prizeDistribution: number[];
  status: TournamentStatus;
  participantCount: number;
  participants: string[];
  currentRound: number;
  totalRounds: number;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

interface BracketMatch {
  matchId: string | null;
  bot1Id: string | null;
  bot2Id: string | null;
  winnerId: string | null;
  slot: number;
}

type BracketRound = BracketMatch[];

interface BracketState {
  tournamentId: string;
  tournamentName: string;
  status: TournamentStatus;
  currentRound: number;
  totalRounds: number;
  rounds: BracketRound[];
  placements: Record<string, number>;
}

// =============================================================================
// Helpers
// =============================================================================

function formatComp(amount: number): string {
  return `${amount.toLocaleString()} COMP`;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortBotId(id: string | null): string {
  if (!id) return 'TBD';
  return id.replace('bot_', '').slice(0, 8);
}

// =============================================================================
// Components
// =============================================================================

function TournamentCard({
  tournament,
  onViewBracket,
}: {
  tournament: TournamentSummary;
  onViewBracket: (id: string) => void;
}) {
  const prizeText = tournament.prizePool > 0
    ? formatComp(tournament.prizePool)
    : `${formatComp(tournament.buyIn)} buy-in`;

  return (
    <GlassCard className="group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate group-hover:text-neon-purple transition-colors">
            {tournament.name}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {tournament.format.replace('-', ' ')} &middot; {timeAgo(tournament.createdAt)}
          </p>
        </div>
        <Badge
          variant={
            tournament.status === 'in_progress' ? 'live'
            : tournament.status === 'registration' ? 'open'
            : tournament.status === 'completed' ? 'completed'
            : 'cancelled'
          }
          pulse={tournament.status === 'in_progress'}
        >
          {tournament.status === 'in_progress' ? 'Live'
            : tournament.status === 'registration' ? 'Open'
            : tournament.status === 'completed' ? 'Ended'
            : 'Cancelled'}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="glass rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-display mb-1">Prize Pool</div>
          <div className="text-sm font-mono font-bold text-neon-amber">{prizeText}</div>
        </div>
        <div className="glass rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-display mb-1">Bots</div>
          <div className="text-sm font-mono font-bold">
            {tournament.participantCount}
            <span className="text-gray-500"> / {tournament.maxBots}</span>
          </div>
        </div>
        <div className="glass rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-display mb-1">Round</div>
          <div className="text-sm font-mono font-bold">
            {tournament.status === 'registration'
              ? '--'
              : `${tournament.currentRound + 1} / ${tournament.totalRounds}`}
          </div>
        </div>
      </div>

      {/* Prize Distribution */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-display">Payouts:</span>
        {tournament.prizeDistribution.map((pct, i) => {
          const colors = ['text-neon-amber', 'text-gray-400', 'text-amber-600', 'text-gray-500'];
          const icons = ['1st', '2nd', '3rd', '4th'];
          return (
            <span key={i} className={`text-xs font-mono font-medium ${colors[i] || 'text-gray-500'}`}>
              {icons[i]}: {pct}%
            </span>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {tournament.status === 'registration' && (
          <NeonButton className="flex-1">
            Join Tournament
          </NeonButton>
        )}
        {(tournament.status === 'in_progress' || tournament.status === 'completed') && (
          <NeonButton
            variant="secondary"
            className="flex-1"
            onClick={() => onViewBracket(tournament.id)}
          >
            View Bracket
          </NeonButton>
        )}
        {tournament.status === 'in_progress' && (
          <NeonButton variant="ghost">
            Spectate
          </NeonButton>
        )}
      </div>
    </GlassCard>
  );
}

function BracketView({
  bracket,
  onClose,
}: {
  bracket: BracketState;
  onClose: () => void;
}) {
  const roundNames = useMemo(() => {
    const total = bracket.rounds.length;
    return bracket.rounds.map((_, i) => {
      if (i === total - 1) return 'Final';
      if (i === total - 2) return 'Semifinals';
      if (i === total - 3) return 'Quarterfinals';
      return `Round ${i + 1}`;
    });
  }, [bracket.rounds]);

  return (
    <GlassCard hover={false} className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-xl tracking-wider">{bracket.tournamentName}</h2>
          <p className="text-gray-400 text-sm mt-1">Tournament Bracket</p>
        </div>
        <NeonButton size="sm" variant="ghost" onClick={onClose}>
          Close
        </NeonButton>
      </div>

      {/* Bracket Tree */}
      <div className="overflow-x-auto">
        <div className="flex gap-8 min-w-max pb-4">
          {bracket.rounds.map((round, roundIdx) => (
            <div key={roundIdx} className="flex flex-col">
              <div className="text-center text-[10px] font-display font-bold text-gray-500 uppercase tracking-wider mb-4">
                {roundNames[roundIdx]}
              </div>
              <div
                className="flex flex-col justify-around flex-1"
                style={{ gap: `${Math.pow(2, roundIdx) * 16}px` }}
              >
                {round.map((match, matchIdx) => (
                  <BracketMatchCard key={matchIdx} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function BracketMatchCard({ match }: { match: BracketMatch }) {
  const isComplete = match.winnerId !== null;
  const isLive = match.matchId !== null && !isComplete;

  return (
    <div className={cn(
      'w-52 rounded-xl border overflow-hidden',
      isLive
        ? 'border-neon-amber/50 bg-neon-amber/5'
        : isComplete
          ? 'border-white/10 glass'
          : 'border-white/5 bg-white/[0.01]',
    )}>
      {/* Bot 1 */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 text-sm',
        match.winnerId === match.bot1Id && match.winnerId
          ? 'bg-neon-green/10 text-neon-green font-semibold'
          : match.winnerId && match.winnerId !== match.bot1Id
            ? 'text-gray-600 line-through'
            : 'text-gray-300',
      )}>
        <span className="truncate font-mono text-xs">{shortBotId(match.bot1Id)}</span>
        {match.winnerId === match.bot1Id && match.winnerId && (
          <span className="text-neon-green text-xs ml-2">W</span>
        )}
      </div>

      <div className="border-t border-white/5" />

      {/* Bot 2 */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 text-sm',
        match.winnerId === match.bot2Id && match.winnerId
          ? 'bg-neon-green/10 text-neon-green font-semibold'
          : match.winnerId && match.winnerId !== match.bot2Id
            ? 'text-gray-600 line-through'
            : 'text-gray-300',
      )}>
        <span className="truncate font-mono text-xs">{shortBotId(match.bot2Id)}</span>
        {match.winnerId === match.bot2Id && match.winnerId && (
          <span className="text-neon-green text-xs ml-2">W</span>
        )}
      </div>

      {/* Live indicator */}
      {isLive && (
        <div className="border-t border-neon-amber/30 px-3 py-1 bg-neon-amber/10 text-center">
          <span className="text-[10px] font-display font-bold text-neon-amber uppercase tracking-wider animate-pulse">
            Live
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activeBracket, setActiveBracket] = useState<BracketState | null>(null);
  const [bracketLoading, setBracketLoading] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/api/tournaments`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.tournaments;
        if (Array.isArray(list)) {
          setTournaments(list);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredTournaments = useMemo(() => {
    if (filter === 'all') return tournaments;
    return tournaments.filter((t) => t.status === filter);
  }, [filter, tournaments]);

  const stats = useMemo(() => ({
    active: tournaments.filter((t) => t.status === 'in_progress').length,
    open: tournaments.filter((t) => t.status === 'registration').length,
    totalPrize: tournaments.reduce((s, t) => s + t.prizePool, 0),
    completed: tournaments.filter((t) => t.status === 'completed').length,
  }), [tournaments]);

  const handleViewBracket = useCallback((id: string) => {
    setBracketLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/api/tournaments/${id}/bracket`)
      .then((r) => r.json())
      .then((data) => {
        if (data.rounds) {
          setActiveBracket(data);
        }
        setBracketLoading(false);
      })
      .catch(() => setBracketLoading(false));
  }, []);

  const handleCloseBracket = useCallback(() => {
    setActiveBracket(null);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-wider mb-2">TOURNAMENTS</h1>
          <p className="text-gray-400">Compete in single-elimination brackets for COMP prizes</p>
        </div>
        <NeonButton>Create Tournament</NeonButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <GlassCard hover={false} className="!p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Active</div>
          <div className="font-mono text-2xl font-bold">{stats.active}</div>
          <div className="text-xs text-neon-amber mt-1">live now</div>
        </GlassCard>
        <GlassCard hover={false} className="!p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Open</div>
          <div className="font-mono text-2xl font-bold">{stats.open}</div>
          <div className="text-xs text-neon-green mt-1">join now</div>
        </GlassCard>
        <GlassCard hover={false} className="!p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Prize Pool</div>
          <div className="font-mono text-2xl font-bold text-neon-amber">{formatComp(stats.totalPrize)}</div>
          <div className="text-xs text-gray-500 mt-1">across all tournaments</div>
        </GlassCard>
        <GlassCard hover={false} className="!p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Completed</div>
          <div className="font-mono text-2xl font-bold">{stats.completed}</div>
          <div className="text-xs text-gray-500 mt-1">tournaments finished</div>
        </GlassCard>
      </div>

      {/* Active Bracket View */}
      <AnimatePresence>
        {activeBracket && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <BracketView bracket={activeBracket} onClose={handleCloseBracket} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Bar */}
      <div className="flex gap-1 glass rounded-lg p-1 w-fit mb-8">
        {([
          { key: 'all', label: 'All' },
          { key: 'registration', label: 'Open' },
          { key: 'in_progress', label: 'Live' },
          { key: 'completed', label: 'Ended' },
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

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Tournament Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTournaments.map((tournament, i) => (
            <motion.div
              key={tournament.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <TournamentCard
                tournament={tournament}
                onViewBracket={handleViewBracket}
              />
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filteredTournaments.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 font-display tracking-wider">NO TOURNAMENTS FOUND</p>
          <p className="text-gray-600 text-sm mt-2">
            {filter === 'all'
              ? 'No tournaments have been created yet.'
              : `No tournaments with this status.`}
          </p>
        </div>
      )}

      {/* How Tournaments Work */}
      <div className="mt-16 mb-8">
        <GlassCard hover={false}>
          <h2 className="font-display font-bold text-xl tracking-wider mb-6">HOW TOURNAMENTS WORK</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-green to-green-600 flex items-center justify-center mb-3 font-display font-bold text-sm">01</div>
              <h3 className="font-display font-bold tracking-wider mb-2">REGISTRATION</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Tournaments open with a set COMP buy-in. Once the max number of bots join (8 or 16), the tournament begins. Your buy-in goes into the shared prize pool.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-purple to-purple-600 flex items-center justify-center mb-3 font-display font-bold text-sm">02</div>
              <h3 className="font-display font-bold tracking-wider mb-2">SINGLE ELIMINATION</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Bots are randomly seeded into a bracket. Each round, losers are eliminated. Winners advance until one remains. Same rules as ranked play.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-amber to-amber-600 flex items-center justify-center mb-3 font-display font-bold text-sm">03</div>
              <h3 className="font-display font-bold tracking-wider mb-2">PRIZES</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                The prize pool is distributed to the top finishers based on the tournament's payout structure. Prizes are paid out in COMP tokens.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
