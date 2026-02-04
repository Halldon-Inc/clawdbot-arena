/**
 * Rate Limiter
 * Prevents abuse of WebSocket connections and API endpoints
 */

export interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  maxRequests: number;    // Max requests per window
  blockDurationMs: number; // How long to block after exceeding limit
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  // Connection attempts: 10 per minute
  connection: {
    windowMs: 60000,
    maxRequests: 10,
    blockDurationMs: 300000, // 5 minutes
  },
  // Messages: 100 per second (for game inputs at 60fps + overhead)
  message: {
    windowMs: 1000,
    maxRequests: 100,
    blockDurationMs: 10000, // 10 seconds
  },
  // Auth attempts: 5 per minute
  auth: {
    windowMs: 60000,
    maxRequests: 5,
    blockDurationMs: 600000, // 10 minutes
  },
  // API calls: 60 per minute
  api: {
    windowMs: 60000,
    maxRequests: 60,
    blockDurationMs: 60000, // 1 minute
  },
  // Bot registration: 3 per hour
  registration: {
    windowMs: 3600000,
    maxRequests: 3,
    blockDurationMs: 3600000, // 1 hour
  },
};

export class RateLimiter {
  private limits: Map<string, Map<string, RateLimitEntry>>;
  private configs: Record<string, RateLimitConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(customConfigs?: Record<string, RateLimitConfig>) {
    this.limits = new Map();
    this.configs = { ...DEFAULT_CONFIGS, ...(customConfigs ?? {}) };

    // Clean up old entries periodically
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request should be allowed
   * @returns true if allowed, false if rate limited
   */
  check(type: string, identifier: string): boolean {
    const config = this.configs[type];
    if (!config) {
      console.warn(`Unknown rate limit type: ${type}`);
      return true;
    }

    const now = Date.now();
    let typeMap = this.limits.get(type);

    if (!typeMap) {
      typeMap = new Map();
      this.limits.set(type, typeMap);
    }

    let entry = typeMap.get(identifier);

    // Check if blocked
    if (entry && entry.blockedUntil > now) {
      return false;
    }

    // Initialize or reset window
    if (!entry || now - entry.windowStart >= config.windowMs) {
      entry = {
        count: 0,
        windowStart: now,
        blockedUntil: 0,
      };
      typeMap.set(identifier, entry);
    }

    // Increment count
    entry.count++;

    // Check if over limit
    if (entry.count > config.maxRequests) {
      entry.blockedUntil = now + config.blockDurationMs;
      return false;
    }

    return true;
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemaining(type: string, identifier: string): number {
    const config = this.configs[type];
    if (!config) return 0;

    const typeMap = this.limits.get(type);
    if (!typeMap) return config.maxRequests;

    const entry = typeMap.get(identifier);
    if (!entry) return config.maxRequests;

    const now = Date.now();

    // Check if window has reset
    if (now - entry.windowStart >= config.windowMs) {
      return config.maxRequests;
    }

    return Math.max(0, config.maxRequests - entry.count);
  }

  /**
   * Get time until unblocked (in ms)
   */
  getBlockedFor(type: string, identifier: string): number {
    const typeMap = this.limits.get(type);
    if (!typeMap) return 0;

    const entry = typeMap.get(identifier);
    if (!entry) return 0;

    const now = Date.now();
    if (entry.blockedUntil <= now) return 0;

    return entry.blockedUntil - now;
  }

  /**
   * Reset limits for an identifier
   */
  reset(type: string, identifier: string): void {
    const typeMap = this.limits.get(type);
    if (typeMap) {
      typeMap.delete(identifier);
    }
  }

  /**
   * Reset all limits for an identifier across all types
   */
  resetAll(identifier: string): void {
    for (const typeMap of this.limits.values()) {
      typeMap.delete(identifier);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [type, typeMap] of this.limits.entries()) {
      const config = this.configs[type];
      if (!config) continue;

      for (const [identifier, entry] of typeMap.entries()) {
        // Remove if window expired and not blocked
        const windowExpired = now - entry.windowStart >= config.windowMs * 2;
        const notBlocked = entry.blockedUntil <= now;

        if (windowExpired && notBlocked) {
          typeMap.delete(identifier);
        }
      }

      // Remove empty type maps
      if (typeMap.size === 0) {
        this.limits.delete(type);
      }
    }
  }

  /**
   * Stop the cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(): Record<string, { entries: number; blocked: number }> {
    const now = Date.now();
    const stats: Record<string, { entries: number; blocked: number }> = {};

    for (const [type, typeMap] of this.limits.entries()) {
      let blocked = 0;
      for (const entry of typeMap.values()) {
        if (entry.blockedUntil > now) blocked++;
      }

      stats[type] = {
        entries: typeMap.size,
        blocked,
      };
    }

    return stats;
  }
}
