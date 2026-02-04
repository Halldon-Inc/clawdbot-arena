'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface ArenaSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface UseArenaSocketReturn {
  status: ConnectionStatus;
  send: (message: Record<string, unknown>) => void;
  subscribe: (type: string, handler: (data: any) => void) => () => void;
  connect: () => void;
  disconnect: () => void;
  lastMessage: any | null;
}

export function useArenaSocket(options: ArenaSocketOptions = {}): UseArenaSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 2000,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();
    setStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          const typeHandlers = handlersRef.current.get(data.type);
          if (typeHandlers) {
            typeHandlers.forEach((handler) => handler(data));
          }

          // Also notify wildcard listeners
          const wildcardHandlers = handlersRef.current.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => handler(data));
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        wsRef.current = null;

        if (reconnectCountRef.current < reconnectAttempts) {
          setStatus('reconnecting');
          reconnectCountRef.current++;
          const delay = reconnectDelay * Math.pow(1.5, reconnectCountRef.current - 1);
          reconnectTimerRef.current = setTimeout(connect, delay);
        } else {
          setStatus('disconnected');
        }
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      setStatus('disconnected');
    }
  }, [url, reconnectAttempts, reconnectDelay, cleanup]);

  const disconnect = useCallback(() => {
    reconnectCountRef.current = reconnectAttempts; // prevent reconnect
    cleanup();
    setStatus('disconnected');
  }, [cleanup, reconnectAttempts]);

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((type: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    return () => {
      const handlers = handlersRef.current.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(type);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return cleanup;
  }, [autoConnect, connect, cleanup]);

  return { status, send, subscribe, connect, disconnect, lastMessage };
}
