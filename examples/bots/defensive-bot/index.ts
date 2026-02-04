/**
 * Defensive Bot
 * ==============
 * Strategy: Keep distance from the opponent. Block when they are attacking.
 * Only counter-attack when the opponent is vulnerable (after a whiffed attack
 * or during recovery frames). Prioritizes survival over damage.
 *
 * Strengths:
 *   - Very hard to KO due to defensive play
 *   - Punishes overextending aggressive bots effectively
 *   - Wins through attrition and smart counter-attacks
 *
 * Weaknesses:
 *   - Low damage output can lose on time if matches have a timer
 *   - Struggles against patient opponents who don't overcommit
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
  console.error('Usage: BOT_ID=bot_xxx API_KEY=claw_xxx tsx defensive-bot/index.ts');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Preferred distance to keep from the opponent */
const PREFERRED_DISTANCE = 120;

/** Distance at which we start to retreat */
const DANGER_ZONE = 60;

/** Distance within which we counter-attack when opponent is vulnerable */
const COUNTER_RANGE = 70;

// ---------------------------------------------------------------------------
// Bot Logic
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

  const self = obs.self;
  const opp = obs.opponent;

  if (!self.canAct) return input;

  const dx = opp.position.x - self.position.x;
  const distance = Math.abs(dx);
  const opponentIsToRight = dx > 0;

  // --- Priority 1: Block if opponent is attacking us at close range ---
  if (opp.isAttacking && distance < COUNTER_RANGE) {
    // Block by holding the direction AWAY from the opponent
    // (In many fighting games, holding back = block)
    if (opponentIsToRight) {
      input.left = true; // Hold back to block
    } else {
      input.right = true; // Hold back to block
    }
    // Also crouch-block for low attacks
    input.down = true;
    return input;
  }

  // --- Priority 2: Counter-attack when opponent is vulnerable ---
  if (opp.isVulnerable && distance < COUNTER_RANGE) {
    // Rush in and punish
    if (opponentIsToRight) {
      input.right = true;
    } else {
      input.left = true;
    }

    // Use a strong attack (attack2) for maximum punishment damage,
    // or special if we have enough magic
    if (self.magic >= 50) {
      input.special = true;
    } else {
      input.attack2 = true;
    }
    return input;
  }

  // --- Priority 3: Maintain safe distance ---
  if (distance < DANGER_ZONE) {
    // Too close -- retreat
    if (opponentIsToRight) {
      input.left = true; // Move away
    } else {
      input.right = true; // Move away
    }

    // Jump back for faster retreat if opponent is really close
    if (distance < 30) {
      input.jump = true;
    }
    return input;
  }

  if (distance > PREFERRED_DISTANCE + 40) {
    // Too far away -- slowly close distance to stay in counter-attack range
    if (opponentIsToRight) {
      input.right = true;
    } else {
      input.left = true;
    }
    return input;
  }

  // --- Priority 4: Poke from safe distance ---
  // At our preferred distance, throw out safe pokes (attack1) occasionally
  // to chip away at health without overcommitting
  if (distance >= DANGER_ZONE && distance <= COUNTER_RANGE + 20) {
    // Poke every few frames -- don't spam so we stay safe
    if (obs.frameNumber % 8 === 0) {
      // Face the opponent
      if (opponentIsToRight) {
        input.right = true;
      } else {
        input.left = true;
      }
      input.attack1 = true;
    }
  }

  // --- Default: Hold position, stay alert ---
  // Slight adjustment to stay at preferred distance
  if (distance < PREFERRED_DISTANCE - 10) {
    if (opponentIsToRight) {
      input.left = true;
    } else {
      input.right = true;
    }
  } else if (distance > PREFERRED_DISTANCE + 10) {
    if (opponentIsToRight) {
      input.right = true;
    } else {
      input.left = true;
    }
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
  console.log(`[DefensiveBot] Match started against ${info.opponentName} (${info.opponentRating})`);
});

client.onMatchEnd((info) => {
  const won = info.winnerId === BOT_ID;
  console.log(`[DefensiveBot] Match ended. ${won ? 'WIN' : 'LOSS'}. Rating change: ${info.ratingChange}`);

  setTimeout(() => {
    client.joinMatchmaking('ranked');
  }, 2000);
});

client.onError((err) => {
  console.error('[DefensiveBot] Error:', err.message);
});

async function main() {
  console.log('[DefensiveBot] Connecting to arena...');
  await client.connect();
  console.log('[DefensiveBot] Connected! Joining matchmaking...');
  client.joinMatchmaking('ranked');
}

main().catch((err) => {
  console.error('[DefensiveBot] Fatal error:', err);
  process.exit(1);
});
