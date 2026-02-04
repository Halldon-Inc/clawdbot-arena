/**
 * Fighter State Machine
 * Manages fighter state transitions and frame timing
 */

import type { FighterStateEnum, BotInput, AttackType } from '@clawdbot/protocol';
import { ATTACK_DATA, COMBAT, AttackFrameData } from '../constants';

export interface StateContext {
  grounded: boolean;
  health: number;
  magic: number;
  currentFrame: number;
  stateStartFrame: number;
  attackPhase: 'startup' | 'active' | 'recovery' | null;
  currentAttack: AttackType | null;
  comboCount: number;
  lastAttackFrame: number;
  invincible: boolean;
}

export interface StateTransition {
  newState: FighterStateEnum;
  newAttack?: AttackType | null;
  resetCombo?: boolean;
}

// Frames in each state before auto-transitioning
const STATE_DURATIONS: Partial<Record<FighterStateEnum, number | null>> = {
  idle: null, // No auto-transition
  walking: null,
  running: null,
  jumping: null, // Transitions based on physics
  falling: null,
  attacking: null, // Based on attack data
  blocking: null,
  hitstun: null, // Set dynamically
  knockdown: COMBAT.KNOCKDOWN_DURATION_FRAMES,
  getting_up: COMBAT.GETUP_DURATION_FRAMES,
  ko: null, // Terminal state
};

export class FighterStateMachine {
  private state: FighterStateEnum = 'idle';
  private context: StateContext;

  constructor() {
    this.context = {
      grounded: true,
      health: 1000,
      magic: 0,
      currentFrame: 0,
      stateStartFrame: 0,
      attackPhase: null,
      currentAttack: null,
      comboCount: 0,
      lastAttackFrame: 0,
      invincible: false,
    };
  }

  getState(): FighterStateEnum {
    return this.state;
  }

  getContext(): StateContext {
    return { ...this.context };
  }

  setState(state: FighterStateEnum, frame: number): void {
    this.state = state;
    this.context.stateStartFrame = frame;
    this.context.attackPhase = null;
    this.context.currentAttack = null;
  }

  updateContext(updates: Partial<StateContext>): void {
    Object.assign(this.context, updates);
  }

  /**
   * Check if the fighter can perform actions
   */
  canAct(): boolean {
    const nonActingStates: FighterStateEnum[] = [
      'hitstun',
      'knockdown',
      'getting_up',
      'ko',
    ];

    if (nonActingStates.includes(this.state)) {
      return false;
    }

    // Can't act during attack startup/active/recovery
    if (this.state === 'attacking' && this.context.attackPhase) {
      return false;
    }

    return true;
  }

  /**
   * Check if the fighter is in an attacking state with active hitbox
   */
  isAttackActive(): boolean {
    return this.state === 'attacking' && this.context.attackPhase === 'active';
  }

  /**
   * Check if the fighter is vulnerable (can be hit)
   */
  isVulnerable(): boolean {
    if (this.context.invincible) return false;
    if (this.state === 'blocking') return false;
    return true;
  }

  /**
   * Get the current attack's frame data
   */
  getCurrentAttackData(): AttackFrameData | null {
    if (!this.context.currentAttack) return null;
    return ATTACK_DATA[this.context.currentAttack] || null;
  }

  /**
   * Process input and determine state transition
   */
  processInput(input: BotInput, frame: number): StateTransition | null {
    if (!this.canAct()) {
      return null;
    }

    // Check for attack inputs
    if (input.special && this.context.magic >= COMBAT.MAGIC_COST) {
      return this.startAttack('special', frame);
    }

    if (input.attack1) {
      return this.startLightAttack(frame);
    }

    if (input.attack2) {
      return this.startAttack(this.context.grounded ? 'heavy' : 'air_heavy', frame);
    }

    // Check for jump
    if (input.jump && this.context.grounded) {
      return { newState: 'jumping' };
    }

    // Check for blocking (down while grounded and not moving)
    if (input.down && this.context.grounded && !input.left && !input.right) {
      return { newState: 'blocking' };
    }

    // Movement
    if (input.left || input.right) {
      // Running if already walking/running
      if (this.state === 'walking' || this.state === 'running') {
        return { newState: 'running' };
      }
      return { newState: 'walking' };
    }

    // No input - return to idle
    if (this.context.grounded) {
      return { newState: 'idle' };
    }

    return null;
  }

  /**
   * Start a light attack (handles combo chaining)
   */
  private startLightAttack(frame: number): StateTransition {
    if (!this.context.grounded) {
      return this.startAttack('air_light', frame);
    }

    // Check for combo continuation
    const timeSinceLastAttack = frame - this.context.lastAttackFrame;
    const lastAttackData = this.context.currentAttack
      ? ATTACK_DATA[this.context.currentAttack]
      : null;

    if (lastAttackData?.canChain && timeSinceLastAttack <= lastAttackData.chainWindow) {
      // Chain to next attack in combo
      const nextAttack = this.getNextComboAttack();
      if (nextAttack) {
        return this.startAttack(nextAttack, frame);
      }
    }

    // Start new combo
    return this.startAttack('light_1', frame, true);
  }

  /**
   * Get the next attack in the combo chain
   */
  private getNextComboAttack(): AttackType | null {
    const comboChain: AttackType[] = ['light_1', 'light_2', 'light_3', 'light_4'];
    const currentIndex = this.context.currentAttack
      ? comboChain.indexOf(this.context.currentAttack as AttackType)
      : -1;

    if (currentIndex >= 0 && currentIndex < comboChain.length - 1) {
      return comboChain[currentIndex + 1];
    }

    return null;
  }

  /**
   * Start an attack
   */
  private startAttack(
    attackType: AttackType,
    frame: number,
    resetCombo = false
  ): StateTransition {
    this.context.currentAttack = attackType;
    this.context.attackPhase = 'startup';
    this.context.stateStartFrame = frame;
    this.context.lastAttackFrame = frame;

    if (resetCombo) {
      this.context.comboCount = 0;
    }

    return {
      newState: 'attacking',
      newAttack: attackType,
      resetCombo,
    };
  }

  /**
   * Update attack phase based on current frame
   */
  updateAttackPhase(frame: number): void {
    if (this.state !== 'attacking' || !this.context.currentAttack) {
      return;
    }

    const attackData = ATTACK_DATA[this.context.currentAttack];
    if (!attackData) return;

    const frameInAttack = frame - this.context.stateStartFrame;

    if (frameInAttack < attackData.startup) {
      this.context.attackPhase = 'startup';
    } else if (frameInAttack < attackData.startup + attackData.active) {
      this.context.attackPhase = 'active';
    } else if (frameInAttack < attackData.startup + attackData.active + attackData.recovery) {
      this.context.attackPhase = 'recovery';
    } else {
      // Attack finished
      this.state = this.context.grounded ? 'idle' : 'falling';
      this.context.attackPhase = null;
    }
  }

  /**
   * Handle being hit
   */
  onHit(damage: number, hitstunFrames: number, isKnockdown: boolean, frame: number): void {
    this.context.health = Math.max(0, this.context.health - damage);

    if (this.context.health <= 0) {
      this.state = 'ko';
      return;
    }

    if (isKnockdown) {
      this.state = 'knockdown';
    } else {
      this.state = 'hitstun';
    }

    this.context.stateStartFrame = frame;
    this.context.attackPhase = null;
    this.context.currentAttack = null;
  }

  /**
   * Update state based on time (auto-transitions)
   */
  tick(frame: number): StateTransition | null {
    const framesInState = frame - this.context.stateStartFrame;

    // Update attack phases
    if (this.state === 'attacking') {
      this.updateAttackPhase(frame);
    }

    // Check for auto-transitions based on duration
    switch (this.state) {
      case 'hitstun': {
        const hitstunDuration = this.context.currentAttack
          ? (ATTACK_DATA[this.context.currentAttack]?.hitstun ?? COMBAT.LIGHT_HITSTUN_FRAMES)
          : COMBAT.LIGHT_HITSTUN_FRAMES;

        if (framesInState >= hitstunDuration) {
          return { newState: this.context.grounded ? 'idle' : 'falling' };
        }
        break;
      }

      case 'knockdown':
        if (framesInState >= COMBAT.KNOCKDOWN_DURATION_FRAMES) {
          this.context.invincible = true;
          return { newState: 'getting_up' };
        }
        break;

      case 'getting_up':
        if (framesInState >= COMBAT.GETUP_DURATION_FRAMES) {
          this.context.invincible = false;
          return { newState: 'idle' };
        }
        // Invincibility ends partway through
        if (framesInState >= COMBAT.GETUP_INVINCIBILITY_FRAMES) {
          this.context.invincible = false;
        }
        break;

      case 'jumping':
        // Transition to falling handled by physics (when vy > 0)
        break;

      case 'blocking':
        // Blocking ends when no longer holding down
        break;
    }

    return null;
  }

  /**
   * Handle landing on ground
   */
  onLand(): StateTransition {
    this.context.grounded = true;

    if (this.state === 'falling' || this.state === 'jumping') {
      return { newState: 'idle' };
    }

    return { newState: this.state };
  }

  /**
   * Handle leaving ground
   */
  onAirborne(): void {
    this.context.grounded = false;

    if (this.state === 'idle' || this.state === 'walking' || this.state === 'running') {
      this.state = 'falling';
    }
  }

  /**
   * Reset for new round
   */
  reset(startFrame: number): void {
    this.state = 'idle';
    this.context = {
      grounded: true,
      health: 1000,
      magic: 0,
      currentFrame: startFrame,
      stateStartFrame: startFrame,
      attackPhase: null,
      currentAttack: null,
      comboCount: 0,
      lastAttackFrame: 0,
      invincible: false,
    };
  }
}
