/**
 * Hitbox System
 * Handles attack collision detection
 */

import type { FighterState, AttackType } from '@clawdbot/protocol';
import { ATTACK_DATA, FIGHTER, AttackFrameData } from '../constants';

export interface Hitbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HurtBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HitResult {
  hit: boolean;
  attackData: AttackFrameData | null;
  attackType: AttackType | null;
}

export class HitboxSystem {
  /**
   * Get the hurtbox (vulnerable area) for a fighter
   */
  static getHurtbox(fighter: FighterState): HurtBox {
    return {
      x: fighter.x - FIGHTER.HURTBOX_WIDTH / 2 + FIGHTER.HURTBOX_OFFSET_X,
      y: fighter.y - FIGHTER.HURTBOX_HEIGHT + FIGHTER.HURTBOX_OFFSET_Y,
      width: FIGHTER.HURTBOX_WIDTH,
      height: FIGHTER.HURTBOX_HEIGHT,
    };
  }

  /**
   * Get the active hitbox for an attacking fighter
   * Returns null if no hitbox is active
   */
  static getActiveHitbox(
    fighter: FighterState,
    attackType: AttackType | null,
    isActive: boolean
  ): Hitbox | null {
    if (!attackType || !isActive) {
      return null;
    }

    const attackData = ATTACK_DATA[attackType];
    if (!attackData) {
      return null;
    }

    // Mirror hitbox based on facing direction
    const facingMultiplier = fighter.facing === 'right' ? 1 : -1;

    const hitboxX = fighter.facing === 'right'
      ? fighter.x + attackData.hitboxOffsetX
      : fighter.x - attackData.hitboxOffsetX - attackData.hitboxWidth;

    return {
      x: hitboxX,
      y: fighter.y - FIGHTER.HEIGHT / 2 + attackData.hitboxOffsetY,
      width: attackData.hitboxWidth,
      height: attackData.hitboxHeight,
    };
  }

  /**
   * Check if two boxes overlap (AABB collision)
   */
  static boxesOverlap(box1: Hitbox | HurtBox, box2: Hitbox | HurtBox): boolean {
    return (
      box1.x < box2.x + box2.width &&
      box1.x + box1.width > box2.x &&
      box1.y < box2.y + box2.height &&
      box1.y + box1.height > box2.y
    );
  }

  /**
   * Check if an attack hits a defender
   */
  static checkHit(
    attacker: FighterState,
    defender: FighterState,
    attackType: AttackType | null,
    isAttackActive: boolean,
    defenderVulnerable: boolean
  ): HitResult {
    // No hit if attack isn't active or defender isn't vulnerable
    if (!isAttackActive || !defenderVulnerable || !attackType) {
      return { hit: false, attackData: null, attackType: null };
    }

    const hitbox = this.getActiveHitbox(attacker, attackType, isAttackActive);
    const hurtbox = this.getHurtbox(defender);

    if (!hitbox) {
      return { hit: false, attackData: null, attackType: null };
    }

    const hit = this.boxesOverlap(hitbox, hurtbox);

    if (hit) {
      return {
        hit: true,
        attackData: ATTACK_DATA[attackType] || null,
        attackType,
      };
    }

    return { hit: false, attackData: null, attackType: null };
  }

  /**
   * Check if a fighter is in attack range of another
   */
  static inAttackRange(
    attacker: FighterState,
    defender: FighterState,
    attackType: AttackType = 'light_1'
  ): boolean {
    const attackData = ATTACK_DATA[attackType];
    if (!attackData) return false;

    const distance = Math.abs(attacker.x - defender.x);
    const maxRange = attackData.hitboxOffsetX + attackData.hitboxWidth;

    // Check if defender is in front of attacker
    const attackerFacing = attacker.facing;
    const defenderToRight = defender.x > attacker.x;
    const facingDefender =
      (attackerFacing === 'right' && defenderToRight) ||
      (attackerFacing === 'left' && !defenderToRight);

    return distance <= maxRange && facingDefender;
  }

  /**
   * Check if a fighter is in special attack range
   */
  static inSpecialRange(attacker: FighterState, defender: FighterState): boolean {
    return this.inAttackRange(attacker, defender, 'special');
  }

  /**
   * Get debug visualization data for hitboxes
   */
  static getDebugBoxes(
    fighter: FighterState,
    attackType: AttackType | null,
    isAttackActive: boolean
  ): { hurtbox: HurtBox; hitbox: Hitbox | null } {
    return {
      hurtbox: this.getHurtbox(fighter),
      hitbox: this.getActiveHitbox(fighter, attackType, isAttackActive),
    };
  }
}
