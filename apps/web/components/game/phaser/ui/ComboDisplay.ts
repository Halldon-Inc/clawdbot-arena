/**
 * Combo Display
 * Shows combo counter with flashy animations
 */

import Phaser from 'phaser';

export class ComboDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private hitText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text;
  private currentCombo = 0;
  private displayTimer = 0;
  private isVisible = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Create container
    this.container = scene.add.container(x, y);
    this.container.setAlpha(0);

    // Combo number
    this.hitText = scene.add.text(0, 0, '0', {
      fontSize: '72px',
      fontFamily: 'Arial Black',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 6,
    });
    this.hitText.setOrigin(0.5);

    // "HIT COMBO!" text
    this.comboText = scene.add.text(0, 50, 'HIT COMBO!', {
      fontSize: '24px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.comboText.setOrigin(0.5);

    this.container.add([this.hitText, this.comboText]);
  }

  /**
   * Show combo with given count
   */
  show(hitCount: number): void {
    this.currentCombo = hitCount;
    this.hitText.setText(hitCount.toString());
    this.displayTimer = 2000; // Show for 2 seconds
    this.isVisible = true;

    // Scale based on combo size
    const scale = Math.min(1 + (hitCount - 2) * 0.1, 2);

    // Animate in
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: scale,
      duration: 100,
      ease: 'Back.easeOut',
    });

    // Color based on combo size
    let color = '#ffd700'; // Gold
    if (hitCount >= 10) {
      color = '#ff00ff'; // Magenta for big combos
    } else if (hitCount >= 5) {
      color = '#ff6600'; // Orange
    }
    this.hitText.setColor(color);

    // Shake effect
    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x + Math.random() * 10 - 5,
      y: this.container.y + Math.random() * 10 - 5,
      duration: 50,
      yoyo: true,
      repeat: 2,
    });
  }

  /**
   * Hide the display
   */
  hide(): void {
    this.isVisible = false;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.5,
      duration: 200,
      ease: 'Back.easeIn',
    });
  }

  /**
   * Update (call each frame)
   */
  update(delta: number): void {
    if (this.isVisible) {
      this.displayTimer -= delta;

      if (this.displayTimer <= 0) {
        this.hide();
      } else if (this.displayTimer < 500) {
        // Fade out
        this.container.setAlpha(this.displayTimer / 500);
      }
    }
  }

  /**
   * Get current combo count
   */
  getCombo(): number {
    return this.currentCombo;
  }

  /**
   * Reset combo
   */
  reset(): void {
    this.currentCombo = 0;
    this.hide();
  }
}
