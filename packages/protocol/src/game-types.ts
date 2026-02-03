import { z } from 'zod';

// =============================================================================
// Game Type Definitions
// =============================================================================

export const GameTypeSchema = z.enum([
  'platformer',
  'puzzle',
  'strategy',
  'beat_em_up',
]);
export type GameType = z.infer<typeof GameTypeSchema>;

export const GameConfigSchema = z.object({
  gameType: GameTypeSchema,
  maxPlayers: z.number(),
  turnBased: z.boolean(),
  tickRate: z.number(), // Updates per second (0 for pure turn-based)
  turnTimeout: z.number(), // Max time per turn in ms
  maxTurns: z.number().optional(),
  maxDuration: z.number().optional(), // Max game duration in ms
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

// =============================================================================
// Platformer Game Types
// =============================================================================

export const PlatformerPlayerStateSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  vx: z.number(),
  vy: z.number(),
  grounded: z.boolean(),
  health: z.number(),
  checkpoint: z.number(),
  score: z.number(),
});
export type PlatformerPlayerState = z.infer<typeof PlatformerPlayerStateSchema>;

export const PlatformSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  type: z.enum(['solid', 'moving', 'breakable']).optional(),
});
export type Platform = z.infer<typeof PlatformSchema>;

export const HazardSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  damage: z.number(),
  type: z.enum(['spike', 'lava', 'enemy']),
});
export type Hazard = z.infer<typeof HazardSchema>;

export const PlatformerStateSchema = z.object({
  gameId: z.string(),
  tick: z.number(),
  players: z.record(PlatformerPlayerStateSchema),
  platforms: z.array(PlatformSchema),
  hazards: z.array(HazardSchema),
  goal: z.object({ x: z.number(), y: z.number() }),
  timeRemaining: z.number(),
});
export type PlatformerState = z.infer<typeof PlatformerStateSchema>;

export const PlatformerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MOVE'), direction: z.enum(['left', 'right', 'none']) }),
  z.object({ type: z.literal('JUMP') }),
  z.object({ type: z.literal('DOUBLE_JUMP') }),
  z.object({ type: z.literal('DASH'), direction: z.enum(['left', 'right']) }),
]);
export type PlatformerAction = z.infer<typeof PlatformerActionSchema>;

// =============================================================================
// Puzzle Game Types
// =============================================================================

export const TileSchema = z.object({
  id: z.string(),
  type: z.string(),
  color: z.string().optional(),
  value: z.number().optional(),
});
export type Tile = z.infer<typeof TileSchema>;

export const PuzzleStateSchema = z.object({
  gameId: z.string(),
  tick: z.number(),
  board: z.array(z.array(TileSchema)),
  currentPlayer: z.string(),
  scores: z.record(z.number()),
  movesRemaining: z.number(),
  combos: z.number(),
});
export type PuzzleState = z.infer<typeof PuzzleStateSchema>;

export const PuzzleActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SWAP'),
    from: z.object({ x: z.number(), y: z.number() }),
    to: z.object({ x: z.number(), y: z.number() }),
  }),
  z.object({
    type: z.literal('ROTATE'),
    center: z.object({ x: z.number(), y: z.number() }),
    direction: z.enum(['cw', 'ccw']),
  }),
]);
export type PuzzleAction = z.infer<typeof PuzzleActionSchema>;

// =============================================================================
// Strategy Game Types
// =============================================================================

export const UnitSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  health: z.number(),
  attack: z.number(),
  ownerId: z.string(),
});
export type Unit = z.infer<typeof UnitSchema>;

export const BuildingSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  ownerId: z.string(),
});
export type Building = z.infer<typeof BuildingSchema>;

export const ZoneSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  radius: z.number(),
  ownerId: z.string().nullable(),
  resourceValue: z.number(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const StrategyPlayerStateSchema = z.object({
  id: z.string(),
  resources: z.number(),
  units: z.array(UnitSchema),
  buildings: z.array(BuildingSchema),
  territories: z.array(z.string()),
});
export type StrategyPlayerState = z.infer<typeof StrategyPlayerStateSchema>;

export const StrategyStateSchema = z.object({
  gameId: z.string(),
  tick: z.number(),
  players: z.record(StrategyPlayerStateSchema),
  zones: z.array(ZoneSchema),
  mapWidth: z.number(),
  mapHeight: z.number(),
});
export type StrategyState = z.infer<typeof StrategyStateSchema>;

export const StrategyActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MOVE_UNIT'), unitId: z.string(), target: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ type: z.literal('ATTACK'), unitId: z.string(), targetId: z.string() }),
  z.object({ type: z.literal('BUILD'), buildingType: z.string(), position: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ type: z.literal('TRAIN_UNIT'), buildingId: z.string(), unitType: z.string() }),
  z.object({ type: z.literal('CAPTURE'), unitId: z.string(), zoneId: z.string() }),
]);
export type StrategyAction = z.infer<typeof StrategyActionSchema>;
