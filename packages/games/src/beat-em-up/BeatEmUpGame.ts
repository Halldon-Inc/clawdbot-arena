/**
 * Beat 'em Up Game Implementation
 * Castle Crashers-style side-scroller fighting game
 */

import type {
  ArenaMatchState,
  FighterState,
  BotInput,
  BotObservation,
  MatchPhase,
  DamageEvent,
  KOEvent,
  AttackType,
  ArenaGameConfig,
} from '@clawdbot/protocol';
import {
  BaseGame,
  type GameResult,
  type TickResult,
  type GameEvent,
} from '@clawdbot/engine';
import { FighterPhysics } from './physics/FighterPhysics';
import { HitboxSystem } from './physics/HitboxSystem';
import { FighterStateMachine } from './state/FighterStateMachine';
import { ComboSystem } from './combat/ComboSystem';
import { DamageCalculator } from './combat/DamageCalculator';
import { MATCH, FIGHTER, PHYSICS, COMBAT, ATTACK_DATA } from './constants';

// =============================================================================
// Game Configuration
// =============================================================================

const DEFAULT_CONFIG: ArenaGameConfig = {
  gameType: 'beat_em_up',
  maxPlayers: 2,
  roundsToWin: MATCH.ROUNDS_TO_WIN,
  roundTimeSeconds: MATCH.ROUND_TIME_SECONDS,
  startingHealth: MATCH.STARTING_HEALTH,
  startingMagic: MATCH.STARTING_MAGIC,
  tickRate: MATCH.TICK_RATE,
  decisionTimeoutMs: MATCH.DECISION_TIMEOUT_MS,
  stageWidth: MATCH.STAGE_WIDTH,
  stageHeight: MATCH.STAGE_HEIGHT,
};

// =============================================================================
// Internal State Types
// =============================================================================

interface InternalFighterState extends FighterState {
  stateMachine: FighterStateMachine;
  currentAttack: AttackType | null;
  isAttackActive: boolean;
  totalDamageDealt: number;
  totalDamageTaken: number;
}

interface InternalMatchState {
  matchId: string;
  player1: InternalFighterState;
  player2: InternalFighterState;
  player1BotId: string;
  player2BotId: string;
  roundNumber: number;
  roundsP1: number;
  roundsP2: number;
  timeRemaining: number;
  phase: MatchPhase;
  frameNumber: number;
  winner: string | null;
  countdownFrames: number;
  roundEndFrames: number;
  pendingInputs: Map<string, BotInput>;
  hitThisFrame: Map<string, boolean>;
}

// =============================================================================
// Beat 'em Up Game
// =============================================================================

export class BeatEmUpGame extends BaseGame<ArenaMatchState, BotInput> {
  readonly gameType = 'beat_em_up';
  readonly maxPlayers = 2;
  readonly turnBased = false;
  readonly tickRate = MATCH.TICK_RATE;
  readonly config: ArenaGameConfig;

  private matchState!: InternalMatchState;
  private comboSystem: ComboSystem;
  private tickEvents: GameEvent[] = [];

  constructor(config: Partial<ArenaGameConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.comboSystem = new ComboSystem();
  }

  // =============================================================================
  // Lifecycle
  // =============================================================================

  protected createInitialState(seed?: number): ArenaMatchState {
    const matchId = `match_${Date.now()}_${seed ?? Math.random().toString(36).slice(2)}`;

    this.matchState = {
      matchId,
      player1: this.createFighter(1),
      player2: this.createFighter(2),
      player1BotId: this.players[0] || 'player1',
      player2BotId: this.players[1] || 'player2',
      roundNumber: 1,
      roundsP1: 0,
      roundsP2: 0,
      timeRemaining: this.config.roundTimeSeconds,
      phase: 'countdown',
      frameNumber: 0,
      winner: null,
      countdownFrames: MATCH.COUNTDOWN_FRAMES,
      roundEndFrames: 0,
      pendingInputs: new Map(),
      hitThisFrame: new Map(),
    };

    this.comboSystem.reset();

    return this.getPublicState();
  }

  private createFighter(playerNumber: 1 | 2): InternalFighterState {
    const pos = FighterPhysics.getSpawnPosition(playerNumber);

    return {
      health: this.config.startingHealth,
      maxHealth: this.config.startingHealth,
      magic: this.config.startingMagic,
      maxMagic: MATCH.MAX_MAGIC,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      facing: playerNumber === 1 ? 'right' : 'left',
      state: 'idle',
      grounded: true,
      canAct: true,
      comboCounter: 0,
      lastAttackFrame: 0,
      stateMachine: new FighterStateMachine(),
      currentAttack: null,
      isAttackActive: false,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
    };
  }

  private getPublicState(): ArenaMatchState {
    const { player1, player2, ...rest } = this.matchState;

    return {
      ...rest,
      player1: this.getPublicFighterState(player1),
      player2: this.getPublicFighterState(player2),
    };
  }

  private getPublicFighterState(fighter: InternalFighterState): FighterState {
    const {
      stateMachine,
      currentAttack,
      isAttackActive,
      totalDamageDealt,
      totalDamageTaken,
      ...publicState
    } = fighter;

    return publicState;
  }

  // =============================================================================
  // State Management
  // =============================================================================

  getState(): ArenaMatchState {
    return this.getPublicState();
  }

  getStateForPlayer(playerId: string): ArenaMatchState {
    // No fog of war in fighting games
    return this.getPublicState();
  }

  /**
   * Get observation for a specific bot
   */
  getObservation(playerId: string): BotObservation {
    const isPlayer1 = playerId === this.matchState.player1BotId;
    const self = isPlayer1 ? this.matchState.player1 : this.matchState.player2;
    const opponent = isPlayer1 ? this.matchState.player2 : this.matchState.player1;
    const roundsWon = isPlayer1 ? this.matchState.roundsP1 : this.matchState.roundsP2;
    const roundsLost = isPlayer1 ? this.matchState.roundsP2 : this.matchState.roundsP1;

    const distances = FighterPhysics.getDistance(self, opponent);

    return {
      self: {
        health: self.health,
        healthPercent: self.health / self.maxHealth,
        magic: self.magic,
        magicPercent: self.magic / self.maxMagic,
        position: { x: self.x, y: self.y },
        velocity: { vx: self.vx, vy: self.vy },
        state: self.state,
        facing: self.facing,
        grounded: self.grounded,
        canAct: self.canAct,
        comboCounter: self.comboCounter,
      },
      opponent: {
        health: opponent.health,
        healthPercent: opponent.health / opponent.maxHealth,
        position: { x: opponent.x, y: opponent.y },
        state: opponent.state,
        facing: opponent.facing,
        isAttacking: opponent.state === 'attacking',
        isBlocking: opponent.state === 'blocking',
        isVulnerable:
          opponent.state === 'hitstun' ||
          opponent.state === 'knockdown' ||
          opponent.state === 'getting_up',
        grounded: opponent.grounded,
      },
      distance: distances.distance,
      horizontalDistance: distances.horizontalDistance,
      verticalDistance: distances.verticalDistance,
      inAttackRange: HitboxSystem.inAttackRange(self, opponent),
      inSpecialRange: HitboxSystem.inSpecialRange(self, opponent),
      roundNumber: this.matchState.roundNumber,
      roundsWon,
      roundsLost,
      timeRemaining: this.matchState.timeRemaining,
      frameNumber: this.matchState.frameNumber,
      decisionDeadlineMs: this.config.decisionTimeoutMs,
      validActions: this.getValidActionsList(playerId),
    };
  }

  private getValidActionsList(playerId: string): string[] {
    const isPlayer1 = playerId === this.matchState.player1BotId;
    const fighter = isPlayer1 ? this.matchState.player1 : this.matchState.player2;

    const actions: string[] = ['WAIT'];

    if (!fighter.canAct) {
      return actions;
    }

    actions.push('MOVE_LEFT', 'MOVE_RIGHT');

    if (fighter.grounded) {
      actions.push('JUMP', 'BLOCK');
    }

    actions.push('ATTACK_LIGHT', 'ATTACK_HEAVY');

    if (fighter.magic >= COMBAT.MAGIC_COST) {
      actions.push('SPECIAL');
    }

    return actions;
  }

  // =============================================================================
  // Actions
  // =============================================================================

  getValidActions(playerId: string): BotInput[] {
    // Return a default input - actual validation happens in processInput
    return [{ left: false, right: false, up: false, down: false, attack1: false, attack2: false, jump: false, special: false }];
  }

  applyAction(playerId: string, action: BotInput): { success: boolean; reason?: string } {
    if (this.matchState.phase !== 'fighting') {
      return { success: false, reason: 'Not in fighting phase' };
    }

    this.matchState.pendingInputs.set(playerId, action);
    return { success: true };
  }

  // =============================================================================
  // Game Flow
  // =============================================================================

  protected processTick(deltaTime: number): TickResult {
    this.tickEvents = [];
    this.matchState.frameNumber++;

    // Reset per-frame state
    this.matchState.hitThisFrame.clear();

    switch (this.matchState.phase) {
      case 'countdown':
        this.processCountdown();
        break;

      case 'fighting':
        this.processFighting();
        break;

      case 'round_end':
      case 'ko':
        this.processRoundEnd();
        break;

      case 'timeout':
        this.processTimeout();
        break;

      case 'match_end':
        // Match is over, no processing needed
        break;
    }

    // Update state
    this.state = this.getPublicState();

    return {
      stateChanged: true,
      events: this.tickEvents,
    };
  }

  private processCountdown(): void {
    this.matchState.countdownFrames--;

    if (this.matchState.countdownFrames <= 0) {
      this.matchState.phase = 'fighting';
      this.emitEvent('round_start', { roundNumber: this.matchState.roundNumber });
    }
  }

  private processFighting(): void {
    // Decrement timer (every 60 frames = 1 second)
    if (this.matchState.frameNumber % MATCH.TICK_RATE === 0) {
      this.matchState.timeRemaining--;

      if (this.matchState.timeRemaining <= 0) {
        this.matchState.phase = 'timeout';
        return;
      }
    }

    // Process inputs for both players
    this.processPlayerInput(this.matchState.player1, this.matchState.player1BotId);
    this.processPlayerInput(this.matchState.player2, this.matchState.player2BotId);

    // Update physics
    this.updatePhysics(this.matchState.player1);
    this.updatePhysics(this.matchState.player2);

    // Update state machines
    this.updateStateMachine(this.matchState.player1);
    this.updateStateMachine(this.matchState.player2);

    // Check for hits
    this.checkHits();

    // Update combo system
    this.comboSystem.tick(this.matchState.frameNumber);

    // Check for KO
    this.checkKO();

    // Clear pending inputs
    this.matchState.pendingInputs.clear();
  }

  private processPlayerInput(fighter: InternalFighterState, playerId: string): void {
    const input = this.matchState.pendingInputs.get(playerId) || this.getDefaultInput();

    // Update facing toward opponent (only when can act and not attacking)
    if (fighter.canAct && fighter.state !== 'attacking') {
      const opponent = playerId === this.matchState.player1BotId
        ? this.matchState.player2
        : this.matchState.player1;
      fighter.facing = FighterPhysics.getFacingToward(fighter.x, opponent.x);
    }

    // Process input through state machine
    const transition = fighter.stateMachine.processInput(input, this.matchState.frameNumber);

    if (transition) {
      fighter.state = transition.newState;

      if (transition.newAttack !== undefined) {
        fighter.currentAttack = transition.newAttack;
        fighter.lastAttackFrame = this.matchState.frameNumber;

        // Deduct magic for special attacks
        if (transition.newAttack === 'special') {
          fighter.magic = Math.max(0, fighter.magic - COMBAT.MAGIC_COST);
        }
      }

      if (transition.resetCombo) {
        fighter.comboCounter = 0;
      }
    }

    // Store input for physics
    (fighter as any)._currentInput = input;
  }

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

  private updatePhysics(fighter: InternalFighterState): void {
    const input = (fighter as any)._currentInput || this.getDefaultInput();
    const canMove = fighter.stateMachine.canAct();

    const wasGrounded = fighter.grounded;
    const result = FighterPhysics.update(fighter, input, canMove);

    fighter.x = result.x;
    fighter.y = result.y;
    fighter.vx = result.vx;
    fighter.vy = result.vy;
    fighter.grounded = result.grounded;
    fighter.facing = result.facing;

    // Update state machine with ground state
    fighter.stateMachine.updateContext({ grounded: result.grounded });

    // Handle landing
    if (!wasGrounded && result.grounded) {
      const landTransition = fighter.stateMachine.onLand();
      fighter.state = landTransition.newState;
    }

    // Handle becoming airborne
    if (wasGrounded && !result.grounded) {
      fighter.stateMachine.onAirborne();
    }
  }

  private updateStateMachine(fighter: InternalFighterState): void {
    // Update attack active state
    fighter.isAttackActive = fighter.stateMachine.isAttackActive();
    fighter.canAct = fighter.stateMachine.canAct();

    // Check for auto-transitions
    const transition = fighter.stateMachine.tick(this.matchState.frameNumber);

    if (transition) {
      fighter.state = transition.newState;

      if (transition.newAttack !== undefined) {
        fighter.currentAttack = transition.newAttack;
      }
    }
  }

  private checkHits(): void {
    // P1 attacking P2
    this.checkPlayerHit(
      this.matchState.player1,
      this.matchState.player2,
      this.matchState.player1BotId,
      this.matchState.player2BotId,
      true
    );

    // P2 attacking P1
    this.checkPlayerHit(
      this.matchState.player2,
      this.matchState.player1,
      this.matchState.player2BotId,
      this.matchState.player1BotId,
      false
    );
  }

  private checkPlayerHit(
    attacker: InternalFighterState,
    defender: InternalFighterState,
    attackerId: string,
    defenderId: string,
    isPlayer1Attacker: boolean
  ): void {
    // Skip if already hit this frame or not attacking
    if (this.matchState.hitThisFrame.get(attackerId)) {
      return;
    }

    const hitResult = HitboxSystem.checkHit(
      attacker,
      defender,
      attacker.currentAttack,
      attacker.isAttackActive,
      defender.stateMachine.isVulnerable()
    );

    if (!hitResult.hit || !hitResult.attackData || !hitResult.attackType) {
      return;
    }

    // Mark as hit this frame (prevents multi-hits)
    this.matchState.hitThisFrame.set(attackerId, true);

    // Calculate damage
    const isCounterHit = DamageCalculator.isCounterHit(
      defender.state,
      defender.stateMachine.getContext().attackPhase
    );

    const comboCount = this.comboSystem.getComboCount(isPlayer1Attacker);
    let damageResult = DamageCalculator.calculate(
      hitResult.attackType,
      comboCount,
      isCounterHit
    );

    // Apply damage scaling for long combos
    damageResult = DamageCalculator.applyScaling(damageResult, comboCount);

    // Register hit in combo system
    const comboResult = this.comboSystem.registerHit(
      isPlayer1Attacker,
      hitResult.attackType,
      damageResult.finalDamage,
      this.matchState.frameNumber
    );

    // Apply damage
    defender.health = Math.max(0, defender.health - damageResult.finalDamage);
    defender.totalDamageTaken += damageResult.finalDamage;
    attacker.totalDamageDealt += damageResult.finalDamage;

    // Apply magic gain
    attacker.magic = Math.min(attacker.maxMagic, attacker.magic + damageResult.magicGain);

    // Update combo counter
    attacker.comboCounter = comboResult.comboCount;

    // Apply knockback
    const knockback = FighterPhysics.applyKnockback(
      defender,
      damageResult.knockbackX,
      damageResult.knockbackY,
      attacker.x
    );

    defender.vx = knockback.vx;
    defender.vy = knockback.vy;
    defender.grounded = knockback.grounded;

    // Apply hitstun/knockdown to defender
    defender.stateMachine.onHit(
      damageResult.finalDamage,
      damageResult.hitstunFrames,
      damageResult.causesKnockdown,
      this.matchState.frameNumber
    );
    defender.state = defender.stateMachine.getState();

    // If knockdown, end attacker's combo tracking
    if (damageResult.causesKnockdown) {
      this.comboSystem.recordLongestCombo(isPlayer1Attacker);
      this.comboSystem.endCombo(isPlayer1Attacker);
    }

    // Emit damage event
    const damageEvent: DamageEvent = {
      attackerId,
      defenderId,
      attackType: hitResult.attackType,
      damage: damageResult.finalDamage,
      isCombo: comboResult.isCombo,
      comboHitNumber: comboResult.comboCount,
      defenderHealthAfter: defender.health,
      frameNumber: this.matchState.frameNumber,
    };

    this.emitEvent('damage', damageEvent, attackerId);
  }

  private checkKO(): void {
    const p1KO = this.matchState.player1.health <= 0;
    const p2KO = this.matchState.player2.health <= 0;

    if (p1KO || p2KO) {
      this.matchState.phase = 'ko';

      if (p1KO) {
        this.matchState.player1.state = 'ko';
        this.matchState.roundsP2++;
      }

      if (p2KO) {
        this.matchState.player2.state = 'ko';
        this.matchState.roundsP1++;
      }

      this.matchState.roundEndFrames = MATCH.KO_DELAY_FRAMES;

      // Emit KO event
      const winnerId = p2KO ? this.matchState.player1BotId : this.matchState.player2BotId;
      const loserId = p2KO ? this.matchState.player2BotId : this.matchState.player1BotId;
      const winner = p2KO ? this.matchState.player1 : this.matchState.player2;
      const loser = p2KO ? this.matchState.player2 : this.matchState.player1;

      const koEvent: KOEvent = {
        winnerId,
        loserId,
        roundNumber: this.matchState.roundNumber,
        winnerHealthRemaining: winner.health,
        totalDamageDealt: winner.totalDamageDealt,
        longestCombo: this.comboSystem.getLongestCombo(p2KO),
        frameNumber: this.matchState.frameNumber,
      };

      this.emitEvent('ko', koEvent, winnerId);
    }
  }

  private processRoundEnd(): void {
    this.matchState.roundEndFrames--;

    if (this.matchState.roundEndFrames <= 0) {
      // Check for match end
      if (
        this.matchState.roundsP1 >= this.config.roundsToWin ||
        this.matchState.roundsP2 >= this.config.roundsToWin
      ) {
        this.endMatch();
      } else {
        // Start next round
        this.startNextRound();
      }
    }
  }

  private processTimeout(): void {
    // In timeout, winner is whoever has more health
    const p1Health = this.matchState.player1.health;
    const p2Health = this.matchState.player2.health;

    if (p1Health > p2Health) {
      this.matchState.roundsP1++;
    } else if (p2Health > p1Health) {
      this.matchState.roundsP2++;
    }
    // If equal health, no one wins the round (draw)

    this.matchState.roundEndFrames = MATCH.ROUND_END_DELAY_FRAMES;
    this.matchState.phase = 'round_end';

    this.emitEvent('timeout', {
      roundNumber: this.matchState.roundNumber,
      p1Health,
      p2Health,
    });
  }

  private startNextRound(): void {
    this.matchState.roundNumber++;
    this.matchState.timeRemaining = this.config.roundTimeSeconds;
    this.matchState.phase = 'countdown';
    this.matchState.countdownFrames = MATCH.COUNTDOWN_FRAMES;

    // Reset fighters
    this.resetFighter(this.matchState.player1, 1);
    this.resetFighter(this.matchState.player2, 2);

    // Reset combo tracking
    this.comboSystem.reset();

    this.emitEvent('round_start', { roundNumber: this.matchState.roundNumber });
  }

  private resetFighter(fighter: InternalFighterState, playerNumber: 1 | 2): void {
    const pos = FighterPhysics.getSpawnPosition(playerNumber);

    fighter.health = this.config.startingHealth;
    fighter.magic = this.config.startingMagic;
    fighter.x = pos.x;
    fighter.y = pos.y;
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.facing = playerNumber === 1 ? 'right' : 'left';
    fighter.state = 'idle';
    fighter.grounded = true;
    fighter.canAct = true;
    fighter.comboCounter = 0;
    fighter.currentAttack = null;
    fighter.isAttackActive = false;

    fighter.stateMachine.reset(this.matchState.frameNumber);
  }

  private endMatch(): void {
    this.matchState.phase = 'match_end';

    if (this.matchState.roundsP1 > this.matchState.roundsP2) {
      this.matchState.winner = this.matchState.player1BotId;
    } else if (this.matchState.roundsP2 > this.matchState.roundsP1) {
      this.matchState.winner = this.matchState.player2BotId;
    }

    this.emitEvent('match_end', {
      winnerId: this.matchState.winner,
      roundsP1: this.matchState.roundsP1,
      roundsP2: this.matchState.roundsP2,
    });
  }

  // =============================================================================
  // Terminal State
  // =============================================================================

  isTerminal(): boolean {
    return this.matchState.phase === 'match_end';
  }

  getResult(): GameResult {
    return {
      winner: this.matchState.winner,
      scores: {
        [this.matchState.player1BotId]: this.matchState.roundsP1,
        [this.matchState.player2BotId]: this.matchState.roundsP2,
      },
      endCondition: this.matchState.winner ? 'victory' : 'draw',
      duration: Date.now() - this.startTime,
      finalTick: this.matchState.frameNumber,
    };
  }
}
