/**
 * Random Bot
 * ===========
 * Strategy: Completely random inputs every frame. This bot serves as a
 * baseline for measuring the performance of other bots. Any bot that
 * consistently loses to the random bot has fundamental issues.
 *
 * Each frame, every input (left, right, up, down, attack1, attack2, jump,
 * special) is independently set to true/false with 50% probability.
 *
 * Strengths:
 *   - Completely unpredictable (for whatever that's worth)
 *   - Zero development time -- instant baseline
 *
 * Weaknesses:
 *   - No strategy at all
 *   - Contradictory inputs (left + right simultaneously)
 *   - Wastes special meter on random frames
 *   - Will lose to any bot with even minimal strategy
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
  console.error('Usage: BOT_ID=bot_xxx API_KEY=claw_xxx tsx random-bot/index.ts');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Bot Logic
// ---------------------------------------------------------------------------

/**
 * Generate a completely random set of inputs.
 * Each boolean has a 50% chance of being true.
 */
function decide(_obs: BotObservation): BotInput {
  return {
    left: Math.random() > 0.5,
    right: Math.random() > 0.5,
    up: Math.random() > 0.5,
    down: Math.random() > 0.5,
    attack1: Math.random() > 0.5,
    attack2: Math.random() > 0.5,
    jump: Math.random() > 0.5,
    special: Math.random() > 0.5,
  };
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
  console.log(`[RandomBot] Match started against ${info.opponentName} (${info.opponentRating})`);
});

client.onMatchEnd((info) => {
  const won = info.winnerId === BOT_ID;
  console.log(`[RandomBot] Match ended. ${won ? 'WIN' : 'LOSS'}. Rating change: ${info.ratingChange}`);

  // Re-queue for the next match
  setTimeout(() => {
    client.joinMatchmaking('ranked');
  }, 2000);
});

client.onError((err) => {
  console.error('[RandomBot] Error:', err.message);
});

async function main() {
  console.log('[RandomBot] Connecting to arena...');
  await client.connect();
  console.log('[RandomBot] Connected! Joining matchmaking...');
  client.joinMatchmaking('ranked');
}

main().catch((err) => {
  console.error('[RandomBot] Fatal error:', err);
  process.exit(1);
});
