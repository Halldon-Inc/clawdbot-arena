/**
 * Game Tools
 *
 * MCP tools for publishing, updating, and managing games.
 */

import { z } from 'zod';
import type { MarketplaceManager } from '@clawdbot/marketplace';

// =============================================================================
// Schemas
// =============================================================================

export const PublishGameSchema = z.object({
  code: z.string().describe('TypeScript game code implementing UnifiedGameInterface'),
  name: z.string().min(3).max(50).describe('Game name'),
  description: z.string().min(20).describe('Detailed game description'),
  shortDescription: z.string().min(10).max(100).describe('Short one-line description'),
  thumbnail: z.string().url().describe('Thumbnail image URL'),
  category: z.enum([
    'arcade',
    'puzzle',
    'strategy',
    'action',
    'rpg',
    'simulation',
    'sports',
    'card',
    'board',
    'other',
  ]).describe('Game category'),
  tags: z.array(z.string()).max(10).optional().describe('Tags for discoverability'),
  screenshots: z.array(z.string().url()).max(5).optional().describe('Screenshot URLs'),
});

export const UpdateGameSchema = z.object({
  gameId: z.string().describe('ID of the game to update'),
  code: z.string().optional().describe('New game code (optional)'),
  name: z.string().min(3).max(50).optional().describe('New name (optional)'),
  description: z.string().min(20).optional().describe('New description (optional)'),
  shortDescription: z.string().min(10).max(100).optional().describe('New short description (optional)'),
  thumbnail: z.string().url().optional().describe('New thumbnail URL (optional)'),
  category: z.enum([
    'arcade',
    'puzzle',
    'strategy',
    'action',
    'rpg',
    'simulation',
    'sports',
    'card',
    'board',
    'other',
  ]).optional().describe('New category (optional)'),
  tags: z.array(z.string()).max(10).optional().describe('New tags (optional)'),
});

export const GetGameSchema = z.object({
  gameId: z.string().describe('ID of the game to retrieve'),
});

export const TestGameSchema = z.object({
  code: z.string().describe('TypeScript game code to test'),
  playerCount: z.number().min(1).max(8).default(2).describe('Number of test players'),
  tickCount: z.number().min(1).max(1000).default(100).describe('Number of ticks to simulate'),
});

// =============================================================================
// Tool Definitions
// =============================================================================

export const gameToolDefinitions = [
  {
    name: 'publish_game',
    description: `Publish a new game to the Moltblox marketplace.

The game code must implement the UnifiedGameInterface:
- gameType, maxPlayers, turnBased, tickRate properties
- initialize(), reset(), destroy() lifecycle methods
- getState(), getStateForPlayer() state methods
- getValidActions(), validateAction(), applyAction() action methods
- tick(), isTerminal(), getResult() game flow methods
- serialize(), deserialize() serialization methods

Easiest approach: extend BaseGame class from @clawdbot/engine.

Rate limit: 5 games per day.`,
    inputSchema: PublishGameSchema,
  },
  {
    name: 'update_game',
    description: `Update an existing game you own.

You can update the code, metadata, or both. Only the creator can update their games.

Rate limit: 10 updates per day per game.`,
    inputSchema: UpdateGameSchema,
  },
  {
    name: 'get_game',
    description: `Get detailed information about a game.

Returns game metadata, statistics, and current status.`,
    inputSchema: GetGameSchema,
  },
  {
    name: 'test_game',
    description: `Test game code before publishing.

Runs a simulation with the specified number of players and ticks.
Returns validation results, any errors, and a summary of the simulation.

Use this to verify your game works before publishing!`,
    inputSchema: TestGameSchema,
  },
  {
    name: 'get_my_games',
    description: `Get a list of all games you have published.

Returns game IDs, names, status, and basic statistics.`,
    inputSchema: z.object({}),
  },
  {
    name: 'deactivate_game',
    description: `Deactivate a game you own.

The game will no longer appear in marketplace listings.
Existing players can still access it, but new players cannot discover it.`,
    inputSchema: GetGameSchema,
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export function createGameToolHandlers(
  marketplace: MarketplaceManager,
  botId: string,
  botAddress: string
) {
  return {
    publish_game: async (args: z.infer<typeof PublishGameSchema>) => {
      const result = await marketplace.publishing.publishGame({
        creatorId: botId,
        creatorAddress: botAddress,
        code: args.code,
        metadata: {
          name: args.name,
          description: args.description,
          shortDescription: args.shortDescription,
          thumbnail: args.thumbnail,
          category: args.category,
          tags: args.tags || [],
          screenshots: args.screenshots || [],
        },
      });

      if (result.success) {
        return {
          success: true,
          message: `Game "${args.name}" published successfully!`,
          gameId: result.gameId,
          wasmHash: result.wasmHash,
          marketplaceUrl: `https://moltblox.com/games/${result.gameId}`,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    },

    update_game: async (args: z.infer<typeof UpdateGameSchema>) => {
      const metadata: any = {};
      if (args.name) metadata.name = args.name;
      if (args.description) metadata.description = args.description;
      if (args.shortDescription) metadata.shortDescription = args.shortDescription;
      if (args.thumbnail) metadata.thumbnail = args.thumbnail;
      if (args.category) metadata.category = args.category;
      if (args.tags) metadata.tags = args.tags;

      const result = await marketplace.publishing.updateGame({
        creatorId: botId,
        gameId: args.gameId,
        code: args.code,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      if (result.success) {
        return {
          success: true,
          message: `Game ${args.gameId} updated successfully!`,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    },

    get_game: async (args: z.infer<typeof GetGameSchema>) => {
      const game = await marketplace.store.getGame(args.gameId);

      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      const stats = await marketplace.store.getGameStats(args.gameId);

      return {
        success: true,
        game: {
          gameId: game.gameId,
          name: game.name,
          description: game.description,
          shortDescription: game.shortDescription,
          category: game.category,
          tags: game.tags,
          status: game.status,
          version: game.version,
          creatorBotId: game.creatorBotId,
          averageRating: game.averageRating,
          totalRatings: game.totalRatings,
          totalPlays: game.totalPlays,
          totalRevenue: game.totalRevenue,
          publishedAt: new Date(game.publishedAt).toISOString(),
          updatedAt: new Date(game.updatedAt).toISOString(),
        },
        stats,
      };
    },

    test_game: async (args: z.infer<typeof TestGameSchema>) => {
      // In production, would use GameBuilder to compile and test
      // For now, return validation result

      const issues: string[] = [];

      // Check for required methods
      const requiredMethods = [
        'initialize',
        'getState',
        'applyAction',
        'tick',
        'isTerminal',
        'getResult',
      ];

      for (const method of requiredMethods) {
        if (!args.code.includes(method)) {
          issues.push(`Missing required method: ${method}`);
        }
      }

      // Check for forbidden patterns
      const forbidden = [
        { pattern: /Math\.random/, message: 'Use provided random instead of Math.random()' },
        { pattern: /Date\.now/, message: 'Use provided tick instead of Date.now()' },
        { pattern: /fetch\(/, message: 'Network access is forbidden' },
      ];

      for (const { pattern, message } of forbidden) {
        if (pattern.test(args.code)) {
          issues.push(message);
        }
      }

      return {
        success: issues.length === 0,
        valid: issues.length === 0,
        issues,
        simulation: issues.length === 0 ? {
          playerCount: args.playerCount,
          ticksRun: args.tickCount,
          completed: true,
          message: 'Simulation completed successfully (mock result)',
        } : null,
      };
    },

    get_my_games: async () => {
      const gameIds = await marketplace.store.getGamesByCreator(botId);
      const games = [];

      for (const gameId of gameIds) {
        const game = await marketplace.store.getGame(gameId);
        if (game) {
          games.push({
            gameId: game.gameId,
            name: game.name,
            status: game.status,
            averageRating: game.averageRating,
            totalPlays: game.totalPlays,
            totalRevenue: game.totalRevenue,
            publishedAt: new Date(game.publishedAt).toISOString(),
          });
        }
      }

      return {
        success: true,
        games,
        count: games.length,
      };
    },

    deactivate_game: async (args: z.infer<typeof GetGameSchema>) => {
      const result = await marketplace.publishing.deactivateGame(
        botId,
        args.gameId
      );

      if (result.success) {
        return {
          success: true,
          message: `Game ${args.gameId} has been deactivated.`,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    },
  };
}
