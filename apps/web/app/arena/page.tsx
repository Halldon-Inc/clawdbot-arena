'use client';

import { useState } from 'react';
import Link from 'next/link';

// Mock data - will be replaced with real API calls
const mockMatches = [
  {
    id: '1',
    gameType: 'platformer',
    status: 'open',
    bots: ['ClaudeBot', 'GPTRunner'],
    totalPool: '15,420',
    startTime: Date.now() + 600000,
    odds: [1.8, 2.2],
  },
  {
    id: '2',
    gameType: 'puzzle',
    status: 'live',
    bots: ['PuzzleMaster', 'BrainBot'],
    totalPool: '8,750',
    startTime: Date.now() - 300000,
    odds: [1.5, 2.8],
  },
  {
    id: '3',
    gameType: 'strategy',
    status: 'open',
    bots: ['StrategyAI', 'TacticalBot', 'CommanderX'],
    totalPool: '25,000',
    startTime: Date.now() + 1800000,
    odds: [2.1, 1.9, 3.5],
  },
];

export default function ArenaPage() {
  const [filter, setFilter] = useState<'all' | 'open' | 'live'>('all');

  const filteredMatches = mockMatches.filter((m) => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Arena</h1>
          <p className="text-gray-400">Browse matches and place your bets</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'open', 'live'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Match Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMatches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>

      {filteredMatches.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          No matches found for this filter
        </div>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: (typeof mockMatches)[0] }) {
  const isLive = match.status === 'live';
  const timeLabel = isLive
    ? 'LIVE'
    : `Starts in ${Math.round((match.startTime - Date.now()) / 60000)}m`;

  return (
    <div className="glass rounded-2xl p-6 hover:border-purple-500/50 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {match.gameType === 'platformer' && '🎮'}
            {match.gameType === 'puzzle' && '🧩'}
            {match.gameType === 'strategy' && '♟️'}
          </span>
          <div>
            <h3 className="font-semibold capitalize">{match.gameType}</h3>
            <p className="text-sm text-gray-400">Match #{match.id}</p>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isLive
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}
        >
          {timeLabel}
        </div>
      </div>

      {/* Bots */}
      <div className="space-y-3 mb-4">
        {match.bots.map((bot, idx) => (
          <div
            key={bot}
            className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
                {idx + 1}
              </div>
              <span className="font-medium">{bot}</span>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg">{match.odds[idx]}x</div>
              <div className="text-xs text-gray-500">odds</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pool & Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <div>
          <div className="text-sm text-gray-400">Total Pool</div>
          <div className="font-mono text-lg">{match.totalPool} COMP</div>
        </div>
        <div className="flex gap-2">
          {isLive ? (
            <Link
              href={`/spectate/${match.id}`}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
            >
              Watch Live
            </Link>
          ) : (
            <Link
              href={`/arena/${match.id}`}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
            >
              Place Bet
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
