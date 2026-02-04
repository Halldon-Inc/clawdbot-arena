/**
 * Effects Manager
 * Handles visual effects using actual sprite assets
 */

import Phaser from 'phaser';

interface Effect {
  object: Phaser.GameObjects.GameObject;
  lifetime: number;
  maxLifetime: number;
  update?: (effect: Effect, delta: number) => void;
}

interface AnimatedEffect extends Effect {
  sprite: Phaser.GameObjects.Image;
  frameCount: number;
  currentFrame: number;
  frameDelay: number;
  frameTimer: number;
  effectName: string;
}

export class EffectsManager {
  private scene: Phaser.Scene;
  private effects: Effect[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Update all active effects
   */
  update(delta: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.lifetime -= delta;

      if (effect.update) {
        effect.update(effect, delta);
      }

      // Update animated effects
      if ('frameTimer' in effect) {
        const animEffect = effect as AnimatedEffect;
        animEffect.frameTimer += delta;

        if (animEffect.frameTimer >= animEffect.frameDelay) {
          animEffect.frameTimer = 0;
          animEffect.currentFrame++;

          if (animEffect.currentFrame < animEffect.frameCount) {
            const textureKey = `${animEffect.effectName}_${animEffect.currentFrame}`;
            if (this.scene.textures.exists(textureKey)) {
              animEffect.sprite.setTexture(textureKey);
            }
          }
        }
      }

      if (effect.lifetime <= 0) {
        effect.object.destroy();
        this.effects.splice(i, 1);
      }
    }
  }

  /**
   * Create hit effect at position
   */
  createHitEffect(x: number, y: number, isHeavy: boolean = false): void {
    const effectName = isHeavy ? 'heavy-hit' : 'hit-spark';
    const frameCount = 4;

    // Try to use sprite-based effect
    if (this.scene.textures.exists(`${effectName}_0`)) {
      const sprite = this.scene.add.image(x, y, `${effectName}_0`);
      sprite.setScale(isHeavy ? 2.5 : 2);
      sprite.setDepth(100);

      const effect: AnimatedEffect = {
        object: sprite,
        sprite: sprite,
        lifetime: 300,
        maxLifetime: 300,
        effectName: effectName,
        frameCount: frameCount,
        currentFrame: 0,
        frameDelay: 50,
        frameTimer: 0,
        update: (e, delta) => {
          const progress = 1 - e.lifetime / e.maxLifetime;
          sprite.setAlpha(1 - progress * 0.5);
          sprite.setScale((isHeavy ? 2.5 : 2) * (1 + progress * 0.5));
        },
      };

      this.effects.push(effect);
    } else {
      // Fallback to procedural effect
      this.createProceduralHitEffect(x, y, isHeavy);
    }

    // Create burst particles
    this.createBurstParticles(x, y, isHeavy ? 0xff6600 : 0xffff00, isHeavy ? 12 : 8);

    // Create hit spark lines
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      const length = (isHeavy ? 40 : 30) + Math.random() * 20;

      const spark = this.scene.add.line(
        x,
        y,
        0,
        0,
        Math.cos(angle) * length,
        Math.sin(angle) * length,
        0xffffff
      );
      spark.setLineWidth(isHeavy ? 4 : 3);
      spark.setDepth(99);

      const sparkEffect: Effect = {
        object: spark,
        lifetime: 150,
        maxLifetime: 150,
        update: (e, delta) => {
          const progress = 1 - e.lifetime / e.maxLifetime;
          spark.setAlpha(1 - progress);
          spark.setScale(1 - progress * 0.5);
        },
      };

      this.effects.push(sparkEffect);
    }
  }

  /**
   * Fallback procedural hit effect
   */
  private createProceduralHitEffect(x: number, y: number, isHeavy: boolean): void {
    const ring = this.scene.add.circle(x, y, isHeavy ? 15 : 10, 0xffffff, 0.8);
    ring.setDepth(100);

    const effect: Effect = {
      object: ring,
      lifetime: 200,
      maxLifetime: 200,
      update: (e, delta) => {
        const progress = 1 - e.lifetime / e.maxLifetime;
        const scale = 1 + progress * (isHeavy ? 4 : 3);
        ring.setScale(scale);
        ring.setAlpha(1 - progress);
      },
    };

    this.effects.push(effect);
  }

  /**
   * Create block effect
   */
  createBlockEffect(x: number, y: number): void {
    const effectName = 'block';
    const frameCount = 3;

    if (this.scene.textures.exists(`${effectName}_0`)) {
      const sprite = this.scene.add.image(x, y, `${effectName}_0`);
      sprite.setScale(2);
      sprite.setDepth(100);
      sprite.setTint(0x4a90d9);

      const effect: AnimatedEffect = {
        object: sprite,
        sprite: sprite,
        lifetime: 250,
        maxLifetime: 250,
        effectName: effectName,
        frameCount: frameCount,
        currentFrame: 0,
        frameDelay: 60,
        frameTimer: 0,
        update: (e, delta) => {
          const progress = 1 - e.lifetime / e.maxLifetime;
          sprite.setAlpha(1 - progress);
          sprite.setScale(2 * (1 + progress * 0.3));
        },
      };

      this.effects.push(effect);
    } else {
      // Fallback
      const shield = this.scene.add.circle(x, y, 30, 0x4a90d9, 0.5);
      shield.setStrokeStyle(4, 0x4a90d9);
      shield.setDepth(100);

      const effect: Effect = {
        object: shield,
        lifetime: 250,
        maxLifetime: 250,
        update: (e, delta) => {
          const progress = 1 - e.lifetime / e.maxLifetime;
          shield.setAlpha(0.5 * (1 - progress));
          shield.setScale(1 + progress * 0.5);
        },
      };

      this.effects.push(effect);
    }
  }

  /**
   * Create dust effect (landing/dashing)
   */
  createDustEffect(x: number, y: number): void {
    const effectName = 'dust';
    const frameCount = 4;

    if (this.scene.textures.exists(`${effectName}_0`)) {
      const sprite = this.scene.add.image(x, y, `${effectName}_0`);
      sprite.setScale(1.5);
      sprite.setDepth(50);
      sprite.setAlpha(0.7);

      const effect: AnimatedEffect = {
        object: sprite,
        sprite: sprite,
        lifetime: 400,
        maxLifetime: 400,
        effectName: effectName,
        frameCount: frameCount,
        currentFrame: 0,
        frameDelay: 80,
        frameTimer: 0,
        update: (e, delta) => {
          const progress = 1 - e.lifetime / e.maxLifetime;
          sprite.setAlpha(0.7 * (1 - progress));
          sprite.y -= delta * 0.02;
        },
      };

      this.effects.push(effect);
    } else {
      // Fallback dust puffs
      for (let i = 0; i < 5; i++) {
        const offsetX = (Math.random() - 0.5) * 40;
        const puff = this.scene.add.circle(x + offsetX, y, 8 + Math.random() * 8, 0x888888, 0.5);
        puff.setDepth(50);

        const effect: Effect = {
          object: puff,
          lifetime: 400,
          maxLifetime: 400,
          update: (e, delta) => {
            const progress = 1 - e.lifetime / e.maxLifetime;
            puff.setAlpha(0.5 * (1 - progress));
            puff.y -= delta * 0.03;
            puff.setScale(1 + progress);
          },
        };

        this.effects.push(effect);
      }
    }
  }

  /**
   * Create damage number
   */
  createDamageNumber(x: number, y: number, damage: number, isCombo: boolean): void {
    const color = isCombo ? '#ffd700' : '#ffffff';
    const fontSize = isCombo ? '32px' : '24px';

    const text = this.scene.add.text(x, y, damage.toString(), {
      fontSize,
      fontFamily: 'Arial Black',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    });
    text.setOrigin(0.5);
    text.setDepth(200);

    // Random horizontal offset
    const offsetX = (Math.random() - 0.5) * 40;

    const effect: Effect = {
      object: text,
      lifetime: 800,
      maxLifetime: 800,
      update: (e, delta) => {
        const progress = 1 - e.lifetime / e.maxLifetime;

        // Rise and fade
        text.y -= delta * 0.1;
        text.x += offsetX * delta * 0.001;

        // Scale pop
        if (progress < 0.1) {
          text.setScale(1 + (0.1 - progress) * 5);
        } else {
          text.setScale(1);
        }

        // Fade out
        if (progress > 0.7) {
          text.setAlpha(1 - (progress - 0.7) / 0.3);
        }
      },
    };

    this.effects.push(effect);
  }

  /**
   * Create KO effect
   */
  createKOEffect(x: number, y: number): void {
    const effectName = 'ko-explosion';
    const frameCount = 4;

    // Main explosion sprite
    if (this.scene.textures.exists(`${effectName}_0`)) {
      const sprite = this.scene.add.image(x, y - 50, `${effectName}_0`);
      sprite.setScale(3);
      sprite.setDepth(150);

      const effect: AnimatedEffect = {
        object: sprite,
        sprite: sprite,
        lifetime: 500,
        maxLifetime: 500,
        effectName: effectName,
        frameCount: frameCount,
        currentFrame: 0,
        frameDelay: 100,
        frameTimer: 0,
        update: (e, delta) => {
          const progress = 1 - e.lifetime / e.maxLifetime;
          sprite.setScale(3 + progress * 2);
          if (progress > 0.6) {
            sprite.setAlpha(1 - (progress - 0.6) / 0.4);
          }
        },
      };

      this.effects.push(effect);
    }

    // Large burst
    this.createBurstParticles(x, y - 50, 0xff0000, 30);
    this.createBurstParticles(x, y - 50, 0xffff00, 20);
    this.createBurstParticles(x, y - 50, 0xffffff, 15);

    // Shockwave
    const shockwave = this.scene.add.circle(x, y - 50, 20, 0xffffff, 0);
    shockwave.setStrokeStyle(8, 0xffffff, 1);
    shockwave.setDepth(140);

    const shockEffect: Effect = {
      object: shockwave,
      lifetime: 400,
      maxLifetime: 400,
      update: (e, delta) => {
        const progress = 1 - e.lifetime / e.maxLifetime;
        const scale = 1 + progress * 10;
        shockwave.setScale(scale);
        shockwave.setStrokeStyle(8 * (1 - progress), 0xffffff, 1 - progress);
      },
    };

    this.effects.push(shockEffect);

    // "KO" text rising
    const koText = this.scene.add.text(x, y - 50, 'KO!', {
      fontSize: '64px',
      fontFamily: 'Arial Black',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 6,
    });
    koText.setOrigin(0.5);
    koText.setDepth(200);

    const textEffect: Effect = {
      object: koText,
      lifetime: 1500,
      maxLifetime: 1500,
      update: (e, delta) => {
        const progress = 1 - e.lifetime / e.maxLifetime;

        // Rise
        koText.y -= delta * 0.05;

        // Scale bounce
        if (progress < 0.1) {
          koText.setScale(progress * 10);
        } else if (progress < 0.2) {
          koText.setScale(1 + Math.sin((progress - 0.1) * Math.PI * 10) * 0.2);
        } else {
          koText.setScale(1);
        }

        // Fade at end
        if (progress > 0.8) {
          koText.setAlpha(1 - (progress - 0.8) / 0.2);
        }
      },
    };

    this.effects.push(textEffect);
  }

  /**
   * Create energy charge effect
   */
  createEnergyChargeEffect(x: number, y: number): Effect {
    const effectName = 'energy-charge';
    const frameCount = 4;

    if (this.scene.textures.exists(`${effectName}_0`)) {
      const sprite = this.scene.add.image(x, y, `${effectName}_0`);
      sprite.setScale(2);
      sprite.setDepth(90);

      const effect: AnimatedEffect = {
        object: sprite,
        sprite: sprite,
        lifetime: 99999, // Manual control
        maxLifetime: 99999,
        effectName: effectName,
        frameCount: frameCount,
        currentFrame: 0,
        frameDelay: 80,
        frameTimer: 0,
        update: (e, delta) => {
          // Loop animation
          const animEffect = e as AnimatedEffect;
          if (animEffect.currentFrame >= animEffect.frameCount) {
            animEffect.currentFrame = 0;
          }
          // Pulse scale
          const pulse = Math.sin(Date.now() / 100) * 0.1;
          sprite.setScale(2 + pulse);
        },
      };

      this.effects.push(effect);
      return effect;
    }

    // Fallback
    const glow = this.scene.add.circle(x, y, 40, 0x00ffff, 0.3);
    glow.setDepth(90);

    const effect: Effect = {
      object: glow,
      lifetime: 99999,
      maxLifetime: 99999,
      update: (e, delta) => {
        const pulse = Math.sin(Date.now() / 100) * 0.2;
        glow.setScale(1 + pulse);
        glow.setAlpha(0.3 + pulse * 0.2);
      },
    };

    this.effects.push(effect);
    return effect;
  }

  /**
   * Stop an effect
   */
  stopEffect(effect: Effect): void {
    effect.lifetime = 0;
  }

  /**
   * Create burst of particles
   */
  private createBurstParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 100 + Math.random() * 200;
      const size = 3 + Math.random() * 5;

      const particle = this.scene.add.circle(x, y, size, color);
      particle.setDepth(100);

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const effect: Effect = {
        object: particle,
        lifetime: 300 + Math.random() * 200,
        maxLifetime: 500,
        update: (e, delta) => {
          const deltaSeconds = delta / 1000;
          particle.x += vx * deltaSeconds;
          particle.y += vy * deltaSeconds + 200 * deltaSeconds; // Gravity

          const progress = 1 - e.lifetime / e.maxLifetime;
          particle.setAlpha(1 - progress);
          particle.setScale(1 - progress * 0.5);
        },
      };

      this.effects.push(effect);
    }
  }

  /**
   * Clear all effects
   */
  clear(): void {
    for (const effect of this.effects) {
      effect.object.destroy();
    }
    this.effects = [];
  }
}
