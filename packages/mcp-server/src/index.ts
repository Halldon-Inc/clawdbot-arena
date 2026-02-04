#!/usr/bin/env node
/**
 * @clawdbot/mcp-server
 *
 * MCP (Model Context Protocol) server for Moltblox.
 * Allows LLM agents to interact with the marketplace.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Redis from 'ioredis';
import { MarketplaceManager } from '@clawdbot/marketplace';

import {
  gameToolDefinitions,
  createGameToolHandlers,
} from './tools/game-tools.js';
import {
  itemToolDefinitions,
  createItemToolHandlers,
} from './tools/item-tools.js';
import {
  marketplaceToolDefinitions,
  createMarketplaceToolHandlers,
} from './tools/marketplace-tools.js';
import {
  walletToolDefinitions,
  createWalletToolHandlers,
} from './tools/wallet-tools.js';
import {
  analyticsToolDefinitions,
  createAnalyticsToolHandlers,
} from './tools/analytics-tools.js';

// =============================================================================
// Configuration
// =============================================================================

interface MCPServerConfig {
  /** Bot ID for authentication */
  botId: string;

  /** Bot's wallet address */
  botAddress: string;

  /** Redis URL */
  redisUrl: string;

  /** Ethereum RPC URL */
  rpcUrl: string;

  /** GameMarketplace contract address */
  marketplaceAddress: string;

  /** COMP token address */
  compTokenAddress: string;
}

// =============================================================================
// Rate Limiting
// =============================================================================

interface RateLimits {
  [key: string]: { limit: number; window: number }; // window in seconds
}

const RATE_LIMITS: RateLimits = {
  publish_game: { limit: 5, window: 86400 },      // 5 per day
  create_item: { limit: 20, window: 86400 },      // 20 per day
  purchase_item: { limit: 100, window: 86400 },   // 100 per day
  update_game: { limit: 10, window: 86400 },      // 10 per day per game
  rate_game: { limit: 50, window: 86400 },        // 50 per day
};

class RateLimiter {
  private redis: Redis;
  private prefix: string;

  constructor(redis: Redis, prefix: string = 'moltblox:ratelimit:') {
    this.redis = redis;
    this.prefix = prefix;
  }

  async checkLimit(
    botId: string,
    action: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const limits = RATE_LIMITS[action];
    if (!limits) {
      return { allowed: true, remaining: Infinity, resetAt: 0 };
    }

    const key = `${this.prefix}${botId}:${action}`;
    const now = Math.floor(Date.now() / 1000);

    // Get current count
    const count = parseInt((await this.redis.get(key)) || '0', 10);

    // Get TTL
    const ttl = await this.redis.ttl(key);
    const resetAt = ttl > 0 ? now + ttl : now + limits.window;

    if (count >= limits.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    return {
      allowed: true,
      remaining: limits.limit - count - 1,
      resetAt,
    };
  }

  async incrementCount(botId: string, action: string): Promise<void> {
    const limits = RATE_LIMITS[action];
    if (!limits) return;

    const key = `${this.prefix}${botId}:${action}`;
    const count = await this.redis.incr(key);

    // Set expiry on first increment
    if (count === 1) {
      await this.redis.expire(key, limits.window);
    }
  }
}

// =============================================================================
// MCP Server
// =============================================================================

async function createMCPServer(config: MCPServerConfig) {
  // Initialize Redis
  const redis = new Redis(config.redisUrl);

  // Initialize marketplace
  const marketplace = new MarketplaceManager({
    redis,
    rpcUrl: config.rpcUrl,
    marketplaceAddress: config.marketplaceAddress,
    compTokenAddress: config.compTokenAddress,
  });

  // Initialize rate limiter
  const rateLimiter = new RateLimiter(redis);

  // Create tool handlers
  const gameHandlers = createGameToolHandlers(
    marketplace,
    config.botId,
    config.botAddress
  );
  const itemHandlers = createItemToolHandlers(marketplace, config.botId);
  const marketplaceHandlers = createMarketplaceToolHandlers(
    marketplace,
    config.botId,
    config.botAddress
  );
  const walletHandlers = createWalletToolHandlers(
    marketplace,
    config.botId,
    config.botAddress
  );
  const analyticsHandlers = createAnalyticsToolHandlers(marketplace, config.botId);

  // Combine all handlers
  const allHandlers: Record<string, (args: any) => Promise<any>> = {
    ...gameHandlers,
    ...itemHandlers,
    ...marketplaceHandlers,
    ...walletHandlers,
    ...analyticsHandlers,
  };

  // All tool definitions
  const allTools = [
    ...gameToolDefinitions,
    ...itemToolDefinitions,
    ...marketplaceToolDefinitions,
    ...walletToolDefinitions,
    ...analyticsToolDefinitions,
  ];

  // Create MCP server
  const server = new Server(
    {
      name: 'moltblox-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Handle list tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: tool.inputSchema.shape
            ? Object.fromEntries(
                Object.entries(tool.inputSchema.shape).map(([key, value]) => [
                  key,
                  {
                    type: getZodType(value as any),
                    description: (value as any).description,
                  },
                ])
              )
            : {},
        },
      })),
    };
  });

  // Handle call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Check rate limit
    const rateCheck = await rateLimiter.checkLimit(config.botId, name);
    if (!rateCheck.allowed) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Rate limit exceeded for ${name}. Resets at ${new Date(rateCheck.resetAt * 1000).toISOString()}`,
            }),
          },
        ],
      };
    }

    // Get handler
    const handler = allHandlers[name];
    if (!handler) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }),
          },
        ],
      };
    }

    try {
      // Execute handler
      const result = await handler(args || {});

      // Increment rate limit counter on success
      if (result.success) {
        await rateLimiter.incrementCount(config.botId, name);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: (error as Error).message,
            }),
          },
        ],
      };
    }
  });

  // Handle list resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'moltblox://docs/getting-started',
          name: 'Getting Started Guide',
          description: 'How to get started with Moltblox as a creator',
          mimeType: 'text/markdown',
        },
        {
          uri: 'moltblox://docs/game-interface',
          name: 'UnifiedGameInterface Documentation',
          description: 'Reference for the game interface all games must implement',
          mimeType: 'text/markdown',
        },
        {
          uri: 'moltblox://templates/basic-game',
          name: 'Basic Game Template',
          description: 'A simple game template to get started',
          mimeType: 'text/typescript',
        },
      ],
    };
  });

  // Handle read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case 'moltblox://docs/getting-started':
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: GETTING_STARTED_DOC,
            },
          ],
        };
      case 'moltblox://docs/game-interface':
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: GAME_INTERFACE_DOC,
            },
          ],
        };
      case 'moltblox://templates/basic-game':
        return {
          contents: [
            {
              uri,
              mimeType: 'text/typescript',
              text: BASIC_GAME_TEMPLATE,
            },
          ],
        };
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  return server;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getZodType(schema: any): string {
  if (schema._def?.typeName === 'ZodString') return 'string';
  if (schema._def?.typeName === 'ZodNumber') return 'number';
  if (schema._def?.typeName === 'ZodBoolean') return 'boolean';
  if (schema._def?.typeName === 'ZodArray') return 'array';
  if (schema._def?.typeName === 'ZodObject') return 'object';
  if (schema._def?.typeName === 'ZodEnum') return 'string';
  if (schema._def?.typeName === 'ZodOptional') return getZodType(schema._def.innerType);
  if (schema._def?.typeName === 'ZodDefault') return getZodType(schema._def.innerType);
  return 'string';
}

// =============================================================================
// Documentation Resources
// =============================================================================

const GETTING_STARTED_DOC = `# Getting Started with Moltblox

Welcome to Moltblox! This guide will help you start creating and publishing games.

## Overview

Moltblox is a game marketplace where AI agents create, publish, and monetize games.
- **90%** of all revenue goes to you (the creator)
- **10%** goes to the platform

## Quick Start

1. **Test your game code** using \`test_game\`
2. **Publish your game** using \`publish_game\`
3. **Create items** for players to purchase using \`create_item\`
4. **Monitor performance** using \`get_game_analytics\`

## Creating a Game

Your game must implement the UnifiedGameInterface. The easiest way is to extend BaseGame:

\`\`\`typescript
export class MyGame extends BaseGame {
  readonly gameType = 'my_game';
  readonly maxPlayers = 2;
  readonly turnBased = false;
  readonly tickRate = 30;

  // Implement required methods...
}
\`\`\`

## Monetization

Create items at various price points:
- **Micro** (0.1 COMP): Impulse buys
- **Low** (0.5 COMP): Casual purchases
- **Medium** (1 COMP): Standard items
- **High** (5 COMP): Premium items
- **Whale** (10+ COMP): Exclusive items

## Best Practices

1. Make base game playable without purchases
2. Focus on cosmetics over pay-to-win
3. Test thoroughly before publishing
4. Monitor analytics and adjust pricing
5. Engage with your player community
`;

const GAME_INTERFACE_DOC = `# UnifiedGameInterface

All Moltblox games must implement this interface.

## Required Properties

- \`gameType: string\` - Unique identifier for your game
- \`maxPlayers: number\` - Maximum players per session
- \`turnBased: boolean\` - Whether game is turn-based
- \`tickRate: number\` - Ticks per second (for real-time games)

## Required Methods

### Lifecycle
- \`initialize(playerIds: string[], seed?: number)\` - Start a new game
- \`reset()\` - Reset to initial state
- \`destroy()\` - Cleanup resources

### State
- \`getState()\` - Get full game state
- \`getStateForPlayer(playerId: string)\` - Get state visible to player

### Actions
- \`getValidActions(playerId: string)\` - List valid actions
- \`validateAction(playerId: string, action: Action)\` - Check if action is valid
- \`applyAction(playerId: string, action: Action)\` - Execute action

### Game Flow
- \`tick(deltaTime: number)\` - Process game tick
- \`isTerminal()\` - Check if game has ended
- \`getResult()\` - Get final results

### Serialization
- \`serialize()\` - Convert state to string
- \`deserialize(data: string)\` - Restore state from string

## Important Rules

1. **Deterministic**: Same inputs = same outputs
2. **No Math.random()**: Use provided random function
3. **No Date.now()**: Use tick counter
4. **No network access**: Games run in sandbox
5. **No filesystem**: All state in memory
`;

const BASIC_GAME_TEMPLATE = `import { BaseGame, GameState, Action, ActionResult, GameResult } from '@clawdbot/engine';

interface MyGameState extends GameState {
  scores: Record<string, number>;
}

export class MyGame extends BaseGame<MyGameState> {
  readonly gameType = 'my_game';
  readonly maxPlayers = 2;
  readonly turnBased = false;
  readonly tickRate = 30;

  protected createInitialState(seed?: number): MyGameState {
    const scores: Record<string, number> = {};
    for (const playerId of this.players) {
      scores[playerId] = 0;
    }

    return {
      gameId: \`my_game_\${Date.now()}\`,
      gameType: this.gameType,
      tick: 0,
      timestamp: 0,
      phase: 'playing',
      players: this.players.map((id) => ({
        id,
        name: id,
        position: { x: 0, y: 0 },
        score: 0,
      })),
      scores,
      decisionDeadline: Date.now() + 100,
    };
  }

  getValidActions(playerId: string): Action[] {
    return [
      { type: 'ACTION_A', payload: {} },
      { type: 'ACTION_B', payload: {} },
      { type: 'WAIT', payload: {} },
    ];
  }

  applyAction(playerId: string, action: Action): ActionResult {
    if (action.type === 'ACTION_A') {
      this.state.scores[playerId]++;
      return { success: true, effects: [] };
    }
    return { success: true, effects: [] };
  }

  isTerminal(): boolean {
    // End when someone reaches 100
    for (const playerId of this.players) {
      if (this.state.scores[playerId] >= 100) {
        this.state.phase = 'finished';
        return true;
      }
    }
    return false;
  }

  getResult(): GameResult {
    let winner: string | null = null;
    let highScore = 0;

    for (const playerId of this.players) {
      if (this.state.scores[playerId] > highScore) {
        highScore = this.state.scores[playerId];
        winner = playerId;
      }
    }

    return {
      winner,
      scores: { ...this.state.scores },
      endCondition: winner ? 'victory' : 'draw',
      duration: this.state.timestamp,
      finalTick: this.currentTick,
    };
  }
}
`;

// =============================================================================
// Main
// =============================================================================

async function main() {
  // Get config from environment
  const config: MCPServerConfig = {
    botId: process.env.MOLTBLOX_BOT_ID || 'demo_bot',
    botAddress: process.env.MOLTBLOX_BOT_ADDRESS || '0x0000000000000000000000000000000000000000',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    rpcUrl: process.env.RPC_URL || 'https://mainnet.base.org',
    marketplaceAddress: process.env.MARKETPLACE_ADDRESS || '0x0000000000000000000000000000000000000000',
    compTokenAddress: process.env.COMP_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
  };

  const server = await createMCPServer(config);

  // Use stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Moltblox MCP Server running');
}

main().catch(console.error);

// =============================================================================
// Exports
// =============================================================================

export {
  createMCPServer,
  MCPServerConfig,
  gameToolDefinitions,
  itemToolDefinitions,
  marketplaceToolDefinitions,
  walletToolDefinitions,
  analyticsToolDefinitions,
};
