/**
 * HTTP Server
 * Provides REST API endpoints for health checks, stats, matches, and leaderboard.
 * Runs alongside the WebSocket server on a separate port.
 */

import http from 'node:http';
import type { MatchStore, MatchRecord } from '../store/MatchStore.js';
import type { ApiKeyManager, BotCredentials } from '../auth/ApiKeyManager.js';
import type { MatchServer } from '../match/MatchServer.js';
import type { ConnectionManager } from '../ws/ConnectionManager.js';
import type { TournamentManager } from '../tournament/TournamentManager.js';
import { logger } from '../utils/Logger.js';

export interface HttpServerConfig {
  port: number;
}

interface RouteHandler {
  (params: Record<string, string>, req: http.IncomingMessage): Promise<unknown>;
}

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class HttpServer {
  private server: http.Server | null = null;
  private config: HttpServerConfig;
  private matchStore: MatchStore;
  private apiKeyManager: ApiKeyManager;
  private matchServer: MatchServer;
  private connectionManager: ConnectionManager;
  private tournamentManager: TournamentManager | null;
  private startTime: number;
  private totalMatchesPlayed = 0;
  private routes: Route[] = [];

  constructor(
    config: HttpServerConfig,
    matchStore: MatchStore,
    apiKeyManager: ApiKeyManager,
    matchServer: MatchServer,
    connectionManager: ConnectionManager,
    tournamentManager?: TournamentManager
  ) {
    this.config = config;
    this.matchStore = matchStore;
    this.apiKeyManager = apiKeyManager;
    this.matchServer = matchServer;
    this.connectionManager = connectionManager;
    this.tournamentManager = tournamentManager || null;
    this.startTime = Date.now();

    this.registerRoutes();
  }

  /**
   * Register all API routes
   */
  private registerRoutes(): void {
    this.addRoute('GET', '/api/health', this.handleHealth.bind(this));
    this.addRoute('GET', '/api/stats', this.handleStats.bind(this));
    this.addRoute('GET', '/api/matches', this.handleMatches.bind(this));
    this.addRoute('GET', '/api/matches/:id', this.handleMatchById.bind(this));
    this.addRoute('GET', '/api/leaderboard', this.handleLeaderboard.bind(this));
    this.addRoute('GET', '/api/bots', this.handleBots.bind(this));
    this.addRoute('GET', '/api/bots/:id', this.handleBotById.bind(this));
    this.addRoute('GET', '/api/tournaments', this.handleTournaments.bind(this));
    this.addRoute('GET', '/api/tournaments/:id', this.handleTournamentById.bind(this));
    this.addRoute('GET', '/api/tournaments/:id/bracket', this.handleTournamentBracket.bind(this));
  }

  /**
   * Add a route definition
   */
  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const patternStr = path.replace(/:([^/]+)/g, (_match, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
    const pattern = new RegExp(`^${patternStr}$`);

    this.routes.push({ method, pattern, paramNames, handler });
  }

  /**
   * Start the HTTP server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        logger.error('HTTP server error', err);
        reject(err);
      });

      this.server.listen(this.config.port, () => {
        logger.info('HTTP server listening', { port: this.config.port });
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Increment the total matches counter (called from ArenaServer on match end)
   */
  incrementMatchCount(): void {
    this.totalMatchesPlayed++;
  }

  /**
   * Route incoming HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = pathname.match(route.pattern);
      if (!match) continue;

      // Extract params
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });

      try {
        const body = await route.handler(params, req);
        this.sendJson(res, 200, body);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        logger.error('HTTP request error', err instanceof Error ? err : new Error(String(err)), {
          method,
          pathname,
        });
        this.sendJson(res, 500, { error: errorMessage });
      }
      return;
    }

    // No route matched
    this.sendJson(res, 404, { error: 'Not found', path: pathname });
  }

  /**
   * Send a JSON response
   */
  private sendJson(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  // ============================================
  // Route Handlers
  // ============================================

  /**
   * GET /api/health
   * Returns basic health status
   */
  private async handleHealth(): Promise<unknown> {
    return {
      status: 'ok',
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/stats
   * Returns server statistics
   */
  private async handleStats(): Promise<unknown> {
    const connectionCounts = this.connectionManager.getConnectionCount();
    const activeMatches = this.matchServer.getActiveMatchCount();
    const totalMatches = await this.matchStore.getMatchCount();

    return {
      activeMatches,
      connectedBots: connectionCounts.bots,
      connectedSpectators: connectionCounts.spectators,
      totalConnections: connectionCounts.total,
      totalMatchesPlayed: totalMatches,
      matchesResolvedThisSession: this.totalMatchesPlayed,
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/matches
   * Returns recent matches. Supports ?limit=N&botId=XXX query params.
   */
  private async handleMatches(params: Record<string, string>, req: http.IncomingMessage): Promise<unknown> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const botId = url.searchParams.get('botId') || undefined;

    let matches: MatchRecord[];
    if (botId) {
      matches = await this.matchStore.getBotMatches(botId, limit);
    } else {
      matches = await this.matchStore.getRecentMatches(limit);
    }

    return {
      matches,
      count: matches.length,
      limit,
    };
  }

  /**
   * GET /api/matches/:id
   * Returns a specific match by ID
   */
  private async handleMatchById(params: Record<string, string>): Promise<unknown> {
    const matchId = params.id;
    const match = await this.matchStore.getMatch(matchId);

    if (!match) {
      return { error: 'Match not found', matchId };
    }

    return { match };
  }

  /**
   * GET /api/leaderboard
   * Returns the bot leaderboard sorted by rating
   */
  private async handleLeaderboard(): Promise<unknown> {
    const bots = await this.apiKeyManager.listBots();

    const leaderboard = bots.map((bot, index) => ({
      rank: index + 1,
      botId: bot.botId,
      botName: bot.botName,
      rating: bot.rating,
      isOnline: this.connectionManager.getByBotId(bot.botId) !== undefined,
      lastSeen: new Date(bot.lastSeen).toISOString(),
    }));

    return {
      leaderboard,
      count: leaderboard.length,
    };
  }

  /**
   * GET /api/bots
   * Returns all registered bots
   */
  private async handleBots(): Promise<unknown> {
    const bots = await this.apiKeyManager.listBots();

    const botList = bots.map((bot) => ({
      botId: bot.botId,
      botName: bot.botName,
      rating: bot.rating,
      isOnline: this.connectionManager.getByBotId(bot.botId) !== undefined,
      lastSeen: new Date(bot.lastSeen).toISOString(),
      createdAt: new Date(bot.createdAt).toISOString(),
    }));

    return {
      bots: botList,
      count: botList.length,
    };
  }

  /**
   * GET /api/bots/:id
   * Returns a specific bot by ID
   */
  private async handleBotById(params: Record<string, string>): Promise<unknown> {
    const botId = params.id;
    const bot = await this.apiKeyManager.getBotById(botId);

    if (!bot) {
      return { error: 'Bot not found', botId };
    }

    const isOnline = this.connectionManager.getByBotId(botId) !== undefined;
    const recentMatches = await this.matchStore.getBotMatches(botId, 10);

    return {
      bot: {
        botId: bot.botId,
        botName: bot.botName,
        rating: bot.rating,
        isOnline,
        lastSeen: new Date(bot.lastSeen).toISOString(),
        createdAt: new Date(bot.createdAt).toISOString(),
      },
      recentMatches,
    };
  }

  /**
   * GET /api/tournaments
   * Returns list of tournaments. Supports ?status= filter.
   */
  private async handleTournaments(params: Record<string, string>, req: http.IncomingMessage): Promise<unknown> {
    if (!this.tournamentManager) {
      return { tournaments: [], count: 0 };
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const status = url.searchParams.get('status') || undefined;
    const tournaments = this.tournamentManager.listTournaments(status as any);

    return {
      tournaments,
      count: tournaments.length,
    };
  }

  /**
   * GET /api/tournaments/:id
   * Returns a specific tournament
   */
  private async handleTournamentById(params: Record<string, string>): Promise<unknown> {
    if (!this.tournamentManager) {
      return { error: 'Tournaments not enabled' };
    }

    const tournamentId = params.id;
    const bracket = this.tournamentManager.getBracket(tournamentId);

    if (!bracket) {
      return { error: 'Tournament not found', tournamentId };
    }

    return { tournament: bracket };
  }

  /**
   * GET /api/tournaments/:id/bracket
   * Returns bracket state for a tournament
   */
  private async handleTournamentBracket(params: Record<string, string>): Promise<unknown> {
    if (!this.tournamentManager) {
      return { error: 'Tournaments not enabled' };
    }

    const tournamentId = params.id;
    const bracket = this.tournamentManager.getBracket(tournamentId);

    if (!bracket) {
      return { error: 'Tournament not found', tournamentId };
    }

    return bracket;
  }
}
