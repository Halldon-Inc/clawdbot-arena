'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

// Game constants
const ROUND_TIME = 30;
const STARTING_HEALTH = 1000;
const WALK_SPEED = 5;
const GROUND_Y_OFFSET = 95;
const SPRITE_SCALE = 3.5;

class DemoScene extends Phaser.Scene {
  private player1!: Phaser.GameObjects.Sprite;
  private player2!: Phaser.GameObjects.Sprite;
  private player1Shadow!: Phaser.GameObjects.Ellipse;
  private player2Shadow!: Phaser.GameObjects.Ellipse;
  private healthBar1!: Phaser.GameObjects.Graphics;
  private healthBar2!: Phaser.GameObjects.Graphics;
  private health1 = STARTING_HEALTH;
  private health2 = STARTING_HEALTH;
  private timerText!: Phaser.GameObjects.Text;
  private timer = ROUND_TIME;
  private isRunning = false;
  private walkFrame = 0;
  private walkTimer = 0;
  private p1State = 'idle';
  private p2State = 'idle';
  private p1ActionLock = false;
  private p2ActionLock = false;

  constructor() {
    super({ key: 'DemoScene' });
  }

  preload() {
    const fighters = ['alphabot', 'neuralknight', 'quantumfist', 'ironlogic'];
    const anims = ['idle', 'walk', 'walk2', 'jump', 'attack1', 'attack2', 'special', 'hit', 'ko'];

    for (const fighter of fighters) {
      for (const anim of anims) {
        this.load.image(
          `${fighter}_${anim}`,
          `/assets/sprites/fighters/${fighter}/${anim}.png`
        );
      }
    }
  }

  create() {
    const { width, height } = this.scale;

    this.createArenaBackground(width, height);

    // Shadows
    this.player1Shadow = this.add.ellipse(250, height - 75, 80, 20, 0x000000, 0.5);
    this.player2Shadow = this.add.ellipse(width - 250, height - 75, 80, 20, 0x000000, 0.5);

    // Create player sprites
    const p1Tex = this.textures.exists('alphabot_idle') ? 'alphabot_idle' : this.createFallbackTexture('p1', 0x4a90d9);
    const p2Tex = this.textures.exists('neuralknight_idle') ? 'neuralknight_idle' : this.createFallbackTexture('p2', 0xd94a4a);

    this.player1 = this.add.sprite(250, height - GROUND_Y_OFFSET, p1Tex);
    this.player1.setScale(SPRITE_SCALE);
    this.player1.setOrigin(0.5, 1);

    this.player2 = this.add.sprite(width - 250, height - GROUND_Y_OFFSET, p2Tex);
    this.player2.setScale(SPRITE_SCALE);
    this.player2.setOrigin(0.5, 1);
    this.player2.setFlipX(true);

    this.createUI(width);

    this.time.delayedCall(500, () => this.showFightText());
  }

  update(time: number, delta: number) {
    if (!this.isRunning) return;

    // Update walk animation cycling
    this.walkTimer += delta;
    if (this.walkTimer > 150) {
      this.walkTimer = 0;
      this.walkFrame = this.walkFrame === 0 ? 1 : 0;
    }

    // Update sprite textures based on state
    if (this.p1State === 'walk' && !this.p1ActionLock) {
      const walkAnim = this.walkFrame === 0 ? 'walk' : 'walk2';
      this.setPlayerTexture(1, walkAnim);
    }
    if (this.p2State === 'walk' && !this.p2ActionLock) {
      const walkAnim = this.walkFrame === 0 ? 'walk' : 'walk2';
      this.setPlayerTexture(2, walkAnim);
    }
  }

  createArenaBackground(width: number, height: number) {
    const g = this.add.graphics();

    // Sky gradient
    for (let y = 0; y < height * 0.6; y++) {
      const t = y / (height * 0.6);
      const r = Math.floor(5 + t * 15);
      const gb = Math.floor(10 + t * 30);
      const b = Math.floor(30 + t * 40);
      g.fillStyle(Phaser.Display.Color.GetColor(r, gb, b));
      g.fillRect(0, y, width, 1);
    }

    // City skyline
    g.fillStyle(0x0a1525);
    const buildings = [
      { x: 0, w: 80, h: 180 }, { x: 70, w: 60, h: 220 }, { x: 120, w: 100, h: 160 },
      { x: 210, w: 70, h: 250 }, { x: 270, w: 90, h: 190 }, { x: 350, w: 60, h: 230 },
      { x: 400, w: 120, h: 170 }, { x: 510, w: 80, h: 260 }, { x: 580, w: 100, h: 200 },
      { x: 670, w: 70, h: 240 }, { x: 730, w: 90, h: 180 }, { x: 810, w: 60, h: 220 },
      { x: 860, w: 110, h: 190 }, { x: 960, w: 80, h: 250 }, { x: 1030, w: 70, h: 210 },
      { x: 1090, w: 100, h: 170 }, { x: 1180, w: 120, h: 230 },
    ];

    const skylineY = height * 0.35;
    for (const b of buildings) {
      g.fillRect(b.x, skylineY - b.h + 100, b.w, b.h);
      g.fillStyle(0x1a3050);
      for (let wy = skylineY - b.h + 110; wy < skylineY + 90; wy += 20) {
        for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 15) {
          if (Math.random() > 0.3) g.fillRect(wx, wy, 8, 12);
        }
      }
      g.fillStyle(0x0a1525);
    }

    // Arena mid-ground
    g.fillStyle(0x101830);
    g.fillRect(0, height * 0.4, width, height * 0.3);

    g.lineStyle(2, 0x2a4a6a, 0.5);
    for (let i = 0; i < 8; i++) {
      const y = height * 0.4 + i * 25;
      g.lineBetween(0, y, width, y);
    }

    // Pillars
    g.fillStyle(0x152540);
    g.fillRect(50, height * 0.35, 40, height * 0.35);
    g.fillRect(width - 90, height * 0.35, 40, height * 0.35);
    g.fillRect(width / 2 - 20, height * 0.3, 40, height * 0.4);

    // Ground
    g.fillStyle(0x0a1a2a);
    g.fillRect(0, height - 80, width, 80);

    // Neon grid
    g.lineStyle(2, 0x00ffaa, 0.6);
    for (let i = 0; i < 4; i++) {
      const y = height - 70 + i * 18;
      g.lineBetween(0, y, width, y);
    }
    const gridLines = 20;
    for (let i = 0; i <= gridLines; i++) {
      const x = (width / gridLines) * i;
      const topY = height - 80;
      const bottomY = height;
      const topX = width / 2 + (x - width / 2) * 0.3;
      g.lineBetween(topX, topY, x, bottomY);
    }

    g.lineStyle(4, 0x00ff88, 0.3);
    g.lineBetween(0, height - 80, width, height - 80);

    g.fillStyle(0x00ffaa, 0.2);
    g.fillTriangle(0, height - 80, 100, height - 80, 0, height - 30);
    g.fillTriangle(width, height - 80, width - 100, height - 80, width, height - 30);
  }

  createFallbackTexture(key: string, color: number): string {
    const g = this.add.graphics();
    g.fillStyle(color);
    g.fillRect(0, 0, 48, 55);
    g.generateTexture(key, 48, 55);
    g.destroy();
    return key;
  }

  createUI(width: number) {
    // Health bars
    const hbBg1 = this.add.graphics();
    hbBg1.fillStyle(0x000000, 0.7);
    hbBg1.fillRoundedRect(40, 20, 320, 30, 5);
    hbBg1.lineStyle(2, 0x4a90d9);
    hbBg1.strokeRoundedRect(40, 20, 320, 30, 5);

    const hbBg2 = this.add.graphics();
    hbBg2.fillStyle(0x000000, 0.7);
    hbBg2.fillRoundedRect(width - 360, 20, 320, 30, 5);
    hbBg2.lineStyle(2, 0xd94a4a);
    hbBg2.strokeRoundedRect(width - 360, 20, 320, 30, 5);

    this.healthBar1 = this.add.graphics();
    this.healthBar2 = this.add.graphics();
    this.updateHealthBars(width);

    // Names
    this.add.text(50, 55, 'AlphaBot', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#4a90d9',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.add.text(width - 50, 55, 'NeuralKnight', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#d94a4a',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0);

    // Timer
    const timerBg = this.add.graphics();
    timerBg.fillStyle(0x000000, 0.8);
    timerBg.fillRoundedRect(width / 2 - 40, 15, 80, 50, 8);
    timerBg.lineStyle(2, 0xffcc00);
    timerBg.strokeRoundedRect(width / 2 - 40, 15, 80, 50, 8);

    this.timerText = this.add.text(width / 2, 40, ROUND_TIME.toString(), {
      fontSize: '32px',
      fontFamily: 'Arial Black',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Single round indicator
    this.add.text(width / 2, 75, 'FINAL ROUND', {
      fontSize: '14px',
      fontFamily: 'Arial Black',
      color: '#ff6600',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }

  updateHealthBars(width: number) {
    this.healthBar1.clear();
    this.healthBar2.clear();

    const h1Width = (this.health1 / STARTING_HEALTH) * 310;
    this.healthBar1.fillGradientStyle(0x2a6aaa, 0x4a90d9, 0x2a6aaa, 0x4a90d9);
    this.healthBar1.fillRoundedRect(45, 25, h1Width, 20, 3);

    const h2Width = (this.health2 / STARTING_HEALTH) * 310;
    this.healthBar2.fillGradientStyle(0xd94a4a, 0xaa2a2a, 0xd94a4a, 0xaa2a2a);
    this.healthBar2.fillRoundedRect(width - 45 - h2Width, 25, h2Width, 20, 3);
  }

  showFightText() {
    const { width, height } = this.scale;

    const text = this.add.text(width / 2, height / 2, 'FIGHT!', {
      fontSize: '72px',
      fontFamily: 'Arial Black',
      color: '#ff3333',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: text,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(500, () => {
          this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              text.destroy();
              this.startBattle();
            }
          });
        });
      }
    });
  }

  startBattle() {
    this.isRunning = true;

    this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.isRunning && this.timer > 0) {
          this.timer--;
          this.timerText.setText(this.timer.toString());

          // Time's up - determine winner
          if (this.timer === 0) {
            this.timeUp();
          }
        }
      },
      loop: true
    });

    this.battleTick();
  }

  timeUp() {
    this.isRunning = false;
    const { width, height } = this.scale;

    // Determine winner by health
    let winner: string;
    if (this.health1 > this.health2) {
      winner = 'AlphaBot';
    } else if (this.health2 > this.health1) {
      winner = 'NeuralKnight';
    } else {
      winner = 'DRAW';
    }

    const timeText = this.add.text(width / 2, height / 2, 'TIME!', {
      fontSize: '60px',
      fontFamily: 'Arial Black',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: timeText,
      scale: 1,
      duration: 400,
      ease: 'Bounce.easeOut'
    });

    this.time.delayedCall(1500, () => {
      const winText = winner === 'DRAW' ? 'DRAW!' : `${winner} WINS!`;
      this.add.text(width / 2, height / 2 + 70, winText, {
        fontSize: '40px',
        fontFamily: 'Arial Black',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 6,
      }).setOrigin(0.5);

      this.time.delayedCall(3000, () => this.scene.restart());
    });
  }

  battleTick() {
    if (!this.isRunning) return;

    const action = Phaser.Math.RND.pick(['approach', 'attack', 'retreat', 'jump', 'idle']);
    const attacker = Phaser.Math.RND.pick([1, 2]);

    switch (action) {
      case 'approach':
        this.doApproach(attacker);
        break;
      case 'attack':
        this.doAttack(attacker);
        break;
      case 'retreat':
        this.doRetreat(attacker);
        break;
      case 'jump':
        this.doJump(attacker);
        break;
      case 'idle':
        // Do nothing, just idle
        break;
    }

    this.time.delayedCall(Phaser.Math.Between(400, 800), () => {
      if (this.health1 > 0 && this.health2 > 0 && this.isRunning) {
        this.battleTick();
      }
    });
  }

  setPlayerTexture(player: number, animName: string) {
    const charName = player === 1 ? 'alphabot' : 'neuralknight';
    const textureKey = `${charName}_${animName}`;

    if (this.textures.exists(textureKey)) {
      const sprite = player === 1 ? this.player1 : this.player2;
      sprite.setTexture(textureKey);
    }
  }

  setPlayerState(player: number, state: string) {
    if (player === 1) {
      this.p1State = state;
    } else {
      this.p2State = state;
    }
  }

  doApproach(player: number) {
    if ((player === 1 && this.p1ActionLock) || (player === 2 && this.p2ActionLock)) return;

    const sprite = player === 1 ? this.player1 : this.player2;
    const shadow = player === 1 ? this.player1Shadow : this.player2Shadow;
    const target = player === 1 ? this.player2.x - 120 : this.player1.x + 120;

    // Don't move past each other
    const minX = 100;
    const maxX = this.scale.width - 100;
    const clampedTarget = Phaser.Math.Clamp(target, minX, maxX);

    this.setPlayerState(player, 'walk');

    this.tweens.add({
      targets: [sprite, shadow],
      x: clampedTarget,
      duration: 300,
      ease: 'Linear',
      onComplete: () => {
        this.setPlayerState(player, 'idle');
        this.setPlayerTexture(player, 'idle');
      }
    });
  }

  doAttack(player: number) {
    if ((player === 1 && this.p1ActionLock) || (player === 2 && this.p2ActionLock)) return;

    // Lock actions during attack
    if (player === 1) this.p1ActionLock = true;
    else this.p2ActionLock = true;

    // Choose attack type
    const attackType = Phaser.Math.RND.pick(['attack1', 'attack2', 'special']);
    this.setPlayerTexture(player, attackType);
    this.setPlayerState(player, 'attack');

    const dist = Math.abs(this.player1.x - this.player2.x);
    const attackRange = attackType === 'special' ? 200 : 150;

    if (dist < attackRange) {
      this.time.delayedCall(100, () => {
        const target = player === 1 ? 2 : 1;
        const baseDamage = attackType === 'special' ? 60 : attackType === 'attack2' ? 45 : 30;
        const damage = baseDamage + Phaser.Math.Between(0, 20);
        this.applyDamage(target, damage);
      });
    }

    const recoveryTime = attackType === 'special' ? 500 : 300;
    this.time.delayedCall(recoveryTime, () => {
      if (player === 1) this.p1ActionLock = false;
      else this.p2ActionLock = false;
      this.setPlayerTexture(player, 'idle');
      this.setPlayerState(player, 'idle');
    });
  }

  applyDamage(target: number, damage: number) {
    const sprite = target === 1 ? this.player1 : this.player2;

    if (target === 1) {
      this.health1 = Math.max(0, this.health1 - damage);
    } else {
      this.health2 = Math.max(0, this.health2 - damage);
    }
    this.updateHealthBars(this.scale.width);

    this.setPlayerTexture(target, 'hit');
    this.setPlayerState(target, 'hit');

    // Flash white
    sprite.setTint(0xffffff);
    this.time.delayedCall(80, () => sprite.clearTint());

    // Knockback
    const dir = target === 1 ? -1 : 1;
    this.tweens.add({
      targets: sprite,
      x: sprite.x + dir * 30,
      duration: 80,
      ease: 'Power2'
    });

    this.showDamageNumber(sprite.x, sprite.y - 80, damage);
    this.createHitSpark(sprite.x + dir * -20, sprite.y - 60);

    // Camera shake for big hits
    if (damage >= 50) {
      this.cameras.main.shake(100, 0.005);
    }

    this.time.delayedCall(200, () => {
      if ((target === 1 && this.health1 > 0) || (target === 2 && this.health2 > 0)) {
        this.setPlayerTexture(target, 'idle');
        this.setPlayerState(target, 'idle');
      } else {
        this.doKO(target);
      }
    });
  }

  doRetreat(player: number) {
    if ((player === 1 && this.p1ActionLock) || (player === 2 && this.p2ActionLock)) return;

    const sprite = player === 1 ? this.player1 : this.player2;
    const shadow = player === 1 ? this.player1Shadow : this.player2Shadow;
    const retreatDist = 80;
    const target = player === 1 ? sprite.x - retreatDist : sprite.x + retreatDist;

    const minX = 100;
    const maxX = this.scale.width - 100;
    const clampedTarget = Phaser.Math.Clamp(target, minX, maxX);

    this.setPlayerState(player, 'walk');

    this.tweens.add({
      targets: [sprite, shadow],
      x: clampedTarget,
      duration: 250,
      ease: 'Linear',
      onComplete: () => {
        this.setPlayerState(player, 'idle');
        this.setPlayerTexture(player, 'idle');
      }
    });
  }

  doJump(player: number) {
    if ((player === 1 && this.p1ActionLock) || (player === 2 && this.p2ActionLock)) return;

    if (player === 1) this.p1ActionLock = true;
    else this.p2ActionLock = true;

    const sprite = player === 1 ? this.player1 : this.player2;
    const startY = sprite.y;

    this.setPlayerTexture(player, 'jump');
    this.setPlayerState(player, 'jump');

    this.tweens.add({
      targets: sprite,
      y: startY - 100,
      duration: 200,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        if (player === 1) this.p1ActionLock = false;
        else this.p2ActionLock = false;
        this.setPlayerTexture(player, 'idle');
        this.setPlayerState(player, 'idle');
      }
    });
  }

  doKO(loser: number) {
    this.isRunning = false;

    this.setPlayerTexture(loser, 'ko');
    this.setPlayerState(loser, 'ko');

    const sprite = loser === 1 ? this.player1 : this.player2;

    // Fall down animation
    this.tweens.add({
      targets: sprite,
      angle: loser === 1 ? -90 : 90,
      y: sprite.y + 30,
      duration: 400,
      ease: 'Bounce.easeOut'
    });
    sprite.setAlpha(0.8);

    const { width, height } = this.scale;

    // Screen flash
    this.cameras.main.flash(200, 255, 255, 255);

    const koText = this.add.text(width / 2, height / 2, 'K.O.!', {
      fontSize: '80px',
      fontFamily: 'Arial Black',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 10,
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: koText,
      scale: 1,
      duration: 400,
      ease: 'Bounce.easeOut'
    });

    const winner = loser === 1 ? 'NeuralKnight' : 'AlphaBot';
    this.time.delayedCall(1500, () => {
      this.add.text(width / 2, height / 2 + 70, `${winner} WINS!`, {
        fontSize: '40px',
        fontFamily: 'Arial Black',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 6,
      }).setOrigin(0.5);

      this.time.delayedCall(3000, () => this.scene.restart());
    });
  }

  showDamageNumber(x: number, y: number, damage: number) {
    const color = damage >= 50 ? '#ff4444' : '#ffff00';
    const text = this.add.text(x, y, damage.toString(), {
      fontSize: damage >= 50 ? '40px' : '32px',
      fontFamily: 'Arial Black',
      color: color,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      scale: damage >= 50 ? 1.3 : 1,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  createHitSpark(x: number, y: number) {
    // Star burst
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i;
      const len = 35;

      const line = this.add.line(x, y, 0, 0, Math.cos(angle) * len, Math.sin(angle) * len, 0xffff00);
      line.setLineWidth(4);

      this.tweens.add({
        targets: line,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 150,
        onComplete: () => line.destroy()
      });
    }

    // Impact flash
    const flash = this.add.circle(x, y, 25, 0xffffff, 1);
    this.tweens.add({
      targets: flash,
      scale: 3,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy()
    });

    // Particles
    for (let i = 0; i < 6; i++) {
      const particle = this.add.circle(x, y, 4, 0xffaa00, 1);
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 60;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.3,
        duration: 300,
        onComplete: () => particle.destroy()
      });
    }
  }
}

export default function DemoGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1280,
      height: 600,
      parent: containerRef.current,
      backgroundColor: '#050510',
      scene: DemoScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[600px] rounded-xl overflow-hidden" />
  );
}
