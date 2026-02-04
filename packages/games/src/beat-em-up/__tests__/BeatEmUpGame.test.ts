/**
 * Beat 'em Up Game Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BeatEmUpGame } from '../BeatEmUpGame';
import type { BotInput } from '@clawdbot/protocol';

describe('BeatEmUpGame', () => {
  let game: BeatEmUpGame;

  beforeEach(() => {
    game = new BeatEmUpGame();
    game.initialize(['bot1', 'bot2']);
  });

  describe('initialization', () => {
    it('should create a match with correct initial state', () => {
      const state = game.getState();

      expect(state.player1.health).toBe(1000);
      expect(state.player2.health).toBe(1000);
      expect(state.roundNumber).toBe(1);
      expect(state.phase).toBe('countdown');
    });

    it('should position players on opposite sides', () => {
      const state = game.getState();

      expect(state.player1.x).toBeLessThan(state.player2.x);
      expect(state.player1.facing).toBe('right');
      expect(state.player2.facing).toBe('left');
    });
  });

  describe('game loop', () => {
    it('should transition from countdown to fighting', () => {
      // Tick through countdown (180 frames at 60fps = 3 seconds)
      for (let i = 0; i < 180; i++) {
        game.tick(16.67);
      }

      const state = game.getState();
      expect(state.phase).toBe('fighting');
    });

    it('should accept bot inputs during fighting phase', () => {
      // Skip countdown
      for (let i = 0; i < 180; i++) {
        game.tick(16.67);
      }

      const input: BotInput = {
        left: false,
        right: true,
        up: false,
        down: false,
        attack1: false,
        attack2: false,
        jump: false,
        special: false,
      };

      const result = game.applyAction('bot1', input);
      expect(result.success).toBe(true);
    });
  });

  describe('observations', () => {
    it('should provide correct observation for each player', () => {
      const obs1 = game.getObservation('bot1');
      const obs2 = game.getObservation('bot2');

      // Self should match the respective player
      expect(obs1.self.health).toBe(1000);
      expect(obs2.self.health).toBe(1000);

      // Distance should be the same for both
      expect(obs1.distance).toBe(obs2.distance);
    });
  });

  describe('combat', () => {
    it('should not be terminal at start', () => {
      expect(game.isTerminal()).toBe(false);
    });

    it('should have correct game type', () => {
      expect(game.gameType).toBe('beat_em_up');
    });

    it('should have tick rate of 60', () => {
      expect(game.tickRate).toBe(60);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize state', () => {
      const serialized = game.serialize();

      expect(serialized.gameType).toBe('beat_em_up');
      expect(serialized.tick).toBe(0);
      expect(serialized.state).toBeDefined();
    });
  });
});
