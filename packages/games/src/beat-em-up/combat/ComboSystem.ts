/**
 * Combo System
 * Tracks combo state for each fighter
 */

import type { AttackType } from '@clawdbot/protocol';
import { ATTACK_DATA, COMBAT } from '../constants';

export interface ComboState {
  // Current combo hit count
  count: number;

  // Total damage dealt in this combo
  damage: number;

  // Last attack type used
  lastAttack: AttackType | null;

  // Frame when combo started
  startFrame: number;

  // Frame of last hit
  lastHitFrame: number;

  // Is combo still active (can continue)?
  active: boolean;

  // Can chain to next attack?
  canChain: boolean;

  // Chain window remaining (frames)
  chainWindowRemaining: number;
}

export class ComboSystem {
  private comboState: ComboState;
  private opponentComboState: ComboState;

  constructor() {
    this.comboState = this.createEmptyCombo();
    this.opponentComboState = this.createEmptyCombo();
  }

  private createEmptyCombo(): ComboState {
    return {
      count: 0,
      damage: 0,
      lastAttack: null,
      startFrame: 0,
      lastHitFrame: 0,
      active: false,
      canChain: false,
      chainWindowRemaining: 0,
    };
  }

  /**
   * Get combo state for a player
   */
  getComboState(isPlayer1: boolean): ComboState {
    return isPlayer1 ? { ...this.comboState } : { ...this.opponentComboState };
  }

  /**
   * Register a hit and update combo state
   */
  registerHit(
    isPlayer1Attacker: boolean,
    attackType: AttackType,
    damage: number,
    frame: number
  ): {
    comboCount: number;
    isCombo: boolean;
    comboDamage: number;
    bonusDamage: number;
  } {
    const combo = isPlayer1Attacker ? this.comboState : this.opponentComboState;
    const attackData = ATTACK_DATA[attackType];

    // Check if this continues the combo
    const isCombo = combo.active && frame - combo.lastHitFrame < this.getComboWindow(combo.lastAttack);

    if (isCombo) {
      combo.count++;
    } else {
      // Start new combo
      combo.count = 1;
      combo.damage = 0;
      combo.startFrame = frame;
      combo.active = true;
    }

    // Calculate bonus damage
    const bonusMultiplier = Math.min(
      (combo.count - 1) * COMBAT.COMBO_DAMAGE_BONUS,
      COMBAT.MAX_COMBO_BONUS
    );
    const bonusDamage = Math.floor(damage * bonusMultiplier);
    const totalDamage = damage + bonusDamage;

    combo.damage += totalDamage;
    combo.lastAttack = attackType;
    combo.lastHitFrame = frame;
    combo.canChain = attackData?.canChain ?? false;
    combo.chainWindowRemaining = attackData?.chainWindow ?? 0;

    return {
      comboCount: combo.count,
      isCombo: combo.count > 1,
      comboDamage: combo.damage,
      bonusDamage,
    };
  }

  /**
   * Get the window (in frames) to continue a combo
   */
  private getComboWindow(lastAttack: AttackType | null): number {
    if (!lastAttack) return 0;

    const attackData = ATTACK_DATA[lastAttack];
    if (!attackData) return 30; // Default combo window

    // Combo window is hitstun + a grace period
    return attackData.hitstun + 5;
  }

  /**
   * Update combo state each frame
   */
  tick(frame: number): void {
    this.updateCombo(this.comboState, frame);
    this.updateCombo(this.opponentComboState, frame);
  }

  private updateCombo(combo: ComboState, frame: number): void {
    if (!combo.active) return;

    // Update chain window
    if (combo.chainWindowRemaining > 0) {
      combo.chainWindowRemaining--;
    } else {
      combo.canChain = false;
    }

    // Check if combo has dropped
    const framesSinceHit = frame - combo.lastHitFrame;
    const window = this.getComboWindow(combo.lastAttack);

    if (framesSinceHit > window) {
      combo.active = false;
      combo.canChain = false;
    }
  }

  /**
   * End a combo (opponent escaped, knocked down, etc.)
   */
  endCombo(isPlayer1: boolean): ComboState {
    const combo = isPlayer1 ? this.comboState : this.opponentComboState;
    const finalState = { ...combo };

    // Reset combo state
    if (isPlayer1) {
      this.comboState = this.createEmptyCombo();
    } else {
      this.opponentComboState = this.createEmptyCombo();
    }

    return finalState;
  }

  /**
   * Check if a player can chain into the next attack
   */
  canChainAttack(isPlayer1: boolean): boolean {
    const combo = isPlayer1 ? this.comboState : this.opponentComboState;
    return combo.canChain && combo.chainWindowRemaining > 0;
  }

  /**
   * Get current combo count
   */
  getComboCount(isPlayer1: boolean): number {
    const combo = isPlayer1 ? this.comboState : this.opponentComboState;
    return combo.active ? combo.count : 0;
  }

  /**
   * Get longest combo in the current session (for stats)
   */
  private longestComboP1 = 0;
  private longestComboP2 = 0;

  recordLongestCombo(isPlayer1: boolean): void {
    const combo = isPlayer1 ? this.comboState : this.opponentComboState;

    if (isPlayer1) {
      this.longestComboP1 = Math.max(this.longestComboP1, combo.count);
    } else {
      this.longestComboP2 = Math.max(this.longestComboP2, combo.count);
    }
  }

  getLongestCombo(isPlayer1: boolean): number {
    return isPlayer1 ? this.longestComboP1 : this.longestComboP2;
  }

  /**
   * Reset all combo tracking
   */
  reset(): void {
    this.comboState = this.createEmptyCombo();
    this.opponentComboState = this.createEmptyCombo();
    this.longestComboP1 = 0;
    this.longestComboP2 = 0;
  }
}
