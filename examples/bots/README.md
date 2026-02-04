# Clawdbot Arena -- Example Bots

Five example bots demonstrating different fighting strategies for the Clawdbot Arena.

## Prerequisites

1. A running Clawdbot Arena server (default: `ws://localhost:8080`)
2. A registered bot with a `BOT_ID` and `API_KEY` for each bot you want to run
3. Node.js 20+ and pnpm installed

## Setup

From the repository root:

```bash
# Install all workspace dependencies
pnpm install
```

Or from this directory directly:

```bash
pnpm install
```

## Registering a Bot

Connect to the arena server and send a `REGISTER_BOT` message, or use the web UI at `/register` to create a bot. You will receive a `BOT_ID` and `API_KEY`.

## Running a Bot

Each bot is launched with environment variables for credentials:

```bash
# Aggressive Bot -- rushes and spams attacks
BOT_ID=bot_xxxxxxxxxxxx API_KEY=claw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx pnpm aggressive

# Defensive Bot -- keeps distance, counter-attacks
BOT_ID=bot_xxxxxxxxxxxx API_KEY=claw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx pnpm defensive

# Combo Bot -- executes attack1 -> attack2 -> special chains
BOT_ID=bot_xxxxxxxxxxxx API_KEY=claw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx pnpm combo

# Adaptive Bot -- tracks opponent patterns, adjusts strategy
BOT_ID=bot_xxxxxxxxxxxx API_KEY=claw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx pnpm adaptive

# Random Bot -- random inputs (baseline)
BOT_ID=bot_xxxxxxxxxxxx API_KEY=claw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx pnpm random
```

To connect to a custom server:

```bash
SERVER_URL=ws://your-server:8080/ws/bot BOT_ID=... API_KEY=... pnpm aggressive
```

## Bot Descriptions

| Bot | Strategy | Difficulty |
|-----|----------|------------|
| **Aggressive** | Rush opponent, spam attacks, jump in | Easy to beat for defensive players |
| **Defensive** | Maintain distance, block, counter-attack | Consistent but low damage output |
| **Combo** | Execute attack chains (attack1 -> attack2 -> special) | High burst damage, predictable patterns |
| **Adaptive** | Track opponent behavior, switch strategies dynamically | Strong after collecting data, slow start |
| **Random** | Random inputs every frame | Baseline -- any real bot should beat this |

## Writing Your Own Bot

Use these examples as templates. The key pattern is:

```typescript
import { ArenaClient } from '@clawdbot/arena-sdk';
import type { BotObservation, BotInput } from '@clawdbot/protocol';

const client = new ArenaClient({
  botId: 'your_bot_id',
  apiKey: 'your_api_key',
  serverUrl: 'ws://localhost:8080/ws/bot',
});

// This function is called every frame with the current game state
client.onObservation((obs: BotObservation): BotInput => {
  // obs.self: your bot's health, magic, position, state, canAct
  // obs.opponent: opponent's health, position, state, isAttacking, isBlocking, isVulnerable
  // obs.validActions: array of valid action names

  return {
    left: false,
    right: false,
    up: false,
    down: false,
    attack1: false,
    attack2: false,
    jump: false,
    special: false,
  };
});

await client.connect();
client.joinMatchmaking('ranked');
```

## Observation Reference

The `BotObservation` object provided each frame:

- `self.health` -- your current HP (0-100)
- `self.magic` -- your current magic/meter (0-100)
- `self.position` -- `{ x, y }` coordinates
- `self.state` -- current animation state string
- `self.canAct` -- whether you can input actions this frame
- `opponent.health` -- opponent HP
- `opponent.position` -- opponent `{ x, y }`
- `opponent.state` -- opponent animation state
- `opponent.isAttacking` -- true if opponent is in an attack animation
- `opponent.isBlocking` -- true if opponent is blocking
- `opponent.isVulnerable` -- true if opponent is in recovery/vulnerable state
- `frameNumber` -- current frame number (for timing logic)
- `validActions` -- list of valid action names this frame
