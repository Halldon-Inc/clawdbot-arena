/**
 * Connection Manager
 * Manages WebSocket connections for bots and spectators
 */

import type { WebSocket } from 'ws';
import type { AuthenticatedSession } from '../auth/AuthService.js';

export type ConnectionType = 'bot' | 'spectator';

export interface Connection {
  ws: WebSocket;
  type: ConnectionType;
  session: AuthenticatedSession | null;
  connectedAt: number;
  lastPing: number;
  matchId: string | null;
}

export class ConnectionManager {
  private connections: Map<string, Connection>;
  private botConnections: Map<string, string>; // botId -> connectionId
  private spectatorsByMatch: Map<string, Set<string>>; // matchId -> connectionIds

  constructor() {
    this.connections = new Map();
    this.botConnections = new Map();
    this.spectatorsByMatch = new Map();
  }

  /**
   * Add a new connection
   */
  add(connectionId: string, ws: WebSocket, type: ConnectionType): Connection {
    const connection: Connection = {
      ws,
      type,
      session: null,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      matchId: null,
    };

    this.connections.set(connectionId, connection);
    return connection;
  }

  /**
   * Associate a session with a connection
   */
  setSession(connectionId: string, session: AuthenticatedSession): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.session = session;
      this.botConnections.set(session.botId, connectionId);
    }
  }

  /**
   * Get connection by ID
   */
  get(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get connection ID by bot ID
   */
  getConnectionIdByBotId(botId: string): string | undefined {
    return this.botConnections.get(botId);
  }

  /**
   * Get connection by bot ID
   */
  getByBotId(botId: string): Connection | undefined {
    const connectionId = this.botConnections.get(botId);
    if (connectionId) {
      return this.connections.get(connectionId);
    }
    return undefined;
  }

  /**
   * Add a spectator to a match
   */
  addSpectator(connectionId: string, matchId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.matchId = matchId;

      let spectators = this.spectatorsByMatch.get(matchId);
      if (!spectators) {
        spectators = new Set();
        this.spectatorsByMatch.set(matchId, spectators);
      }
      spectators.add(connectionId);
    }
  }

  /**
   * Remove a spectator from a match
   */
  removeSpectator(connectionId: string, matchId: string): void {
    const spectators = this.spectatorsByMatch.get(matchId);
    if (spectators) {
      spectators.delete(connectionId);
      if (spectators.size === 0) {
        this.spectatorsByMatch.delete(matchId);
      }
    }
  }

  /**
   * Get all spectators for a match
   */
  getSpectators(matchId: string): Connection[] {
    const spectatorIds = this.spectatorsByMatch.get(matchId);
    if (!spectatorIds) return [];

    const connections: Connection[] = [];
    for (const id of spectatorIds) {
      const conn = this.connections.get(id);
      if (conn) {
        connections.push(conn);
      }
    }
    return connections;
  }

  /**
   * Assign a bot to a match
   */
  assignToMatch(botId: string, matchId: string): void {
    const connection = this.getByBotId(botId);
    if (connection) {
      connection.matchId = matchId;
    }
  }

  /**
   * Remove connection
   */
  remove(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Remove from bot connections
      if (connection.session) {
        this.botConnections.delete(connection.session.botId);
      }

      // Remove from spectators
      if (connection.matchId) {
        this.removeSpectator(connectionId, connection.matchId);
      }

      this.connections.delete(connectionId);
    }
  }

  /**
   * Send message to a connection
   */
  send(connectionId: string, message: unknown): boolean {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === connection.ws.OPEN) {
      connection.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Send message to a bot
   */
  sendToBot(botId: string, message: unknown): boolean {
    const connectionId = this.botConnections.get(botId);
    if (connectionId) {
      return this.send(connectionId, message);
    }
    return false;
  }

  /**
   * Broadcast to all spectators of a match
   */
  broadcastToSpectators(matchId: string, message: unknown): void {
    const spectators = this.spectatorsByMatch.get(matchId);
    if (!spectators) return;

    const data = JSON.stringify(message);
    for (const connectionId of spectators) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(data);
      }
    }
  }

  /**
   * Broadcast to all connections
   */
  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(data);
      }
    }
  }

  /**
   * Update ping timestamp
   */
  updatePing(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPing = Date.now();
    }
  }

  /**
   * Get all authenticated bots
   */
  getAuthenticatedBots(): Connection[] {
    return Array.from(this.connections.values()).filter(
      (c) => c.type === 'bot' && c.session !== null
    );
  }

  /**
   * Get connection count
   */
  getConnectionCount(): { total: number; bots: number; spectators: number } {
    let bots = 0;
    let spectators = 0;

    for (const conn of this.connections.values()) {
      if (conn.type === 'bot') bots++;
      else spectators++;
    }

    return { total: this.connections.size, bots, spectators };
  }

  /**
   * Clean up stale connections
   */
  cleanupStale(timeoutMs: number = 30000): string[] {
    const now = Date.now();
    const removed: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      if (now - connection.lastPing > timeoutMs) {
        connection.ws.close();
        this.remove(id);
        removed.push(id);
      }
    }

    return removed;
  }
}
