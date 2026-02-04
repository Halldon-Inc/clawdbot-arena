/**
 * Shared environment configuration with Zod validation
 */

import { z } from 'zod';

// Web app env schema (NEXT_PUBLIC_ variables)
export const webEnvSchema = z.object({
  NEXT_PUBLIC_WS_URL: z.string().url().default('ws://localhost:8080'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:8080'),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().default(31337),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().default('demo'),
  NEXT_PUBLIC_COMP_TOKEN_ADDRESS: z.string().startsWith('0x').default('0x5FbDB2315678afecb367f032d93F642f64180aa3'),
  NEXT_PUBLIC_BETTING_ARENA_ADDRESS: z.string().startsWith('0x').default('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'),
  NEXT_PUBLIC_RPC_URL_BASE: z.string().url().default('https://mainnet.base.org'),
  NEXT_PUBLIC_RPC_URL_BASE_SEPOLIA: z.string().url().default('https://sepolia.base.org'),
  NEXT_PUBLIC_RPC_URL_LOCAL: z.string().url().default('http://127.0.0.1:8545'),
});

// Server env schema
export const serverEnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SERVICE_NAME: z.string().default('arena-server'),
  REDIS_URL: z.string().optional(),
  LOG_ENDPOINT: z.string().url().optional(),
  LOG_API_KEY: z.string().optional(),
});

// Contract/Oracle env schema
export const contractEnvSchema = z.object({
  PRIVATE_KEY: z.string().min(1),
  RPC_URL: z.string().url(),
  ETHERSCAN_API_KEY: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ContractEnv = z.infer<typeof contractEnvSchema>;

/**
 * Parse and validate web environment variables
 */
export function getWebEnv(): WebEnv {
  return webEnvSchema.parse({
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_COMP_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_COMP_TOKEN_ADDRESS,
    NEXT_PUBLIC_BETTING_ARENA_ADDRESS: process.env.NEXT_PUBLIC_BETTING_ARENA_ADDRESS,
    NEXT_PUBLIC_RPC_URL_BASE: process.env.NEXT_PUBLIC_RPC_URL_BASE,
    NEXT_PUBLIC_RPC_URL_BASE_SEPOLIA: process.env.NEXT_PUBLIC_RPC_URL_BASE_SEPOLIA,
    NEXT_PUBLIC_RPC_URL_LOCAL: process.env.NEXT_PUBLIC_RPC_URL_LOCAL,
  });
}

/**
 * Parse and validate server environment variables
 */
export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    SERVICE_NAME: process.env.SERVICE_NAME,
    REDIS_URL: process.env.REDIS_URL,
    LOG_ENDPOINT: process.env.LOG_ENDPOINT,
    LOG_API_KEY: process.env.LOG_API_KEY,
  });
}
