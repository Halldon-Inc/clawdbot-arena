/**
 * WebSocket Server
 * Handles WebSocket connections and message routing
 */

import { WebSocketServer as WSServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { nanoid } from 'nanoid';
import { ConnectionManager, type Connection } from './ConnectionManager.js';
import { AuthService } from '../auth/AuthService.js';

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export interface WSServerOptions {
  port?: number;
  pingInterval?: number;
  connectionTimeout?: number;
}

export class WebSocketServerWrapper {
  private wss: WSServer | null = null;
  private connectionManager: ConnectionManager;
  private authService: AuthService;
  private options: Required<WSServerOptions>;
  private pingTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, (conn: Connection, message: WSMessage) => void>;

  constructor(
    authService: AuthService,
    options: WSServerOptions = {}
  ) {
    this.authService = authService;
    this.connectionManager = new ConnectionManager();
    this.options = {
      port: options.port ?? 8080,
      pingInterval: options.pingInterval ?? 10000,
      connectionTimeout: options.connectionTimeout ?? 30000,
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
          console.log(`WebSocket server listening on port ${this.options.port}`);
          this.startPingLoop();
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error('WebSocket server error:', error);
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
          console.log('WebSocket server stopped');
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
    const connectionId = nanoid(16);
    const isBot = req.url?.includes('/bot');
    const type = isBot ? 'bot' : 'spectator';

    const connection = this.connectionManager.add(connectionId, ws, type);

    console.log(`New ${type} connection: ${connectionId}`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.handleMessage(connectionId, connection, message);
      } catch (error) {
        console.error(`Error parsing message from ${connectionId}:`, error);
        this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
      }
    });

    ws.on('close', () => {
      console.log(`Connection closed: ${connectionId}`);

      if (connection.session) {
        this.authService.endSession(connection.session.botId);
      }

      this.connectionManager.remove(connectionId);
    });

    ws.on('error', (error) => {
      console.error(`Connection error ${connectionId}:`, error);
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
    this.connectionManager.updatePing(connectionId);

    const handler = this.messageHandlers.get(message.type);

    if (handler) {
      handler(connection, message);
    } else {
      console.warn(`Unknown message type: ${message.type}`);
      this.sendError(connection.ws, 'UNKNOWN_TYPE', `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle authentication message
   */
  private async handleAuth(conn: Connection, message: WSMessage): Promise<void> {
    const apiKey = message.apiKey as string;

    if (!apiKey) {
      this.sendError(conn.ws, 'AUTH_FAILED', 'Missing API key');
      return;
    }

    const session = await this.authService.authenticate(apiKey);

    if (!session) {
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

    console.log(`Bot authenticated: ${session.botName} (${session.botId})`);
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
        console.log(`Cleaned up ${removed.length} stale connections`);
      }
    }, this.options.pingInterval);
  }
}
