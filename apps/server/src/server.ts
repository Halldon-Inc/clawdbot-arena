/**
 * Arena Server
 * Main server class that coordinates all components
 */

import type { Redis } from 'ioredis';
import { ApiKeyManager } from './auth/ApiKeyManager.js';
import { AuthService } from './auth/AuthService.js';
import { WebSocketServerWrapper, type WSMessage } from './ws/WebSocketServer.js';
import { MatchServer } from './match/MatchServer.js';
import { MatchStore } from './store/MatchStore.js';
import type { Connection } from './ws/ConnectionManager.js';
import type { BotInput } from '@clawdbot/protocol';

export interface ServerConfig {
  port: number;
  redis?: Redis;
  tickRate?: number;
  decisionTimeoutMs?: number;
}

interface MatchmakingEntry {
  botId: string;
  rating: number;
  joinedAt: number;
}

export class ArenaServer {
  private config: ServerConfig;
  private apiKeyManager: ApiKeyManager;
  private authService: AuthService;
  private wsServer: WebSocketServerWrapper;
  private matchServer: MatchServer;
  private matchStore: MatchStore;
  private matchmakingQueue: MatchmakingEntry[];
  private matchmakingTimer: NodeJS.Timeout | null = null;

  constructor(config: ServerConfig) {
    this.config = config;
    this.matchmakingQueue = [];

    // Initialize components
    this.apiKeyManager = new ApiKeyManager(config.redis);
    this.authService = new AuthService(this.apiKeyManager);
    this.wsServer = new WebSocketServerWrapper(this.authService, {
      port: config.port,
    });
    this.matchServer = new MatchServer(this.wsServer.getConnectionManager());
    this.matchStore = new MatchStore(config.redis);

    // Register message handlers
    this.registerHandlers();

    // Set up match end callback
    this.matchServer.setOnMatchEnd(this.handleMatchEnd.bind(this));
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    await this.wsServer.start();
    this.startMatchmaking();
    console.log(`Arena server started on port ${this.config.port}`);
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.matchmakingTimer) {
      clearInterval(this.matchmakingTimer);
    }
    await this.wsServer.stop();
    console.log('Arena server stopped');
  }

  /**
   * Register WebSocket message handlers
   */
  private registerHandlers(): void {
    // Bot input handler
    this.wsServer.registerHandler('INPUT', (conn, msg) => {
      this.handleInput(conn, msg);
    });

    // Join matchmaking
    this.wsServer.registerHandler('JOIN_MATCHMAKING', (conn, msg) => {
      this.handleJoinMatchmaking(conn, msg);
    });

    // Leave matchmaking
    this.wsServer.registerHandler('LEAVE_MATCHMAKING', (conn, msg) => {
      this.handleLeaveMatchmaking(conn);
    });

    // Challenge bot
    this.wsServer.registerHandler('CHALLENGE', (conn, msg) => {
      this.handleChallenge(conn, msg);
    });

    // Spectate match
    this.wsServer.registerHandler('SPECTATE', (conn, msg) => {
      this.handleSpectate(conn, msg);
    });

    // Get leaderboard
    this.wsServer.registerHandler('GET_LEADERBOARD', (conn, msg) => {
      this.handleGetLeaderboard(conn);
    });

    // Get match history
    this.wsServer.registerHandler('GET_MATCHES', (conn, msg) => {
      this.handleGetMatches(conn, msg);
    });

    // Register new bot
    this.wsServer.registerHandler('REGISTER_BOT', (conn, msg) => {
      this.handleRegisterBot(conn, msg);
    });
  }

  /**
   * Handle bot input
   */
  private handleInput(conn: Connection, msg: WSMessage): void {
    if (!conn.session) {
      return;
    }

    const input = msg.input as BotInput;
    const frameNumber = msg.frameNumber as number;

    this.matchServer.receiveInput(conn.session.botId, input, frameNumber);
  }

  /**
   * Handle join matchmaking
   */
  private handleJoinMatchmaking(conn: Connection, msg: WSMessage): void {
    if (!conn.session) {
      this.sendError(conn, 'NOT_AUTHENTICATED', 'Must authenticate first');
      return;
    }

    // Check if already in matchmaking
    const existing = this.matchmakingQueue.find(
      (e) => e.botId === conn.session!.botId
    );
    if (existing) {
      return;
    }

    // Check if already in a match
    if (this.matchServer.getMatchByBotId(conn.session.botId)) {
      this.sendError(conn, 'ALREADY_IN_MATCH', 'Already in a match');
      return;
    }

    // Add to queue
    this.matchmakingQueue.push({
      botId: conn.session.botId,
      rating: conn.session.rating,
      joinedAt: Date.now(),
    });

    this.send(conn, {
      type: 'MATCHMAKING_JOINED',
      position: this.matchmakingQueue.length,
    });

    console.log(`Bot ${conn.session.botName} joined matchmaking`);
  }

  /**
   * Handle leave matchmaking
   */
  private handleLeaveMatchmaking(conn: Connection): void {
    if (!conn.session) return;

    this.matchmakingQueue = this.matchmakingQueue.filter(
      (e) => e.botId !== conn.session!.botId
    );

    this.send(conn, { type: 'MATCHMAKING_LEFT' });
  }

  /**
   * Handle direct challenge
   */
  private async handleChallenge(conn: Connection, msg: WSMessage): Promise<void> {
    if (!conn.session) {
      this.sendError(conn, 'NOT_AUTHENTICATED', 'Must authenticate first');
      return;
    }

    const targetBotId = msg.targetBotId as string;
    const targetConn = this.wsServer.getConnectionManager().getByBotId(targetBotId);

    if (!targetConn || !targetConn.session) {
      this.sendError(conn, 'BOT_NOT_ONLINE', 'Target bot is not online');
      return;
    }

    // Create match
    const matchId = this.matchServer.createMatch({
      player1BotId: conn.session.botId,
      player2BotId: targetBotId,
      tickRate: this.config.tickRate,
      decisionTimeoutMs: this.config.decisionTimeoutMs,
    });

    // Notify both bots
    const matchMsg = {
      type: 'MATCH_STARTING',
      matchId,
      opponent: {
        botId: targetBotId,
        botName: targetConn.session.botName,
        rating: targetConn.session.rating,
      },
    };

    this.send(conn, matchMsg);
    this.send(targetConn, {
      ...matchMsg,
      opponent: {
        botId: conn.session.botId,
        botName: conn.session.botName,
        rating: conn.session.rating,
      },
    });
  }

  /**
   * Handle spectate request
   */
  private handleSpectate(conn: Connection, msg: WSMessage): void {
    const matchId = msg.matchId as string;

    const success = this.matchServer.addSpectator(
      this.getConnectionId(conn),
      matchId
    );

    if (success) {
      this.send(conn, { type: 'SPECTATE_JOINED', matchId });
    } else {
      this.sendError(conn, 'MATCH_NOT_FOUND', 'Match not found');
    }
  }

  /**
   * Handle get leaderboard
   */
  private async handleGetLeaderboard(conn: Connection): Promise<void> {
    const bots = await this.apiKeyManager.listBots();

    const leaderboard = bots.map((bot, index) => ({
      rank: index + 1,
      botId: bot.botId,
      botName: bot.botName,
      rating: bot.rating,
      isOnline: this.wsServer.getConnectionManager().getByBotId(bot.botId) !== undefined,
    }));

    this.send(conn, {
      type: 'LEADERBOARD',
      entries: leaderboard,
    });
  }

  /**
   * Handle get matches
   */
  private async handleGetMatches(conn: Connection, msg: WSMessage): Promise<void> {
    const botId = msg.botId as string | undefined;
    const limit = (msg.limit as number) || 20;

    const matches = botId
      ? await this.matchStore.getBotMatches(botId, limit)
      : await this.matchStore.getRecentMatches(limit);

    this.send(conn, {
      type: 'MATCH_HISTORY',
      matches,
    });
  }

  /**
   * Handle register new bot
   */
  private async handleRegisterBot(conn: Connection, msg: WSMessage): Promise<void> {
    const botName = msg.botName as string;
    const ownerId = msg.ownerId as string;

    if (!botName || !ownerId) {
      this.sendError(conn, 'INVALID_REQUEST', 'Missing botName or ownerId');
      return;
    }

    const credentials = await this.authService.registerBot(botName, ownerId);

    this.send(conn, {
      type: 'BOT_REGISTERED',
      botId: credentials.botId,
      apiKey: credentials.apiKey,
      botName: credentials.botName,
    });
  }

  /**
   * Handle match end
   */
  private async handleMatchEnd(matchId: string, replay: any): Promise<void> {
    const bot1 = await this.apiKeyManager.getBotById(replay.player1BotId);
    const bot2 = await this.apiKeyManager.getBotById(replay.player2BotId);

    // Save match
    await this.matchStore.saveMatch(
      replay,
      bot1?.botName || 'Unknown',
      bot2?.botName || 'Unknown'
    );

    // Update ratings
    if (replay.winner && bot1 && bot2) {
      const { newRating1, newRating2 } = this.calculateElo(
        bot1.rating,
        bot2.rating,
        replay.winner === bot1.botId
      );

      await this.authService.updateBotRating(bot1.botId, newRating1);
      await this.authService.updateBotRating(bot2.botId, newRating2);

      console.log(
        `Rating update: ${bot1.botName} ${bot1.rating} -> ${newRating1}, ` +
          `${bot2.botName} ${bot2.rating} -> ${newRating2}`
      );
    }
  }

  /**
   * Calculate ELO changes
   */
  private calculateElo(
    rating1: number,
    rating2: number,
    player1Won: boolean
  ): { newRating1: number; newRating2: number } {
    const K = 32;

    const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
    const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));

    const score1 = player1Won ? 1 : 0;
    const score2 = player1Won ? 0 : 1;

    const newRating1 = Math.round(rating1 + K * (score1 - expected1));
    const newRating2 = Math.round(rating2 + K * (score2 - expected2));

    return { newRating1, newRating2 };
  }

  /**
   * Start matchmaking loop
   */
  private startMatchmaking(): void {
    this.matchmakingTimer = setInterval(() => {
      this.processMatchmaking();
    }, 1000);
  }

  /**
   * Process matchmaking queue
   */
  private processMatchmaking(): void {
    if (this.matchmakingQueue.length < 2) return;

    // Sort by rating for fair matches
    this.matchmakingQueue.sort((a, b) => a.rating - b.rating);

    // Match adjacent bots in queue
    while (this.matchmakingQueue.length >= 2) {
      const bot1 = this.matchmakingQueue.shift()!;
      const bot2 = this.matchmakingQueue.shift()!;

      // Create match
      const matchId = this.matchServer.createMatch({
        player1BotId: bot1.botId,
        player2BotId: bot2.botId,
        tickRate: this.config.tickRate,
        decisionTimeoutMs: this.config.decisionTimeoutMs,
      });

      // Notify bots
      const conn1 = this.wsServer.getConnectionManager().getByBotId(bot1.botId);
      const conn2 = this.wsServer.getConnectionManager().getByBotId(bot2.botId);

      if (conn1?.session && conn2?.session) {
        this.send(conn1, {
          type: 'MATCH_STARTING',
          matchId,
          opponent: {
            botId: bot2.botId,
            botName: conn2.session.botName,
            rating: conn2.session.rating,
          },
        });

        this.send(conn2, {
          type: 'MATCH_STARTING',
          matchId,
          opponent: {
            botId: bot1.botId,
            botName: conn1.session.botName,
            rating: conn1.session.rating,
          },
        });
      }

      console.log(`Matchmaking: ${bot1.botId} vs ${bot2.botId} (Match: ${matchId})`);
    }
  }

  /**
   * Send message to connection
   */
  private send(conn: Connection, message: unknown): void {
    if (conn.ws.readyState === conn.ws.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to connection
   */
  private sendError(conn: Connection, code: string, message: string): void {
    this.send(conn, { type: 'ERROR', code, message });
  }

  /**
   * Get connection ID (hacky but works)
   */
  private getConnectionId(conn: Connection): string {
    const cm = this.wsServer.getConnectionManager() as any;
    for (const [id, c] of cm.connections.entries()) {
      if (c === conn) return id;
    }
    return '';
  }
}
