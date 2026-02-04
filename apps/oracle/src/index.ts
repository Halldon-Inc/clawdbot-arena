/**
 * Oracle Service Entry Point
 * Bridges game server match results to the BettingArena smart contract.
 */

import Redis from 'ioredis';
import { OracleService, type OracleConfig } from './oracle.js';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const wsUrl = getRequiredEnv('WS_URL');
  const rpcUrl = getRequiredEnv('RPC_URL');
  const privateKey = getRequiredEnv('ORACLE_PRIVATE_KEY') as `0x${string}`;
  const bettingArenaAddress = getRequiredEnv('BETTING_ARENA_ADDRESS') as `0x${string}`;
  const chainId = parseInt(process.env.CHAIN_ID || '31337', 10);
  const redisUrl = process.env.REDIS_URL;

  let redis: Redis | undefined;
  if (redisUrl) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 10) return null;
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
    });

    try {
      await redis.connect();
      console.info(`[oracle] Connected to Redis at ${redisUrl}`);
    } catch (err) {
      console.warn('[oracle] Redis connection failed, continuing without Redis:', err);
      redis = undefined;
    }
  }

  const config: OracleConfig = {
    wsUrl,
    rpcUrl,
    privateKey,
    bettingArenaAddress,
    chainId,
    redis,
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryBaseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || '1000', 10),
    reconnectDelayMs: parseInt(process.env.RECONNECT_DELAY_MS || '5000', 10),
  };

  const oracle = new OracleService(config);

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.info(`[oracle] Received ${signal}, shutting down...`);
    await oracle.stop();
    if (redis) {
      await redis.quit();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    console.error('[oracle] Uncaught exception:', err);
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[oracle] Unhandled rejection:', reason);
  });

  await oracle.start();

  console.info('[oracle] Oracle service is running');
  console.info(`[oracle] Listening for match results on ${wsUrl}`);
  console.info(`[oracle] Resolving to contract ${bettingArenaAddress} on chain ${chainId}`);

  // Keep the process alive
  await new Promise<void>(() => {});
}

main().catch((err) => {
  console.error('[oracle] Fatal error:', err);
  process.exit(1);
});
