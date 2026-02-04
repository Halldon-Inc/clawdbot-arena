/**
 * Authentication Service
 * Validates bot connections and manages sessions
 */

import { ApiKeyManager, type BotCredentials } from './ApiKeyManager.js';

export interface AuthenticatedSession {
  botId: string;
  botName: string;
  ownerId: string;
  rating: number;
  authenticatedAt: number;
}

export class AuthService {
  private apiKeyManager: ApiKeyManager;
  private sessions: Map<string, AuthenticatedSession>;

  constructor(apiKeyManager: ApiKeyManager) {
    this.apiKeyManager = apiKeyManager;
    this.sessions = new Map();
  }

  /**
   * Authenticate a connection with an API key
   */
  async authenticate(apiKey: string): Promise<AuthenticatedSession | null> {
    const credentials = await this.apiKeyManager.validate(apiKey);

    if (!credentials) {
      return null;
    }

    // Update last seen
    await this.apiKeyManager.updateLastSeen(credentials.botId);

    const session: AuthenticatedSession = {
      botId: credentials.botId,
      botName: credentials.botName,
      ownerId: credentials.ownerId,
      rating: credentials.rating,
      authenticatedAt: Date.now(),
    };

    this.sessions.set(credentials.botId, session);
    return session;
  }

  /**
   * Get session by bot ID
   */
  getSession(botId: string): AuthenticatedSession | null {
    return this.sessions.get(botId) || null;
  }

  /**
   * End a session
   */
  endSession(botId: string): void {
    this.sessions.delete(botId);
  }

  /**
   * Check if a bot is currently authenticated
   */
  isAuthenticated(botId: string): boolean {
    return this.sessions.has(botId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AuthenticatedSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Create a new bot registration
   */
  async registerBot(botName: string, ownerId: string): Promise<BotCredentials> {
    return this.apiKeyManager.generateKey(botName, ownerId);
  }

  /**
   * Update a bot's rating after a match
   */
  async updateBotRating(botId: string, newRating: number): Promise<void> {
    await this.apiKeyManager.updateRating(botId, newRating);

    // Update session if exists
    const session = this.sessions.get(botId);
    if (session) {
      session.rating = newRating;
    }
  }
}
