/**
 * Damage Calculator
 * Calculates damage, knockback, and other combat effects
 */

import type { AttackType } from '@clawdbot/protocol';
import { ATTACK_DATA, COMBAT, AttackFrameData } from '../constants';

export interface DamageResult {
  // Base damage before modifiers
  baseDamage: number;

  // Final damage after all calculations
  finalDamage: number;

  // Combo bonus applied
  comboBonus: number;

  // Magic gained by attacker
  magicGain: number;

  // Hitstun duration in frames
  hitstunFrames: number;

  // Knockback values
  knockbackX: number;
  knockbackY: number;

  // Does this cause knockdown?
  causesKnockdown: boolean;
}

export class DamageCalculator {
  /**
   * Calculate full damage and effects for an attack hit
   */
  static calculate(
    attackType: AttackType,
    comboCount: number,
    isCounterHit: boolean = false
  ): DamageResult {
    const attackData = ATTACK_DATA[attackType];

    if (!attackData) {
      return this.getDefaultResult();
    }

    // Base damage
    const baseDamage = attackData.damage;

    // Combo bonus (capped)
    const comboBonusPercent = Math.min(
      comboCount * COMBAT.COMBO_DAMAGE_BONUS,
      COMBAT.MAX_COMBO_BONUS
    );
    const comboBonus = Math.floor(baseDamage * comboBonusPercent);

    // Counter hit bonus (hit during opponent's startup)
    const counterBonus = isCounterHit ? Math.floor(baseDamage * 0.25) : 0;

    // Final damage
    const finalDamage = baseDamage + comboBonus + counterBonus;

    // Magic gain
    const magicGain = attackData.magicGain + Math.floor(finalDamage * COMBAT.MAGIC_GAIN_PER_DAMAGE);

    // Hitstun (longer for counter hits)
    const hitstunFrames = isCounterHit
      ? Math.floor(attackData.hitstun * 1.5)
      : attackData.hitstun;

    // Knockback (stronger for counter hits and high combos)
    const knockbackMultiplier = isCounterHit ? 1.25 : 1;
    const knockbackX = attackData.knockbackX * knockbackMultiplier;
    const knockbackY = attackData.knockbackY * knockbackMultiplier;

    // Knockdown happens on:
    // - Final hit of light combo (light_4)
    // - Heavy attacks
    // - Special attacks
    // - High combo count (6+)
    const causesKnockdown =
      attackType === 'light_4' ||
      attackType === 'heavy' ||
      attackType === 'special' ||
      attackType === 'air_heavy' ||
      comboCount >= 6;

    return {
      baseDamage,
      finalDamage,
      comboBonus,
      magicGain,
      hitstunFrames,
      knockbackX,
      knockbackY,
      causesKnockdown,
    };
  }

  /**
   * Calculate damage when an attack is blocked
   */
  static calculateBlocked(attackType: AttackType): {
    chipDamage: number;
    blockstunFrames: number;
    pushback: number;
  } {
    const attackData = ATTACK_DATA[attackType];

    if (!attackData) {
      return { chipDamage: 0, blockstunFrames: 0, pushback: 0 };
    }

    return {
      // Chip damage is 10% of normal damage
      chipDamage: Math.floor(attackData.damage * 0.1),
      // Blockstun is 60% of hitstun
      blockstunFrames: Math.floor(attackData.hitstun * 0.6),
      // Pushback is 50% of knockback
      pushback: attackData.knockbackX * 0.5,
    };
  }

  /**
   * Check if an attack would be a counter hit
   * (Defender was in attack startup)
   */
  static isCounterHit(
    defenderState: string,
    defenderAttackPhase: string | null
  ): boolean {
    return defenderState === 'attacking' && defenderAttackPhase === 'startup';
  }

  /**
   * Calculate damage scaling for very long combos
   */
  static getDamageScaling(comboCount: number): number {
    if (comboCount <= 5) return 1.0;
    if (comboCount <= 10) return 0.9;
    if (comboCount <= 15) return 0.8;
    if (comboCount <= 20) return 0.7;
    return 0.6; // Minimum scaling
  }

  /**
   * Apply damage scaling to a damage result
   */
  static applyScaling(result: DamageResult, comboCount: number): DamageResult {
    const scaling = this.getDamageScaling(comboCount);

    return {
      ...result,
      finalDamage: Math.floor(result.finalDamage * scaling),
      comboBonus: Math.floor(result.comboBonus * scaling),
    };
  }

  /**
   * Calculate magic cost for special attacks
   */
  static getMagicCost(attackType: AttackType): number {
    if (attackType === 'special') {
      return COMBAT.MAGIC_COST;
    }
    return 0;
  }

  /**
   * Check if player has enough magic for an attack
   */
  static canAffordAttack(attackType: AttackType, currentMagic: number): boolean {
    return currentMagic >= this.getMagicCost(attackType);
  }

  /**
   * Default result for invalid attacks
   */
  private static getDefaultResult(): DamageResult {
    return {
      baseDamage: 0,
      finalDamage: 0,
      comboBonus: 0,
      magicGain: 0,
      hitstunFrames: 0,
      knockbackX: 0,
      knockbackY: 0,
      causesKnockdown: false,
    };
  }
}
