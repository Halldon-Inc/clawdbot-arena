import { z } from 'zod';
import {
  GameListingSchema,
  OwnedItemSchema,
  PublishResultSchema,
  PurchaseResultSchema,
  ItemResultSchema,
  GameMetadataSchema,
  ItemDefinitionSchema,
  GameQuerySchema,
} from './marketplace-types';

// =============================================================================
// Moltblox Marketplace WebSocket Messages
// =============================================================================

// =============================================================================
// Client -> Server Messages
// =============================================================================

// Game Publishing
export const PublishGameMessageSchema = z.object({
  type: z.literal('PUBLISH_GAME'),
  code: z.string(), // TypeScript source code
  metadata: GameMetadataSchema,
});
export type PublishGameMessage = z.infer<typeof PublishGameMessageSchema>;

export const UpdateGameMessageSchema = z.object({
  type: z.literal('UPDATE_GAME'),
  gameId: z.string(),
  code: z.string().optional(),
  metadata: GameMetadataSchema.partial().optional(),
});
export type UpdateGameMessage = z.infer<typeof UpdateGameMessageSchema>;

// Item Management
export const CreateItemMessageSchema = z.object({
  type: z.literal('CREATE_ITEM'),
  gameId: z.string(),
  item: ItemDefinitionSchema,
});
export type CreateItemMessage = z.infer<typeof CreateItemMessageSchema>;

export const UpdateItemMessageSchema = z.object({
  type: z.literal('UPDATE_ITEM'),
  gameId: z.string(),
  itemId: z.string(),
  updates: ItemDefinitionSchema.partial(),
});
export type UpdateItemMessage = z.infer<typeof UpdateItemMessageSchema>;

// Marketplace Browsing
export const BrowseGamesMessageSchema = z.object({
  type: z.literal('BROWSE_GAMES'),
  query: GameQuerySchema,
});
export type BrowseGamesMessage = z.infer<typeof BrowseGamesMessageSchema>;

export const GetGameDetailsMessageSchema = z.object({
  type: z.literal('GET_GAME_DETAILS'),
  gameId: z.string(),
});
export type GetGameDetailsMessage = z.infer<typeof GetGameDetailsMessageSchema>;

// Purchases
export const PurchaseItemMessageSchema = z.object({
  type: z.literal('PURCHASE_ITEM'),
  gameId: z.string(),
  itemId: z.string(),
});
export type PurchaseItemMessage = z.infer<typeof PurchaseItemMessageSchema>;

// Inventory
export const GetInventoryMessageSchema = z.object({
  type: z.literal('GET_INVENTORY'),
  gameId: z.string().optional(), // If omitted, return all items
});
export type GetInventoryMessage = z.infer<typeof GetInventoryMessageSchema>;

// Wallet
export const GetWalletMessageSchema = z.object({
  type: z.literal('GET_WALLET'),
});
export type GetWalletMessage = z.infer<typeof GetWalletMessageSchema>;

// Ratings
export const RateGameMessageSchema = z.object({
  type: z.literal('RATE_GAME'),
  gameId: z.string(),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(1000).optional(),
});
export type RateGameMessage = z.infer<typeof RateGameMessageSchema>;

// Game Joining (user-created games)
export const JoinUserGameMessageSchema = z.object({
  type: z.literal('JOIN_USER_GAME'),
  gameId: z.string(),
});
export type JoinUserGameMessage = z.infer<typeof JoinUserGameMessageSchema>;

// Creator Dashboard
export const GetCreatorDashboardMessageSchema = z.object({
  type: z.literal('GET_CREATOR_DASHBOARD'),
});
export type GetCreatorDashboardMessage = z.infer<typeof GetCreatorDashboardMessageSchema>;

// Combined Client Marketplace Messages
export const MarketplaceClientMessageSchema = z.discriminatedUnion('type', [
  PublishGameMessageSchema,
  UpdateGameMessageSchema,
  CreateItemMessageSchema,
  UpdateItemMessageSchema,
  BrowseGamesMessageSchema,
  GetGameDetailsMessageSchema,
  PurchaseItemMessageSchema,
  GetInventoryMessageSchema,
  GetWalletMessageSchema,
  RateGameMessageSchema,
  JoinUserGameMessageSchema,
  GetCreatorDashboardMessageSchema,
]);
export type MarketplaceClientMessage = z.infer<typeof MarketplaceClientMessageSchema>;

// =============================================================================
// Server -> Client Messages
// =============================================================================

// Game Publishing Results
export const GamePublishedMessageSchema = z.object({
  type: z.literal('GAME_PUBLISHED'),
  result: PublishResultSchema,
});
export type GamePublishedMessage = z.infer<typeof GamePublishedMessageSchema>;

export const GameUpdatedMessageSchema = z.object({
  type: z.literal('GAME_UPDATED'),
  gameId: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type GameUpdatedMessage = z.infer<typeof GameUpdatedMessageSchema>;

// Item Results
export const ItemCreatedMessageSchema = z.object({
  type: z.literal('ITEM_CREATED'),
  result: ItemResultSchema,
});
export type ItemCreatedMessage = z.infer<typeof ItemCreatedMessageSchema>;

export const ItemUpdatedMessageSchema = z.object({
  type: z.literal('ITEM_UPDATED'),
  gameId: z.string(),
  itemId: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type ItemUpdatedMessage = z.infer<typeof ItemUpdatedMessageSchema>;

// Browse Results
export const GamesListMessageSchema = z.object({
  type: z.literal('GAMES_LIST'),
  games: z.array(GameListingSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
});
export type GamesListMessage = z.infer<typeof GamesListMessageSchema>;

// Purchase Events
export const ItemPurchasedMessageSchema = z.object({
  type: z.literal('ITEM_PURCHASED'),
  result: PurchaseResultSchema,
});
export type ItemPurchasedMessage = z.infer<typeof ItemPurchasedMessageSchema>;

// Inventory Updates
export const InventoryUpdateMessageSchema = z.object({
  type: z.literal('INVENTORY_UPDATE'),
  items: z.array(OwnedItemSchema),
});
export type InventoryUpdateMessage = z.infer<typeof InventoryUpdateMessageSchema>;

// Wallet Updates
export const WalletUpdateMessageSchema = z.object({
  type: z.literal('WALLET_UPDATE'),
  address: z.string(),
  compBalance: z.string(),
});
export type WalletUpdateMessage = z.infer<typeof WalletUpdateMessageSchema>;

// Balance Changes (real-time notifications)
export const BalanceChangeMessageSchema = z.object({
  type: z.literal('BALANCE_CHANGE'),
  previousBalance: z.string(),
  newBalance: z.string(),
  reason: z.enum(['purchase', 'sale', 'withdrawal', 'deposit']),
  transactionHash: z.string().optional(),
});
export type BalanceChangeMessage = z.infer<typeof BalanceChangeMessageSchema>;

// Rating Confirmation
export const RatingSubmittedMessageSchema = z.object({
  type: z.literal('RATING_SUBMITTED'),
  gameId: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type RatingSubmittedMessage = z.infer<typeof RatingSubmittedMessageSchema>;

// Game Join Confirmation
export const UserGameJoinedMessageSchema = z.object({
  type: z.literal('USER_GAME_JOINED'),
  gameId: z.string(),
  instanceId: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type UserGameJoinedMessage = z.infer<typeof UserGameJoinedMessageSchema>;

// Combined Server Marketplace Messages
export const MarketplaceServerMessageSchema = z.discriminatedUnion('type', [
  GamePublishedMessageSchema,
  GameUpdatedMessageSchema,
  ItemCreatedMessageSchema,
  ItemUpdatedMessageSchema,
  GamesListMessageSchema,
  ItemPurchasedMessageSchema,
  InventoryUpdateMessageSchema,
  WalletUpdateMessageSchema,
  BalanceChangeMessageSchema,
  RatingSubmittedMessageSchema,
  UserGameJoinedMessageSchema,
]);
export type MarketplaceServerMessage = z.infer<typeof MarketplaceServerMessageSchema>;
