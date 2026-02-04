/**
 * Fighter Physics System
 * Handles movement, gravity, and collision with stage boundaries
 */

import type { FighterState, BotInput, FacingDirection } from '@clawdbot/protocol';
import { PHYSICS, FIGHTER } from '../constants';

export interface PhysicsResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: FacingDirection;
}

export class FighterPhysics {
  /**
   * Apply physics for one frame
   */
  static update(
    fighter: FighterState,
    input: BotInput,
    canMove: boolean
  ): PhysicsResult {
    let { x, y, vx, vy, grounded, facing } = fighter;

    // Apply gravity if airborne
    if (!grounded) {
      vy = Math.min(vy + PHYSICS.GRAVITY, PHYSICS.MAX_FALL_SPEED);
    }

    // Handle movement input
    if (canMove) {
      const speed = fighter.state === 'running' ? PHYSICS.RUN_SPEED : PHYSICS.WALK_SPEED;
      const control = grounded ? 1 : PHYSICS.AIR_CONTROL;

      if (input.left) {
        vx -= speed * control;
        facing = 'left';
      }
      if (input.right) {
        vx += speed * control;
        facing = 'right';
      }

      // Jump
      if (input.jump && grounded) {
        vy = PHYSICS.JUMP_FORCE;
        grounded = false;
      }
    }

    // Apply friction
    const friction = grounded ? PHYSICS.GROUND_FRICTION : PHYSICS.AIR_FRICTION;
    vx *= friction;

    // Stop very small velocities
    if (Math.abs(vx) < 0.1) vx = 0;

    // Apply velocity
    x += vx;
    y += vy;

    // Ground collision
    if (y >= PHYSICS.GROUND_Y) {
      y = PHYSICS.GROUND_Y;
      vy = 0;
      grounded = true;
    } else {
      grounded = false;
    }

    // Stage boundary collision
    const halfWidth = FIGHTER.WIDTH / 2;
    if (x - halfWidth < PHYSICS.STAGE_LEFT) {
      x = PHYSICS.STAGE_LEFT + halfWidth;
      vx = 0;
    }
    if (x + halfWidth > PHYSICS.STAGE_RIGHT) {
      x = PHYSICS.STAGE_RIGHT - halfWidth;
      vx = 0;
    }

    return { x, y, vx, vy, grounded, facing };
  }

  /**
   * Apply knockback to a fighter
   */
  static applyKnockback(
    fighter: FighterState,
    knockbackX: number,
    knockbackY: number,
    attackerX: number
  ): PhysicsResult {
    let { x, y, vx, vy, grounded, facing } = fighter;

    // Direction based on attacker position
    const direction = fighter.x > attackerX ? 1 : -1;

    vx = knockbackX * direction;
    vy = knockbackY;

    // Small knockback keeps on ground, larger launches
    if (vy < -5) {
      grounded = false;
    }

    return { x, y, vx, vy, grounded, facing };
  }

  /**
   * Calculate distance between two fighters
   */
  static getDistance(fighter1: FighterState, fighter2: FighterState): {
    distance: number;
    horizontalDistance: number;
    verticalDistance: number;
  } {
    const dx = fighter2.x - fighter1.x;
    const dy = fighter2.y - fighter1.y;

    return {
      distance: Math.sqrt(dx * dx + dy * dy),
      horizontalDistance: Math.abs(dx),
      verticalDistance: Math.abs(dy),
    };
  }

  /**
   * Check if fighter should face opponent
   */
  static getFacingToward(
    fighterX: number,
    opponentX: number
  ): FacingDirection {
    return opponentX > fighterX ? 'right' : 'left';
  }

  /**
   * Get spawn position for a player
   */
  static getSpawnPosition(playerNumber: 1 | 2): { x: number; y: number } {
    return {
      x: playerNumber === 1 ? FIGHTER.P1_START_X : FIGHTER.P2_START_X,
      y: FIGHTER.START_Y,
    };
  }

  /**
   * Reset fighter position for new round
   */
  static resetPosition(playerNumber: 1 | 2): Partial<FighterState> {
    const spawn = this.getSpawnPosition(playerNumber);
    return {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      grounded: true,
      facing: playerNumber === 1 ? 'right' : 'left',
    };
  }
}
