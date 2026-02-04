/**
 * Phaser Arena Scene
 * Main game scene for rendering matches
 */

import Phaser from 'phaser';
import type { ArenaMatchState, DamageEvent, KOEvent } from '@clawdbot/protocol';
import { FighterSprite } from './sprites/FighterSprite';
import { EffectsManager } from './sprites/EffectsManager';
import { ComboDisplay } from './ui/ComboDisplay';
import { AnnouncerText } from './ui/AnnouncerText';

// Asset paths
const ASSET_BASE = '/assets';

export class PhaserArenaScene extends Phaser.Scene {
  // Game objects
  private player1Sprite!: FighterSprite;
  private player2Sprite!: FighterSprite;
  private effectsManager!: EffectsManager;
  private comboDisplayP1!: ComboDisplay;
  private comboDisplayP2!: ComboDisplay;
  private announcerText!: AnnouncerText;

  // Background layers
  private bgFar!: Phaser.GameObjects.Image;
  private bgMid!: Phaser.GameObjects.Image;
  private bgNear!: Phaser.GameObjects.Image;

  // UI elements
  private healthBarP1!: Phaser.GameObjects.Graphics;
  private healthBarP2!: Phaser.GameObjects.Graphics;
  private healthBarBgP1!: Phaser.GameObjects.Image;
  private healthBarBgP2!: Phaser.GameObjects.Image;
  private magicBarP1!: Phaser.GameObjects.Graphics;
  private magicBarP2!: Phaser.GameObjects.Graphics;
  private timerDisplay!: Phaser.GameObjects.Image;
  private timerText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private nameTextP1!: Phaser.GameObjects.Text;
  private nameTextP2!: Phaser.GameObjects.Text;
  private roundIndicators!: Phaser.GameObjects.Graphics;
  private portraitP1!: Phaser.GameObjects.Image;
  private portraitP2!: Phaser.GameObjects.Image;

  // State
  private currentState: ArenaMatchState | null = null;
  private demoMode = false;
  private demoTimer = 0;
  private currentArena: 'cyber-colosseum' | 'factory-floor' | 'digital-void' = 'cyber-colosseum';

  // Constants
  private readonly STAGE_WIDTH = 1280;
  private readonly STAGE_HEIGHT = 720;
  private readonly GROUND_Y = 550;
  private readonly HEALTH_BAR_WIDTH = 400;
  private readonly HEALTH_BAR_HEIGHT = 30;

  constructor() {
    super({ key: 'ArenaScene' });
  }

  init(data: { arena?: string }): void {
    if (data.arena) {
      this.currentArena = data.arena as typeof this.currentArena;
    }
  }

  preload(): void {
    // Load fighter sprites
    const fighters = ['alphabot', 'neuralknight', 'quantumfist', 'ironlogic'];
    const animations = ['idle', 'walk', 'jump', 'attack1', 'attack2', 'special', 'hit', 'ko'];

    for (const fighter of fighters) {
      // Load individual animation frames
      for (const anim of animations) {
        this.load.image(
          `${fighter}_${anim}`,
          `${ASSET_BASE}/sprites/fighters/${fighter}/${anim}.png`
        );
      }
      // Load portrait
      this.load.image(
        `${fighter}_portrait`,
        `${ASSET_BASE}/sprites/fighters/${fighter}/portrait.png`
      );
    }

    // Load background layers for all arenas
    const arenas = ['cyber-colosseum', 'factory-floor', 'digital-void'];
    for (const arena of arenas) {
      this.load.image(`${arena}_far`, `${ASSET_BASE}/backgrounds/${arena}/layer1-far.png`);
      this.load.image(`${arena}_mid`, `${ASSET_BASE}/backgrounds/${arena}/layer2-mid.png`);
      this.load.image(`${arena}_near`, `${ASSET_BASE}/backgrounds/${arena}/layer3-near.png`);
    }

    // Load UI elements
    this.load.image('health_bar', `${ASSET_BASE}/ui/health-bar.png`);
    this.load.image('combo_counter', `${ASSET_BASE}/ui/combo-counter.png`);
    this.load.image('round_indicators', `${ASSET_BASE}/ui/round-indicators.png`);
    this.load.image('announcer_text', `${ASSET_BASE}/ui/announcer-text.png`);
    this.load.image('timer', `${ASSET_BASE}/ui/timer.png`);
    this.load.image('betting_frame', `${ASSET_BASE}/ui/betting-frame.png`);

    // Load effects
    const effects = ['hit-spark', 'heavy-hit', 'block', 'dust', 'ko-explosion', 'energy-charge'];
    for (const effect of effects) {
      // Load the spritesheet version
      this.load.image(`${effect}`, `${ASSET_BASE}/sprites/effects/${effect}.png`);
      // Load individual frames
      const frameCount = effect === 'block' ? 3 : 4;
      for (let i = 0; i < frameCount; i++) {
        this.load.image(
          `${effect}_${i}`,
          `${ASSET_BASE}/sprites/effects/${effect}/frame_${i.toString().padStart(2, '0')}.png`
        );
      }
    }
  }

  create(): void {
    // Background layers (parallax)
    this.createBackground();

    // Stage/ground
    this.createStage();

    // Initialize effects manager (before fighters so effects render behind)
    this.effectsManager = new EffectsManager(this);

    // Initialize fighter sprites
    this.player1Sprite = new FighterSprite(this, 300, this.GROUND_Y, 'player1', 'alphabot');
    this.player2Sprite = new FighterSprite(this, 980, this.GROUND_Y, 'player2', 'neuralknight');

    // UI
    this.createUI();

    // Combo displays
    this.comboDisplayP1 = new ComboDisplay(this, 200, 150);
    this.comboDisplayP2 = new ComboDisplay(this, 1080, 150);

    // Announcer text
    this.announcerText = new AnnouncerText(this, this.STAGE_WIDTH / 2, this.STAGE_HEIGHT / 2);

    // Initial announcer
    this.announcerText.show('READY', 1500);
  }

  update(time: number, delta: number): void {
    // Update fighter sprites
    this.player1Sprite.update(delta);
    this.player2Sprite.update(delta);

    // Update effects
    this.effectsManager.update(delta);

    // Update combo displays
    this.comboDisplayP1.update(delta);
    this.comboDisplayP2.update(delta);

    // Parallax scrolling based on average fighter position
    if (this.currentState) {
      const avgX = (this.currentState.player1.x + this.currentState.player2.x) / 2;
      const parallaxOffset = (avgX - 960) * 0.1; // 960 = center of game world

      this.bgFar.x = this.STAGE_WIDTH / 2 - parallaxOffset * 0.2;
      this.bgMid.x = this.STAGE_WIDTH / 2 - parallaxOffset * 0.5;
      this.bgNear.x = this.STAGE_WIDTH / 2 - parallaxOffset * 0.8;
    }

    // Demo mode AI
    if (this.demoMode) {
      this.updateDemo(delta);
    }

    // Interpolate positions if we have state
    if (this.currentState) {
      this.interpolatePositions(delta);
    }
  }

  /**
   * Update match state from server
   */
  updateState(state: ArenaMatchState): void {
    const previousState = this.currentState;
    this.currentState = state;

    // Update fighter positions and states
    this.player1Sprite.setTargetState(state.player1);
    this.player2Sprite.setTargetState(state.player2);

    // Update health bars
    this.updateHealthBars(state);

    // Update magic bars
    this.updateMagicBars(state);

    // Update timer
    this.timerText.setText(state.timeRemaining.toString().padStart(2, '0'));

    // Update round display
    this.updateRoundIndicators(state);

    // Update names if first time
    if (!previousState) {
      this.nameTextP1.setText(state.player1BotId.slice(0, 12));
      this.nameTextP2.setText(state.player2BotId.slice(0, 12));
    }
  }

  /**
   * Show damage effect
   */
  showDamageEffect(event: DamageEvent): void {
    const isP1Attacker = event.attackerId === this.currentState?.player1BotId;
    const defender = isP1Attacker ? this.player2Sprite : this.player1Sprite;
    const comboDisplay = isP1Attacker ? this.comboDisplayP1 : this.comboDisplayP2;

    // Hit effect at defender position
    const isHeavyHit = event.damage >= 50;
    this.effectsManager.createHitEffect(defender.x, defender.y - 50, isHeavyHit);

    // Damage number
    this.effectsManager.createDamageNumber(
      defender.x,
      defender.y - 80,
      event.damage,
      event.isCombo
    );

    // Update combo display
    if (event.comboHitNumber > 1) {
      comboDisplay.show(event.comboHitNumber);
    }

    // Flash the defender
    defender.flashHit();

    // Screen shake for big hits
    if (event.damage >= 50) {
      this.cameras.main.shake(100, 0.01);
    }
  }

  /**
   * Show KO effect
   */
  showKOEffect(event: KOEvent): void {
    const isP1Winner = event.winnerId === this.currentState?.player1BotId;
    const loser = isP1Winner ? this.player2Sprite : this.player1Sprite;

    // Big screen shake
    this.cameras.main.shake(500, 0.02);

    // Flash
    this.cameras.main.flash(300, 255, 255, 255);

    // KO effect at loser position
    this.effectsManager.createKOEffect(loser.x, loser.y);

    // Announcer
    this.announcerText.show('K.O.!', 2000);
  }

  /**
   * Show round start
   */
  showRoundStart(roundNumber: number): void {
    this.announcerText.show(`ROUND ${roundNumber}`, 1500, () => {
      this.announcerText.show('FIGHT!', 800);
    });
  }

  /**
   * Show match end
   */
  showMatchEnd(winnerId: string | null): void {
    if (winnerId) {
      const isP1Winner = winnerId === this.currentState?.player1BotId;
      const winnerName = isP1Winner
        ? this.nameTextP1.text
        : this.nameTextP2.text;

      this.announcerText.show(`${winnerName} WINS!`, 3000);
    } else {
      this.announcerText.show('DRAW!', 3000);
    }
  }

  /**
   * Start demo mode
   */
  startDemo(): void {
    this.demoMode = true;
    this.demoTimer = 0;

    // Create fake initial state
    this.currentState = {
      matchId: 'demo',
      player1: {
        health: 1000,
        maxHealth: 1000,
        magic: 0,
        maxMagic: 100,
        x: 300,
        y: this.GROUND_Y,
        vx: 0,
        vy: 0,
        facing: 'right',
        state: 'idle',
        grounded: true,
        canAct: true,
        comboCounter: 0,
        lastAttackFrame: 0,
      },
      player2: {
        health: 1000,
        maxHealth: 1000,
        magic: 0,
        maxMagic: 100,
        x: 980,
        y: this.GROUND_Y,
        vx: 0,
        vy: 0,
        facing: 'left',
        state: 'idle',
        grounded: true,
        canAct: true,
        comboCounter: 0,
        lastAttackFrame: 0,
      },
      player1BotId: 'AlphaBot',
      player2BotId: 'NeuralKnight',
      roundNumber: 1,
      roundsP1: 0,
      roundsP2: 0,
      timeRemaining: 99,
      phase: 'fighting',
      frameNumber: 0,
      winner: null,
    };

    this.updateState(this.currentState);
    this.showRoundStart(1);
  }

  /**
   * Set fighter characters
   */
  setFighters(p1Fighter: string, p2Fighter: string): void {
    this.player1Sprite.setCharacter(p1Fighter);
    this.player2Sprite.setCharacter(p2Fighter);

    // Update portraits
    if (this.textures.exists(`${p1Fighter}_portrait`)) {
      this.portraitP1.setTexture(`${p1Fighter}_portrait`);
    }
    if (this.textures.exists(`${p2Fighter}_portrait`)) {
      this.portraitP2.setTexture(`${p2Fighter}_portrait`);
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private createBackground(): void {
    // Add background layers with scaling to fit screen
    const arena = this.currentArena;

    // Far layer (slowest parallax)
    if (this.textures.exists(`${arena}_far`)) {
      this.bgFar = this.add.image(this.STAGE_WIDTH / 2, 100, `${arena}_far`);
      this.bgFar.setScale(this.STAGE_WIDTH / this.bgFar.width);
      this.bgFar.setDepth(-3);
    } else {
      // Fallback gradient
      const bgFallback = this.add.graphics();
      bgFallback.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
      bgFallback.fillRect(0, 0, this.STAGE_WIDTH, 200);
      this.bgFar = this.add.image(0, 0, '__DEFAULT'); // Placeholder
      this.bgFar.setVisible(false);
    }

    // Mid layer
    if (this.textures.exists(`${arena}_mid`)) {
      this.bgMid = this.add.image(this.STAGE_WIDTH / 2, 250, `${arena}_mid`);
      this.bgMid.setScale(this.STAGE_WIDTH / this.bgMid.width);
      this.bgMid.setDepth(-2);
    } else {
      this.bgMid = this.add.image(0, 0, '__DEFAULT');
      this.bgMid.setVisible(false);
    }

    // Near layer (fastest parallax)
    if (this.textures.exists(`${arena}_near`)) {
      this.bgNear = this.add.image(this.STAGE_WIDTH / 2, 450, `${arena}_near`);
      this.bgNear.setScale(this.STAGE_WIDTH / this.bgNear.width);
      this.bgNear.setDepth(-1);
    } else {
      this.bgNear = this.add.image(0, 0, '__DEFAULT');
      this.bgNear.setVisible(false);
    }

    // Add atmospheric particles
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * this.STAGE_WIDTH;
      const y = Math.random() * this.STAGE_HEIGHT * 0.6;
      const alpha = Math.random() * 0.3 + 0.1;
      this.add.circle(x, y, Math.random() * 2 + 1, 0xffffff, alpha).setDepth(-1);
    }
  }

  private createStage(): void {
    // Ground
    const ground = this.add.graphics();
    ground.fillStyle(0x2d2d44);
    ground.fillRect(0, this.GROUND_Y + 70, this.STAGE_WIDTH, 200);

    // Ground line
    ground.lineStyle(4, 0x4a4a6a);
    ground.lineBetween(50, this.GROUND_Y + 70, this.STAGE_WIDTH - 50, this.GROUND_Y + 70);

    // Arena boundary indicators
    this.add.rectangle(50, this.GROUND_Y, 4, 200, 0x4a90d9, 0.5);
    this.add.rectangle(this.STAGE_WIDTH - 50, this.GROUND_Y, 4, 200, 0xd94a4a, 0.5);
  }

  private createUI(): void {
    const uiY = 50;

    // Player portraits
    if (this.textures.exists('alphabot_portrait')) {
      this.portraitP1 = this.add.image(50, uiY, 'alphabot_portrait');
      this.portraitP1.setScale(0.5);
      this.portraitP1.setOrigin(0, 0.5);
    }
    if (this.textures.exists('neuralknight_portrait')) {
      this.portraitP2 = this.add.image(this.STAGE_WIDTH - 50, uiY, 'neuralknight_portrait');
      this.portraitP2.setScale(0.5);
      this.portraitP2.setOrigin(1, 0.5);
      this.portraitP2.setFlipX(true);
    }

    // Health bar backgrounds
    this.add.rectangle(220, uiY, this.HEALTH_BAR_WIDTH + 6, this.HEALTH_BAR_HEIGHT + 6, 0x000000);
    this.healthBarP1 = this.add.graphics();

    this.add.rectangle(1060, uiY, this.HEALTH_BAR_WIDTH + 6, this.HEALTH_BAR_HEIGHT + 6, 0x000000);
    this.healthBarP2 = this.add.graphics();

    // Magic bars (smaller, below health)
    this.add.rectangle(220, uiY + 30, this.HEALTH_BAR_WIDTH + 6, 12, 0x000000);
    this.magicBarP1 = this.add.graphics();

    this.add.rectangle(1060, uiY + 30, this.HEALTH_BAR_WIDTH + 6, 12, 0x000000);
    this.magicBarP2 = this.add.graphics();

    // Timer background
    if (this.textures.exists('timer')) {
      this.timerDisplay = this.add.image(this.STAGE_WIDTH / 2, uiY, 'timer');
      this.timerDisplay.setScale(1.5);
    }

    // Timer text
    this.timerText = this.add.text(this.STAGE_WIDTH / 2, uiY, '99', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Round text
    this.roundText = this.add.text(this.STAGE_WIDTH / 2, uiY + 45, 'ROUND 1', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Player names
    this.nameTextP1 = this.add.text(100, uiY - 35, 'Player 1', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#4a90d9',
      fontStyle: 'bold',
    });

    this.nameTextP2 = this.add.text(this.STAGE_WIDTH - 100, uiY - 35, 'Player 2', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#d94a4a',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    // Round indicators (dots)
    this.roundIndicators = this.add.graphics();

    // Initial draw
    this.drawHealthBar(this.healthBarP1, 20, uiY - 15, 1, 0x4a90d9, false);
    this.drawHealthBar(this.healthBarP2, 860, uiY - 15, 1, 0xd94a4a, true);
    this.drawMagicBar(this.magicBarP1, 20, uiY + 24, 0, 0x9b59b6, false);
    this.drawMagicBar(this.magicBarP2, 860, uiY + 24, 0, 0x9b59b6, true);
  }

  private drawHealthBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    percent: number,
    color: number,
    flipX: boolean
  ): void {
    graphics.clear();

    const width = this.HEALTH_BAR_WIDTH * Math.max(0, Math.min(1, percent));

    if (flipX) {
      graphics.fillStyle(color);
      graphics.fillRect(x + this.HEALTH_BAR_WIDTH - width, y, width, this.HEALTH_BAR_HEIGHT);
    } else {
      graphics.fillStyle(color);
      graphics.fillRect(x, y, width, this.HEALTH_BAR_HEIGHT);
    }
  }

  private drawMagicBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    percent: number,
    color: number,
    flipX: boolean
  ): void {
    graphics.clear();

    const width = this.HEALTH_BAR_WIDTH * Math.max(0, Math.min(1, percent));

    if (flipX) {
      graphics.fillStyle(color);
      graphics.fillRect(x + this.HEALTH_BAR_WIDTH - width, y, width, 8);
    } else {
      graphics.fillStyle(color);
      graphics.fillRect(x, y, width, 8);
    }
  }

  private updateHealthBars(state: ArenaMatchState): void {
    const p1Percent = state.player1.health / state.player1.maxHealth;
    const p2Percent = state.player2.health / state.player2.maxHealth;

    this.drawHealthBar(this.healthBarP1, 20, 35, p1Percent, 0x4a90d9, false);
    this.drawHealthBar(this.healthBarP2, 860, 35, p2Percent, 0xd94a4a, true);
  }

  private updateMagicBars(state: ArenaMatchState): void {
    const p1Percent = state.player1.magic / state.player1.maxMagic;
    const p2Percent = state.player2.magic / state.player2.maxMagic;

    this.drawMagicBar(this.magicBarP1, 20, 74, p1Percent, 0x9b59b6, false);
    this.drawMagicBar(this.magicBarP2, 860, 74, p2Percent, 0x9b59b6, true);
  }

  private updateRoundIndicators(state: ArenaMatchState): void {
    this.roundIndicators.clear();
    this.roundText.setText(`ROUND ${state.roundNumber}`);

    const centerX = this.STAGE_WIDTH / 2;
    const y = 95;
    const spacing = 20;

    // P1 rounds (left of center)
    for (let i = 0; i < 2; i++) {
      const x = centerX - 60 - i * spacing;
      const won = i < state.roundsP1;
      this.roundIndicators.fillStyle(won ? 0x4a90d9 : 0x333333);
      this.roundIndicators.fillCircle(x, y, 6);
    }

    // P2 rounds (right of center)
    for (let i = 0; i < 2; i++) {
      const x = centerX + 60 + i * spacing;
      const won = i < state.roundsP2;
      this.roundIndicators.fillStyle(won ? 0xd94a4a : 0x333333);
      this.roundIndicators.fillCircle(x, y, 6);
    }
  }

  private interpolatePositions(delta: number): void {
    // Smooth position interpolation is handled by FighterSprite
  }

  private updateDemo(delta: number): void {
    if (!this.currentState) return;

    this.demoTimer += delta;

    // Simple AI: move toward each other and attack randomly
    const p1 = this.currentState.player1;
    const p2 = this.currentState.player2;
    const distance = Math.abs(p2.x - p1.x);

    // Update positions
    if (distance > 150) {
      p1.x += 3;
      p2.x -= 3;
      p1.state = 'walking';
      p2.state = 'walking';
    } else {
      p1.state = 'idle';
      p2.state = 'idle';
    }

    // Random attacks
    if (Math.random() < 0.02 && distance < 200) {
      const attacker = Math.random() < 0.5 ? p1 : p2;
      const defender = attacker === p1 ? p2 : p1;

      attacker.state = 'attacking';

      // Simulate hit
      const damage = Math.floor(Math.random() * 40) + 20;
      defender.health = Math.max(0, defender.health - damage);
      attacker.magic = Math.min(100, attacker.magic + 10);
      defender.state = 'hitstun';

      const attackerId = attacker === p1 ? this.currentState.player1BotId : this.currentState.player2BotId;
      const defenderId = defender === p1 ? this.currentState.player1BotId : this.currentState.player2BotId;

      this.showDamageEffect({
        attackerId,
        defenderId,
        attackType: 'light_1',
        damage,
        isCombo: Math.random() < 0.3,
        comboHitNumber: Math.floor(Math.random() * 3) + 1,
        defenderHealthAfter: defender.health,
        frameNumber: this.currentState.frameNumber++,
      });

      // Reset states after delay
      this.time.delayedCall(300, () => {
        if (this.currentState) {
          this.currentState.player1.state = 'idle';
          this.currentState.player2.state = 'idle';
        }
      });
    }

    // Update timer
    if (this.demoTimer > 1000) {
      this.demoTimer = 0;
      this.currentState.timeRemaining = Math.max(0, this.currentState.timeRemaining - 1);
    }

    // Check for KO
    if (p1.health <= 0 || p2.health <= 0) {
      const winnerId = p1.health > 0
        ? this.currentState.player1BotId
        : this.currentState.player2BotId;

      const loserId = p1.health > 0
        ? this.currentState.player2BotId
        : this.currentState.player1BotId;

      // Set loser to KO state
      if (p1.health <= 0) p1.state = 'ko';
      if (p2.health <= 0) p2.state = 'ko';

      this.showKOEffect({
        winnerId,
        loserId,
        roundNumber: this.currentState.roundNumber,
        winnerHealthRemaining: Math.max(p1.health, p2.health),
        totalDamageDealt: 1000 - Math.max(p1.health, p2.health),
        longestCombo: 5,
        frameNumber: this.currentState.frameNumber,
      });

      // Reset for next round after delay
      this.time.delayedCall(3000, () => {
        if (this.currentState) {
          this.currentState.player1.health = 1000;
          this.currentState.player2.health = 1000;
          this.currentState.player1.x = 300;
          this.currentState.player2.x = 980;
          this.currentState.player1.state = 'idle';
          this.currentState.player2.state = 'idle';
          this.currentState.roundNumber++;
          this.showRoundStart(this.currentState.roundNumber);
        }
      });
    }

    this.updateState(this.currentState);
  }
}
