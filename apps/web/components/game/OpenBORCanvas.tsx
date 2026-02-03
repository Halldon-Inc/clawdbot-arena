'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ArenaMatchState, FighterState } from '@clawdbot/protocol';

// =============================================================================
// Component Props
// =============================================================================

interface OpenBORCanvasProps {
  matchId: string;
  player1Name: string;
  player2Name: string;
  onMatchEnd?: (winnerId: string) => void;
  onRoundEnd?: (roundNumber: number, winnerId: string) => void;
  className?: string;
}

// =============================================================================
// Health Bar Component
// =============================================================================

interface HealthBarProps {
  health: number;
  maxHealth: number;
  playerName: string;
  side: 'left' | 'right';
  tier?: string;
}

function HealthBar({ health, maxHealth, playerName, side, tier }: HealthBarProps) {
  const percentage = Math.max(0, (health / maxHealth) * 100);

  const getHealthColor = () => {
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex flex-col ${side === 'right' ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2 mb-1">
        {side === 'left' ? (
          <>
            <span className="text-white font-bold text-lg">{playerName}</span>
            {tier && (
              <span className="text-xs px-2 py-0.5 bg-purple-600 rounded">{tier}</span>
            )}
          </>
        ) : (
          <>
            {tier && (
              <span className="text-xs px-2 py-0.5 bg-purple-600 rounded">{tier}</span>
            )}
            <span className="text-white font-bold text-lg">{playerName}</span>
          </>
        )}
      </div>
      <div className="w-64 h-6 bg-gray-800 rounded-sm overflow-hidden border-2 border-gray-600">
        <div
          className={`h-full ${getHealthColor()} transition-all duration-100`}
          style={{
            width: `${percentage}%`,
            transformOrigin: side === 'right' ? 'right' : 'left',
          }}
        />
      </div>
      <span className="text-gray-400 text-sm mt-0.5">
        {Math.round(health)} / {maxHealth}
      </span>
    </div>
  );
}

// =============================================================================
// Round Indicator
// =============================================================================

interface RoundIndicatorProps {
  roundsWon: number;
  maxRounds: number;
  side: 'left' | 'right';
}

function RoundIndicator({ roundsWon, maxRounds }: RoundIndicatorProps) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxRounds }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 ${
            i < roundsWon
              ? 'bg-yellow-400 border-yellow-500'
              : 'bg-gray-700 border-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Timer Component
// =============================================================================

interface TimerProps {
  time: number;
  phase: string;
}

function Timer({ time, phase }: TimerProps) {
  const isLowTime = time <= 10;

  return (
    <div className="flex flex-col items-center">
      {phase === 'countdown' && (
        <span className="text-4xl font-bold text-yellow-400 animate-pulse">
          READY
        </span>
      )}
      {phase === 'ko' && (
        <span className="text-4xl font-bold text-red-500">K.O.!</span>
      )}
      {phase === 'fighting' && (
        <span
          className={`text-5xl font-bold ${
            isLowTime ? 'text-red-500 animate-pulse' : 'text-white'
          }`}
        >
          {time}
        </span>
      )}
      {phase === 'match_end' && (
        <span className="text-3xl font-bold text-yellow-400">FINISH!</span>
      )}
    </div>
  );
}

// =============================================================================
// Main OpenBOR Canvas Component
// =============================================================================

export function OpenBORCanvas({
  matchId,
  player1Name,
  player2Name,
  onMatchEnd,
  onRoundEnd,
  className = '',
}: OpenBORCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<ArenaMatchState | null>(null);

  // Handle messages from the game iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'GAME_READY') {
      setIsLoaded(true);
    }

    if (event.data?.type === 'MATCH_STATE') {
      setMatchState(event.data.state as ArenaMatchState);
    }

    if (event.data?.type === 'ROUND_END') {
      onRoundEnd?.(event.data.roundNumber, event.data.winnerId);
    }

    if (event.data?.type === 'MATCH_END') {
      onMatchEnd?.(event.data.winnerId);
    }
  }, [onMatchEnd, onRoundEnd]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Initialize game when iframe loads
  const handleIframeLoad = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        // Start match via bridge
        iframe.contentWindow.postMessage({
          type: 'START_MATCH',
          matchId,
          player1Name,
          player2Name,
        }, '*');
      }
    } catch (err) {
      setError('Failed to initialize game');
    }
  }, [matchId, player1Name, player2Name]);

  // Mock state for development (when OpenBOR isn't available)
  useEffect(() => {
    if (!matchState) {
      // Set initial mock state
      setMatchState({
        matchId,
        player1: {
          health: 1000,
          maxHealth: 1000,
          magic: 0,
          maxMagic: 100,
          x: 200,
          y: 400,
          vx: 0,
          vy: 0,
          facing: 'right',
          state: 'idle',
          grounded: true,
          canAct: true,
          comboCounter: 0,
          lastAttackFrame: 0,
        },
        player2: {
          health: 1000,
          maxHealth: 1000,
          magic: 0,
          maxMagic: 100,
          x: 1720,
          y: 400,
          vx: 0,
          vy: 0,
          facing: 'left',
          state: 'idle',
          grounded: true,
          canAct: true,
          comboCounter: 0,
          lastAttackFrame: 0,
        },
        player1BotId: 'bot1',
        player2BotId: 'bot2',
        roundNumber: 1,
        roundsP1: 0,
        roundsP2: 0,
        timeRemaining: 99,
        phase: 'fighting',
        frameNumber: 0,
        winner: null,
      });
    }
  }, [matchId, matchState]);

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden ${className}`}>
      {/* HUD Overlay */}
      <div className="absolute inset-x-0 top-0 z-10 p-4">
        <div className="flex justify-between items-start">
          {/* Player 1 Health */}
          <div className="flex flex-col gap-2">
            <HealthBar
              health={matchState?.player1.health ?? 1000}
              maxHealth={matchState?.player1.maxHealth ?? 1000}
              playerName={player1Name}
              side="left"
            />
            <RoundIndicator
              roundsWon={matchState?.roundsP1 ?? 0}
              maxRounds={2}
              side="left"
            />
          </div>

          {/* Timer & Round */}
          <div className="flex flex-col items-center">
            <span className="text-gray-400 text-sm mb-1">
              Round {matchState?.roundNumber ?? 1}
            </span>
            <Timer
              time={matchState?.timeRemaining ?? 99}
              phase={matchState?.phase ?? 'fighting'}
            />
          </div>

          {/* Player 2 Health */}
          <div className="flex flex-col gap-2 items-end">
            <HealthBar
              health={matchState?.player2.health ?? 1000}
              maxHealth={matchState?.player2.maxHealth ?? 1000}
              playerName={player2Name}
              side="right"
            />
            <RoundIndicator
              roundsWon={matchState?.roundsP2 ?? 0}
              maxRounds={2}
              side="right"
            />
          </div>
        </div>
      </div>

      {/* Game Canvas Area */}
      <div className="aspect-video bg-gradient-to-b from-gray-800 to-gray-900">
        {error ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-500 text-lg mb-2">{error}</p>
              <p className="text-gray-400">Please ensure OpenBOR-WASM is set up correctly.</p>
            </div>
          </div>
        ) : !isLoaded ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400">Loading game engine...</p>
            </div>
          </div>
        ) : null}

        {/* OpenBOR iframe - sandboxed for security */}
        <iframe
          ref={iframeRef}
          src="/game/loader.html"
          className={`w-full h-full border-0 ${isLoaded && !error ? '' : 'hidden'}`}
          onLoad={handleIframeLoad}
          sandbox="allow-scripts allow-same-origin"
          title="Clawdbot Arena Game"
        />

        {/* Placeholder arena visualization (shown when iframe not ready) */}
        {!isLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-full h-full">
              {/* Arena floor line */}
              <div className="absolute bottom-[30%] left-0 right-0 h-1 bg-purple-500/30" />

              {/* Player 1 placeholder */}
              <div
                className="absolute w-16 h-24 bg-blue-500/50 rounded"
                style={{
                  left: `${((matchState?.player1.x ?? 200) / 1920) * 100}%`,
                  bottom: '30%',
                  transform: 'translateX(-50%)',
                }}
              />

              {/* Player 2 placeholder */}
              <div
                className="absolute w-16 h-24 bg-red-500/50 rounded"
                style={{
                  left: `${((matchState?.player2.x ?? 1720) / 1920) * 100}%`,
                  bottom: '30%',
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom HUD - Combo counter, etc */}
      {matchState && (matchState.player1.comboCounter > 1 || matchState.player2.comboCounter > 1) && (
        <div className="absolute inset-x-0 bottom-4 flex justify-between px-4">
          {matchState.player1.comboCounter > 1 && (
            <div className="bg-blue-600/80 px-4 py-2 rounded">
              <span className="text-white font-bold">{matchState.player1.comboCounter} HIT COMBO!</span>
            </div>
          )}
          {matchState.player2.comboCounter > 1 && (
            <div className="bg-red-600/80 px-4 py-2 rounded ml-auto">
              <span className="text-white font-bold">{matchState.player2.comboCounter} HIT COMBO!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OpenBORCanvas;
