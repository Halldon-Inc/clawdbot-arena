import { z } from 'zod';
import { ActionSchema, GameStateSchema, MatchResultSchema, BetSchema } from './types';

// =============================================================================
// WebSocket Message Types
// =============================================================================

// Client -> Server Messages
export const AuthMessageSchema = z.object({
  type: z.literal('AUTH'),
  botId: z.string(),
  apiKey: z.string(),
  matchId: z.string().optional(),
});
export type AuthMessage = z.infer<typeof AuthMessageSchema>;

export const ActionMessageSchema = z.object({
  type: z.literal('ACTION'),
  action: ActionSchema,
  clientTick: z.number(),
  timestamp: z.number(),
});
export type ActionMessage = z.infer<typeof ActionMessageSchema>;

export const PingMessageSchema = z.object({
  type: z.literal('PING'),
  timestamp: z.number(),
});
export type PingMessage = z.infer<typeof PingMessageSchema>;

export const RequestStateMessageSchema = z.object({
  type: z.literal('REQUEST_STATE'),
});
export type RequestStateMessage = z.infer<typeof RequestStateMessageSchema>;

export const JoinMatchMessageSchema = z.object({
  type: z.literal('JOIN_MATCH'),
  gameType: z.string(),
  ranked: z.boolean().optional(),
});
export type JoinMatchMessage = z.infer<typeof JoinMatchMessageSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  AuthMessageSchema,
  ActionMessageSchema,
  PingMessageSchema,
  RequestStateMessageSchema,
  JoinMatchMessageSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server -> Client Messages
export const AuthOkMessageSchema = z.object({
  type: z.literal('AUTH_OK'),
  playerId: z.string(),
  sessionId: z.string(),
});
export type AuthOkMessage = z.infer<typeof AuthOkMessageSchema>;

export const StateUpdateMessageSchema = z.object({
  type: z.literal('STATE_UPDATE'),
  state: GameStateSchema,
  tick: z.number(),
  validActions: z.array(ActionSchema).optional(),
});
export type StateUpdateMessage = z.infer<typeof StateUpdateMessageSchema>;

export const ActionResultMessageSchema = z.object({
  type: z.literal('ACTION_RESULT'),
  success: z.boolean(),
  effects: z.array(z.object({
    type: z.string(),
    target: z.string().optional(),
    value: z.unknown().optional(),
  })),
});
export type ActionResultMessage = z.infer<typeof ActionResultMessageSchema>;

export const TurnStartMessageSchema = z.object({
  type: z.literal('TURN_START'),
  deadline: z.number(),
  validActions: z.array(ActionSchema),
});
export type TurnStartMessage = z.infer<typeof TurnStartMessageSchema>;

export const TurnEndMessageSchema = z.object({
  type: z.literal('TURN_END'),
  results: z.record(z.object({
    action: ActionSchema.optional(),
    effects: z.array(z.unknown()),
  })),
});
export type TurnEndMessage = z.infer<typeof TurnEndMessageSchema>;

export const MatchFoundMessageSchema = z.object({
  type: z.literal('MATCH_FOUND'),
  matchId: z.string(),
  gameType: z.string(),
  opponents: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
  yourIndex: z.number(),
});
export type MatchFoundMessage = z.infer<typeof MatchFoundMessageSchema>;

export const GameEndMessageSchema = z.object({
  type: z.literal('GAME_END'),
  result: MatchResultSchema,
});
export type GameEndMessage = z.infer<typeof GameEndMessageSchema>;

export const PongMessageSchema = z.object({
  type: z.literal('PONG'),
  timestamp: z.number(),
  serverTime: z.number(),
});
export type PongMessage = z.infer<typeof PongMessageSchema>;

export const ErrorMessageSchema = z.object({
  type: z.literal('ERROR'),
  code: z.string(),
  message: z.string(),
});
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  AuthOkMessageSchema,
  StateUpdateMessageSchema,
  ActionResultMessageSchema,
  TurnStartMessageSchema,
  TurnEndMessageSchema,
  MatchFoundMessageSchema,
  GameEndMessageSchema,
  PongMessageSchema,
  ErrorMessageSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// =============================================================================
// Spectator Messages
// =============================================================================

export const SpectatorJoinMessageSchema = z.object({
  type: z.literal('SPECTATOR_JOIN'),
  matchId: z.string(),
});
export type SpectatorJoinMessage = z.infer<typeof SpectatorJoinMessageSchema>;

export const SpectatorFrameSchema = z.object({
  type: z.literal('SPECTATOR_FRAME'),
  matchId: z.string(),
  tick: z.number(),
  state: GameStateSchema,
  events: z.array(z.object({
    type: z.string(),
    data: z.unknown(),
  })),
});
export type SpectatorFrame = z.infer<typeof SpectatorFrameSchema>;
