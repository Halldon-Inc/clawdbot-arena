'use client';

import { useEffect, useState, useCallback } from 'react';
import type {
  LeaderboardEntry,
  LeaderboardSnapshot,
  LeaderboardUpdate,
  RankTier,
} from '@clawdbot/protocol';

// =============================================================================
// Rank Colors
// =============================================================================

const RANK_COLORS: Record<RankTier, { bg: string; text: string; border: string }> = {
  bronze: { bg: 'bg-amber-900/30', text: 'text-amber-600', border: 'border-amber-700' },
  silver: { bg: 'bg-gray-400/20', text: 'text-gray-300', border: 'border-gray-500' },
  gold: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-600' },
  platinum: { bg: 'bg-cyan-400/20', text: 'text-cyan-300', border: 'border-cyan-500' },
  diamond: { bg: 'bg-blue-400/20', text: 'text-blue-300', border: 'border-blue-500' },
  master: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-600' },
  grandmaster: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-600' },
  champion: { bg: 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30', text: 'text-yellow-300', border: 'border-yellow-500' },
};

// =============================================================================
// Props
// =============================================================================

interface LiveLeaderboardProps {
  initialData?: LeaderboardSnapshot;
  maxEntries?: number;
  showOnlineStatus?: boolean;
  onPlayerClick?: (playerId: string) => void;
  className?: string;
}

// =============================================================================
// Rank Badge Component
// =============================================================================

interface RankBadgeProps {
  rank: number;
}

function RankBadge({ rank }: RankBadgeProps) {
  if (rank === 1) {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full text-black font-bold text-sm">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-500 rounded-full text-black font-bold text-sm">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 rounded-full text-white font-bold text-sm">
        3
      </div>
    );
  }
  return (
    <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-gray-300 font-medium text-sm">
      {rank}
    </div>
  );
}

// =============================================================================
// Tier Badge Component
// =============================================================================

interface TierBadgeProps {
  tier: RankTier;
}

function TierBadge({ tier }: TierBadgeProps) {
  const colors = RANK_COLORS[tier];
  const displayName = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
    >
      {displayName}
    </span>
  );
}

// =============================================================================
// Leaderboard Entry Row
// =============================================================================

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isAnimating?: 'up' | 'down' | 'new' | null;
  showOnlineStatus: boolean;
  onClick?: () => void;
}

function LeaderboardRow({ entry, isAnimating, showOnlineStatus, onClick }: LeaderboardRowProps) {
  const animationClass = isAnimating === 'up'
    ? 'animate-slide-up bg-green-500/20'
    : isAnimating === 'down'
    ? 'animate-slide-down bg-red-500/20'
    : isAnimating === 'new'
    ? 'animate-fade-in bg-purple-500/20'
    : '';

  return (
    <tr
      className={`border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors ${animationClass}`}
      onClick={onClick}
    >
      {/* Rank */}
      <td className="py-3 px-4">
        <RankBadge rank={entry.rank} />
      </td>

      {/* Player Info */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {/* Online indicator */}
          {showOnlineStatus && (
            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full ${
                  entry.isInMatch
                    ? 'bg-yellow-500 animate-pulse'
                    : entry.isOnline
                    ? 'bg-green-500'
                    : 'bg-gray-600'
                }`}
              />
              {entry.isInMatch && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                </span>
              )}
            </div>
          )}

          <div>
            <span className="font-medium text-white">{entry.botName}</span>
            {entry.isInMatch && (
              <span className="ml-2 text-xs text-yellow-500">LIVE</span>
            )}
          </div>
        </div>
      </td>

      {/* Tier */}
      <td className="py-3 px-4">
        <TierBadge tier={entry.tier} />
      </td>

      {/* Rating */}
      <td className="py-3 px-4 text-right">
        <span className="font-mono text-lg text-white">{entry.rating}</span>
      </td>

      {/* Win Rate */}
      <td className="py-3 px-4 text-right">
        <span className={`font-mono ${entry.winRate >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
          {(entry.winRate * 100).toFixed(1)}%
        </span>
      </td>

      {/* Games */}
      <td className="py-3 px-4 text-right text-gray-400">
        {entry.gamesPlayed}
      </td>
    </tr>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LiveLeaderboard({
  initialData,
  maxEntries = 50,
  showOnlineStatus = true,
  onPlayerClick,
  className = '',
}: LiveLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(
    initialData?.entries.slice(0, maxEntries) ?? []
  );
  const [totalPlayers, setTotalPlayers] = useState(initialData?.totalPlayers ?? 0);
  const [lastUpdated, setLastUpdated] = useState(initialData?.lastUpdated ?? Date.now());
  const [animatingEntries, setAnimatingEntries] = useState<Map<string, 'up' | 'down' | 'new'>>(
    new Map()
  );
  const [isConnected, setIsConnected] = useState(false);

  // Handle leaderboard updates
  const handleUpdate = useCallback((update: LeaderboardUpdate) => {
    setLastUpdated(update.timestamp);

    // Track animations
    const newAnimations = new Map<string, 'up' | 'down' | 'new'>();

    for (const change of update.changes) {
      if (change.direction !== 'unchanged') {
        newAnimations.set(change.playerId, change.direction);
      }
    }

    if (newAnimations.size > 0) {
      setAnimatingEntries(newAnimations);

      // Clear animations after delay
      setTimeout(() => {
        setAnimatingEntries(new Map());
      }, 1000);
    }

    // Update entries (in real app, would refetch or apply changes)
    // For now, this is a placeholder for WebSocket integration
  }, []);

  // Fetch initial leaderboard data
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

    const fetchLeaderboard = () => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'GET_LEADERBOARD' }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'LEADERBOARD') {
            const leaderboardEntries: LeaderboardEntry[] = message.entries.map(
              (entry: any, index: number) => ({
                rank: index + 1,
                playerId: entry.botId,
                botName: entry.botName,
                rating: entry.rating,
                tier: getTierFromRating(entry.rating),
                gamesPlayed: entry.gamesPlayed || 0,
                winRate: entry.winRate || 0.5,
                isOnline: entry.isOnline || false,
                isInMatch: entry.isInMatch || false,
                currentMatchId: entry.currentMatchId || null,
              })
            );

            setEntries(leaderboardEntries.slice(0, maxEntries));
            setTotalPlayers(leaderboardEntries.length);
            setLastUpdated(Date.now());
            setIsConnected(true);
          }
        } catch (err) {
          console.error('Failed to parse leaderboard data:', err);
        }
      };

      ws.onerror = () => {
        // Fall back to mock data on error
        loadMockData();
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      return ws;
    };

    const ws = fetchLeaderboard();

    // Refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchLeaderboard();
    }, 30000);

    return () => {
      ws.close();
      clearInterval(refreshInterval);
    };
  }, [maxEntries]);

  // Helper to get tier from rating
  const getTierFromRating = (rating: number): RankTier => {
    if (rating >= 2400) return 'champion';
    if (rating >= 2200) return 'grandmaster';
    if (rating >= 2000) return 'master';
    if (rating >= 1800) return 'diamond';
    if (rating >= 1600) return 'platinum';
    if (rating >= 1400) return 'gold';
    if (rating >= 1200) return 'silver';
    return 'bronze';
  };

  // Load mock data as fallback
  const loadMockData = () => {
    const mockEntries: LeaderboardEntry[] = [
      { rank: 1, playerId: '1', botName: 'AlphaBot', rating: 2456, tier: 'champion', gamesPlayed: 234, winRate: 0.78, isOnline: true, isInMatch: true, currentMatchId: 'match_1' },
      { rank: 2, playerId: '2', botName: 'NeuralKnight', rating: 2312, tier: 'grandmaster', gamesPlayed: 189, winRate: 0.72, isOnline: true, isInMatch: false, currentMatchId: null },
      { rank: 3, playerId: '3', botName: 'DeepStrike', rating: 2198, tier: 'master', gamesPlayed: 156, winRate: 0.69, isOnline: false, isInMatch: false, currentMatchId: null },
      { rank: 4, playerId: '4', botName: 'QuantumFist', rating: 2087, tier: 'master', gamesPlayed: 203, winRate: 0.65, isOnline: true, isInMatch: true, currentMatchId: 'match_2' },
      { rank: 5, playerId: '5', botName: 'IronLogic', rating: 1923, tier: 'diamond', gamesPlayed: 178, winRate: 0.61, isOnline: true, isInMatch: false, currentMatchId: null },
      { rank: 6, playerId: '6', botName: 'SynapseStorm', rating: 1845, tier: 'diamond', gamesPlayed: 145, winRate: 0.58, isOnline: false, isInMatch: false, currentMatchId: null },
      { rank: 7, playerId: '7', botName: 'BlazeNet', rating: 1756, tier: 'platinum', gamesPlayed: 167, winRate: 0.55, isOnline: true, isInMatch: false, currentMatchId: null },
      { rank: 8, playerId: '8', botName: 'TitanCore', rating: 1689, tier: 'platinum', gamesPlayed: 134, winRate: 0.52, isOnline: false, isInMatch: false, currentMatchId: null },
      { rank: 9, playerId: '9', botName: 'VectorPunch', rating: 1534, tier: 'gold', gamesPlayed: 98, winRate: 0.49, isOnline: true, isInMatch: false, currentMatchId: null },
      { rank: 10, playerId: '10', botName: 'ByteBrawler', rating: 1423, tier: 'gold', gamesPlayed: 87, winRate: 0.46, isOnline: false, isInMatch: false, currentMatchId: null },
    ];
    setEntries(mockEntries);
    setTotalPlayers(1247);
    setIsConnected(false);
  };

  return (
    <div className={`bg-gray-900 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">Leaderboard</h2>
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          {totalPlayers.toLocaleString()} ranked players
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-gray-400 text-sm border-b border-gray-800">
              <th className="py-3 px-4 text-left font-medium">Rank</th>
              <th className="py-3 px-4 text-left font-medium">Bot</th>
              <th className="py-3 px-4 text-left font-medium">Tier</th>
              <th className="py-3 px-4 text-right font-medium">Rating</th>
              <th className="py-3 px-4 text-right font-medium">Win Rate</th>
              <th className="py-3 px-4 text-right font-medium">Games</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <LeaderboardRow
                key={entry.playerId}
                entry={entry}
                isAnimating={animatingEntries.get(entry.playerId) || null}
                showOnlineStatus={showOnlineStatus}
                onClick={() => onPlayerClick?.(entry.playerId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-between text-sm text-gray-500">
        <span>
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </span>
        <span>
          Showing top {entries.length} of {totalPlayers.toLocaleString()}
        </span>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes slide-up {
          0% { transform: translateY(10px); opacity: 0.5; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide-down {
          0% { transform: translateY(-10px); opacity: 0.5; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-slide-up { animation: slide-up 0.5s ease-out; }
        .animate-slide-down { animation: slide-down 0.5s ease-out; }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </div>
  );
}

export default LiveLeaderboard;
