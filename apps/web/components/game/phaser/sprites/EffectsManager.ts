/**
 * Effects Manager
 * Handles visual effects like hit sparks, particles, etc.
 */

import Phaser from 'phaser';

interface Effect {
  object: Phaser.GameObjects.GameObject;
  lifetime: number;
  maxLifetime: number;
  update?: (effect: Effect, delta: number) => void;
}

export class EffectsManager {
  private scene: Phaser.Scene;
  private effects: Effect[] = [];
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initParticles();
  }

  /**
   * Initialize particle system
   */
  private initParticles(): void {
    // Create a simple white circle texture for particles
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture('particle', 16, 16);
    graphics.destroy();
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

      if (effect.lifetime <= 0) {
        effect.object.destroy();
        this.effects.splice(i, 1);
      }
    }
  }

  /**
   * Create hit effect at position
   */
  createHitEffect(x: number, y: number): void {
    // Create expanding ring
    const ring = this.scene.add.circle(x, y, 10, 0xffffff, 0.8);

    const effect: Effect = {
      object: ring,
      lifetime: 200,
      maxLifetime: 200,
      update: (e, delta) => {
        const progress = 1 - e.lifetime / e.maxLifetime;
        const scale = 1 + progress * 3;
        ring.setScale(scale);
        ring.setAlpha(1 - progress);
      },
    };

    this.effects.push(effect);

    // Create burst particles
    this.createBurstParticles(x, y, 0xffff00, 8);

    // Create hit spark lines
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      const length = 30 + Math.random() * 20;

      const spark = this.scene.add.line(
        x,
        y,
        0,
        0,
        Math.cos(angle) * length,
        Math.sin(angle) * length,
        0xffffff
      );
      spark.setLineWidth(3);

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
    // Large burst
    this.createBurstParticles(x, y, 0xff0000, 30);
    this.createBurstParticles(x, y, 0xffff00, 20);
    this.createBurstParticles(x, y, 0xffffff, 15);

    // Shockwave
    const shockwave = this.scene.add.circle(x, y, 20, 0xffffff, 0);
    shockwave.setStrokeStyle(8, 0xffffff, 1);

    const effect: Effect = {
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

    this.effects.push(effect);

    // "KO" text rising
    const koText = this.scene.add.text(x, y, 'KO!', {
      fontSize: '64px',
      fontFamily: 'Arial Black',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 6,
    });
    koText.setOrigin(0.5);

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
   * Create burst of particles
   */
  private createBurstParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 100 + Math.random() * 200;
      const size = 3 + Math.random() * 5;

      const particle = this.scene.add.circle(x, y, size, color);

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
