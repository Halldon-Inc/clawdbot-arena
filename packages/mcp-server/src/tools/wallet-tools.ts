/**
 * Wallet Tools
 *
 * MCP tools for wallet and balance management.
 */

import { z } from 'zod';
import type { MarketplaceManager } from '@clawdbot/marketplace';

// =============================================================================
// Schemas
// =============================================================================

export const GetBalanceSchema = z.object({});

export const GetInventorySchema = z.object({
  gameId: z.string().optional().describe('Filter inventory by game ID'),
});

export const UseConsumableSchema = z.object({
  itemId: z.string().describe('ID of the consumable item to use'),
  quantity: z.number().min(1).default(1).describe('How many to use'),
});

export const CheckOwnershipSchema = z.object({
  itemId: z.string().describe('ID of the item to check'),
});

export const CheckSubscriptionSchema = z.object({
  itemId: z.string().describe('ID of the subscription item to check'),
});

// =============================================================================
// Tool Definitions
// =============================================================================

export const walletToolDefinitions = [
  {
    name: 'get_balance',
    description: `Get your current COMP token balance.

Returns your balance in both wei and human-readable COMP.`,
    inputSchema: GetBalanceSchema,
  },
  {
    name: 'get_inventory',
    description: `Get your owned items.

Optionally filter by a specific game. Shows all items you've purchased,
including cosmetics, power-ups, and active subscriptions.`,
    inputSchema: GetInventorySchema,
  },
  {
    name: 'use_consumable',
    description: `Use a consumable item from your inventory.

Decreases the quantity of the item. Returns the remaining quantity.`,
    inputSchema: UseConsumableSchema,
  },
  {
    name: 'check_ownership',
    description: `Check if you own a specific item.

Useful for verifying purchases or checking access rights.`,
    inputSchema: CheckOwnershipSchema,
  },
  {
    name: 'check_subscription',
    description: `Check the status of a subscription item.

Returns whether the subscription is active and when it expires.`,
    inputSchema: CheckSubscriptionSchema,
  },
  {
    name: 'get_earnings',
    description: `Get your total earnings as a game creator.

Returns total COMP earned from all your games' item sales.`,
    inputSchema: z.object({}),
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export function createWalletToolHandlers(
  marketplace: MarketplaceManager,
  botId: string,
  botAddress: string
) {
  return {
    get_balance: async () => {
      const balanceWei = await marketplace.purchases.getBalance(botAddress);
      const balanceComp = parseFloat(balanceWei) / 1e18;

      return {
        success: true,
        balance: {
          wei: balanceWei,
          comp: balanceComp,
          formatted: `${balanceComp.toFixed(4)} COMP`,
        },
        address: botAddress,
      };
    },

    get_inventory: async (args: z.infer<typeof GetInventorySchema>) => {
      const inventory = await marketplace.purchases.getInventory(
        botId,
        args.gameId
      );

      const items = inventory.map((item) => ({
        itemId: item.itemId,
        gameId: item.gameId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        acquiredAt: new Date(item.acquiredAt).toISOString(),
        expiresAt: item.expiresAt
          ? new Date(item.expiresAt).toISOString()
          : null,
        isActive: !item.expiresAt || item.expiresAt > Date.now(),
      }));

      return {
        success: true,
        inventory: items,
        count: items.length,
        gameId: args.gameId || 'all',
      };
    },

    use_consumable: async (args: z.infer<typeof UseConsumableSchema>) => {
      const result = await marketplace.purchases.useConsumable(
        botId,
        args.itemId,
        args.quantity
      );

      if (result.success) {
        return {
          success: true,
          message: `Used ${args.quantity}x item`,
          remaining: result.remaining,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    },

    check_ownership: async (args: z.infer<typeof CheckOwnershipSchema>) => {
      const owns = await marketplace.purchases.checkOwnership(
        botAddress,
        args.itemId
      );

      return {
        success: true,
        itemId: args.itemId,
        owns,
      };
    },

    check_subscription: async (args: z.infer<typeof CheckSubscriptionSchema>) => {
      const status = await marketplace.purchases.checkSubscription(
        botAddress,
        args.itemId
      );

      return {
        success: true,
        itemId: args.itemId,
        active: status.active,
        expiresAt: status.expiresAt
          ? new Date(status.expiresAt).toISOString()
          : null,
        remainingDays: status.expiresAt
          ? Math.ceil((status.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
          : null,
      };
    },

    get_earnings: async () => {
      const earningsWei = await marketplace.purchases.getCreatorEarnings(botId);
      const earningsComp = parseFloat(earningsWei) / 1e18;

      return {
        success: true,
        earnings: {
          wei: earningsWei,
          comp: earningsComp,
          formatted: `${earningsComp.toFixed(4)} COMP`,
        },
        note: 'This is your total earnings after the 10% platform fee.',
      };
    },
  };
}
