/**
 * Adaptive Bot
 * =============
 * Strategy: Track opponent patterns over the course of a match and adjust
 * behavior accordingly. Starts neutral, then shifts to exploit the opponent's
 * tendencies.
 *
 * Pattern tracking:
 *   - Counts how often the opponent attacks, blocks, and moves
 *   - Classifies the opponent as aggressive, defensive, or balanced
 *   - Adjusts playstyle: defensive against aggressive, aggressive against
 *     defensive, combo-focused against balanced
 *
 * Strengths:
 *   - Versatile -- can handle many different opponent types
 *   - Gets stronger as the match progresses and more data is collected
 *   - Hard to predict because it mirrors the opponent's weaknesses
 *
 * Weaknesses:
 *   - Slower to optimize in short matches (needs data to adapt)
 *   - The initial neutral phase may get punished by pure aggression
 */

import { ArenaClient } from '@clawdbot/arena-sdk';
import type { BotObservation, BotInput } from '@clawdbot/protocol';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BOT_ID = process.env.BOT_ID || '';
const API_KEY = process.env.API_KEY || '';
const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080/ws/bot';

if (!BOT_ID || !API_KEY) {
  console.error('Error: BOT_ID and API_KEY environment variables are required.');
  console.error('Usage: BOT_ID=bot_xxx API_KEY=claw_xxx tsx adaptive-bot/index.ts');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Opponent Pattern Tracker
// ---------------------------------------------------------------------------

interface OpponentProfile {
  /** How many frames the opponent has spent attacking */
  attackFrames: number;
  /** How many frames the opponent has spent blocking */
  blockFrames: number;
  /** How many frames the opponent was vulnerable (recovery) */
  vulnerableFrames: number;
  /** Total frames observed */
  totalFrames: number;
  /** Tracks the last N distances to detect approach/retreat patterns */
  recentDistances: number[];
  /** Opponent's average position (for predicting movement) */
  avgPositionX: number;
}

type OpponentStyle = 'aggressive' | 'defensive' | 'balanced';

/** How many frames of data we need before adapting */
const ANALYSIS_THRESHOLD = 60;

/** Rolling window for recent distance tracking */
const DISTANCE_WINDOW = 30;

let profile: OpponentProfile = {
  attackFrames: 0,
  blockFrames: 0,
  vulnerableFrames: 0,
  totalFrames: 0,
  recentDistances: [],
  avgPositionX: 0,
};

function resetProfile(): void {
  profile = {
    attackFrames: 0,
    blockFrames: 0,
    vulnerableFrames: 0,
    totalFrames: 0,
    recentDistances: [],
    avgPositionX: 0,
  };
}

/**
 * Update the opponent profile based on the current observation.
 */
function updateProfile(obs: BotObservation): void {
  const opp = obs.opponent;

  profile.totalFrames++;

  if (opp.isAttacking) profile.attackFrames++;
  if (opp.isBlocking) profile.blockFrames++;
  if (opp.isVulnerable) profile.vulnerableFrames++;

  // Track distances
  const dx = Math.abs(opp.position.x - obs.self.position.x);
  profile.recentDistances.push(dx);
  if (profile.recentDistances.length > DISTANCE_WINDOW) {
    profile.recentDistances.shift();
  }

  // Running average of opponent X position
  profile.avgPositionX =
    profile.avgPositionX * 0.95 + opp.position.x * 0.05;
}

/**
 * Classify the opponent's style based on collected data.
 */
function classifyOpponent(): OpponentStyle {
  if (profile.totalFrames < ANALYSIS_THRESHOLD) {
    return 'balanced'; // Not enough data yet
  }

  const attackRate = profile.attackFrames / profile.totalFrames;
  const blockRate = profile.blockFrames / profile.totalFrames;

  // Aggressive: attacks more than 30% of the time
  if (attackRate > 0.30) return 'aggressive';

  // Defensive: blocks more than 20% of the time and attacks less than 15%
  if (blockRate > 0.20 && attackRate < 0.15) return 'defensive';

  return 'balanced';
}

/**
 * Check if opponent is approaching (distance decreasing over time).
 */
function opponentIsApproaching(): boolean {
  const dists = profile.recentDistances;
  if (dists.length < 10) return false;

  const recentAvg =
    dists.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const olderAvg =
    dists.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

  return recentAvg < olderAvg - 5; // Distance is shrinking
}

// ---------------------------------------------------------------------------
// Strategy Functions
// ---------------------------------------------------------------------------

/**
 * Anti-aggressive strategy: defensive posture, counter-attack on whiffs.
 */
function playAntiAggressive(obs: BotObservation, input: BotInput): void {
  const self = obs.self;
  const opp = obs.opponent;
  const dx = opp.position.x - self.position.x;
  const distance = Math.abs(dx);
  const oppRight = dx > 0;

  // Block when opponent attacks
  if (opp.isAttacking && distance < 80) {
    if (oppRight) input.left = true;
    else input.right = true;
    input.down = true;
    return;
  }

  // Counter-attack when opponent is vulnerable
  if (opp.isVulnerable && distance < 70) {
    if (oppRight) input.right = true;
    else input.left = true;
    input.attack2 = true; // Heavy punish
    return;
  }

  // Keep safe distance
  if (distance < 50) {
    if (oppRight) input.left = true;
    else input.right = true;
    if (distance < 30) input.jump = true;
  } else if (distance > 100) {
    if (oppRight) input.right = true;
    else input.left = true;
  }

  // Occasional safe poke
  if (distance > 50 && distance < 80 && obs.frameNumber % 10 === 0) {
    input.attack1 = true;
  }
}

/**
 * Anti-defensive strategy: apply pressure, use throws/grabs, mix up attacks.
 */
function playAntiDefensive(obs: BotObservation, input: BotInput): void {
  const self = obs.self;
  const opp = obs.opponent;
  const dx = opp.position.x - self.position.x;
  const distance = Math.abs(dx);
  const oppRight = dx > 0;

  // Aggressively close distance
  if (oppRight) input.right = true;
  else input.left = true;

  if (distance > 100) {
    input.jump = true; // Close gap fast
    return;
  }

  // At close range, mix up attacks to break through blocking
  if (distance < 60) {
    const cycle = obs.frameNumber % 6;

    switch (cycle) {
      case 0:
      case 1:
        // Low attack (crouch + attack1) to hit low blockers
        input.down = true;
        input.attack1 = true;
        break;
      case 2:
      case 3:
        // Overhead (jump + attack2) to hit high blockers
        input.jump = true;
        input.attack2 = true;
        break;
      case 4:
        // Special -- often goes through blocks
        if (self.magic >= 25) {
          input.special = true;
        } else {
          input.attack1 = true;
        }
        break;
      case 5:
        // Pause briefly to bait a counter, then punish
        break;
    }
  }
}

/**
 * Anti-balanced strategy: play a combo-focused game looking for openings.
 */
function playAntiBalanced(obs: BotObservation, input: BotInput): void {
  const self = obs.self;
  const opp = obs.opponent;
  const dx = opp.position.x - self.position.x;
  const distance = Math.abs(dx);
  const oppRight = dx > 0;

  // Approach to mid range
  if (distance > 70) {
    if (oppRight) input.right = true;
    else input.left = true;
    if (distance > 120) input.jump = true;
    return;
  }

  // Look for openings and launch combos
  if (opp.isVulnerable && distance < 60) {
    if (oppRight) input.right = true;
    else input.left = true;

    // 3-hit combo chain
    const comboFrame = obs.frameNumber % 12;
    if (comboFrame < 4) {
      input.attack1 = true;
    } else if (comboFrame < 8) {
      input.attack2 = true;
    } else {
      if (self.magic >= 25) {
        input.special = true;
      } else {
        input.attack1 = true;
        input.attack2 = true;
      }
    }
    return;
  }

  // When approaching, poke with safe attacks
  if (distance < 70 && distance > 40) {
    if (obs.frameNumber % 5 === 0) {
      input.attack1 = true;
    }

    // Maintain spacing
    if (distance < 45) {
      if (oppRight) input.left = true;
      else input.right = true;
    }
  }

  // Block if they attack
  if (opp.isAttacking && distance < 60) {
    if (oppRight) input.left = true;
    else input.right = true;
  }
}

// ---------------------------------------------------------------------------
// Main Decision Function
// ---------------------------------------------------------------------------

function decide(obs: BotObservation): BotInput {
  const input: BotInput = {
    left: false,
    right: false,
    up: false,
    down: false,
    attack1: false,
    attack2: false,
    jump: false,
    special: false,
  };

  if (!obs.self.canAct) return input;

  // Update tracking data
  updateProfile(obs);

  // Classify opponent and choose counter-strategy
  const style = classifyOpponent();

  switch (style) {
    case 'aggressive':
      playAntiAggressive(obs, input);
      break;
    case 'defensive':
      playAntiDefensive(obs, input);
      break;
    case 'balanced':
      playAntiBalanced(obs, input);
      break;
  }

  return input;
}

// ---------------------------------------------------------------------------
// Client Setup
// ---------------------------------------------------------------------------

const client = new ArenaClient({
  botId: BOT_ID,
  apiKey: API_KEY,
  serverUrl: SERVER_URL,
  autoReconnect: true,
});

client.onObservation((obs: BotObservation) => {
  return decide(obs);
});

client.onMatchStart((info) => {
  console.log(`[AdaptiveBot] Match started against ${info.opponentName} (${info.opponentRating})`);
  // Reset opponent profile for the new match
  resetProfile();
});

client.onMatchEnd((info) => {
  const won = info.winnerId === BOT_ID;
  const style = classifyOpponent();
  console.log(
    `[AdaptiveBot] Match ended. ${won ? 'WIN' : 'LOSS'}. ` +
    `Opponent classified as: ${style}. Rating change: ${info.ratingChange}`
  );

  setTimeout(() => {
    client.joinMatchmaking('ranked');
  }, 2000);
});

client.onError((err) => {
  console.error('[AdaptiveBot] Error:', err.message);
});

async function main() {
  console.log('[AdaptiveBot] Connecting to arena...');
  await client.connect();
  console.log('[AdaptiveBot] Connected! Joining matchmaking...');
  client.joinMatchmaking('ranked');
}

main().catch((err) => {
  console.error('[AdaptiveBot] Fatal error:', err);
  process.exit(1);
});
