/**
 * Item Tools
 *
 * MCP tools for creating and managing in-game items.
 */

import { z } from 'zod';
import type { MarketplaceManager } from '@clawdbot/marketplace';

// =============================================================================
// Schemas
// =============================================================================

export const CreateItemSchema = z.object({
  gameId: z.string().describe('ID of the game this item belongs to'),
  name: z.string().min(2).max(50).describe('Item name'),
  description: z.string().min(10).describe('Item description'),
  imageUrl: z.string().url().describe('Item image URL'),
  category: z.enum([
    'cosmetic',
    'power_up',
    'access',
    'consumable',
    'subscription',
  ]).describe('Item category'),
  price: z.string().describe('Price in wei (e.g., "1000000000000000000" for 1 COMP)'),
  maxSupply: z.number().min(1).optional().describe('Maximum supply (unlimited if not set)'),
  duration: z.number().min(1).optional().describe('Duration in seconds (for subscriptions)'),
  properties: z.record(z.any()).optional().describe('Custom properties for the item'),
});

export const UpdateItemPriceSchema = z.object({
  gameId: z.string().describe('ID of the game'),
  itemId: z.string().describe('ID of the item'),
  newPrice: z.string().describe('New price in wei'),
});

export const GetItemSchema = z.object({
  itemId: z.string().describe('ID of the item'),
});

export const GetGameItemsSchema = z.object({
  gameId: z.string().describe('ID of the game'),
});

export const DeactivateItemSchema = z.object({
  gameId: z.string().describe('ID of the game'),
  itemId: z.string().describe('ID of the item to deactivate'),
});

// =============================================================================
// Tool Definitions
// =============================================================================

export const itemToolDefinitions = [
  {
    name: 'create_item',
    description: `Create a new purchasable item for your game.

Item categories:
- cosmetic: Visual customization (skins, badges, effects)
- power_up: Temporary boosts during gameplay
- access: Unlock premium content/levels
- consumable: One-time use items (lives, hints)
- subscription: Time-limited access (VIP passes)

Pricing tips:
- Micro (0.1 COMP): Impulse buys
- Low (0.5 COMP): Casual purchases
- Medium (1 COMP): Standard items
- High (5 COMP): Premium items
- Whale (10+ COMP): Exclusive/limited items

Rate limit: 20 items per day.`,
    inputSchema: CreateItemSchema,
  },
  {
    name: 'update_item_price',
    description: `Update the price of an existing item.

Only the game creator can update item prices.
Price changes take effect immediately for new purchases.`,
    inputSchema: UpdateItemPriceSchema,
  },
  {
    name: 'get_item',
    description: `Get detailed information about an item.

Returns item metadata, sales statistics, and current status.`,
    inputSchema: GetItemSchema,
  },
  {
    name: 'get_game_items',
    description: `Get all items for a specific game.

Returns a list of all items with their details and sales stats.`,
    inputSchema: GetGameItemsSchema,
  },
  {
    name: 'deactivate_item',
    description: `Stop selling an item.

The item will no longer be available for purchase.
Players who already own it will retain ownership.`,
    inputSchema: DeactivateItemSchema,
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export function createItemToolHandlers(
  marketplace: MarketplaceManager,
  botId: string
) {
  return {
    create_item: async (args: z.infer<typeof CreateItemSchema>) => {
      // Verify game ownership
      const game = await marketplace.store.getGame(args.gameId);
      if (!game) {
        return { success: false, error: 'Game not found' };
      }
      if (game.creatorBotId !== botId) {
        return { success: false, error: 'You can only create items for your own games' };
      }

      const result = await marketplace.publishing.createItem({
        creatorId: botId,
        gameId: args.gameId,
        item: {
          name: args.name,
          description: args.description,
          imageUrl: args.imageUrl,
          category: args.category,
          price: args.price,
          maxSupply: args.maxSupply,
          duration: args.duration,
          properties: args.properties,
        },
      });

      if (result.success) {
        // Convert price to human-readable
        const priceComp = parseFloat(args.price) / 1e18;

        return {
          success: true,
          message: `Item "${args.name}" created successfully!`,
          itemId: result.itemId,
          price: `${priceComp} COMP`,
          category: args.category,
          maxSupply: args.maxSupply || 'unlimited',
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    },

    update_item_price: async (args: z.infer<typeof UpdateItemPriceSchema>) => {
      const result = await marketplace.publishing.updateItemPrice(
        botId,
        args.gameId,
        args.itemId,
        args.newPrice
      );

      if (result.success) {
        const priceComp = parseFloat(args.newPrice) / 1e18;
        return {
          success: true,
          message: `Item price updated to ${priceComp} COMP`,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    },

    get_item: async (args: z.infer<typeof GetItemSchema>) => {
      const item = await marketplace.store.getItem(args.itemId);

      if (!item) {
        return { success: false, error: 'Item not found' };
      }

      const priceComp = parseFloat(item.price) / 1e18;

      return {
        success: true,
        item: {
          itemId: item.itemId,
          gameId: item.gameId,
          name: item.name,
          description: item.description,
          category: item.category,
          price: `${priceComp} COMP`,
          priceWei: item.price,
          maxSupply: item.maxSupply || 'unlimited',
          soldCount: item.soldCount,
          active: item.active,
          duration: item.duration,
          properties: item.properties,
          createdAt: new Date(item.createdAt).toISOString(),
        },
      };
    },

    get_game_items: async (args: z.infer<typeof GetGameItemsSchema>) => {
      const items = await marketplace.publishing.getGameItems(args.gameId);

      const formattedItems = items.map((item: any) => {
        const priceComp = parseFloat(item.price) / 1e18;
        return {
          itemId: item.itemId,
          name: item.name,
          category: item.category,
          price: `${priceComp} COMP`,
          soldCount: item.soldCount,
          active: item.active,
          maxSupply: item.maxSupply || 'unlimited',
        };
      });

      return {
        success: true,
        items: formattedItems,
        count: formattedItems.length,
      };
    },

    deactivate_item: async (args: z.infer<typeof DeactivateItemSchema>) => {
      const result = await marketplace.publishing.deactivateItem(
        botId,
        args.gameId,
        args.itemId
      );

      if (result.success) {
        return {
          success: true,
          message: `Item ${args.itemId} has been deactivated.`,
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
