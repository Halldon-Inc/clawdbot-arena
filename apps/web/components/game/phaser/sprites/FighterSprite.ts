/**
 * Fighter Sprite
 * Renders and animates a fighter character using actual sprite assets
 */

import Phaser from 'phaser';
import type { FighterState, FighterStateEnum } from '@clawdbot/protocol';

// Map game states to animation names
const STATE_TO_ANIM: Record<FighterStateEnum, string> = {
  idle: 'idle',
  walking: 'walk',
  running: 'walk',
  jumping: 'jump',
  falling: 'jump',
  attacking: 'attack1',
  hitstun: 'hit',
  knockdown: 'hit',
  ko: 'ko',
  blocking: 'idle',
  getting_up: 'idle',
};

export class FighterSprite extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Image;
  private shadowSprite: Phaser.GameObjects.Ellipse;
  private characterId: string;
  private targetX = 0;
  private targetY = 0;
  private currentState: FighterStateEnum = 'idle';
  private previousState: FighterStateEnum = 'idle';
  private isPlayer1: boolean;
  private animTimer = 0;
  private hitFlashTimer = 0;
  private currentAnimFrame = 0;

  // Animation offsets
  private bobOffset = 0;
  private squashStretch = 1;

  // Sprite scale
  private readonly SPRITE_SCALE = 2;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerId: string,
    characterId: string = 'alphabot'
  ) {
    super(scene, x, y);

    this.isPlayer1 = playerId === 'player1';
    this.characterId = characterId;

    // Create shadow
    this.shadowSprite = scene.add.ellipse(0, 60, 60, 20, 0x000000, 0.3);
    this.add(this.shadowSprite);

    // Create main sprite
    const textureKey = `${characterId}_idle`;
    if (scene.textures.exists(textureKey)) {
      this.sprite = scene.add.image(0, 0, textureKey);
    } else {
      // Fallback to colored rectangle if texture doesn't exist
      const graphics = scene.make.graphics({ x: 0, y: 0 });
      const color = this.isPlayer1 ? 0x4a90d9 : 0xd94a4a;
      graphics.fillStyle(color);
      graphics.fillRect(0, 0, 60, 100);
      graphics.generateTexture(`fallback_${playerId}`, 60, 100);
      graphics.destroy();
      this.sprite = scene.add.image(0, 0, `fallback_${playerId}`);
    }

    this.sprite.setScale(this.SPRITE_SCALE);
    this.sprite.setOrigin(0.5, 1); // Origin at bottom center
    this.add(this.sprite);

    // Add to scene
    scene.add.existing(this);

    this.targetX = x;
    this.targetY = y;
  }

  /**
   * Set the character (fighter) to use
   */
  setCharacter(characterId: string): void {
    this.characterId = characterId;
    this.updateSpriteTexture();
  }

  /**
   * Update target state from server
   */
  setTargetState(state: FighterState): void {
    this.targetX = this.gameToScreenX(state.x);
    this.targetY = this.gameToScreenY(state.y);
    this.previousState = this.currentState;
    this.currentState = state.state;

    // Flip based on facing direction
    const facingLeft = state.facing === 'left';
    this.sprite.setFlipX(facingLeft);

    // Update animation when state changes
    if (this.currentState !== this.previousState) {
      this.currentAnimFrame = 0;
      this.updateSpriteTexture();
    }

    // Handle state-specific visuals
    this.updateStateVisuals(state);
  }

  /**
   * Update sprite texture based on current state
   */
  private updateSpriteTexture(): void {
    const animName = STATE_TO_ANIM[this.currentState] || 'idle';
    const textureKey = `${this.characterId}_${animName}`;

    if (this.scene.textures.exists(textureKey)) {
      this.sprite.setTexture(textureKey);
    }
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

    // Update shadow
    this.updateShadow();

    // Hit flash decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      const flashIntensity = Math.min(1, this.hitFlashTimer / 100);
      this.sprite.setTint(
        Phaser.Display.Color.GetColor(
          255,
          255 * (1 - flashIntensity),
          255 * (1 - flashIntensity)
        )
      );

      if (this.hitFlashTimer <= 0) {
        this.sprite.clearTint();
      }
    }
  }

  /**
   * Flash white when hit
   */
  flashHit(): void {
    this.hitFlashTimer = 200;
    this.sprite.setTint(0xffffff);
  }

  /**
   * Scale X coordinate from game space to screen space
   */
  private gameToScreenX(gameX: number): number {
    // Game coordinates: 50-1870
    // Screen coordinates: 50-1230
    return 50 + ((gameX - 50) / (1870 - 50)) * (1230 - 50);
  }

  /**
   * Scale Y coordinate from game space to screen space
   */
  private gameToScreenY(gameY: number): number {
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
        // Rotate sprite when KO'd
        this.sprite.setRotation(Math.PI / 2);
        this.sprite.setAlpha(0.8);
        break;

      default:
        this.sprite.setRotation(0);
        this.sprite.setAlpha(1);
        break;
    }
  }

  /**
   * Update shadow position and scale
   */
  private updateShadow(): void {
    // Shadow stays on ground
    const groundOffset = 60;
    this.shadowSprite.y = groundOffset;

    // Scale shadow based on height (jumping)
    const heightAboveGround = Math.max(0, this.targetY - this.y);
    const shadowScale = Math.max(0.5, 1 - heightAboveGround / 200);
    this.shadowSprite.setScale(shadowScale, shadowScale * 0.4);
    this.shadowSprite.setAlpha(0.3 * shadowScale);
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
        this.squashStretch = 1.1;
        this.bobOffset = 0;
        break;

      case 'falling':
        // Squash while falling
        this.squashStretch = 0.95;
        this.bobOffset = 0;
        break;

      case 'attacking':
        // Quick squash-stretch for attack
        const attackPhase = (time * 20) % 1;
        if (attackPhase < 0.3) {
          this.squashStretch = 1.1;
          this.bobOffset = -5;
        } else if (attackPhase < 0.6) {
          this.squashStretch = 0.95;
          this.bobOffset = 5;
        } else {
          this.squashStretch = 1;
          this.bobOffset = 0;
        }
        break;

      case 'hitstun':
        // Shake
        this.bobOffset = Math.sin(time * 40) * 3;
        this.squashStretch = 0.95;
        break;

      case 'knockdown':
        // Fall animation
        this.squashStretch = 0.8;
        this.bobOffset = 10;
        break;

      case 'ko':
        // Fallen
        this.squashStretch = 0.7;
        this.bobOffset = 20;
        break;

      case 'blocking':
        // Crouch slightly
        this.squashStretch = 0.9;
        this.bobOffset = 5;
        break;

      default:
        this.bobOffset = 0;
        this.squashStretch = 1;
    }

    // Apply animations to sprite
    this.sprite.y = -this.bobOffset;
    this.sprite.setScale(
      this.SPRITE_SCALE * (this.sprite.flipX ? -1 : 1),
      this.SPRITE_SCALE * this.squashStretch
    );
  }
}
