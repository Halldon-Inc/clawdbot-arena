/**
 * Replay Recorder
 * Records match frames for replay playback
 */

import type { ArenaMatchState } from '@clawdbot/protocol';
import type { GameResult, GameEvent } from '@clawdbot/engine';

export interface ReplayFrame {
  frameNumber: number;
  timestamp: number;
  state: ArenaMatchState;
  events: GameEvent[];
}

export interface ReplayData {
  matchId: string;
  player1BotId: string;
  player2BotId: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  winner: string | null;
  finalScore: {
    p1Rounds: number;
    p2Rounds: number;
  };
  totalFrames: number;
  frames: ReplayFrame[];
  keyFrames: number[]; // Frame indices for key moments (round starts, KOs)
  metadata: {
    tickRate: number;
    version: string;
  };
}

export class ReplayRecorder {
  private matchId: string;
  private player1BotId: string;
  private player2BotId: string;
  private startedAt: number;
  private frames: ReplayFrame[];
  private keyFrames: number[];
  private frameIndex: number;

  constructor(matchId: string, player1BotId: string, player2BotId: string) {
    this.matchId = matchId;
    this.player1BotId = player1BotId;
    this.player2BotId = player2BotId;
    this.startedAt = Date.now();
    this.frames = [];
    this.keyFrames = [];
    this.frameIndex = 0;
  }

  /**
   * Record a single frame
   */
  recordFrame(state: ArenaMatchState, events: GameEvent[]): void {
    const frame: ReplayFrame = {
      frameNumber: this.frameIndex,
      timestamp: Date.now(),
      state: { ...state },
      events: [...events],
    };

    this.frames.push(frame);

    // Check for key events
    for (const event of events) {
      if (
        event.type === 'round_start' ||
        event.type === 'ko' ||
        event.type === 'match_end'
      ) {
        this.keyFrames.push(this.frameIndex);
      }
    }

    this.frameIndex++;
  }

  /**
   * Finalize the replay
   */
  finalize(result: GameResult): ReplayData {
    const endedAt = Date.now();
    const finalState = this.frames[this.frames.length - 1]?.state;

    return {
      matchId: this.matchId,
      player1BotId: this.player1BotId,
      player2BotId: this.player2BotId,
      startedAt: this.startedAt,
      endedAt,
      duration: endedAt - this.startedAt,
      winner: result.winner,
      finalScore: {
        p1Rounds: finalState?.roundsP1 ?? 0,
        p2Rounds: finalState?.roundsP2 ?? 0,
      },
      totalFrames: this.frames.length,
      frames: this.frames,
      keyFrames: this.keyFrames,
      metadata: {
        tickRate: 60,
        version: '1.0.0',
      },
    };
  }

  /**
   * Get frame at index
   */
  getFrame(index: number): ReplayFrame | null {
    return this.frames[index] ?? null;
  }

  /**
   * Get frames in range
   */
  getFrameRange(start: number, end: number): ReplayFrame[] {
    return this.frames.slice(start, end);
  }

  /**
   * Get current frame count
   */
  getFrameCount(): number {
    return this.frames.length;
  }

  /**
   * Compress replay for storage (delta encoding)
   */
  static compress(replay: ReplayData): string {
    // For now, just JSON stringify
    // In production, implement delta encoding to reduce size
    return JSON.stringify(replay);
  }

  /**
   * Decompress replay
   */
  static decompress(data: string): ReplayData {
    return JSON.parse(data);
  }
}
