/**
 * Match Server
 * Runs game loops and coordinates between bots
 */

import { nanoid } from 'nanoid';
import { BeatEmUpGame } from '@clawdbot/games';
import type {
  ArenaMatchState,
  BotInput,
  BotObservation,
  ArenaMessage,
} from '@clawdbot/protocol';
import type { ConnectionManager } from '../ws/ConnectionManager.js';
import { ReplayRecorder, type ReplayData } from './ReplayRecorder.js';
import { logger } from '../utils/Logger.js';

export interface MatchConfig {
  player1BotId: string;
  player2BotId: string;
  tickRate?: number;
  decisionTimeoutMs?: number;
}

export interface ActiveMatch {
  matchId: string;
  game: BeatEmUpGame;
  config: MatchConfig;
  startedAt: number;
  tickTimer: NodeJS.Timeout | null;
  pendingInputs: Map<string, BotInput>;
  inputDeadlines: Map<string, NodeJS.Timeout>;
  replayRecorder: ReplayRecorder;
  spectatorCount: number;
}

export class MatchServer {
  private connectionManager: ConnectionManager;
  private activeMatches: Map<string, ActiveMatch>;
  private botToMatch: Map<string, string>;
  private onMatchEnd: ((matchId: string, replay: ReplayData) => void) | null = null;
  private log = logger.child({ component: 'MatchServer' });

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.activeMatches = new Map();
    this.botToMatch = new Map();
  }

  /**
   * Set match end callback
   */
  setOnMatchEnd(callback: (matchId: string, replay: ReplayData) => void): void {
    this.onMatchEnd = callback;
  }

  /**
   * Create and start a new match
   */
  createMatch(config: MatchConfig): string {
    const matchId = `match_${nanoid(12)}`;

    const game = new BeatEmUpGame({
      tickRate: config.tickRate ?? 60,
      decisionTimeoutMs: config.decisionTimeoutMs ?? 100,
    });

    game.initialize([config.player1BotId, config.player2BotId]);

    const match: ActiveMatch = {
      matchId,
      game,
      config,
      startedAt: Date.now(),
      tickTimer: null,
      pendingInputs: new Map(),
      inputDeadlines: new Map(),
      replayRecorder: new ReplayRecorder(matchId, config.player1BotId, config.player2BotId),
      spectatorCount: 0,
    };

    this.activeMatches.set(matchId, match);
    this.botToMatch.set(config.player1BotId, matchId);
    this.botToMatch.set(config.player2BotId, matchId);

    // Assign bots to match
    this.connectionManager.assignToMatch(config.player1BotId, matchId);
    this.connectionManager.assignToMatch(config.player2BotId, matchId);

    this.log.info('Match created', {
      matchId,
      lifecycle: 'created',
      player1: config.player1BotId,
      player2: config.player2BotId,
      tickRate: config.tickRate,
    });

    // Start the game loop
    this.startGameLoop(match);

    return matchId;
  }

  /**
   * Start the game loop
   */
  private startGameLoop(match: ActiveMatch): void {
    const tickMs = 1000 / (match.config.tickRate ?? 60);

    match.tickTimer = setInterval(() => {
      this.processTick(match);
    }, tickMs);

    // Send initial state to bots
    this.sendObservations(match);
  }

  /**
   * Process one game tick
   */
  private processTick(match: ActiveMatch): void {
    const state = match.game.getState();

    // Only process inputs during fighting phase
    if (state.phase === 'fighting') {
      // Apply pending inputs
      for (const [botId, input] of match.pendingInputs.entries()) {
        match.game.applyAction(botId, input);
      }
      match.pendingInputs.clear();
    }

    // Tick the game
    const result = match.game.tick(1000 / (match.config.tickRate ?? 60));

    // Record frame for replay
    match.replayRecorder.recordFrame(match.game.getState(), result.events);

    // Broadcast state to spectators
    this.broadcastState(match);

    // Send observations to bots (for next frame input)
    if (state.phase === 'fighting') {
      this.sendObservations(match);
    }

    // Handle events
    for (const event of result.events) {
      this.handleGameEvent(match, event);
    }

    // Check for match end
    if (match.game.isTerminal()) {
      this.endMatch(match.matchId);
    }
  }

  /**
   * Send observations to both bots
   */
  private sendObservations(match: ActiveMatch): void {
    const { player1BotId, player2BotId } = match.config;

    // Send to player 1
    const obs1 = match.game.getObservation(player1BotId);
    const message1: ArenaMessage = {
      type: 'OBSERVATION',
      observation: obs1,
      requiresResponse: true,
    };
    this.connectionManager.sendToBot(player1BotId, message1);

    // Send to player 2
    const obs2 = match.game.getObservation(player2BotId);
    const message2: ArenaMessage = {
      type: 'OBSERVATION',
      observation: obs2,
      requiresResponse: true,
    };
    this.connectionManager.sendToBot(player2BotId, message2);

    // Set input deadlines
    this.setInputDeadline(match, player1BotId);
    this.setInputDeadline(match, player2BotId);
  }

  /**
   * Set deadline for bot input
   */
  private setInputDeadline(match: ActiveMatch, botId: string): void {
    // Clear existing deadline
    const existing = match.inputDeadlines.get(botId);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new deadline
    const deadline = setTimeout(() => {
      // If no input received, use default (no input)
      if (!match.pendingInputs.has(botId)) {
        match.pendingInputs.set(botId, this.getDefaultInput());
      }
    }, match.config.decisionTimeoutMs ?? 100);

    match.inputDeadlines.set(botId, deadline);
  }

  /**
   * Receive input from a bot
   */
  receiveInput(botId: string, input: BotInput, frameNumber: number): void {
    const matchId = this.botToMatch.get(botId);
    if (!matchId) return;

    const match = this.activeMatches.get(matchId);
    if (!match) return;

    // Clear deadline
    const deadline = match.inputDeadlines.get(botId);
    if (deadline) {
      clearTimeout(deadline);
      match.inputDeadlines.delete(botId);
    }

    // Store input for next tick
    match.pendingInputs.set(botId, input);
  }

  /**
   * Broadcast state to spectators
   */
  private broadcastState(match: ActiveMatch): void {
    const state = match.game.getState();
    const message: ArenaMessage = {
      type: 'MATCH_STATE',
      state,
    };
    this.connectionManager.broadcastToSpectators(match.matchId, message);
  }

  /**
   * Handle game event
   */
  private handleGameEvent(match: ActiveMatch, event: any): void {
    const { type, data } = event;

    switch (type) {
      case 'damage':
        this.connectionManager.broadcastToSpectators(match.matchId, {
          type: 'DAMAGE',
          event: data,
        });
        break;

      case 'ko':
        this.connectionManager.broadcastToSpectators(match.matchId, {
          type: 'KO',
          event: data,
        });
        break;

      case 'round_start':
        // Notify both bots and spectators
        const roundMsg = { type: 'ROUND_START', roundNumber: data.roundNumber };
        this.connectionManager.sendToBot(match.config.player1BotId, roundMsg);
        this.connectionManager.sendToBot(match.config.player2BotId, roundMsg);
        this.connectionManager.broadcastToSpectators(match.matchId, roundMsg);
        this.log.info('Round started', {
          matchId: match.matchId,
          lifecycle: 'round',
          roundNumber: data.roundNumber,
        });
        break;

      case 'match_end':
        // Handled in endMatch
        break;
    }
  }

  /**
   * End a match
   */
  private endMatch(matchId: string): void {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    // Stop game loop
    if (match.tickTimer) {
      clearInterval(match.tickTimer);
      match.tickTimer = null;
    }

    // Clear all deadlines
    for (const deadline of match.inputDeadlines.values()) {
      clearTimeout(deadline);
    }

    // Get final result
    const result = match.game.getResult();
    const state = match.game.getState();

    // Finalize replay
    const replay = match.replayRecorder.finalize(result);

    // Notify bots
    const endMsg = {
      type: 'MATCH_END',
      matchId,
      winnerId: result.winner,
      finalScore: {
        p1Rounds: state.roundsP1,
        p2Rounds: state.roundsP2,
      },
      ratingChanges: [], // Will be calculated by caller
    };

    this.connectionManager.sendToBot(match.config.player1BotId, endMsg);
    this.connectionManager.sendToBot(match.config.player2BotId, endMsg);
    this.connectionManager.broadcastToSpectators(matchId, endMsg);

    // Clean up
    this.botToMatch.delete(match.config.player1BotId);
    this.botToMatch.delete(match.config.player2BotId);
    this.activeMatches.delete(matchId);

    this.log.info('Match ended', {
      matchId,
      lifecycle: 'ended',
      winner: result.winner,
      score: { p1Rounds: state.roundsP1, p2Rounds: state.roundsP2 },
      duration: Date.now() - match.startedAt,
      totalFrames: replay.totalFrames,
    });

    // Callback
    if (this.onMatchEnd) {
      this.onMatchEnd(matchId, replay);
    }
  }

  /**
   * Add spectator to match
   */
  addSpectator(connectionId: string, matchId: string): boolean {
    const match = this.activeMatches.get(matchId);
    if (!match) return false;

    this.connectionManager.addSpectator(connectionId, matchId);
    match.spectatorCount++;

    // Send current state
    const state = match.game.getState();
    this.connectionManager.send(connectionId, {
      type: 'MATCH_STATE',
      state,
    });

    return true;
  }

  /**
   * Get match by bot ID
   */
  getMatchByBotId(botId: string): ActiveMatch | undefined {
    const matchId = this.botToMatch.get(botId);
    if (matchId) {
      return this.activeMatches.get(matchId);
    }
    return undefined;
  }

  /**
   * Get active match count
   */
  getActiveMatchCount(): number {
    return this.activeMatches.size;
  }

  /**
   * Get default input
   */
  private getDefaultInput(): BotInput {
    return {
      left: false,
      right: false,
      up: false,
      down: false,
      attack1: false,
      attack2: false,
      jump: false,
      special: false,
    };
  }
}
