'use client';

/**
 * Phaser Game Container
 * React wrapper for the Phaser game scene
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ArenaMatchState } from '@clawdbot/protocol';

// Phaser types
type PhaserGame = import('phaser').Game;
type PhaserArenaScene = import('./phaser/PhaserArenaScene').PhaserArenaScene;

interface PhaserGameContainerProps {
  matchId?: string;
  wsUrl?: string;
  width?: number;
  height?: number;
  onMatchEnd?: (winnerId: string | null) => void;
}

export function PhaserGameContainer({
  matchId,
  wsUrl = 'ws://localhost:8080/spectate',
  width = 1280,
  height = 720,
  onMatchEnd,
}: PhaserGameContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PhaserGame | null>(null);
  const sceneRef = useRef<PhaserArenaScene | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Initialize Phaser game
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const initPhaser = async () => {
      try {
        const Phaser = (await import('phaser')).default;
        const { PhaserArenaScene } = await import('./phaser/PhaserArenaScene');

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          width,
          height,
          parent: containerRef.current!,
          backgroundColor: '#1a1a2e',
          scene: [PhaserArenaScene],
          physics: {
            default: 'arcade',
            arcade: {
              gravity: { x: 0, y: 0 },
              debug: false,
            },
          },
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          render: {
            pixelArt: false,
            antialias: true,
          },
        };

        gameRef.current = new Phaser.Game(config);

        // Get scene reference after it's created
        gameRef.current.events.once('ready', () => {
          sceneRef.current = gameRef.current!.scene.getScene('ArenaScene') as PhaserArenaScene;
          setIsLoading(false);
        });
      } catch (err) {
        console.error('Failed to initialize Phaser:', err);
        setError('Failed to load game engine');
        setIsLoading(false);
      }
    };

    initPhaser();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
  }, [width, height]);

  // Connect to WebSocket for match state updates
  useEffect(() => {
    if (!matchId || isLoading) return;

    setConnectionStatus('connecting');

    const ws = new WebSocket(`${wsUrl}?matchId=${matchId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      ws.send(JSON.stringify({ type: 'SPECTATE', matchId }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setError('Connection error');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [matchId, wsUrl, isLoading]);

  // Handle incoming messages
  const handleMessage = useCallback((message: any) => {
    if (!sceneRef.current) return;

    switch (message.type) {
      case 'MATCH_STATE':
        sceneRef.current.updateState(message.state as ArenaMatchState);
        break;

      case 'DAMAGE':
        sceneRef.current.showDamageEffect(message.event);
        break;

      case 'KO':
        sceneRef.current.showKOEffect(message.event);
        break;

      case 'ROUND_START':
        sceneRef.current.showRoundStart(message.roundNumber);
        break;

      case 'MATCH_END':
        sceneRef.current.showMatchEnd(message.winnerId);
        onMatchEnd?.(message.winnerId);
        break;
    }
  }, [onMatchEnd]);

  // Demo mode - run without WebSocket
  const startDemo = useCallback(() => {
    if (!sceneRef.current) return;
    sceneRef.current.startDemo();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Game container */}
      <div
        ref={containerRef}
        className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden"
        style={{ maxWidth: width, maxHeight: height }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-white text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4 mx-auto" />
            <p>Loading game...</p>
          </div>
        </div>
      )}

      {/* Connection status */}
      {!isLoading && (
        <div className="absolute top-4 right-4">
          <div
            className={`px-3 py-1 rounded-full text-sm ${
              connectionStatus === 'connected'
                ? 'bg-green-500/20 text-green-400'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {connectionStatus === 'connected' && '● Live'}
            {connectionStatus === 'connecting' && '○ Connecting...'}
            {connectionStatus === 'disconnected' && '○ Offline'}
          </div>
        </div>
      )}

      {/* Demo button (when no matchId) */}
      {!matchId && !isLoading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <button
            onClick={startDemo}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg"
          >
            Start Demo Match
          </button>
        </div>
      )}
    </div>
  );
}
