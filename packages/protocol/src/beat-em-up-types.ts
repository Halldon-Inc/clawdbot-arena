import { z } from 'zod';

// =============================================================================
// Beat 'em Up Game Types - Castle Crashers Style Arena Combat
// =============================================================================

// =============================================================================
// Fighter State Types
// =============================================================================

export const FighterStateEnumSchema = z.enum([
  'idle',
  'walking',
  'running',
  'jumping',
  'falling',
  'attacking',
  'blocking',
  'hitstun',
  'knockdown',
  'getting_up',
  'ko',
]);
export type FighterStateEnum = z.infer<typeof FighterStateEnumSchema>;

export const FacingDirectionSchema = z.enum(['left', 'right']);
export type FacingDirection = z.infer<typeof FacingDirectionSchema>;

export const FighterStateSchema = z.object({
  health: z.number().min(0).max(1000),
  maxHealth: z.number().default(1000),
  magic: z.number().min(0).max(100).default(0),
  maxMagic: z.number().default(100),
  x: z.number(),
  y: z.number(),
  vx: z.number().default(0),
  vy: z.number().default(0),
  facing: FacingDirectionSchema,
  state: FighterStateEnumSchema,
  grounded: z.boolean(),
  canAct: z.boolean(),
  comboCounter: z.number().default(0),
  lastAttackFrame: z.number().default(0),
});
export type FighterState = z.infer<typeof FighterStateSchema>;

// =============================================================================
// Bot Input Types
// =============================================================================

export const BotInputSchema = z.object({
  left: z.boolean().default(false),
  right: z.boolean().default(false),
  up: z.boolean().default(false),
  down: z.boolean().default(false),
  attack1: z.boolean().default(false),  // Light attack
  attack2: z.boolean().default(false),  // Heavy attack
  jump: z.boolean().default(false),
  special: z.boolean().default(false),  // Magic/Special
});
export type BotInput = z.infer<typeof BotInputSchema>;

// =============================================================================
// Bot Observation Types (what bots receive each frame)
// =============================================================================

export const SelfObservationSchema = z.object({
  health: z.number(),
  healthPercent: z.number().min(0).max(1),
  magic: z.number(),
  magicPercent: z.number().min(0).max(1),
  position: z.object({ x: z.number(), y: z.number() }),
  velocity: z.object({ vx: z.number(), vy: z.number() }),
  state: FighterStateEnumSchema,
  facing: FacingDirectionSchema,
  grounded: z.boolean(),
  canAct: z.boolean(),
  comboCounter: z.number(),
});
export type SelfObservation = z.infer<typeof SelfObservationSchema>;

export const OpponentObservationSchema = z.object({
  health: z.number(),
  healthPercent: z.number().min(0).max(1),
  position: z.object({ x: z.number(), y: z.number() }),
  state: FighterStateEnumSchema,
  facing: FacingDirectionSchema,
  isAttacking: z.boolean(),
  isBlocking: z.boolean(),
  isVulnerable: z.boolean(), // In hitstun, knockdown, or getting up
  grounded: z.boolean(),
});
export type OpponentObservation = z.infer<typeof OpponentObservationSchema>;

export const ValidActionsSchema = z.array(z.enum([
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'JUMP',
  'ATTACK_LIGHT',
  'ATTACK_HEAVY',
  'BLOCK',
  'SPECIAL',
  'WAIT',
]));
export type ValidActions = z.infer<typeof ValidActionsSchema>;

export const BotObservationSchema = z.object({
  // Self state
  self: SelfObservationSchema,

  // Opponent state
  opponent: OpponentObservationSchema,

  // Spatial awareness
  distance: z.number(),
  horizontalDistance: z.number(),
  verticalDistance: z.number(),
  inAttackRange: z.boolean(),
  inSpecialRange: z.boolean(),

  // Match state
  roundNumber: z.number().min(1).max(5),
  roundsWon: z.number().min(0),
  roundsLost: z.number().min(0),
  timeRemaining: z.number(),

  // Frame data
  frameNumber: z.number(),
  decisionDeadlineMs: z.number(),

  // Available actions
  validActions: ValidActionsSchema,
});
export type BotObservation = z.infer<typeof BotObservationSchema>;

// =============================================================================
// Match State Types
// =============================================================================

export const MatchPhaseSchema = z.enum([
  'countdown',    // 3, 2, 1, FIGHT!
  'fighting',     // Active combat
  'round_end',    // KO or timeout
  'ko',           // Someone got knocked out
  'timeout',      // Time ran out
  'match_end',    // Match finished (someone won best of 3)
]);
export type MatchPhase = z.infer<typeof MatchPhaseSchema>;

export const ArenaMatchStateSchema = z.object({
  matchId: z.string(),
  player1: FighterStateSchema,
  player2: FighterStateSchema,
  player1BotId: z.string(),
  player2BotId: z.string(),
  roundNumber: z.number().min(1).max(5),
  roundsP1: z.number().min(0).max(3),
  roundsP2: z.number().min(0).max(3),
  timeRemaining: z.number().min(0).max(99),
  phase: MatchPhaseSchema,
  frameNumber: z.number(),
  winner: z.string().nullable(),
});
export type ArenaMatchState = z.infer<typeof ArenaMatchStateSchema>;

// =============================================================================
// Combat Event Types
// =============================================================================

export const AttackTypeSchema = z.enum([
  'light_1',
  'light_2',
  'light_3',
  'light_4',
  'heavy',
  'air_light',
  'air_heavy',
  'special',
]);
export type AttackType = z.infer<typeof AttackTypeSchema>;

export const DamageEventSchema = z.object({
  attackerId: z.string(),
  defenderId: z.string(),
  attackType: AttackTypeSchema,
  damage: z.number(),
  isCombo: z.boolean(),
  comboHitNumber: z.number(),
  defenderHealthAfter: z.number(),
  frameNumber: z.number(),
});
export type DamageEvent = z.infer<typeof DamageEventSchema>;

export const KOEventSchema = z.object({
  winnerId: z.string(),
  loserId: z.string(),
  roundNumber: z.number(),
  winnerHealthRemaining: z.number(),
  totalDamageDealt: z.number(),
  longestCombo: z.number(),
  frameNumber: z.number(),
});
export type KOEvent = z.infer<typeof KOEventSchema>;

// =============================================================================
// Ranking Types
// =============================================================================

export const RankTierSchema = z.enum([
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'master',
  'grandmaster',
  'champion',
]);
export type RankTier = z.infer<typeof RankTierSchema>;

export const RANK_THRESHOLDS: Record<RankTier, { min: number; max: number; color: string }> = {
  bronze: { min: 0, max: 1199, color: '#CD7F32' },
  silver: { min: 1200, max: 1399, color: '#C0C0C0' },
  gold: { min: 1400, max: 1599, color: '#FFD700' },
  platinum: { min: 1600, max: 1799, color: '#E5E4E2' },
  diamond: { min: 1800, max: 1999, color: '#B9F2FF' },
  master: { min: 2000, max: 2199, color: '#9966CC' },
  grandmaster: { min: 2200, max: 2399, color: '#FF4444' },
  champion: { min: 2400, max: 9999, color: '#FFD700' },
};

export const PlayerRatingSchema = z.object({
  playerId: z.string(),
  botName: z.string(),
  rating: z.number().min(0).max(9999),
  tier: RankTierSchema,
  gamesPlayed: z.number().min(0),
  wins: z.number().min(0),
  losses: z.number().min(0),
  winRate: z.number().min(0).max(1),
  peakRating: z.number(),
  currentStreak: z.number(), // Positive = win streak, negative = loss streak
  lastMatchTimestamp: z.number(),
});
export type PlayerRating = z.infer<typeof PlayerRatingSchema>;

export const EloChangeSchema = z.object({
  playerId: z.string(),
  oldRating: z.number(),
  newRating: z.number(),
  change: z.number(),
  matchId: z.string(),
  opponentId: z.string(),
  isWin: z.boolean(),
  timestamp: z.number(),
});
export type EloChange = z.infer<typeof EloChangeSchema>;

// =============================================================================
// Leaderboard Types
// =============================================================================

export const LeaderboardEntrySchema = z.object({
  rank: z.number().min(1),
  playerId: z.string(),
  botName: z.string(),
  rating: z.number(),
  tier: RankTierSchema,
  gamesPlayed: z.number(),
  winRate: z.number(),
  isOnline: z.boolean(),
  isInMatch: z.boolean(),
  currentMatchId: z.string().nullable(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardUpdateSchema = z.object({
  type: z.literal('LEADERBOARD_UPDATE'),
  changes: z.array(z.object({
    playerId: z.string(),
    oldRank: z.number().nullable(),
    newRank: z.number(),
    oldRating: z.number().nullable(),
    newRating: z.number(),
    direction: z.enum(['up', 'down', 'new', 'unchanged']),
  })),
  timestamp: z.number(),
});
export type LeaderboardUpdate = z.infer<typeof LeaderboardUpdateSchema>;

export const LeaderboardSnapshotSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
  totalPlayers: z.number(),
  lastUpdated: z.number(),
});
export type LeaderboardSnapshot = z.infer<typeof LeaderboardSnapshotSchema>;

// =============================================================================
// Matchmaking Types
// =============================================================================

export const MatchmakingStatusSchema = z.enum([
  'searching',
  'found',
  'confirming',
  'starting',
  'cancelled',
  'timeout',
]);
export type MatchmakingStatus = z.infer<typeof MatchmakingStatusSchema>;

export const MatchmakingRequestSchema = z.object({
  playerId: z.string(),
  rating: z.number(),
  ratingRange: z.number().default(100), // +-100 initially
  maxWaitMs: z.number().default(120000), // 2 minutes
  timestamp: z.number(),
});
export type MatchmakingRequest = z.infer<typeof MatchmakingRequestSchema>;

export const MatchmakingResultSchema = z.object({
  status: MatchmakingStatusSchema,
  matchId: z.string().optional(),
  player1Id: z.string().optional(),
  player2Id: z.string().optional(),
  ratingDifference: z.number().optional(),
  waitTimeMs: z.number().optional(),
});
export type MatchmakingResult = z.infer<typeof MatchmakingResultSchema>;

// =============================================================================
// Game Configuration
// =============================================================================

export const ArenaGameConfigSchema = z.object({
  gameType: z.literal('beat_em_up'),
  maxPlayers: z.literal(2),
  turnBased: z.literal(false).default(false), // Real-time game
  turnTimeout: z.number().default(100), // Same as decisionTimeoutMs
  roundsToWin: z.number().default(2), // Best of 3
  roundTimeSeconds: z.number().default(99),
  startingHealth: z.number().default(1000),
  startingMagic: z.number().default(0),
  magicGainPerHit: z.number().default(5),
  tickRate: z.number().default(60), // 60 FPS
  decisionTimeoutMs: z.number().default(100), // 100ms to respond
  stageWidth: z.number().default(1920),
  stageHeight: z.number().default(1080),
});
export type ArenaGameConfig = z.infer<typeof ArenaGameConfigSchema>;

// =============================================================================
// WebSocket Message Types for Beat 'em Up
// =============================================================================

export const ArenaMessageSchema = z.discriminatedUnion('type', [
  // Server -> Bot: Observation for decision
  z.object({
    type: z.literal('OBSERVATION'),
    observation: BotObservationSchema,
    requiresResponse: z.boolean(),
  }),

  // Bot -> Server: Input response
  z.object({
    type: z.literal('INPUT'),
    input: BotInputSchema,
    frameNumber: z.number(),
  }),

  // Server -> All: Match state update (for spectators)
  z.object({
    type: z.literal('MATCH_STATE'),
    state: ArenaMatchStateSchema,
  }),

  // Server -> All: Damage event
  z.object({
    type: z.literal('DAMAGE'),
    event: DamageEventSchema,
  }),

  // Server -> All: KO event
  z.object({
    type: z.literal('KO'),
    event: KOEventSchema,
  }),

  // Server -> All: Round end
  z.object({
    type: z.literal('ROUND_END'),
    roundNumber: z.number(),
    winnerId: z.string(),
    roundsP1: z.number(),
    roundsP2: z.number(),
  }),

  // Server -> All: Match end
  z.object({
    type: z.literal('MATCH_END'),
    matchId: z.string(),
    winnerId: z.string(),
    finalScore: z.object({
      p1Rounds: z.number(),
      p2Rounds: z.number(),
    }),
    ratingChanges: z.array(EloChangeSchema),
  }),

  // Leaderboard updates
  LeaderboardUpdateSchema,
]);
export type ArenaMessage = z.infer<typeof ArenaMessageSchema>;
