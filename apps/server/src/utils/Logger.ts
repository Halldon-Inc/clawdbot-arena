/**
 * Production Logger
 * Structured logging with support for external services
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  serviceName: string;
  environment: string;
  enableConsole: boolean;
  enableJson: boolean;
  externalEndpoint?: string;
  externalApiKey?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      serviceName: process.env.SERVICE_NAME || 'arena-server',
      environment: process.env.NODE_ENV || 'development',
      enableConsole: true,
      enableJson: process.env.NODE_ENV === 'production',
      externalEndpoint: process.env.LOG_ENDPOINT,
      externalApiKey: process.env.LOG_API_KEY,
      ...config,
    };

    // Flush logs periodically in production
    if (this.config.externalEndpoint) {
      this.flushTimer = setInterval(() => this.flush(), 5000);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatEntry(entry: LogEntry): string {
    if (this.config.enableJson) {
      return JSON.stringify({
        ...entry,
        service: this.config.serviceName,
        env: this.config.environment,
      });
    }

    const contextStr = entry.context
      ? ` ${JSON.stringify(entry.context)}`
      : '';
    const errorStr = entry.error
      ? ` [${entry.error.name}: ${entry.error.message}]`
      : '';

    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}${errorStr}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    // Console output
    if (this.config.enableConsole) {
      const formatted = this.formatEntry(entry);
      switch (level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          if (error?.stack) console.error(error.stack);
          break;
      }
    }

    // Buffer for external service
    if (this.config.externalEndpoint) {
      this.buffer.push(entry);

      // Immediate flush for errors
      if (level === 'error') {
        this.flush();
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  /**
   * Flush buffered logs to external service
   */
  async flush(): Promise<void> {
    if (!this.config.externalEndpoint || this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.config.externalEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.externalApiKey && {
            'Authorization': `Bearer ${this.config.externalApiKey}`,
          }),
        },
        body: JSON.stringify({
          service: this.config.serviceName,
          environment: this.config.environment,
          entries,
        }),
      });
    } catch (err) {
      // Don't log to avoid infinite loop, just console
      console.error('Failed to flush logs to external service:', err);
      // Re-add entries to buffer
      this.buffer.unshift(...entries);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Stop the flush timer
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.parent.error(message, error, { ...this.context, ...context });
  }
}

// Singleton instance
export const logger = new Logger();

export { Logger, ChildLogger };
