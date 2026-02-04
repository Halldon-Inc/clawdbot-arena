/**
 * WebSocket Server
 * Handles WebSocket connections and message routing
 */

import { WebSocketServer as WSServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { nanoid } from 'nanoid';
import { ConnectionManager, type Connection } from './ConnectionManager.js';
import { AuthService } from '../auth/AuthService.js';
import { RateLimiter } from '../utils/RateLimiter.js';
import { logger } from '../utils/Logger.js';

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export interface WSServerOptions {
  port?: number;
  pingInterval?: number;
  connectionTimeout?: number;
  enableRateLimiting?: boolean;
}

export class WebSocketServerWrapper {
  private wss: WSServer | null = null;
  private connectionManager: ConnectionManager;
  private authService: AuthService;
  private rateLimiter: RateLimiter;
  private options: Required<WSServerOptions>;
  private pingTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, (conn: Connection, message: WSMessage) => void>;

  constructor(
    authService: AuthService,
    options: WSServerOptions = {}
  ) {
    this.authService = authService;
    this.connectionManager = new ConnectionManager();
    this.rateLimiter = new RateLimiter();
    this.options = {
      port: options.port ?? 8080,
      pingInterval: options.pingInterval ?? 10000,
      connectionTimeout: options.connectionTimeout ?? 30000,
      enableRateLimiting: options.enableRateLimiting ?? true,
    };
    this.messageHandlers = new Map();

    // Register default handlers
    this.registerHandler('AUTH', this.handleAuth.bind(this));
    this.registerHandler('PING', this.handlePing.bind(this));
  }

  /**
   * Start the WebSocket server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WSServer({ port: this.options.port });

        this.wss.on('connection', this.handleConnection.bind(this));

        this.wss.on('listening', () => {
          logger.info('WebSocket server listening', { port: this.options.port });
          this.startPingLoop();
          resolve();
        });

        this.wss.on('error', (error) => {
          logger.error('WebSocket server error', error as Error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }

      if (this.wss) {
        this.wss.close(() => {
          logger.info('WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Register a message handler
   */
  registerHandler(
    type: string,
    handler: (conn: Connection, message: WSMessage) => void
  ): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Get connection manager
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Handle new connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const ip = req.socket.remoteAddress || 'unknown';

    // Rate limit connections
    if (this.options.enableRateLimiting && !this.rateLimiter.check('connection', ip)) {
      const blockedFor = this.rateLimiter.getBlockedFor('connection', ip);
      logger.warn('Connection rate limited', { ip, blockedFor });
      ws.close(4029, `Rate limited. Try again in ${Math.ceil(blockedFor / 1000)}s`);
      return;
    }

    const connectionId = nanoid(16);
    const isBot = req.url?.includes('/bot');
    const type = isBot ? 'bot' : 'spectator';

    const connection = this.connectionManager.add(connectionId, ws, type);
    (connection as any)._ip = ip;

    logger.info(`New ${type} connection`, { connectionId, ip });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.handleMessage(connectionId, connection, message);
      } catch (error) {
        logger.error('Error parsing message', error instanceof Error ? error : new Error(String(error)), { connectionId });
        this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
      }
    });

    ws.on('close', () => {
      logger.info('Connection closed', {
        connectionId,
        botId: connection.session?.botId,
        botName: connection.session?.botName,
      });

      if (connection.session) {
        this.authService.endSession(connection.session.botId);
      }

      this.connectionManager.remove(connectionId);
    });

    ws.on('error', (error) => {
      logger.error('Connection error', error, { connectionId });
    });

    // Send welcome message
    this.send(ws, {
      type: 'WELCOME',
      connectionId,
      requiresAuth: type === 'bot',
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(
    connectionId: string,
    connection: Connection,
    message: WSMessage
  ): void {
    const ip = (connection as any)._ip || 'unknown';

    // Rate limit messages
    if (this.options.enableRateLimiting && !this.rateLimiter.check('message', connectionId)) {
      logger.warn('Message rate limited', { connectionId, ip, type: message.type });
      this.sendError(connection.ws, 'RATE_LIMITED', 'Too many messages. Slow down.');
      return;
    }

    this.connectionManager.updatePing(connectionId);

    const handler = this.messageHandlers.get(message.type);

    if (handler) {
      handler(connection, message);
    } else {
      logger.warn(`Unknown message type: ${message.type}`, { connectionId });
      this.sendError(connection.ws, 'UNKNOWN_TYPE', `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle authentication message
   */
  private async handleAuth(conn: Connection, message: WSMessage): Promise<void> {
    const ip = (conn as any)._ip || 'unknown';
    const apiKey = message.apiKey as string;

    // Rate limit auth attempts
    if (this.options.enableRateLimiting && !this.rateLimiter.check('auth', ip)) {
      const blockedFor = this.rateLimiter.getBlockedFor('auth', ip);
      logger.warn('Auth rate limited', { ip, blockedFor });
      this.sendError(conn.ws, 'RATE_LIMITED', `Too many auth attempts. Try again in ${Math.ceil(blockedFor / 1000)}s`);
      conn.ws.close(4029, 'Rate limited');
      return;
    }

    if (!apiKey) {
      this.sendError(conn.ws, 'AUTH_FAILED', 'Missing API key');
      return;
    }

    const session = await this.authService.authenticate(apiKey);

    if (!session) {
      logger.warn('Auth failed - invalid API key', { ip });
      this.sendError(conn.ws, 'AUTH_FAILED', 'Invalid API key');
      conn.ws.close(4001, 'Authentication failed');
      return;
    }

    // Find connection ID and set session
    for (const [id, c] of (this.connectionManager as any).connections.entries()) {
      if (c === conn) {
        this.connectionManager.setSession(id, session);
        break;
      }
    }

    this.send(conn.ws, {
      type: 'AUTH_SUCCESS',
      botId: session.botId,
      botName: session.botName,
      rating: session.rating,
    });

    logger.info('Bot authenticated', { botName: session.botName, botId: session.botId, ip });
  }

  /**
   * Handle ping message
   */
  private handlePing(conn: Connection, message: WSMessage): void {
    this.send(conn.ws, {
      type: 'PONG',
      timestamp: Date.now(),
    });
  }

  /**
   * Send message to WebSocket
   */
  private send(ws: WebSocket, message: unknown): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, {
      type: 'ERROR',
      code,
      message,
    });
  }

  /**
   * Start ping loop for connection health
   */
  private startPingLoop(): void {
    this.pingTimer = setInterval(() => {
      const removed = this.connectionManager.cleanupStale(this.options.connectionTimeout);
      if (removed.length > 0) {
        logger.info('Cleaned up stale connections', { count: removed.length });
      }
    }, this.options.pingInterval);
  }
}
