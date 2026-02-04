/**
 * Simple Arena Bot Example
 *
 * This bot demonstrates basic arena gameplay:
 * - Connecting to the server
 * - Handling observations
 * - Responding with inputs
 *
 * Run with: npx tsx examples/simple-bot.ts
 */

import {
  ArenaClient,
  createInput,
  isOpponentLeft,
  moveTowardOpponent,
  type BotObservation,
  type BotInput,
} from '../src/index.js';

// Configuration - replace with your actual credentials
const BOT_ID = process.env.BOT_ID || 'your_bot_id';
const API_KEY = process.env.API_KEY || 'your_api_key';
const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080/bot';

/**
 * Main bot logic - called every frame
 */
function decideAction(obs: BotObservation): BotInput {
  const { self, opponent, distance, inAttackRange } = obs;

  // If we can't act (in hitstun, knockdown, etc.), just return no input
  if (!self.canAct) {
    return createInput({});
  }

  // If opponent is attacking and we're grounded, block
  if (opponent.isAttacking && self.grounded && distance < 200) {
    return createInput({ down: true });
  }

  // If we're far away, move toward opponent
  if (distance > 180) {
    return moveTowardOpponent(obs);
  }

  // If in attack range and opponent is vulnerable, combo!
  if (inAttackRange && (opponent.isVulnerable || !opponent.isBlocking)) {
    return createInput({ attack1: true });
  }

  // If we have enough magic and opponent is close, use special
  if (self.magic >= 25 && distance < 150 && self.grounded) {
    return createInput({ special: true });
  }

  // If opponent is blocking, try a heavy attack to break it
  if (opponent.isBlocking && inAttackRange) {
    return createInput({ attack2: true });
  }

  // Default: approach carefully
  if (distance > 120) {
    return moveTowardOpponent(obs);
  }

  // At optimal range, wait for an opening
  return createInput({});
}

/**
 * Main entry point
 */
async function main() {
  console.log('Starting simple arena bot...');
  console.log(`Bot ID: ${BOT_ID}`);
  console.log(`Server: ${SERVER_URL}`);

  const client = new ArenaClient({
    botId: BOT_ID,
    apiKey: API_KEY,
    serverUrl: SERVER_URL,
    autoReconnect: true,
  });

  // Set up handlers
  client.onObservation(decideAction);

  client.onMatchStart((info) => {
    console.log(`\n=== Match Starting ===`);
    console.log(`Match ID: ${info.matchId}`);
    console.log(`Opponent: ${info.opponentName} (Rating: ${info.opponentRating})`);
    console.log(`========================\n`);
  });

  client.onMatchEnd((info) => {
    const won = info.winnerId === BOT_ID;
    console.log(`\n=== Match Ended ===`);
    console.log(`Result: ${won ? 'WIN' : info.winnerId ? 'LOSS' : 'DRAW'}`);
    console.log(`New Rating: ${info.yourRating} (${info.ratingChange >= 0 ? '+' : ''}${info.ratingChange})`);
    console.log(`===================\n`);

    // Rejoin matchmaking after match
    setTimeout(() => {
      console.log('Rejoining matchmaking...');
      client.joinMatchmaking('ranked');
    }, 2000);
  });

  client.onError((error) => {
    console.error('Error:', error.message);
  });

  // Connect and join matchmaking
  try {
    await client.connect();
    console.log('Connected! Joining matchmaking...');
    client.joinMatchmaking('ranked');
  } catch (error) {
    console.error('Failed to connect:', error);
    process.exit(1);
  }

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    client.disconnect();
    process.exit(0);
  });
}

main();
