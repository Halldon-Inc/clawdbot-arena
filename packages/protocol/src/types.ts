import { z } from 'zod';

// =============================================================================
// Core Entity Types
// =============================================================================

export const BotCredentialsSchema = z.object({
  botId: z.string(),
  apiKey: z.string(),
  name: z.string(),
  walletAddress: z.string().optional(),
});
export type BotCredentials = z.infer<typeof BotCredentialsSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const EntitySchema = z.object({
  id: z.string(),
  type: z.string(),
  position: PositionSchema,
  properties: z.record(z.unknown()).optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

// =============================================================================
// Game State Types
// =============================================================================

export const GamePhaseSchema = z.enum([
  'waiting',
  'playing',
  'paused',
  'finished',
]);
export type GamePhase = z.infer<typeof GamePhaseSchema>;

export const PlayerStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: PositionSchema,
  health: z.number().optional(),
  score: z.number(),
  properties: z.record(z.unknown()).optional(),
});
export type PlayerState = z.infer<typeof PlayerStateSchema>;

export const GameStateSchema = z.object({
  gameId: z.string(),
  gameType: z.string(),
  tick: z.number(),
  timestamp: z.number(),
  phase: GamePhaseSchema,
  players: z.array(PlayerStateSchema),
  entities: z.array(EntitySchema).optional(),
  environment: z.record(z.unknown()).optional(),
  decisionDeadline: z.number(),
});
export type GameState = z.infer<typeof GameStateSchema>;

// =============================================================================
// Action Types
// =============================================================================

export const ActionTypeSchema = z.enum([
  'MOVE',
  'JUMP',
  'ATTACK',
  'USE_ABILITY',
  'PLACE',
  'SELECT',
  'WAIT',
  'CUSTOM',
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ActionSchema = z.object({
  type: ActionTypeSchema,
  payload: z.record(z.unknown()),
});
export type Action = z.infer<typeof ActionSchema>;

export const ActionResultSchema = z.object({
  success: z.boolean(),
  effects: z.array(z.object({
    type: z.string(),
    target: z.string().optional(),
    value: z.unknown().optional(),
  })),
  newState: GameStateSchema.optional(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// =============================================================================
// Match Types
// =============================================================================

export const MatchStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'disputed',
]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const MatchResultSchema = z.object({
  matchId: z.string(),
  gameType: z.string(),
  winner: z.string().nullable(),
  players: z.array(z.string()),
  scores: z.record(z.number()),
  duration: z.number(),
  replayUrl: z.string().optional(),
  timestamp: z.number(),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

// =============================================================================
// Betting Types
// =============================================================================

export const BetStatusSchema = z.enum([
  'pending',
  'confirmed',
  'won',
  'lost',
  'cancelled',
  'claimed',
]);
export type BetStatus = z.infer<typeof BetStatusSchema>;

export const BetSchema = z.object({
  betId: z.string(),
  matchId: z.string(),
  bettorAddress: z.string(),
  botIndex: z.number(),
  amount: z.string(), // BigInt as string
  odds: z.number(),
  status: BetStatusSchema,
  payout: z.string().optional(),
  transactionHash: z.string().optional(),
  createdAt: z.number(),
});
export type Bet = z.infer<typeof BetSchema>;

export const MatchPoolSchema = z.object({
  matchId: z.string(),
  totalPool: z.string(), // BigInt as string
  botPools: z.record(z.string()), // botIndex -> amount
  currentOdds: z.record(z.number()), // botIndex -> odds
  bettingLocked: z.boolean(),
});
export type MatchPool = z.infer<typeof MatchPoolSchema>;
