/**
 * Oracle Service
 * Bridges game server match results to the BettingArena smart contract.
 * Listens for MATCH_END events via WebSocket and calls resolveMatch() on-chain.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Hash,
  type TransactionReceipt,
  parseAbi,
  getContract,
  type GetContractReturnType,
  type Address,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { foundry, baseSepolia, base } from 'viem/chains';
import WebSocket from 'ws';
import type { Redis } from 'ioredis';

// BettingArena ABI - only the functions and events we need
const BETTING_ARENA_ABI = parseAbi([
  'function resolveMatch(uint256 matchId, uint256 winnerIndex) external',
  'function lockMatch(uint256 matchId) external',
  'function matches(uint256 matchId) external view returns (uint256 matchId, string gameType, uint256 botCount, uint256 startTime, uint256 lockTime, uint8 status, uint256 winnerIndex, uint256 totalPool)',
  'function matchCounter() external view returns (uint256)',
  'event MatchResolved(uint256 indexed matchId, uint256 winnerIndex, uint256 totalPool)',
  'event MatchCreated(uint256 indexed matchId, string gameType, uint256 botCount, uint256 startTime, uint256 lockTime)',
]);

export interface OracleConfig {
  wsUrl: string;
  rpcUrl: string;
  privateKey: `0x${string}`;
  bettingArenaAddress: Address;
  chainId: number;
  redis?: Redis;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  reconnectDelayMs?: number;
}

interface MatchEndEvent {
  matchId: string;
  winnerId: string | null;
  player1BotId: string;
  player2BotId: string;
  finalScore: {
    p1Rounds: number;
    p2Rounds: number;
  };
}

interface PendingResolution {
  matchId: string;
  onChainMatchId: bigint;
  winnerIndex: bigint;
  retries: number;
  lastAttempt: number;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class OracleService {
  private config: OracleConfig;
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: PrivateKeyAccount;
  private chain: Chain;
  private ws: WebSocket | null = null;
  private redis: Redis | null;
  private isRunning = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private currentNonce: number | null = null;
  private nonceLock = false;
  private pendingResolutions: Map<string, PendingResolution> = new Map();
  private processedMatches: Set<string> = new Set();
  private startTime: number = Date.now();
  private totalResolved = 0;
  private totalFailed = 0;

  constructor(config: OracleConfig) {
    this.config = {
      maxRetries: 3,
      retryBaseDelayMs: 1000,
      reconnectDelayMs: 5000,
      ...config,
    };
    this.redis = config.redis || null;

    this.chain = this.getChain(config.chainId);
    this.account = privateKeyToAccount(config.privateKey);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(config.rpcUrl),
    });

    this.log('info', 'Oracle service initialized', {
      address: this.account.address,
      chain: this.chain.name,
      chainId: this.chain.id,
      bettingArena: config.bettingArenaAddress,
    });
  }

  /**
   * Start the oracle service
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.startTime = Date.now();

    // Initialize nonce
    await this.refreshNonce();

    // Load processed matches from Redis
    await this.loadProcessedMatches();

    // Connect to game server
    this.connectWebSocket();

    this.log('info', 'Oracle service started');
  }

  /**
   * Stop the oracle service
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Oracle shutting down');
      this.ws = null;
    }

    // Save pending state to Redis
    await this.savePendingResolutions();

    this.log('info', 'Oracle service stopped', {
      totalResolved: this.totalResolved,
      totalFailed: this.totalFailed,
      uptime: Date.now() - this.startTime,
    });
  }

  /**
   * Connect to the game server WebSocket
   */
  private connectWebSocket(): void {
    if (!this.isRunning) return;

    const url = this.config.wsUrl;
    this.log('info', 'Connecting to game server', { url });

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.log('info', 'Connected to game server');
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (err) {
        this.log('error', 'Failed to parse WebSocket message', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.log('warn', 'Disconnected from game server', {
        code,
        reason: reason.toString(),
      });
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      this.log('error', 'WebSocket error', { error: err.message });
    });
  }

  /**
   * Schedule a WebSocket reconnection
   */
  private scheduleReconnect(): void {
    if (!this.isRunning) return;

    const delay = this.config.reconnectDelayMs!;
    this.log('info', `Reconnecting in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: Record<string, unknown>): void {
    const type = message.type as string;

    switch (type) {
      case 'WELCOME':
        this.log('debug', 'Received welcome from server', {
          connectionId: message.connectionId,
        });
        break;

      case 'MATCH_END':
        this.handleMatchEnd(message as unknown as MatchEndEvent);
        break;

      case 'MATCH_STARTING':
        this.log('info', 'Match starting', {
          matchId: message.matchId as string,
        });
        break;

      default:
        this.log('debug', 'Unhandled message type', { type });
    }
  }

  /**
   * Handle MATCH_END event - resolve the match on-chain
   */
  private async handleMatchEnd(event: MatchEndEvent): Promise<void> {
    const { matchId, winnerId, player1BotId, player2BotId } = event;

    // Deduplicate
    if (this.processedMatches.has(matchId)) {
      this.log('warn', 'Match already processed, skipping', { matchId });
      return;
    }

    this.log('info', 'Match ended, preparing on-chain resolution', {
      matchId,
      winnerId,
      player1BotId,
      player2BotId,
      score: event.finalScore,
    });

    // Determine winner index (0-based: 0 = player1, 1 = player2)
    let winnerIndex: bigint;
    if (winnerId === player1BotId) {
      winnerIndex = 0n;
    } else if (winnerId === player2BotId) {
      winnerIndex = 1n;
    } else {
      // Draw or unknown winner: default to player1 (0)
      // In production, you would cancel the on-chain match instead
      this.log('warn', 'No clear winner, defaulting to index 0', { matchId });
      winnerIndex = 0n;
    }

    // Look up the on-chain match ID
    // In a full system, the match creation flow would store this mapping.
    // For now, we attempt to find it via events or a simple mapping in Redis.
    const onChainMatchId = await this.lookupOnChainMatchId(matchId);

    if (onChainMatchId === null) {
      this.log('warn', 'No on-chain match found for game match, skipping resolution', {
        matchId,
      });
      this.markProcessed(matchId);
      return;
    }

    // Submit the resolution with retry logic
    await this.resolveMatchWithRetry({
      matchId,
      onChainMatchId,
      winnerIndex,
      retries: 0,
      lastAttempt: 0,
    });
  }

  /**
   * Look up the on-chain match ID corresponding to a game server match ID.
   * Uses Redis mapping or falls back to the latest match counter.
   */
  private async lookupOnChainMatchId(gameMatchId: string): Promise<bigint | null> {
    // Try Redis mapping first
    if (this.redis) {
      const stored = await this.redis.get(`oracle:match_map:${gameMatchId}`);
      if (stored) {
        return BigInt(stored);
      }
    }

    // Fallback: try to read the current match counter from the contract
    try {
      const counter = await this.publicClient.readContract({
        address: this.config.bettingArenaAddress,
        abi: BETTING_ARENA_ABI,
        functionName: 'matchCounter',
      }) as bigint;

      if (counter > 0n) {
        // Check if the latest match is in Locked status (status = 2)
        const matchData = await this.publicClient.readContract({
          address: this.config.bettingArenaAddress,
          abi: BETTING_ARENA_ABI,
          functionName: 'matches',
          args: [counter],
        }) as [bigint, string, bigint, bigint, bigint, number, bigint, bigint];

        const status = matchData[5];
        // Status 2 = Locked (ready for resolution)
        if (status === 2) {
          this.log('info', 'Found locked on-chain match', {
            onChainMatchId: counter.toString(),
            gameMatchId,
          });
          return counter;
        }
      }
    } catch (err) {
      this.log('error', 'Failed to read match counter from contract', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return null;
  }

  /**
   * Resolve a match on-chain with retry logic
   */
  private async resolveMatchWithRetry(pending: PendingResolution): Promise<void> {
    const maxRetries = this.config.maxRetries!;
    const baseDelay = this.config.retryBaseDelayMs!;

    this.pendingResolutions.set(pending.matchId, pending);

    while (pending.retries <= maxRetries) {
      try {
        pending.lastAttempt = Date.now();

        this.log('info', 'Submitting resolveMatch transaction', {
          matchId: pending.matchId,
          onChainMatchId: pending.onChainMatchId.toString(),
          winnerIndex: pending.winnerIndex.toString(),
          attempt: pending.retries + 1,
          maxRetries: maxRetries + 1,
        });

        const txHash = await this.submitResolveTransaction(
          pending.onChainMatchId,
          pending.winnerIndex
        );

        this.log('info', 'Transaction submitted, waiting for confirmation', {
          matchId: pending.matchId,
          txHash,
        });

        const receipt = await this.waitForTransaction(txHash);

        if (receipt.status === 'success') {
          this.log('info', 'Match resolved on-chain successfully', {
            matchId: pending.matchId,
            onChainMatchId: pending.onChainMatchId.toString(),
            txHash,
            blockNumber: receipt.blockNumber.toString(),
            gasUsed: receipt.gasUsed.toString(),
          });

          this.markProcessed(pending.matchId);
          this.pendingResolutions.delete(pending.matchId);
          this.totalResolved++;

          // Store the resolution record in Redis
          if (this.redis) {
            await this.redis.hset('oracle:resolutions', pending.matchId, JSON.stringify({
              matchId: pending.matchId,
              onChainMatchId: pending.onChainMatchId.toString(),
              winnerIndex: pending.winnerIndex.toString(),
              txHash,
              blockNumber: receipt.blockNumber.toString(),
              resolvedAt: Date.now(),
            }));
          }

          return;
        } else {
          this.log('error', 'Transaction reverted', {
            matchId: pending.matchId,
            txHash,
          });
          throw new Error(`Transaction reverted: ${txHash}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        pending.retries++;

        if (pending.retries > maxRetries) {
          this.log('error', 'Max retries exceeded for match resolution', {
            matchId: pending.matchId,
            error: errorMsg,
            totalRetries: pending.retries,
          });

          this.pendingResolutions.delete(pending.matchId);
          this.totalFailed++;

          // Store failure in Redis
          if (this.redis) {
            await this.redis.hset('oracle:failures', pending.matchId, JSON.stringify({
              matchId: pending.matchId,
              onChainMatchId: pending.onChainMatchId.toString(),
              error: errorMsg,
              retries: pending.retries,
              failedAt: Date.now(),
            }));
          }

          return;
        }

        // Exponential backoff: baseDelay * 2^retries
        const delay = baseDelay * Math.pow(2, pending.retries - 1);
        this.log('warn', `Retry ${pending.retries}/${maxRetries} in ${delay}ms`, {
          matchId: pending.matchId,
          error: errorMsg,
        });

        // Refresh nonce on failure in case it drifted
        await this.refreshNonce();

        await this.sleep(delay);
      }
    }
  }

  /**
   * Submit the resolveMatch transaction
   */
  private async submitResolveTransaction(
    matchId: bigint,
    winnerIndex: bigint
  ): Promise<Hash> {
    // Get nonce with lock to prevent race conditions
    const nonce = await this.getNextNonce();

    try {
      // Estimate gas first
      const gasEstimate = await this.publicClient.estimateContractGas({
        address: this.config.bettingArenaAddress,
        abi: BETTING_ARENA_ABI,
        functionName: 'resolveMatch',
        args: [matchId, winnerIndex],
        account: this.account,
      });

      // Add 20% gas buffer
      const gasLimit = (gasEstimate * 120n) / 100n;

      this.log('debug', 'Gas estimated', {
        estimate: gasEstimate.toString(),
        limit: gasLimit.toString(),
        nonce,
      });

      const hash = await this.walletClient.writeContract({
        chain: this.chain,
        account: this.account,
        address: this.config.bettingArenaAddress,
        abi: BETTING_ARENA_ABI,
        functionName: 'resolveMatch',
        args: [matchId, winnerIndex],
        gas: gasLimit,
        nonce,
      });

      return hash;
    } catch (err) {
      // If nonce error, reset nonce
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('nonce') || errMsg.includes('replacement')) {
        this.currentNonce = null;
        await this.refreshNonce();
      }
      throw err;
    }
  }

  /**
   * Wait for a transaction to be confirmed
   */
  private async waitForTransaction(hash: Hash): Promise<TransactionReceipt> {
    return this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 60_000,
    });
  }

  /**
   * Get the next nonce, managing it locally for sequential transactions
   */
  private async getNextNonce(): Promise<number> {
    // Simple lock to prevent concurrent nonce reads
    while (this.nonceLock) {
      await this.sleep(50);
    }
    this.nonceLock = true;

    try {
      if (this.currentNonce === null) {
        await this.refreshNonce();
      }

      const nonce = this.currentNonce!;
      this.currentNonce = nonce + 1;
      return nonce;
    } finally {
      this.nonceLock = false;
    }
  }

  /**
   * Refresh the nonce from the network
   */
  private async refreshNonce(): Promise<void> {
    try {
      const nonce = await this.publicClient.getTransactionCount({
        address: this.account.address,
        blockTag: 'pending',
      });
      this.currentNonce = nonce;
      this.log('debug', 'Nonce refreshed', { nonce });
    } catch (err) {
      this.log('error', 'Failed to refresh nonce', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Mark a match as processed
   */
  private async markProcessed(matchId: string): Promise<void> {
    this.processedMatches.add(matchId);

    if (this.redis) {
      await this.redis.sadd('oracle:processed_matches', matchId);
    }
  }

  /**
   * Load previously processed matches from Redis
   */
  private async loadProcessedMatches(): Promise<void> {
    if (!this.redis) return;

    try {
      const members = await this.redis.smembers('oracle:processed_matches');
      for (const m of members) {
        this.processedMatches.add(m);
      }
      this.log('info', 'Loaded processed matches from Redis', {
        count: members.length,
      });
    } catch (err) {
      this.log('warn', 'Failed to load processed matches from Redis', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Save pending resolutions to Redis for crash recovery
   */
  private async savePendingResolutions(): Promise<void> {
    if (!this.redis || this.pendingResolutions.size === 0) return;

    try {
      const entries: Record<string, string> = {};
      for (const [id, pending] of this.pendingResolutions) {
        entries[id] = JSON.stringify({
          matchId: pending.matchId,
          onChainMatchId: pending.onChainMatchId.toString(),
          winnerIndex: pending.winnerIndex.toString(),
          retries: pending.retries,
          lastAttempt: pending.lastAttempt,
        });
      }
      await this.redis.hset('oracle:pending_resolutions', entries);
      this.log('info', 'Saved pending resolutions to Redis', {
        count: this.pendingResolutions.size,
      });
    } catch (err) {
      this.log('error', 'Failed to save pending resolutions', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Map chain ID to viem chain definition
   */
  private getChain(chainId: number): Chain {
    switch (chainId) {
      case 31337:
        return foundry;
      case 84532:
        return baseSepolia;
      case 8453:
        return base;
      default:
        // Fallback to foundry (local) for unknown chain IDs
        return foundry;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): Record<string, unknown> {
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime,
      totalResolved: this.totalResolved,
      totalFailed: this.totalFailed,
      pendingResolutions: this.pendingResolutions.size,
      processedMatches: this.processedMatches.size,
      oracleAddress: this.account.address,
      chainId: this.chain.id,
      chainName: this.chain.name,
      connected: this.ws?.readyState === WebSocket.OPEN,
    };
  }

  /**
   * Structured logger
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'oracle',
      message,
      ...context,
    };

    const isJson = process.env.NODE_ENV === 'production';

    if (isJson) {
      const output = JSON.stringify(entry);
      switch (level) {
        case 'debug':
          console.debug(output);
          break;
        case 'info':
          console.info(output);
          break;
        case 'warn':
          console.warn(output);
          break;
        case 'error':
          console.error(output);
          break;
      }
    } else {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      const formatted = `[${entry.timestamp}] [${level.toUpperCase()}] [oracle] ${message}${contextStr}`;
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
          break;
      }
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
