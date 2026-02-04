/**
 * Marketplace Tools
 *
 * MCP tools for browsing, searching, and purchasing in the marketplace.
 */

import { z } from 'zod';
import type { MarketplaceManager } from '@clawdbot/marketplace';

// =============================================================================
// Schemas
// =============================================================================

export const BrowseGamesSchema = z.object({
  sortBy: z.enum([
    'trending',
    'newest',
    'top_rated',
    'most_played',
    'highest_earning',
  ]).default('trending').describe('How to sort results'),
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
  ]).optional().describe('Filter by category'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
  minRating: z.number().min(0).max(5).optional().describe('Minimum rating'),
  limit: z.number().min(1).max(50).default(20).describe('Number of results'),
  offset: z.number().min(0).default(0).describe('Pagination offset'),
});

export const SearchGamesSchema = z.object({
  query: z.string().min(2).describe('Search query'),
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
  ]).optional().describe('Filter by category'),
  minRating: z.number().min(0).max(5).optional().describe('Minimum rating'),
  limit: z.number().min(1).max(50).default(20).describe('Number of results'),
});

export const GetRelatedGamesSchema = z.object({
  gameId: z.string().describe('ID of the game to find related games for'),
  limit: z.number().min(1).max(10).default(5).describe('Number of results'),
});

export const PurchaseItemSchema = z.object({
  gameId: z.string().describe('ID of the game'),
  itemId: z.string().describe('ID of the item to purchase'),
  quantity: z.number().min(1).max(100).default(1).describe('Quantity (for consumables)'),
});

export const RateGameSchema = z.object({
  gameId: z.string().describe('ID of the game to rate'),
  rating: z.number().min(1).max(5).describe('Rating from 1-5'),
  review: z.string().max(500).optional().describe('Optional review text'),
});

// =============================================================================
// Tool Definitions
// =============================================================================

export const marketplaceToolDefinitions = [
  {
    name: 'browse_games',
    description: `Browse games in the marketplace.

Sort options:
- trending: Hot games based on revenue, engagement, recency, ratings
- newest: Most recently published
- top_rated: Highest average rating
- most_played: Most total plays
- highest_earning: Most total revenue`,
    inputSchema: BrowseGamesSchema,
  },
  {
    name: 'search_games',
    description: `Search for games by name, description, or tags.

Returns games ranked by relevance to your query.`,
    inputSchema: SearchGamesSchema,
  },
  {
    name: 'get_related_games',
    description: `Get games similar to a specific game.

Based on category, tags, and player preferences.`,
    inputSchema: GetRelatedGamesSchema,
  },
  {
    name: 'purchase_item',
    description: `Purchase an item from a game.

Requires sufficient COMP balance. 90% goes to creator, 10% platform fee.
For consumables, you can purchase multiple at once.

Rate limit: 100 purchases per day.`,
    inputSchema: PurchaseItemSchema,
  },
  {
    name: 'rate_game',
    description: `Rate a game you have played.

Rating is 1-5 stars. You can optionally add a text review.
You can only rate games you have actually played.`,
    inputSchema: RateGameSchema,
  },
  {
    name: 'get_trending',
    description: `Get the current trending games.

Returns the top 10 trending games based on the balanced formula:
- 25% revenue
- 30% engagement
- 20% recency
- 25% ratings`,
    inputSchema: z.object({}),
  },
  {
    name: 'get_categories',
    description: `Get a list of all game categories with counts.`,
    inputSchema: z.object({}),
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export function createMarketplaceToolHandlers(
  marketplace: MarketplaceManager,
  botId: string,
  botAddress: string
) {
  return {
    browse_games: async (args: z.infer<typeof BrowseGamesSchema>) => {
      const result = await marketplace.discovery.browseGames({
        sortBy: args.sortBy,
        category: args.category,
        tags: args.tags,
        minRating: args.minRating,
        limit: args.limit,
        offset: args.offset,
      });

      return {
        success: true,
        games: result.games.map((game) => ({
          gameId: game.gameId,
          name: game.name,
          shortDescription: game.shortDescription,
          category: game.category,
          rating: game.averageRating,
          plays: game.totalPlays,
          revenue: `${parseFloat(game.totalRevenue) / 1e18} COMP`,
        })),
        total: result.total,
        page: result.page,
        hasMore: result.hasMore,
      };
    },

    search_games: async (args: z.infer<typeof SearchGamesSchema>) => {
      const result = await marketplace.discovery.searchGames(
        args.query,
        {
          category: args.category,
          minRating: args.minRating,
        },
        args.limit
      );

      return {
        success: true,
        query: args.query,
        games: result.games.map((game) => ({
          gameId: game.gameId,
          name: game.name,
          shortDescription: game.shortDescription,
          category: game.category,
          rating: game.averageRating,
          plays: game.totalPlays,
        })),
        total: result.total,
      };
    },

    get_related_games: async (args: z.infer<typeof GetRelatedGamesSchema>) => {
      const games = await marketplace.discovery.getRelatedGames(
        args.gameId,
        args.limit
      );

      return {
        success: true,
        relatedTo: args.gameId,
        games: games.map((game) => ({
          gameId: game.gameId,
          name: game.name,
          shortDescription: game.shortDescription,
          category: game.category,
          rating: game.averageRating,
        })),
      };
    },

    purchase_item: async (args: z.infer<typeof PurchaseItemSchema>) => {
      const result = await marketplace.purchases.purchaseItem({
        buyerId: botId,
        buyerAddress: botAddress,
        gameId: args.gameId,
        itemId: args.itemId,
        quantity: args.quantity,
      });

      if (result.success) {
        return {
          success: true,
          message: `Successfully purchased ${args.quantity}x ${result.item?.name}!`,
          purchaseId: result.purchaseId,
          transactionHash: result.transactionHash,
          item: result.item,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    },

    rate_game: async (args: z.infer<typeof RateGameSchema>) => {
      // In production, would verify bot has played the game
      // and store the rating

      const game = await marketplace.store.getGame(args.gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Update game rating (simplified - in production would be more complex)
      const newTotalRatings = game.totalRatings + 1;
      const newAverageRating =
        (game.averageRating * game.totalRatings + args.rating) / newTotalRatings;

      await marketplace.store.updateGame(args.gameId, {
        averageRating: newAverageRating,
        totalRatings: newTotalRatings,
      } as any);

      return {
        success: true,
        message: `Rated "${game.name}" ${args.rating}/5 stars`,
        newAverageRating: newAverageRating.toFixed(2),
        totalRatings: newTotalRatings,
      };
    },

    get_trending: async () => {
      const gameIds = await marketplace.store.getTrendingGames(10);
      const games = [];

      for (const gameId of gameIds) {
        const game = await marketplace.store.getGame(gameId);
        if (game) {
          games.push({
            gameId: game.gameId,
            name: game.name,
            shortDescription: game.shortDescription,
            category: game.category,
            rating: game.averageRating,
            plays: game.totalPlays,
            revenue: `${parseFloat(game.totalRevenue) / 1e18} COMP`,
          });
        }
      }

      return {
        success: true,
        trending: games,
        count: games.length,
      };
    },

    get_categories: async () => {
      const categories = [
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
      ];

      const categoryCounts: Record<string, number> = {};

      for (const category of categories) {
        const games = await marketplace.store.getGamesByCategory(category);
        categoryCounts[category] = games.length;
      }

      return {
        success: true,
        categories: categoryCounts,
        total: Object.values(categoryCounts).reduce((a, b) => a + b, 0),
      };
    },
  };
}
