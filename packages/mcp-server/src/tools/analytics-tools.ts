/**
 * Analytics Tools
 *
 * MCP tools for viewing game analytics and creator dashboard.
 */

import { z } from 'zod';
import type { MarketplaceManager } from '@clawdbot/marketplace';

// =============================================================================
// Schemas
// =============================================================================

export const GetGameAnalyticsSchema = z.object({
  gameId: z.string().describe('ID of the game'),
});

export const GetCreatorDashboardSchema = z.object({});

export const GetTopItemsSchema = z.object({
  gameId: z.string().describe('ID of the game'),
  limit: z.number().min(1).max(20).default(10).describe('Number of items to return'),
});

// =============================================================================
// Tool Definitions
// =============================================================================

export const analyticsToolDefinitions = [
  {
    name: 'get_game_analytics',
    description: `Get detailed analytics for a game you own.

Returns:
- Play statistics (total plays, unique players, session duration)
- Revenue metrics (total revenue, items sold, conversion rate)
- Engagement metrics (return rate, average session time)
- Rating breakdown`,
    inputSchema: GetGameAnalyticsSchema,
  },
  {
    name: 'get_creator_dashboard',
    description: `Get your complete creator dashboard.

Shows all your games with their performance metrics,
total earnings, and recommendations for improvement.`,
    inputSchema: GetCreatorDashboardSchema,
  },
  {
    name: 'get_top_items',
    description: `Get the top-selling items for a game.

Shows which items are performing best and which might need attention.`,
    inputSchema: GetTopItemsSchema,
  },
  {
    name: 'get_marketing_insights',
    description: `Get marketing insights for your games.

Provides recommendations for:
- Pricing adjustments
- New item ideas
- Engagement improvements
- Growth opportunities`,
    inputSchema: GetGameAnalyticsSchema,
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export function createAnalyticsToolHandlers(
  marketplace: MarketplaceManager,
  botId: string
) {
  return {
    get_game_analytics: async (args: z.infer<typeof GetGameAnalyticsSchema>) => {
      const game = await marketplace.store.getGame(args.gameId);

      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      // Verify ownership for detailed analytics
      if (game.creatorBotId !== botId) {
        return {
          success: true,
          // Return limited public analytics for non-owners
          public: true,
          analytics: {
            gameId: game.gameId,
            name: game.name,
            averageRating: game.averageRating,
            totalRatings: game.totalRatings,
            totalPlays: game.totalPlays,
            category: game.category,
          },
        };
      }

      const stats = await marketplace.store.getGameStats(args.gameId);
      const revenueComp = parseFloat(game.totalRevenue) / 1e18;

      // Calculate metrics
      const uniquePlayers = stats.uniquePlayers || game.uniquePlayers || 1;
      const returnRate = stats.returningPlayers
        ? ((stats.returningPlayers / uniquePlayers) * 100).toFixed(1)
        : '0';
      const conversionRate = stats.itemsSold && game.totalPlays
        ? ((stats.itemsSold / game.totalPlays) * 100).toFixed(2)
        : '0';
      const arpp = game.totalPlays > 0
        ? (revenueComp / game.totalPlays).toFixed(4)
        : '0';

      return {
        success: true,
        public: false,
        analytics: {
          gameId: game.gameId,
          name: game.name,

          // Play metrics
          plays: {
            total: game.totalPlays,
            uniquePlayers: uniquePlayers,
            returningPlayers: stats.returningPlayers || 0,
            returnRate: `${returnRate}%`,
          },

          // Revenue metrics
          revenue: {
            total: `${revenueComp.toFixed(4)} COMP`,
            totalWei: game.totalRevenue,
            itemsSold: stats.itemsSold || 0,
            averageRevenuePerPlay: `${arpp} COMP`,
            conversionRate: `${conversionRate}%`,
          },

          // Engagement metrics
          engagement: {
            totalPlayTime: stats.totalPlayTime || 0,
            averageSessionMinutes: stats.totalPlayTime && game.totalPlays
              ? ((stats.totalPlayTime / game.totalPlays) / 60).toFixed(1)
              : '0',
          },

          // Rating metrics
          ratings: {
            average: game.averageRating.toFixed(2),
            total: game.totalRatings,
            distribution: stats.ratingDistribution || {},
          },

          // Timestamps
          publishedAt: new Date(game.publishedAt).toISOString(),
          lastUpdated: new Date(game.updatedAt).toISOString(),
        },
      };
    },

    get_creator_dashboard: async () => {
      const gameIds = await marketplace.store.getGamesByCreator(botId);
      const games = [];
      let totalRevenue = 0;
      let totalPlays = 0;
      let totalItemsSold = 0;

      for (const gameId of gameIds) {
        const game = await marketplace.store.getGame(gameId);
        if (!game) continue;

        const stats = await marketplace.store.getGameStats(gameId);
        const gameRevenue = parseFloat(game.totalRevenue) / 1e18;

        totalRevenue += gameRevenue;
        totalPlays += game.totalPlays;
        totalItemsSold += stats.itemsSold || 0;

        games.push({
          gameId: game.gameId,
          name: game.name,
          status: game.status,
          rating: game.averageRating.toFixed(2),
          plays: game.totalPlays,
          revenue: `${gameRevenue.toFixed(4)} COMP`,
          itemsSold: stats.itemsSold || 0,
          publishedAt: new Date(game.publishedAt).toISOString(),
        });
      }

      // Sort by revenue
      games.sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));

      return {
        success: true,
        dashboard: {
          summary: {
            totalGames: games.length,
            activeGames: games.filter((g) => g.status === 'active').length,
            totalRevenue: `${totalRevenue.toFixed(4)} COMP`,
            totalPlays,
            totalItemsSold,
          },
          games,
          recommendations: generateRecommendations(games),
        },
      };
    },

    get_top_items: async (args: z.infer<typeof GetTopItemsSchema>) => {
      const game = await marketplace.store.getGame(args.gameId);

      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      if (game.creatorBotId !== botId) {
        return { success: false, error: 'You can only view analytics for your own games' };
      }

      const items = await marketplace.publishing.getGameItems(args.gameId);

      // Sort by sold count
      const sortedItems = [...items as any[]].sort(
        (a, b) => (b.soldCount || 0) - (a.soldCount || 0)
      );

      const topItems = sortedItems.slice(0, args.limit).map((item) => ({
        itemId: item.itemId,
        name: item.name,
        category: item.category,
        price: `${parseFloat(item.price) / 1e18} COMP`,
        soldCount: item.soldCount || 0,
        revenue: `${((item.soldCount || 0) * parseFloat(item.price) * 0.9) / 1e18} COMP`,
        active: item.active,
      }));

      return {
        success: true,
        gameId: args.gameId,
        topItems,
        totalItems: items.length,
      };
    },

    get_marketing_insights: async (args: z.infer<typeof GetGameAnalyticsSchema>) => {
      const game = await marketplace.store.getGame(args.gameId);

      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      if (game.creatorBotId !== botId) {
        return { success: false, error: 'You can only view insights for your own games' };
      }

      const stats = await marketplace.store.getGameStats(args.gameId);
      const items = await marketplace.publishing.getGameItems(args.gameId) as any[];

      // Generate insights
      const insights: string[] = [];

      // Conversion insights
      const conversionRate = stats.itemsSold && game.totalPlays
        ? (stats.itemsSold / game.totalPlays) * 100
        : 0;

      if (conversionRate < 3) {
        insights.push('Low conversion rate (<3%). Consider adding more entry-level items priced under 0.5 COMP.');
      } else if (conversionRate > 8) {
        insights.push('Excellent conversion rate (>8%)! Your item strategy is working well.');
      }

      // Item portfolio insights
      const categories = items.reduce((acc: Record<string, number>, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {});

      if (!categories.cosmetic) {
        insights.push('No cosmetic items. Cosmetics are safe revenue without affecting gameplay balance.');
      }

      if (!categories.consumable) {
        insights.push('No consumable items. Consumables provide repeat purchases from engaged players.');
      }

      // Rating insights
      if (game.averageRating < 3.5 && game.totalRatings > 10) {
        insights.push('Average rating below 3.5. Check reviews for common complaints and address them.');
      }

      // Engagement insights
      const returnRate = stats.returningPlayers && stats.uniquePlayers
        ? (stats.returningPlayers / stats.uniquePlayers) * 100
        : 0;

      if (returnRate < 20) {
        insights.push('Low return rate (<20%). Consider adding daily rewards or progression systems.');
      }

      // Pricing insights
      const prices = items.map((i) => parseFloat(i.price) / 1e18);
      const hasLowPriceItem = prices.some((p) => p < 0.5);
      const hasHighPriceItem = prices.some((p) => p > 5);

      if (!hasLowPriceItem && items.length > 0) {
        insights.push('No items under 0.5 COMP. Add impulse-buy items to capture casual spenders.');
      }

      if (!hasHighPriceItem && items.length > 3) {
        insights.push('No premium items over 5 COMP. Consider adding exclusive/limited items for collectors.');
      }

      return {
        success: true,
        gameId: args.gameId,
        name: game.name,
        currentMetrics: {
          rating: game.averageRating.toFixed(2),
          plays: game.totalPlays,
          conversionRate: `${conversionRate.toFixed(2)}%`,
          returnRate: `${returnRate.toFixed(1)}%`,
          itemCount: items.length,
        },
        insights,
        recommendations: insights.length === 0
          ? ['Your game is performing well! Keep up the good work.']
          : insights,
      };
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateRecommendations(
  games: { status: string; rating: string; plays: number; revenue: string }[]
): string[] {
  const recommendations: string[] = [];

  if (games.length === 0) {
    recommendations.push('Publish your first game to start earning COMP!');
    return recommendations;
  }

  const activeGames = games.filter((g) => g.status === 'active');
  const lowRatedGames = games.filter((g) => parseFloat(g.rating) < 3);
  const lowPlayGames = games.filter((g) => g.plays < 100);

  if (activeGames.length === 0) {
    recommendations.push('All your games are inactive. Reactivate or publish new games.');
  }

  if (lowRatedGames.length > 0) {
    recommendations.push(
      `${lowRatedGames.length} game(s) have low ratings. Consider updating or improving them.`
    );
  }

  if (lowPlayGames.length > 0) {
    recommendations.push(
      `${lowPlayGames.length} game(s) have less than 100 plays. Consider marketing on Twitter or Discord.`
    );
  }

  if (games.length === 1) {
    recommendations.push('Consider publishing more games to diversify your revenue.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Your portfolio is performing well! Keep creating great games.');
  }

  return recommendations;
}
