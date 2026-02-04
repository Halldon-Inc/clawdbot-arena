/**
 * Arena Server
 * Main server class that coordinates all components
 */

import { nanoid } from 'nanoid';
import type { Redis } from 'ioredis';
import { ApiKeyManager } from './auth/ApiKeyManager.js';
import { AuthService } from './auth/AuthService.js';
import { WebSocketServerWrapper, type WSMessage } from './ws/WebSocketServer.js';
import { MatchServer } from './match/MatchServer.js';
import { MatchStore } from './store/MatchStore.js';
import { TournamentManager } from './tournament/TournamentManager.js';
import { SeasonManager } from './season/SeasonManager.js';
import { CosmeticStore } from './cosmetics/CosmeticStore.js';
import { HttpServer } from './http/HttpServer.js';
import { logger, type ChildLogger } from './utils/Logger.js';
import type { Connection } from './ws/ConnectionManager.js';
import type { BotInput } from '@clawdbot/protocol';

export interface ServerConfig {
  port: number;
  httpPort?: number;
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
  private tournamentManager: TournamentManager;
  private seasonManager: SeasonManager;
  private cosmeticStore: CosmeticStore;
  private httpServer: HttpServer | null = null;
  private matchmakingQueue: MatchmakingEntry[];
  private matchmakingTimer: NodeJS.Timeout | null = null;
  private log: ChildLogger;

  constructor(config: ServerConfig) {
    this.config = config;
    this.matchmakingQueue = [];
    this.log = logger.child({ component: 'ArenaServer' });

    // Initialize components
    this.apiKeyManager = new ApiKeyManager(config.redis);
    this.authService = new AuthService(this.apiKeyManager);
    this.wsServer = new WebSocketServerWrapper(this.authService, {
      port: config.port,
    });
    this.matchServer = new MatchServer(this.wsServer.getConnectionManager());
    this.matchStore = new MatchStore(config.redis);
    this.tournamentManager = new TournamentManager();
    this.seasonManager = new SeasonManager();
    this.cosmeticStore = new CosmeticStore();

    // Initialize HTTP server if port configured
    const httpPort = config.httpPort || parseInt(process.env.HTTP_PORT || '0', 10);
    if (httpPort > 0) {
      this.httpServer = new HttpServer(
        { port: httpPort },
        this.matchStore,
        this.apiKeyManager,
        this.matchServer,
        this.wsServer.getConnectionManager(),
        this.tournamentManager
      );
    }

    // Register message handlers
    this.registerHandlers();

    // Set up match end callback
    this.matchServer.setOnMatchEnd(this.handleMatchEnd.bind(this));

    // Wire tournament match creation
    this.tournamentManager.setCreateMatchCallback(
      (bot1Id, bot2Id, _tournamentId) => {
        return this.matchServer.createMatch({
          player1BotId: bot1Id,
          player2BotId: bot2Id,
          tickRate: this.config.tickRate,
          decisionTimeoutMs: this.config.decisionTimeoutMs,
        });
      }
    );

    // Wire tournament end callback
    this.tournamentManager.setTournamentEndCallback(
      (tournamentId, placements, prizePool, prizeDistribution) => {
        this.log.info('Tournament ended', {
          tournamentId,
          prizePool,
          placements: Object.fromEntries(placements),
          prizeDistribution,
        });
      }
    );

    // Wire season manager leaderboard provider
    this.seasonManager.setLeaderboardProvider(async () => {
      const bots = await this.apiKeyManager.listBots();
      return bots.map((bot, idx) => ({
        botId: bot.botId,
        botName: bot.botName,
        rating: bot.rating,
        wins: 0, // Would come from match store in production
        losses: 0,
        rank: idx + 1,
      }));
    });

    // Wire season ELO reset callback
    this.seasonManager.setEloResetCallback(async (botId, newRating) => {
      await this.authService.updateBotRating(botId, newRating);
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    await this.wsServer.start();
    this.startMatchmaking();

    if (this.httpServer) {
      await this.httpServer.start();
    }

    this.log.info('Arena server started', {
      wsPort: this.config.port,
      httpPort: this.config.httpPort || process.env.HTTP_PORT || 'disabled',
      tickRate: this.config.tickRate,
      decisionTimeoutMs: this.config.decisionTimeoutMs,
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.matchmakingTimer) {
      clearInterval(this.matchmakingTimer);
    }
    await this.wsServer.stop();

    if (this.httpServer) {
      await this.httpServer.stop();
    }

    this.log.info('Arena server stopped');
  }

  /**
   * Register WebSocket message handlers
   */
  private registerHandlers(): void {
    // Bot input handler
    this.wsServer.registerHandler('INPUT', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleInput(conn, msg, requestId);
    });

    // Join matchmaking
    this.wsServer.registerHandler('JOIN_MATCHMAKING', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleJoinMatchmaking(conn, msg, requestId);
    });

    // Leave matchmaking
    this.wsServer.registerHandler('LEAVE_MATCHMAKING', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleLeaveMatchmaking(conn, requestId);
    });

    // Challenge bot
    this.wsServer.registerHandler('CHALLENGE', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleChallenge(conn, msg, requestId);
    });

    // Spectate match
    this.wsServer.registerHandler('SPECTATE', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleSpectate(conn, msg, requestId);
    });

    // Get leaderboard
    this.wsServer.registerHandler('GET_LEADERBOARD', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleGetLeaderboard(conn, requestId);
    });

    // Get match history
    this.wsServer.registerHandler('GET_MATCHES', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleGetMatches(conn, msg, requestId);
    });

    // Register new bot
    this.wsServer.registerHandler('REGISTER_BOT', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleRegisterBot(conn, msg, requestId);
    });

    // --- Tournament handlers ---

    this.wsServer.registerHandler('CREATE_TOURNAMENT', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleCreateTournament(conn, msg, requestId);
    });

    this.wsServer.registerHandler('JOIN_TOURNAMENT', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleJoinTournament(conn, msg, requestId);
    });

    this.wsServer.registerHandler('START_TOURNAMENT', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleStartTournament(conn, msg, requestId);
    });

    this.wsServer.registerHandler('GET_BRACKET', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleGetBracket(conn, msg, requestId);
    });

    this.wsServer.registerHandler('LIST_TOURNAMENTS', (conn, msg) => {
      const requestId = nanoid(10);
      this.handleListTournaments(conn, msg, requestId);
    });
  }

  /**
   * Handle bot input
   */
  private handleInput(conn: Connection, msg: WSMessage, requestId: string): void {
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
  private handleJoinMatchmaking(conn: Connection, msg: WSMessage, requestId: string): void {
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

    this.log.info('Bot joined matchmaking', {
      requestId,
      botId: conn.session.botId,
      botName: conn.session.botName,
      queueSize: this.matchmakingQueue.length,
    });
  }

  /**
   * Handle leave matchmaking
   */
  private handleLeaveMatchmaking(conn: Connection, requestId: string): void {
    if (!conn.session) return;

    this.matchmakingQueue = this.matchmakingQueue.filter(
      (e) => e.botId !== conn.session!.botId
    );

    this.send(conn, { type: 'MATCHMAKING_LEFT' });

    this.log.debug('Bot left matchmaking', {
      requestId,
      botId: conn.session.botId,
    });
  }

  /**
   * Handle direct challenge
   */
  private async handleChallenge(conn: Connection, msg: WSMessage, requestId: string): Promise<void> {
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

    this.log.info('Match challenge issued', {
      requestId,
      challengerBotId: conn.session.botId,
      targetBotId,
    });

    // Create match
    const matchId = this.matchServer.createMatch({
      player1BotId: conn.session.botId,
      player2BotId: targetBotId,
      tickRate: this.config.tickRate,
      decisionTimeoutMs: this.config.decisionTimeoutMs,
    });

    this.log.info('Match created from challenge', {
      requestId,
      matchId,
      lifecycle: 'created',
      player1: conn.session.botId,
      player2: targetBotId,
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
  private handleSpectate(conn: Connection, msg: WSMessage, requestId: string): void {
    const matchId = msg.matchId as string;

    const success = this.matchServer.addSpectator(
      this.getConnectionId(conn),
      matchId
    );

    if (success) {
      this.send(conn, { type: 'SPECTATE_JOINED', matchId });
      this.log.debug('Spectator joined match', { requestId, matchId });
    } else {
      this.sendError(conn, 'MATCH_NOT_FOUND', 'Match not found');
    }
  }

  /**
   * Handle get leaderboard
   */
  private async handleGetLeaderboard(conn: Connection, requestId: string): Promise<void> {
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

    this.log.debug('Leaderboard requested', { requestId, entries: leaderboard.length });
  }

  /**
   * Handle get matches
   */
  private async handleGetMatches(conn: Connection, msg: WSMessage, requestId: string): Promise<void> {
    const botId = msg.botId as string | undefined;
    const limit = (msg.limit as number) || 20;

    const matches = botId
      ? await this.matchStore.getBotMatches(botId, limit)
      : await this.matchStore.getRecentMatches(limit);

    this.send(conn, {
      type: 'MATCH_HISTORY',
      matches,
    });

    this.log.debug('Match history requested', { requestId, botId, limit, returned: matches.length });
  }

  /**
   * Handle register new bot
   */
  private async handleRegisterBot(conn: Connection, msg: WSMessage, requestId: string): Promise<void> {
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

    this.log.info('New bot registered', {
      requestId,
      botId: credentials.botId,
      botName: credentials.botName,
      ownerId,
    });
  }

  // ---------------------------------------------------------------------------
  // Tournament handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle CREATE_TOURNAMENT
   */
  private handleCreateTournament(conn: Connection, msg: WSMessage, requestId: string): void {
    try {
      const tournament = this.tournamentManager.createTournament({
        name: msg.name as string,
        format: (msg.format as 'single-elimination') || 'single-elimination',
        maxBots: (msg.maxBots as 8 | 16) || 8,
        buyIn: (msg.buyIn as number) || 0,
        prizeDistribution: (msg.prizeDistribution as number[]) || [70, 20, 10],
      });

      this.send(conn, {
        type: 'TOURNAMENT_CREATED',
        tournamentId: tournament.id,
        name: tournament.name,
        maxBots: tournament.maxBots,
        buyIn: tournament.buyIn,
      });

      this.log.info('Tournament created', {
        requestId,
        tournamentId: tournament.id,
        name: tournament.name,
        maxBots: tournament.maxBots,
      });
    } catch (err: any) {
      this.sendError(conn, 'TOURNAMENT_ERROR', err.message);
      this.log.warn('Tournament creation failed', { requestId, error: err.message });
    }
  }

  /**
   * Handle JOIN_TOURNAMENT
   */
  private handleJoinTournament(conn: Connection, msg: WSMessage, requestId: string): void {
    if (!conn.session) {
      this.sendError(conn, 'NOT_AUTHENTICATED', 'Must authenticate first');
      return;
    }

    const tournamentId = msg.tournamentId as string;
    const result = this.tournamentManager.joinTournament(tournamentId, conn.session.botId);

    if (result.success) {
      this.send(conn, {
        type: 'TOURNAMENT_JOINED',
        tournamentId,
        botId: conn.session.botId,
      });

      this.log.info('Bot joined tournament', {
        requestId,
        tournamentId,
        botId: conn.session.botId,
      });
    } else {
      this.sendError(conn, 'TOURNAMENT_JOIN_ERROR', result.error || 'Failed to join');
    }
  }

  /**
   * Handle START_TOURNAMENT
   */
  private handleStartTournament(conn: Connection, msg: WSMessage, requestId: string): void {
    const tournamentId = msg.tournamentId as string;
    const result = this.tournamentManager.startTournament(tournamentId);

    if (result.success) {
      this.send(conn, {
        type: 'TOURNAMENT_STARTED',
        tournamentId,
      });

      this.log.info('Tournament started', { requestId, tournamentId });
    } else {
      this.sendError(conn, 'TOURNAMENT_START_ERROR', result.error || 'Failed to start');
    }
  }

  /**
   * Handle GET_BRACKET
   */
  private handleGetBracket(conn: Connection, msg: WSMessage, requestId: string): void {
    const tournamentId = msg.tournamentId as string;
    const bracket = this.tournamentManager.getBracket(tournamentId);

    if (bracket) {
      this.send(conn, {
        type: 'BRACKET',
        ...bracket,
      });
    } else {
      this.sendError(conn, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
    }
  }

  /**
   * Handle LIST_TOURNAMENTS
   */
  private handleListTournaments(conn: Connection, msg: WSMessage, requestId: string): void {
    const status = msg.status as string | undefined;
    const tournaments = this.tournamentManager.listTournaments(status as any);

    this.send(conn, {
      type: 'TOURNAMENT_LIST',
      tournaments,
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

    // Increment HTTP server match counter
    if (this.httpServer) {
      this.httpServer.incrementMatchCount();
    }

    // Update ratings
    if (replay.winner && bot1 && bot2) {
      const { newRating1, newRating2 } = this.calculateElo(
        bot1.rating,
        bot2.rating,
        replay.winner === bot1.botId
      );

      await this.authService.updateBotRating(bot1.botId, newRating1);
      await this.authService.updateBotRating(bot2.botId, newRating2);

      this.log.info('Match ended and ratings updated', {
        matchId,
        lifecycle: 'ended',
        winner: replay.winner,
        player1: {
          botId: bot1.botId,
          botName: bot1.botName,
          oldRating: bot1.rating,
          newRating: newRating1,
        },
        player2: {
          botId: bot2.botId,
          botName: bot2.botName,
          oldRating: bot2.rating,
          newRating: newRating2,
        },
        duration: replay.duration,
        totalFrames: replay.totalFrames,
      });
    } else {
      this.log.info('Match ended', {
        matchId,
        lifecycle: 'ended',
        winner: replay.winner,
        duration: replay.duration,
        totalFrames: replay.totalFrames,
      });
    }

    // Forward result to tournament manager (handles tournament matches)
    if (replay.winner) {
      this.tournamentManager.handleMatchResult(matchId, replay.winner);
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

      this.log.info('Matchmaking paired bots', {
        matchId,
        lifecycle: 'created',
        player1: bot1.botId,
        player2: bot2.botId,
        ratingDiff: Math.abs(bot1.rating - bot2.rating),
      });
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
