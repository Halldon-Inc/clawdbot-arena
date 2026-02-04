/**
 * Attack Data Module
 * Re-exports attack frame data and provides utility functions
 */

import type { AttackType } from '@clawdbot/protocol';
import { ATTACK_DATA, AttackFrameData, COMBAT } from '../constants';

export { ATTACK_DATA, type AttackFrameData };

/**
 * Get the total duration of an attack in frames
 */
export function getAttackDuration(attackType: AttackType): number {
  const data = ATTACK_DATA[attackType];
  if (!data) return 0;
  return data.startup + data.active + data.recovery;
}

/**
 * Get the frame range when an attack is active (can hit)
 */
export function getActiveFrameRange(attackType: AttackType): { start: number; end: number } {
  const data = ATTACK_DATA[attackType];
  if (!data) return { start: 0, end: 0 };

  return {
    start: data.startup,
    end: data.startup + data.active - 1,
  };
}

/**
 * Check if an attack is in its active phase at a given frame
 */
export function isAttackActiveAtFrame(attackType: AttackType, frameInAttack: number): boolean {
  const range = getActiveFrameRange(attackType);
  return frameInAttack >= range.start && frameInAttack <= range.end;
}

/**
 * Get the frame advantage after an attack hits or is blocked
 */
export function getFrameAdvantage(
  attackType: AttackType,
  hitFrame: number // Frame within active window when hit occurred
): { onHit: number; onBlock: number } {
  const data = ATTACK_DATA[attackType];
  if (!data) return { onHit: 0, onBlock: 0 };

  // Frames remaining in attack after hit
  const activeEnd = data.startup + data.active;
  const framesRemaining = activeEnd - hitFrame + data.recovery;

  return {
    // Attacker advantage = hitstun - remaining recovery
    onHit: data.hitstun - framesRemaining,
    // Block stun is shorter
    onBlock: Math.floor(data.hitstun * 0.6) - framesRemaining,
  };
}

/**
 * Check if an attack can chain into another
 */
export function canChainInto(fromAttack: AttackType, toAttack: AttackType): boolean {
  const fromData = ATTACK_DATA[fromAttack];
  if (!fromData?.canChain) return false;

  // Define the combo chain
  const comboChain: AttackType[] = ['light_1', 'light_2', 'light_3', 'light_4'];

  const fromIndex = comboChain.indexOf(fromAttack);
  const toIndex = comboChain.indexOf(toAttack);

  // Can only chain forward in the combo
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

/**
 * Get the best punish attack based on frame advantage
 */
export function getBestPunishAttack(frameAdvantage: number, hasMagic: boolean): AttackType {
  // Special if we have enough frames and magic
  if (frameAdvantage >= ATTACK_DATA.special.startup && hasMagic) {
    return 'special';
  }

  // Heavy if we have enough frames
  if (frameAdvantage >= ATTACK_DATA.heavy.startup) {
    return 'heavy';
  }

  // Light combo starter
  if (frameAdvantage >= ATTACK_DATA.light_1.startup) {
    return 'light_1';
  }

  // Not enough frame advantage to punish
  return 'light_1';
}

/**
 * Calculate how much damage an attack will do, accounting for combos
 */
export function calculateAttackDamage(
  attackType: AttackType,
  comboCount: number
): number {
  const data = ATTACK_DATA[attackType];
  if (!data) return 0;

  // Apply combo bonus
  const comboBonus = Math.min(
    comboCount * COMBAT.COMBO_DAMAGE_BONUS,
    COMBAT.MAX_COMBO_BONUS
  );

  return Math.floor(data.damage * (1 + comboBonus));
}
