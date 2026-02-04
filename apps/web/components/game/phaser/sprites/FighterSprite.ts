/**
 * Fighter Sprite
 * Renders and animates a fighter character
 */

import Phaser from 'phaser';
import type { FighterState, FighterStateEnum } from '@clawdbot/protocol';

export class FighterSprite extends Phaser.GameObjects.Container {
  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Arc;
  private targetX = 0;
  private targetY = 0;
  private currentState: FighterStateEnum = 'idle';
  private isPlayer1: boolean;
  private animTimer = 0;
  private hitFlashTimer = 0;

  // Animation offsets
  private bobOffset = 0;
  private squashStretch = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, playerId: string) {
    super(scene, x, y);

    this.isPlayer1 = playerId === 'player1';
    const color = this.isPlayer1 ? 0x4a90d9 : 0xd94a4a;

    // Create body parts
    this.body = scene.add.rectangle(0, -50, 60, 100, color);
    this.head = scene.add.circle(0, -110, 25, color);

    // Add to container
    this.add([this.body, this.head]);

    // Add to scene
    scene.add.existing(this);

    this.targetX = x;
    this.targetY = y;
  }

  /**
   * Update target state from server
   */
  setTargetState(state: FighterState): void {
    this.targetX = this.scaleX(state.x);
    this.targetY = this.scaleY(state.y);
    this.currentState = state.state;

    // Flip based on facing direction
    this.setScale(state.facing === 'left' ? -1 : 1, 1);

    // Handle state-specific visuals
    this.updateStateVisuals(state);
  }

  /**
   * Update animation
   */
  update(delta: number): void {
    // Interpolate position
    const lerpSpeed = 0.2;
    this.x = Phaser.Math.Linear(this.x, this.targetX, lerpSpeed);
    this.y = Phaser.Math.Linear(this.y, this.targetY, lerpSpeed);

    // Update animations
    this.animTimer += delta;
    this.updateAnimations(delta);

    // Hit flash decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      const flashIntensity = this.hitFlashTimer / 200;
      const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
        { r: 255, g: 255, b: 255 },
        this.isPlayer1 ? { r: 74, g: 144, b: 217 } : { r: 217, g: 74, b: 74 },
        1,
        1 - flashIntensity
      );
      const colorValue = Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b);
      this.body.setFillStyle(colorValue);
      this.head.setFillStyle(colorValue);
    }
  }

  /**
   * Flash white when hit
   */
  flashHit(): void {
    this.hitFlashTimer = 200;
    this.body.setFillStyle(0xffffff);
    this.head.setFillStyle(0xffffff);
  }

  /**
   * Scale X coordinate from game space to screen space
   */
  private scaleX(gameX: number): number {
    // Game coordinates: 50-1870
    // Screen coordinates: 50-1230
    return 50 + ((gameX - 50) / (1870 - 50)) * (1230 - 50);
  }

  /**
   * Scale Y coordinate from game space to screen space
   */
  private scaleY(gameY: number): number {
    // Game coordinates: 800 = ground
    // Screen coordinates: 550 = ground
    return gameY - 800 + 550;
  }

  /**
   * Update state-specific visuals
   */
  private updateStateVisuals(state: FighterState): void {
    switch (this.currentState) {
      case 'hitstun':
      case 'knockdown':
        this.flashHit();
        break;

      case 'ko':
        this.body.setRotation(Math.PI / 2);
        this.head.setVisible(false);
        break;

      default:
        this.body.setRotation(0);
        this.head.setVisible(true);
        break;
    }
  }

  /**
   * Update animations based on current state
   */
  private updateAnimations(delta: number): void {
    const time = this.animTimer / 1000;

    switch (this.currentState) {
      case 'idle':
        // Gentle breathing
        this.bobOffset = Math.sin(time * 2) * 3;
        this.squashStretch = 1 + Math.sin(time * 2) * 0.02;
        break;

      case 'walking':
        // Walking bob
        this.bobOffset = Math.abs(Math.sin(time * 8)) * 5;
        this.squashStretch = 1;
        break;

      case 'running':
        // Running bob (faster)
        this.bobOffset = Math.abs(Math.sin(time * 12)) * 8;
        this.squashStretch = 1 + Math.sin(time * 12) * 0.05;
        break;

      case 'jumping':
        // Stretch during jump
        this.squashStretch = 1.2;
        this.bobOffset = 0;
        break;

      case 'falling':
        // Squash while falling
        this.squashStretch = 0.9;
        this.bobOffset = 0;
        break;

      case 'attacking':
        // Quick squash-stretch for attack
        const attackPhase = (time * 20) % 1;
        if (attackPhase < 0.3) {
          this.squashStretch = 1.15;
        } else if (attackPhase < 0.6) {
          this.squashStretch = 0.9;
        } else {
          this.squashStretch = 1;
        }
        break;

      case 'hitstun':
        // Shake
        this.bobOffset = Math.sin(time * 40) * 3;
        this.squashStretch = 0.95;
        break;

      case 'knockdown':
        // Rotate to ground
        this.body.setRotation(Math.PI / 4);
        this.squashStretch = 0.8;
        break;

      case 'blocking':
        // Crouch slightly
        this.squashStretch = 0.85;
        this.bobOffset = 5;
        break;

      default:
        this.bobOffset = 0;
        this.squashStretch = 1;
    }

    // Apply animations
    this.body.y = -50 - this.bobOffset;
    this.body.setScale(Math.abs(this.scaleX) * (2 - this.squashStretch), this.squashStretch);
    this.head.y = -110 - this.bobOffset * 0.5;
  }
}
