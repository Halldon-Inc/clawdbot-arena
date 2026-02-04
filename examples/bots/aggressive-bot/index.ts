/**
 * Aggressive Bot
 * ===============
 * Strategy: Rush the opponent relentlessly. Close distance as fast as possible,
 * then spam attack1 and attack2. Jump in when far away to close the gap quickly.
 * Never blocks, never retreats -- pure offense.
 *
 * Strengths:
 *   - High damage output through constant pressure
 *   - Good against passive or defensive bots that don't punish aggression
 *
 * Weaknesses:
 *   - Vulnerable to counter-attacks and well-timed blocks
 *   - Takes a lot of damage due to never blocking
 */

import { ArenaClient } from '@clawdbot/arena-sdk';
import type { BotObservation, BotInput } from '@clawdbot/protocol';

// ---------------------------------------------------------------------------
// Configuration (set via env vars or defaults)
// ---------------------------------------------------------------------------

const BOT_ID = process.env.BOT_ID || '';
const API_KEY = process.env.API_KEY || '';
const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080/ws/bot';

if (!BOT_ID || !API_KEY) {
  console.error('Error: BOT_ID and API_KEY environment variables are required.');
  console.error('Usage: BOT_ID=bot_xxx API_KEY=claw_xxx tsx aggressive-bot/index.ts');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Bot Logic
// ---------------------------------------------------------------------------

/**
 * The core decision function.
 * Receives a frame observation and returns the inputs for that frame.
 */
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

  const self = obs.self;
  const opp = obs.opponent;

  // If we can't act this frame, send empty input
  if (!self.canAct) return input;

  // Calculate horizontal distance to opponent
  const dx = opp.position.x - self.position.x;
  const distance = Math.abs(dx);

  // --- Phase 1: Close the gap ---
  // If we are far from the opponent, rush toward them
  if (distance > 80) {
    // Move toward opponent
    if (dx > 0) {
      input.right = true;
    } else {
      input.left = true;
    }

    // Jump to close distance faster (aerial approach)
    input.jump = true;
    return input;
  }

  // --- Phase 2: Medium range -- charge in with a jump attack ---
  if (distance > 40) {
    // Move toward opponent
    if (dx > 0) {
      input.right = true;
    } else {
      input.left = true;
    }

    // Alternate between attack1 and jump-attack for mix-ups
    if (obs.frameNumber % 3 === 0) {
      input.jump = true;
      input.attack1 = true;
    } else {
      input.attack2 = true;
    }
    return input;
  }

  // --- Phase 3: Close range -- full offense ---
  // We are in striking distance. Spam attacks relentlessly.

  // Slight movement toward opponent to maintain pressure
  if (dx > 0) {
    input.right = true;
  } else {
    input.left = true;
  }

  // Cycle through attack patterns for variety:
  // Frame 0: attack1
  // Frame 1: attack2
  // Frame 2: attack1 + attack2 (heavy combo)
  // Frame 3: special (if we have enough magic)
  const cycle = obs.frameNumber % 4;

  switch (cycle) {
    case 0:
      input.attack1 = true;
      break;
    case 1:
      input.attack2 = true;
      break;
    case 2:
      input.attack1 = true;
      input.attack2 = true;
      break;
    case 3:
      // Use special if we have magic, otherwise keep punching
      if (self.magic >= 30) {
        input.special = true;
      } else {
        input.attack1 = true;
      }
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

// Register the observation handler
client.onObservation((obs: BotObservation) => {
  return decide(obs);
});

client.onMatchStart((info) => {
  console.log(`[AggressiveBot] Match started against ${info.opponentName} (${info.opponentRating})`);
});

client.onMatchEnd((info) => {
  const won = info.winnerId === BOT_ID;
  console.log(`[AggressiveBot] Match ended. ${won ? 'WIN' : 'LOSS'}. Rating change: ${info.ratingChange}`);

  // Re-queue for next match
  setTimeout(() => {
    client.joinMatchmaking('ranked');
  }, 2000);
});

client.onError((err) => {
  console.error('[AggressiveBot] Error:', err.message);
});

// Connect and start matchmaking
async function main() {
  console.log('[AggressiveBot] Connecting to arena...');
  await client.connect();
  console.log('[AggressiveBot] Connected! Joining matchmaking...');
  client.joinMatchmaking('ranked');
}

main().catch((err) => {
  console.error('[AggressiveBot] Fatal error:', err);
  process.exit(1);
});
