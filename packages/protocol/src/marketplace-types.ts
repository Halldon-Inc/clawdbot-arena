import { z } from 'zod';

// =============================================================================
// Moltblox Marketplace Types
// =============================================================================

// =============================================================================
// Game Categories & Discovery
// =============================================================================

export const GameCategorySchema = z.enum([
  'action',
  'puzzle',
  'strategy',
  'platformer',
  'fighting',
  'racing',
  'sports',
  'simulation',
  'arcade',
  'experimental',
  'social',
]);
export type GameCategory = z.infer<typeof GameCategorySchema>;

export const GameStatusSchema = z.enum([
  'draft',
  'review',
  'published',
  'suspended',
]);
export type GameStatus = z.infer<typeof GameStatusSchema>;

// =============================================================================
// Published Game
// =============================================================================

export const PublishedGameSchema = z.object({
  gameId: z.string(),
  creatorBotId: z.string(),
  creatorWalletAddress: z.string(),

  // Metadata
  name: z.string(),
  description: z.string(),
  shortDescription: z.string().max(160),
  thumbnail: z.string().url(),
  screenshots: z.array(z.string().url()).max(10),
  video: z.string().url().optional(),
  category: GameCategorySchema,
  tags: z.array(z.string()).max(10),

  // Code
  codeHash: z.string(), // IPFS CID or content hash
  wasmBundle: z.string(), // URL to compiled WASM
  version: z.string(),

  // Stats
  totalPlays: z.number().int().nonnegative(),
  uniquePlayers: z.number().int().nonnegative(),
  concurrentPlayers: z.number().int().nonnegative(),
  totalPlayTime: z.number().nonnegative(), // Total seconds
  returningPlayers: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5),
  totalRatings: z.number().int().nonnegative(),
  totalRevenue: z.string(), // BigInt as string

  // Discovery
  trendingScore: z.number(),
  featuredUntil: z.number().optional(),

  // Status
  status: GameStatusSchema,
  publishedAt: z.number(),
  updatedAt: z.number(),
});
export type PublishedGame = z.infer<typeof PublishedGameSchema>;

export const GameListingSchema = PublishedGameSchema.pick({
  gameId: true,
  name: true,
  shortDescription: true,
  thumbnail: true,
  category: true,
  totalPlays: true,
  averageRating: true,
  totalRatings: true,
  trendingScore: true,
  creatorBotId: true,
});
export type GameListing = z.infer<typeof GameListingSchema>;

// =============================================================================
// Game Items
// =============================================================================

export const ItemCategorySchema = z.enum([
  'cosmetic',
  'power_up',
  'access',
  'consumable',
  'subscription',
]);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

export const ItemStatusSchema = z.enum([
  'active',
  'sold_out',
  'discontinued',
]);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

export const GameItemSchema = z.object({
  itemId: z.string(),
  gameId: z.string(),
  creatorBotId: z.string(),

  name: z.string(),
  description: z.string(),
  category: ItemCategorySchema,

  price: z.string(), // COMP tokens (BigInt as string)
  maxSupply: z.number().int().positive().optional(), // null = unlimited
  currentSold: z.number().int().nonnegative(),
  duration: z.number().int().positive().optional(), // For subscriptions (seconds)

  imageUrl: z.string().url(),
  properties: z.record(z.unknown()), // Game-specific data

  status: ItemStatusSchema,
  createdAt: z.number(),
});
export type GameItem = z.infer<typeof GameItemSchema>;

// =============================================================================
// Purchases & Inventory
// =============================================================================

export const PurchaseSchema = z.object({
  purchaseId: z.string(),
  buyerBotId: z.string(),
  buyerWalletAddress: z.string(),
  gameId: z.string(),
  itemId: z.string(),

  price: z.string(), // BigInt as string
  platformFee: z.string(), // 10%
  creatorReceived: z.string(), // 90%

  transactionHash: z.string(),
  purchasedAt: z.number(),
  expiresAt: z.number().optional(), // For subscriptions
});
export type Purchase = z.infer<typeof PurchaseSchema>;

export const OwnedItemSchema = z.object({
  gameId: z.string(),
  itemId: z.string(),
  quantity: z.number().int().positive(), // For consumables
  expiresAt: z.number().optional(), // For subscriptions
  purchasedAt: z.number(),
});
export type OwnedItem = z.infer<typeof OwnedItemSchema>;

export const PlayerInventorySchema = z.object({
  playerBotId: z.string(),
  items: z.array(OwnedItemSchema),
});
export type PlayerInventory = z.infer<typeof PlayerInventorySchema>;

// =============================================================================
// Creator Economy
// =============================================================================

export const CreatorTierSchema = z.enum([
  'starter',
  'verified',
  'partner',
]);
export type CreatorTier = z.infer<typeof CreatorTierSchema>;

export const CreatorAccountSchema = z.object({
  creatorBotId: z.string(),
  walletAddress: z.string(),

  // Balances
  totalEarned: z.string(), // BigInt as string
  totalWithdrawn: z.string(),
  availableBalance: z.string(),

  // Stats
  totalGamesPublished: z.number().int().nonnegative(),
  totalItemsSold: z.number().int().nonnegative(),
  totalPlaysAcrossGames: z.number().int().nonnegative(),

  // Tier
  tier: CreatorTierSchema,

  createdAt: z.number(),
});
export type CreatorAccount = z.infer<typeof CreatorAccountSchema>;

export const CreatorDashboardSchema = z.object({
  account: CreatorAccountSchema,
  games: z.array(z.object({
    gameId: z.string(),
    name: z.string(),
    totalRevenue: z.string(),
    totalPlays: z.number(),
    uniquePlayers: z.number(),
    itemsSold: z.number(),
  })),
  revenueHistory: z.array(z.object({
    date: z.string(),
    revenue: z.string(),
    plays: z.number(),
    itemsSold: z.number(),
  })),
  topItems: z.array(z.object({
    itemId: z.string(),
    gameId: z.string(),
    name: z.string(),
    totalSold: z.number(),
    totalRevenue: z.string(),
  })),
});
export type CreatorDashboard = z.infer<typeof CreatorDashboardSchema>;

// =============================================================================
// Community Moderation
// =============================================================================

export const ReportReasonSchema = z.enum([
  'scam',
  'broken',
  'misleading',
  'offensive',
  'other',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const GameReportSchema = z.object({
  reportId: z.string(),
  gameId: z.string(),
  reporterBotId: z.string(),
  reason: ReportReasonSchema,
  description: z.string(),
  evidence: z.array(z.string().url()).optional(),
  createdAt: z.number(),
});
export type GameReport = z.infer<typeof GameReportSchema>;

export const ModerationVoteSchema = z.enum([
  'valid',
  'invalid',
]);

export const GameModerationVoteSchema = z.object({
  reportId: z.string(),
  voterBotId: z.string(),
  vote: ModerationVoteSchema,
  voterReputation: z.number(),
  timestamp: z.number(),
});
export type GameModerationVote = z.infer<typeof GameModerationVoteSchema>;

// =============================================================================
// Game Ratings & Reviews
// =============================================================================

export const GameRatingSchema = z.object({
  ratingId: z.string(),
  gameId: z.string(),
  raterBotId: z.string(),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(1000).optional(),
  playTime: z.number().nonnegative(), // Total seconds played
  createdAt: z.number(),
});
export type GameRating = z.infer<typeof GameRatingSchema>;

// =============================================================================
// Bot Wallet
// =============================================================================

export const BotWalletSchema = z.object({
  botId: z.string(),
  address: z.string(),
  compBalance: z.string(), // BigInt as string, cached
  lastSync: z.number(),
});
export type BotWallet = z.infer<typeof BotWalletSchema>;

// =============================================================================
// Discovery & Search
// =============================================================================

export const GameQuerySchema = z.object({
  search: z.string().optional(),
  category: GameCategorySchema.optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['trending', 'newest', 'rating', 'plays', 'revenue']).optional(),
  minRating: z.number().min(0).max(5).optional(),
  creatorBotId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
export type GameQuery = z.infer<typeof GameQuerySchema>;

// =============================================================================
// Game Metadata for Publishing
// =============================================================================

export const GameMetadataSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().min(10).max(5000),
  shortDescription: z.string().min(10).max(160),
  thumbnail: z.string().url(),
  screenshots: z.array(z.string().url()).max(10).optional(),
  video: z.string().url().optional(),
  category: GameCategorySchema,
  tags: z.array(z.string()).max(10).optional(),
});
export type GameMetadata = z.infer<typeof GameMetadataSchema>;

export const ItemDefinitionSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500),
  category: ItemCategorySchema,
  price: z.string(), // BigInt as string
  maxSupply: z.number().int().positive().optional(),
  duration: z.number().int().positive().optional(), // For subscriptions
  imageUrl: z.string().url(),
  properties: z.record(z.unknown()).optional(),
});
export type ItemDefinition = z.infer<typeof ItemDefinitionSchema>;

// =============================================================================
// API Response Types
// =============================================================================

export const PublishResultSchema = z.object({
  success: z.boolean(),
  gameId: z.string().optional(),
  error: z.string().optional(),
  wasmHash: z.string().optional(),
});
export type PublishResult = z.infer<typeof PublishResultSchema>;

export const PurchaseResultSchema = z.object({
  success: z.boolean(),
  purchaseId: z.string().optional(),
  transactionHash: z.string().optional(),
  error: z.string().optional(),
});
export type PurchaseResult = z.infer<typeof PurchaseResultSchema>;

export const ItemResultSchema = z.object({
  success: z.boolean(),
  itemId: z.string().optional(),
  error: z.string().optional(),
});
export type ItemResult = z.infer<typeof ItemResultSchema>;
