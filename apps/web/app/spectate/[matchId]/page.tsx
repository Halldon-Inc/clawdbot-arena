'use client';

import { useEffect, useState, useCallback } from 'react';
import { OpenBORCanvas } from '@/components/game';
import Link from 'next/link';

interface SpectatePageProps {
  params: { matchId: string };
}

interface MatchInfo {
  player1: { name: string; rating: number; tier: string };
  player2: { name: string; rating: number; tier: string };
  totalPool: string;
  spectators: number;
  odds: { player1: number; player2: number };
}

export default function SpectatePage({ params }: SpectatePageProps) {
  const [connected, setConnected] = useState(false);
  const [matchEnded, setMatchEnded] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchInfo>({
    player1: { name: 'AlphaBot', rating: 2456, tier: 'Champion' },
    player2: { name: 'NeuralKnight', rating: 2312, tier: 'Grandmaster' },
    totalPool: '15,420 COMP',
    spectators: 127,
    odds: { player1: 1.45, player2: 2.10 },
  });

  useEffect(() => {
    // Simulate connection
    const timer = setTimeout(() => setConnected(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Simulate spectator count updates
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      setMatchInfo((prev) => ({
        ...prev,
        spectators: prev.spectators + Math.floor(Math.random() * 3) - 1,
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [connected]);

  const handleMatchEnd = useCallback((winnerId: string) => {
    setMatchEnded(true);
    setWinner(winnerId === 'bot1' ? matchInfo.player1.name : matchInfo.player2.name);
  }, [matchInfo.player1.name, matchInfo.player2.name]);

  const handleRoundEnd = useCallback((roundNumber: number, winnerId: string) => {
    console.log(`Round ${roundNumber} ended. Winner: ${winnerId}`);
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/arena"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Arena
            </Link>
            <span className="text-gray-600">/</span>
            <h1 className="text-2xl font-bold">Match #{params.matchId.slice(0, 8)}</h1>
          </div>
          <p className="text-gray-400">Beat 'em Up Arena Battle</p>
        </div>
        <div className="flex items-center gap-4">
          {!matchEnded && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-400 font-medium">LIVE</span>
            </div>
          )}
          {matchEnded && (
            <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full">
              <span className="text-sm text-green-400 font-medium">FINISHED</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Game View */}
        <div className="lg:col-span-3">
          {!connected ? (
            <div className="aspect-video bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-400">Connecting to match...</p>
              </div>
            </div>
          ) : (
            <OpenBORCanvas
              matchId={params.matchId}
              player1Name={matchInfo.player1.name}
              player2Name={matchInfo.player2.name}
              onMatchEnd={handleMatchEnd}
              onRoundEnd={handleRoundEnd}
              className="rounded-2xl border border-gray-800"
            />
          )}

          {/* Match Result Overlay */}
          {matchEnded && winner && (
            <div className="mt-4 p-6 glass rounded-xl text-center">
              <h2 className="text-3xl font-bold text-yellow-400 mb-2">
                {winner} Wins!
              </h2>
              <p className="text-gray-400 mb-4">
                The match has concluded.
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/arena"
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium transition-colors"
                >
                  Find Another Match
                </Link>
                <Link
                  href="/leaderboard"
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  View Leaderboard
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Fighter Cards */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-semibold">Fighters</h3>
            </div>
            <div className="divide-y divide-gray-800">
              {/* Player 1 */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-blue-400">{matchInfo.player1.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                    {matchInfo.player1.tier}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>Rating</span>
                  <span className="font-mono">{matchInfo.player1.rating}</span>
                </div>
              </div>
              {/* VS */}
              <div className="py-2 text-center text-gray-600 text-sm font-medium">
                VS
              </div>
              {/* Player 2 */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-red-400">{matchInfo.player2.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                    {matchInfo.player2.tier}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>Rating</span>
                  <span className="font-mono">{matchInfo.player2.rating}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Betting Panel */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold mb-4">Live Betting</h3>
            <div className="space-y-3">
              <button
                className="w-full flex items-center justify-between p-3 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/50 rounded-lg transition-colors"
                disabled={matchEnded}
              >
                <span className="font-medium text-blue-400">{matchInfo.player1.name}</span>
                <span className="font-mono text-lg">{matchInfo.odds.player1.toFixed(2)}x</span>
              </button>
              <button
                className="w-full flex items-center justify-between p-3 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 rounded-lg transition-colors"
                disabled={matchEnded}
              >
                <span className="font-medium text-red-400">{matchInfo.player2.name}</span>
                <span className="font-mono text-lg">{matchInfo.odds.player2.toFixed(2)}x</span>
              </button>
            </div>
            {!matchEnded && (
              <button className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-medium transition-all">
                Place Live Bet
              </button>
            )}
            {matchEnded && (
              <div className="mt-4 py-3 text-center text-gray-500 bg-gray-800/50 rounded-lg">
                Betting Closed
              </div>
            )}
          </div>

          {/* Spectators */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold mb-3">Spectators</h3>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 border-2 border-gray-900"
                  />
                ))}
              </div>
              <span className="text-gray-400">
                +{matchInfo.spectators} watching
              </span>
            </div>
          </div>

          {/* Match Info */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold mb-4">Match Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Game Type</span>
                <span>Beat 'em Up</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Format</span>
                <span>Best of 3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Round Time</span>
                <span>99 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Pool</span>
                <span className="text-green-400">{matchInfo.totalPool}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rating Diff</span>
                <span>
                  {Math.abs(matchInfo.player1.rating - matchInfo.player2.rating)} pts
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold mb-3">Controls</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors">
                Fullscreen
              </button>
              <button className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors">
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
