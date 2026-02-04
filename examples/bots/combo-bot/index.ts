/**
 * Combo Bot
 * ==========
 * Strategy: Execute attack chains for maximum damage per opening.
 * Approaches the opponent, waits for an opening, then executes a
 * pre-defined combo sequence: attack1 -> attack2 -> special.
 *
 * The bot operates as a state machine:
 *   APPROACH -> ENGAGE -> COMBO (attack1 -> attack2 -> special) -> RECOVER -> APPROACH
 *
 * Strengths:
 *   - Very high burst damage when combos connect
 *   - Efficient use of openings -- gets maximum value per hit
 *
 * Weaknesses:
 *   - Predictable patterns can be exploited by adaptive bots
 *   - If the combo is interrupted, the bot needs time to reset
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
  console.error('Usage: BOT_ID=bot_xxx API_KEY=claw_xxx tsx combo-bot/index.ts');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

type BotState = 'approach' | 'engage' | 'combo_1' | 'combo_2' | 'combo_3' | 'recover';

/** Persistent state across frames */
let currentState: BotState = 'approach';
let comboStartFrame = 0;
let recoverUntilFrame = 0;

/** Number of frames each combo step takes before transitioning */
const COMBO_STEP_DURATION = 4;

/** Recovery frames after a combo completes */
const RECOVERY_DURATION = 10;

/** Engage range -- close enough to start a combo */
const ENGAGE_RANGE = 50;

/** Approach range -- start engaging when within this distance */
const APPROACH_TARGET = 70;

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
  const frame = obs.frameNumber;

  if (!self.canAct) return input;

  const dx = opp.position.x - self.position.x;
  const distance = Math.abs(dx);
  const opponentIsToRight = dx > 0;

  // Helper: move toward opponent
  function moveToward() {
    if (opponentIsToRight) {
      input.right = true;
    } else {
      input.left = true;
    }
  }

  // Helper: move away from opponent
  function moveAway() {
    if (opponentIsToRight) {
      input.left = true;
    } else {
      input.right = true;
    }
  }

  // State transitions based on conditions
  switch (currentState) {
    // ----- APPROACH: Move toward the opponent until in engage range -----
    case 'approach': {
      moveToward();

      // Jump to close distance faster when far away
      if (distance > 120) {
        input.jump = true;
      }

      // Transition to engage when close enough
      if (distance <= APPROACH_TARGET) {
        currentState = 'engage';
      }
      break;
    }

    // ----- ENGAGE: Wait for an opening to start the combo -----
    case 'engage': {
      // Stay at engage range
      if (distance > ENGAGE_RANGE + 10) {
        moveToward();
      } else if (distance < ENGAGE_RANGE - 20) {
        moveAway();
      }

      // Start combo if:
      //   1. Opponent is vulnerable (recovery frames, whiffed attack)
      //   2. Opponent is not blocking
      //   3. We are close enough
      const canStartCombo =
        distance <= ENGAGE_RANGE &&
        (opp.isVulnerable || !opp.isBlocking);

      if (canStartCombo) {
        currentState = 'combo_1';
        comboStartFrame = frame;
        // Move in for the combo
        moveToward();
        input.attack1 = true; // Start with light attack
      }

      // If opponent got too far, go back to approach
      if (distance > APPROACH_TARGET + 30) {
        currentState = 'approach';
      }
      break;
    }

    // ----- COMBO STEP 1: Light attack (attack1) -----
    case 'combo_1': {
      moveToward(); // Stay close during combo
      input.attack1 = true;

      // After a few frames, chain into step 2
      if (frame - comboStartFrame >= COMBO_STEP_DURATION) {
        currentState = 'combo_2';
      }
      break;
    }

    // ----- COMBO STEP 2: Heavy attack (attack2) -----
    case 'combo_2': {
      moveToward();
      input.attack2 = true;

      // After a few frames, chain into step 3 (finisher)
      if (frame - comboStartFrame >= COMBO_STEP_DURATION * 2) {
        currentState = 'combo_3';
      }
      break;
    }

    // ----- COMBO STEP 3: Special finisher -----
    case 'combo_3': {
      moveToward();

      // Use special if we have enough magic; otherwise use attack1+attack2
      if (self.magic >= 25) {
        input.special = true;
      } else {
        input.attack1 = true;
        input.attack2 = true;
      }

      // After the finisher, enter recovery
      if (frame - comboStartFrame >= COMBO_STEP_DURATION * 3) {
        currentState = 'recover';
        recoverUntilFrame = frame + RECOVERY_DURATION;
      }
      break;
    }

    // ----- RECOVER: Back off after combo to reset -----
    case 'recover': {
      moveAway();

      // Block during recovery in case opponent retaliates
      if (opp.isAttacking) {
        input.down = true;
      }

      if (frame >= recoverUntilFrame) {
        currentState = 'approach';
      }
      break;
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
  console.log(`[ComboBot] Match started against ${info.opponentName} (${info.opponentRating})`);
  // Reset state for new match
  currentState = 'approach';
  comboStartFrame = 0;
  recoverUntilFrame = 0;
});

client.onMatchEnd((info) => {
  const won = info.winnerId === BOT_ID;
  console.log(`[ComboBot] Match ended. ${won ? 'WIN' : 'LOSS'}. Rating change: ${info.ratingChange}`);

  setTimeout(() => {
    client.joinMatchmaking('ranked');
  }, 2000);
});

client.onError((err) => {
  console.error('[ComboBot] Error:', err.message);
});

async function main() {
  console.log('[ComboBot] Connecting to arena...');
  await client.connect();
  console.log('[ComboBot] Connected! Joining matchmaking...');
  client.joinMatchmaking('ranked');
}

main().catch((err) => {
  console.error('[ComboBot] Fatal error:', err);
  process.exit(1);
});
