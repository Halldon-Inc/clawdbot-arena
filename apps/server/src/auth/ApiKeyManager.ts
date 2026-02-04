/**
 * API Key Manager
 * Generates and validates bot API keys
 */

import { nanoid } from 'nanoid';
import type { Redis } from 'ioredis';

export interface BotCredentials {
  botId: string;
  apiKey: string;
  botName: string;
  ownerId: string;
  createdAt: number;
  lastSeen: number;
  rating: number;
}

export class ApiKeyManager {
  private redis: Redis | null;
  private localStore: Map<string, BotCredentials>;

  constructor(redis?: Redis) {
    this.redis = redis || null;
    this.localStore = new Map();
  }

  /**
   * Generate a new API key for a bot
   */
  async generateKey(botName: string, ownerId: string): Promise<BotCredentials> {
    const botId = `bot_${nanoid(12)}`;
    const apiKey = `claw_${nanoid(32)}`;

    const credentials: BotCredentials = {
      botId,
      apiKey,
      botName,
      ownerId,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      rating: 1000, // Starting ELO
    };

    await this.store(apiKey, credentials);
    return credentials;
  }

  /**
   * Validate an API key and return bot credentials
   */
  async validate(apiKey: string): Promise<BotCredentials | null> {
    if (this.redis) {
      const data = await this.redis.get(`apikey:${apiKey}`);
      if (data) {
        return JSON.parse(data);
      }
    }

    return this.localStore.get(apiKey) || null;
  }

  /**
   * Get bot by ID
   */
  async getBotById(botId: string): Promise<BotCredentials | null> {
    if (this.redis) {
      const data = await this.redis.get(`bot:${botId}`);
      if (data) {
        return JSON.parse(data);
      }
    }

    // Search local store by botId
    for (const creds of this.localStore.values()) {
      if (creds.botId === botId) {
        return creds;
      }
    }

    return null;
  }

  /**
   * Update bot's last seen timestamp
   */
  async updateLastSeen(botId: string): Promise<void> {
    const creds = await this.getBotById(botId);
    if (creds) {
      creds.lastSeen = Date.now();
      await this.store(creds.apiKey, creds);
    }
  }

  /**
   * Update bot's rating
   */
  async updateRating(botId: string, newRating: number): Promise<void> {
    const creds = await this.getBotById(botId);
    if (creds) {
      creds.rating = newRating;
      await this.store(creds.apiKey, creds);
    }
  }

  /**
   * Revoke an API key
   */
  async revoke(apiKey: string): Promise<boolean> {
    const creds = await this.validate(apiKey);
    if (!creds) return false;

    if (this.redis) {
      await this.redis.del(`apikey:${apiKey}`);
      await this.redis.del(`bot:${creds.botId}`);
    }

    this.localStore.delete(apiKey);
    return true;
  }

  /**
   * Store credentials
   */
  private async store(apiKey: string, creds: BotCredentials): Promise<void> {
    if (this.redis) {
      await this.redis.set(`apikey:${apiKey}`, JSON.stringify(creds));
      await this.redis.set(`bot:${creds.botId}`, JSON.stringify(creds));
    }

    this.localStore.set(apiKey, creds);
  }

  /**
   * List all bots (for leaderboard)
   */
  async listBots(): Promise<BotCredentials[]> {
    const bots: BotCredentials[] = [];

    if (this.redis) {
      const keys = await this.redis.keys('bot:*');
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          bots.push(JSON.parse(data));
        }
      }
    } else {
      bots.push(...this.localStore.values());
    }

    return bots.sort((a, b) => b.rating - a.rating);
  }
}
