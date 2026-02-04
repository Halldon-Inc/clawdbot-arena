/**
 * Announcer Text
 * Shows big announcements like "ROUND 1", "FIGHT!", "K.O.!"
 */

import Phaser from 'phaser';

type AnnouncerCallback = () => void;

export class AnnouncerText {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;
  private x: number;
  private y: number;
  private currentCallback: AnnouncerCallback | null = null;
  private hideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    this.text = scene.add.text(x, y, '', {
      fontSize: '96px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: '#000000',
        blur: 8,
        fill: true,
      },
    });
    this.text.setOrigin(0.5);
    this.text.setAlpha(0);
    this.text.setDepth(1000); // Always on top
  }

  /**
   * Show announcement text
   */
  show(message: string, duration: number, callback?: AnnouncerCallback): void {
    // Clear any existing timer
    if (this.hideTimer) {
      this.hideTimer.destroy();
      this.hideTimer = null;
    }

    this.text.setText(message);
    this.currentCallback = callback || null;

    // Determine style based on message
    this.applyStyle(message);

    // Animate in
    this.text.setPosition(this.x, this.y);
    this.text.setScale(2);
    this.text.setAlpha(0);

    this.scene.tweens.add({
      targets: this.text,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Schedule hide
    this.hideTimer = this.scene.time.delayedCall(duration, () => {
      this.hide();
    });
  }

  /**
   * Hide the announcement
   */
  hide(): void {
    this.scene.tweens.add({
      targets: this.text,
      scale: 0.5,
      alpha: 0,
      duration: 150,
      ease: 'Back.easeIn',
      onComplete: () => {
        if (this.currentCallback) {
          this.currentCallback();
          this.currentCallback = null;
        }
      },
    });
  }

  /**
   * Apply visual style based on message content
   */
  private applyStyle(message: string): void {
    const upperMessage = message.toUpperCase();

    if (upperMessage.includes('K.O.') || upperMessage.includes('KO')) {
      // KO style - red and impactful
      this.text.setColor('#ff0000');
      this.text.setFontSize(120);
      this.addShakeEffect();
    } else if (upperMessage.includes('FIGHT')) {
      // Fight style - yellow and energetic
      this.text.setColor('#ffd700');
      this.text.setFontSize(96);
      this.addPulseEffect();
    } else if (upperMessage.includes('ROUND')) {
      // Round style - white and clean
      this.text.setColor('#ffffff');
      this.text.setFontSize(72);
    } else if (upperMessage.includes('WINS')) {
      // Winner style - gold and celebratory
      this.text.setColor('#ffd700');
      this.text.setFontSize(64);
      this.addRainbowEffect();
    } else if (upperMessage.includes('READY')) {
      // Ready style - blue
      this.text.setColor('#4a90d9');
      this.text.setFontSize(72);
    } else if (upperMessage.includes('DRAW')) {
      // Draw style - gray
      this.text.setColor('#888888');
      this.text.setFontSize(72);
    } else {
      // Default style
      this.text.setColor('#ffffff');
      this.text.setFontSize(72);
    }
  }

  /**
   * Add shake effect
   */
  private addShakeEffect(): void {
    this.scene.tweens.add({
      targets: this.text,
      x: this.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.text.setX(this.x);
      },
    });
  }

  /**
   * Add pulse effect
   */
  private addPulseEffect(): void {
    this.scene.tweens.add({
      targets: this.text,
      scale: 1.1,
      duration: 100,
      yoyo: true,
      repeat: 2,
    });
  }

  /**
   * Add rainbow color effect for winner
   */
  private addRainbowEffect(): void {
    const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'];
    let colorIndex = 0;

    const colorTimer = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        this.text.setColor(colors[colorIndex % colors.length]);
        colorIndex++;
      },
      repeat: 20,
    });
  }
}
