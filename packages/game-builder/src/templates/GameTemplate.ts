/**
 * Moltblox Game Template
 *
 * This template shows the structure that all Moltblox games must follow.
 * Games implement the UnifiedGameInterface and will be compiled to WASM.
 */

// =============================================================================
// Core Types (provided by engine)
// =============================================================================

export interface GameState {
  gameId: string;
  gameType: string;
  tick: number;
  timestamp: number;
  phase: 'waiting' | 'playing' | 'finished';
  players: PlayerState[];
  decisionDeadline: number;
}

export interface PlayerState {
  id: string;
  name: string;
  position: { x: number; y: number };
  score: number;
}

export interface Action {
  type: string;
  payload: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  effects: Effect[];
  error?: string;
}

export interface Effect {
  type: string;
  target: string;
  value: unknown;
}

export interface TickResult {
  stateChanged: boolean;
  events: GameEvent[];
}

export interface GameEvent {
  type: string;
  tick: number;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface GameResult {
  winner: string | null;
  scores: Record<string, number>;
  endCondition: 'victory' | 'draw' | 'timeout' | 'forfeit';
  duration: number;
  finalTick: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export type SerializedGameState = string;

// =============================================================================
// UnifiedGameInterface
// =============================================================================

export interface UnifiedGameInterface<TState extends GameState = GameState> {
  // Metadata
  readonly gameType: string;
  readonly maxPlayers: number;
  readonly turnBased: boolean;
  readonly tickRate: number;

  // Lifecycle
  initialize(playerIds: string[], seed?: number): void;
  reset(): void;
  destroy(): void;

  // State
  getState(): TState;
  getStateForPlayer(playerId: string): TState;

  // Actions
  getValidActions(playerId: string): Action[];
  validateAction(playerId: string, action: Action): ValidationResult;
  applyAction(playerId: string, action: Action): ActionResult;

  // Game Flow
  tick(deltaTime: number): TickResult;
  isTerminal(): boolean;
  getResult(): GameResult;

  // Serialization
  serialize(): SerializedGameState;
  deserialize(data: SerializedGameState): void;
}

// =============================================================================
// BaseGame - Extend this for your games
// =============================================================================

export abstract class BaseGame<TState extends GameState = GameState>
  implements UnifiedGameInterface<TState>
{
  abstract readonly gameType: string;
  abstract readonly maxPlayers: number;
  abstract readonly turnBased: boolean;
  abstract readonly tickRate: number;

  protected state!: TState;
  protected players: string[] = [];
  protected currentTick: number = 0;
  protected events: GameEvent[] = [];
  private random: SeededRandom | null = null;

  // ===================
  // Abstract Methods (implement these)
  // ===================

  protected abstract createInitialState(seed?: number): TState;
  abstract getValidActions(playerId: string): Action[];
  abstract applyAction(playerId: string, action: Action): ActionResult;
  abstract isTerminal(): boolean;
  abstract getResult(): GameResult;

  // Optional override
  protected processTick(_deltaTime: number): TickResult {
    return { stateChanged: false, events: [] };
  }

  // ===================
  // Lifecycle
  // ===================

  initialize(playerIds: string[], seed?: number): void {
    if (playerIds.length > this.maxPlayers) {
      throw new Error(
        `Too many players (${playerIds.length} > ${this.maxPlayers})`
      );
    }

    this.players = [...playerIds];
    this.currentTick = 0;
    this.events = [];
    this.random = new SeededRandom(seed ?? 12345);
    this.state = this.createInitialState(seed);
  }

  reset(): void {
    this.currentTick = 0;
    this.events = [];
    this.state = this.createInitialState();
  }

  destroy(): void {
    // Override if cleanup needed
  }

  // ===================
  // State
  // ===================

  getState(): TState {
    return { ...this.state };
  }

  getStateForPlayer(playerId: string): TState {
    // Override to filter hidden information
    return this.getState();
  }

  // ===================
  // Actions
  // ===================

  validateAction(playerId: string, action: Action): ValidationResult {
    const validActions = this.getValidActions(playerId);
    const isValid = validActions.some(
      (a) => a.type === action.type
    );

    return {
      valid: isValid,
      reason: isValid ? undefined : 'Invalid action type',
    };
  }

  // ===================
  // Game Flow
  // ===================

  tick(deltaTime: number): TickResult {
    this.currentTick++;
    this.state.tick = this.currentTick;
    this.state.timestamp = this.currentTick * this.tickRate;

    const result = this.processTick(deltaTime);

    // Collect events
    const tickEvents = [...this.events];
    this.events = [];

    return {
      stateChanged: result.stateChanged,
      events: [...tickEvents, ...result.events],
    };
  }

  // ===================
  // Serialization
  // ===================

  serialize(): SerializedGameState {
    return JSON.stringify({
      state: this.state,
      players: this.players,
      currentTick: this.currentTick,
    });
  }

  deserialize(data: SerializedGameState): void {
    const parsed = JSON.parse(data);
    this.state = parsed.state;
    this.players = parsed.players;
    this.currentTick = parsed.currentTick;
  }

  // ===================
  // Helpers
  // ===================

  protected emitEvent(type: string, data: Record<string, unknown>): void {
    this.events.push({
      type,
      tick: this.currentTick,
      timestamp: this.currentTick * this.tickRate,
      data,
    });
  }

  protected getRandom(): number {
    if (!this.random) {
      throw new Error('Game not initialized');
    }
    return this.random.next();
  }

  protected getRandomInt(min: number, max: number): number {
    return Math.floor(this.getRandom() * (max - min + 1)) + min;
  }
}

// =============================================================================
// Seeded Random (Deterministic)
// =============================================================================

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    // Mulberry32 PRNG
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// =============================================================================
// Example: Simple Click Race Game
// =============================================================================

interface ClickRaceState extends GameState {
  scores: Record<string, number>;
  targetScore: number;
  timeLimit: number;
}

export class ClickRaceGame extends BaseGame<ClickRaceState> {
  readonly gameType = 'click_race';
  readonly maxPlayers = 4;
  readonly turnBased = false;
  readonly tickRate = 33; // ~30fps

  private readonly TARGET_SCORE = 100;
  private readonly TIME_LIMIT = 30000; // 30 seconds

  protected createInitialState(seed?: number): ClickRaceState {
    const scores: Record<string, number> = {};
    for (const playerId of this.players) {
      scores[playerId] = 0;
    }

    return {
      gameId: `click_race_${seed ?? Date.now()}`,
      gameType: this.gameType,
      tick: 0,
      timestamp: 0,
      phase: 'playing',
      players: this.players.map((id, index) => ({
        id,
        name: `Player ${index + 1}`,
        position: { x: index * 100, y: 0 },
        score: 0,
      })),
      scores,
      targetScore: this.TARGET_SCORE,
      timeLimit: this.TIME_LIMIT,
      decisionDeadline: Date.now() + 100,
    };
  }

  getValidActions(playerId: string): Action[] {
    if (this.state.phase !== 'playing') {
      return [];
    }

    return [
      { type: 'CLICK', payload: {} },
      { type: 'WAIT', payload: {} },
    ];
  }

  applyAction(playerId: string, action: Action): ActionResult {
    if (this.state.phase !== 'playing') {
      return {
        success: false,
        effects: [],
        error: 'Game is not in playing phase',
      };
    }

    if (action.type === 'CLICK') {
      this.state.scores[playerId]++;

      // Update player state
      const player = this.state.players.find((p) => p.id === playerId);
      if (player) {
        player.score = this.state.scores[playerId];
      }

      this.emitEvent('click', {
        playerId,
        newScore: this.state.scores[playerId],
      });

      return {
        success: true,
        effects: [
          { type: 'score_increase', target: playerId, value: 1 },
        ],
      };
    }

    return { success: true, effects: [] };
  }

  protected processTick(deltaTime: number): TickResult {
    // Check time limit
    if (this.state.timestamp >= this.state.timeLimit) {
      this.state.phase = 'finished';
      return {
        stateChanged: true,
        events: [{
          type: 'time_up',
          tick: this.currentTick,
          timestamp: this.state.timestamp,
          data: {},
        }],
      };
    }

    return { stateChanged: false, events: [] };
  }

  isTerminal(): boolean {
    if (this.state.phase === 'finished') {
      return true;
    }

    // Check if anyone reached target
    for (const playerId of this.players) {
      if (this.state.scores[playerId] >= this.state.targetScore) {
        this.state.phase = 'finished';
        return true;
      }
    }

    return false;
  }

  getResult(): GameResult {
    let winner: string | null = null;
    let highScore = 0;

    for (const playerId of this.players) {
      if (this.state.scores[playerId] > highScore) {
        highScore = this.state.scores[playerId];
        winner = playerId;
      }
    }

    // Check for tie
    const tiedPlayers = this.players.filter(
      (p) => this.state.scores[p] === highScore
    );
    if (tiedPlayers.length > 1) {
      winner = null;
    }

    return {
      winner,
      scores: { ...this.state.scores },
      endCondition: winner ? 'victory' : 'draw',
      duration: this.state.timestamp,
      finalTick: this.currentTick,
    };
  }
}

// =============================================================================
// Export
// =============================================================================

export default {
  BaseGame,
  ClickRaceGame,
};
