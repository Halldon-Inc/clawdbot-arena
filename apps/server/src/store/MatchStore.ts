/**
 * Match Store
 * Stores match history and replays
 */

import type { Redis } from 'ioredis';
import type { ReplayData } from '../match/ReplayRecorder.js';

export interface MatchRecord {
  matchId: string;
  player1BotId: string;
  player2BotId: string;
  player1Name: string;
  player2Name: string;
  winner: string | null;
  p1Rounds: number;
  p2Rounds: number;
  duration: number;
  totalFrames: number;
  startedAt: number;
  endedAt: number;
  hasReplay: boolean;
}

export interface MatchQuery {
  botId?: string;
  limit?: number;
  offset?: number;
  includeReplays?: boolean;
}

export class MatchStore {
  private redis: Redis | null;
  private localMatches: Map<string, MatchRecord>;
  private localReplays: Map<string, ReplayData>;
  private maxLocalReplays: number;

  constructor(redis?: Redis, maxLocalReplays = 100) {
    this.redis = redis || null;
    this.localMatches = new Map();
    this.localReplays = new Map();
    this.maxLocalReplays = maxLocalReplays;
  }

  /**
   * Store a completed match
   */
  async saveMatch(replay: ReplayData, player1Name: string, player2Name: string): Promise<void> {
    const record: MatchRecord = {
      matchId: replay.matchId,
      player1BotId: replay.player1BotId,
      player2BotId: replay.player2BotId,
      player1Name,
      player2Name,
      winner: replay.winner,
      p1Rounds: replay.finalScore.p1Rounds,
      p2Rounds: replay.finalScore.p2Rounds,
      duration: replay.duration,
      totalFrames: replay.totalFrames,
      startedAt: replay.startedAt,
      endedAt: replay.endedAt,
      hasReplay: true,
    };

    if (this.redis) {
      // Store match record
      await this.redis.hset(
        'matches',
        replay.matchId,
        JSON.stringify(record)
      );

      // Store replay separately (large data)
      await this.redis.set(
        `replay:${replay.matchId}`,
        JSON.stringify(replay),
        'EX',
        86400 * 7 // 7 days TTL
      );

      // Add to player match lists
      await this.redis.lpush(`matches:${replay.player1BotId}`, replay.matchId);
      await this.redis.lpush(`matches:${replay.player2BotId}`, replay.matchId);

      // Trim player match lists
      await this.redis.ltrim(`matches:${replay.player1BotId}`, 0, 99);
      await this.redis.ltrim(`matches:${replay.player2BotId}`, 0, 99);
    }

    // Local storage
    this.localMatches.set(replay.matchId, record);
    this.localReplays.set(replay.matchId, replay);

    // Evict old local replays
    if (this.localReplays.size > this.maxLocalReplays) {
      const oldest = Array.from(this.localReplays.keys())[0];
      this.localReplays.delete(oldest);
    }
  }

  /**
   * Get a match record
   */
  async getMatch(matchId: string): Promise<MatchRecord | null> {
    if (this.redis) {
      const data = await this.redis.hget('matches', matchId);
      if (data) {
        return JSON.parse(data);
      }
    }

    return this.localMatches.get(matchId) || null;
  }

  /**
   * Get match replay
   */
  async getReplay(matchId: string): Promise<ReplayData | null> {
    if (this.redis) {
      const data = await this.redis.get(`replay:${matchId}`);
      if (data) {
        return JSON.parse(data);
      }
    }

    return this.localReplays.get(matchId) || null;
  }

  /**
   * Query matches
   */
  async queryMatches(query: MatchQuery): Promise<MatchRecord[]> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    let matchIds: string[] = [];

    if (this.redis) {
      if (query.botId) {
        matchIds = await this.redis.lrange(
          `matches:${query.botId}`,
          offset,
          offset + limit - 1
        );
      } else {
        matchIds = await this.redis.hkeys('matches');
        matchIds = matchIds.slice(offset, offset + limit);
      }

      const records: MatchRecord[] = [];
      for (const id of matchIds) {
        const record = await this.getMatch(id);
        if (record) {
          records.push(record);
        }
      }
      return records;
    }

    // Local query
    let matches = Array.from(this.localMatches.values());

    if (query.botId) {
      matches = matches.filter(
        (m) => m.player1BotId === query.botId || m.player2BotId === query.botId
      );
    }

    // Sort by most recent
    matches.sort((a, b) => b.endedAt - a.endedAt);

    return matches.slice(offset, offset + limit);
  }

  /**
   * Get recent matches
   */
  async getRecentMatches(limit = 10): Promise<MatchRecord[]> {
    return this.queryMatches({ limit });
  }

  /**
   * Get matches for a specific bot
   */
  async getBotMatches(botId: string, limit = 20): Promise<MatchRecord[]> {
    return this.queryMatches({ botId, limit });
  }

  /**
   * Get match count
   */
  async getMatchCount(): Promise<number> {
    if (this.redis) {
      return await this.redis.hlen('matches');
    }
    return this.localMatches.size;
  }

  /**
   * Get head-to-head record between two bots
   */
  async getHeadToHead(bot1Id: string, bot2Id: string): Promise<{
    bot1Wins: number;
    bot2Wins: number;
    draws: number;
    matches: MatchRecord[];
  }> {
    const allMatches = await this.queryMatches({ botId: bot1Id, limit: 100 });

    const h2hMatches = allMatches.filter(
      (m) =>
        (m.player1BotId === bot1Id && m.player2BotId === bot2Id) ||
        (m.player1BotId === bot2Id && m.player2BotId === bot1Id)
    );

    let bot1Wins = 0;
    let bot2Wins = 0;
    let draws = 0;

    for (const match of h2hMatches) {
      if (match.winner === bot1Id) bot1Wins++;
      else if (match.winner === bot2Id) bot2Wins++;
      else draws++;
    }

    return {
      bot1Wins,
      bot2Wins,
      draws,
      matches: h2hMatches,
    };
  }
}
