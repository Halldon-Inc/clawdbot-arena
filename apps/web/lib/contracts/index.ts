/**
 * Contract ABIs and Addresses
 * Reads addresses from environment variables with fallbacks
 */

// =============================================================================
// Chain IDs
// =============================================================================

export const CHAIN_IDS = {
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532,
  LOCAL: 31337,
} as const;

// =============================================================================
// Contract Addresses (from env or defaults)
// =============================================================================

const envCompToken = process.env.NEXT_PUBLIC_COMP_TOKEN_ADDRESS as `0x${string}` | undefined;
const envBettingArena = process.env.NEXT_PUBLIC_BETTING_ARENA_ADDRESS as `0x${string}` | undefined;

export const CONTRACT_ADDRESSES: Record<number, {
  compToken: `0x${string}`;
  bettingArena: `0x${string}`;
}> = {
  // Base Sepolia (testnet)
  [CHAIN_IDS.BASE_SEPOLIA]: {
    compToken: envCompToken || '0x0000000000000000000000000000000000000000',
    bettingArena: envBettingArena || '0x0000000000000000000000000000000000000000',
  },
  // Local Anvil
  [CHAIN_IDS.LOCAL]: {
    compToken: envCompToken || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    bettingArena: envBettingArena || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  },
  // Base Mainnet
  [CHAIN_IDS.BASE_MAINNET]: {
    compToken: envCompToken || '0x0000000000000000000000000000000000000000',
    bettingArena: envBettingArena || '0x0000000000000000000000000000000000000000',
  },
};

// =============================================================================
// CompToken ABI
// =============================================================================

export const COMP_TOKEN_ABI = [
  {
    type: 'constructor',
    inputs: [{ name: 'initialSupply', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;

// =============================================================================
// BettingArena ABI
// =============================================================================

export const BETTING_ARENA_ABI = [
  // Constants
  {
    type: 'function',
    name: 'HOUSE_EDGE_BPS',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_BET',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_BET',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },

  // State
  {
    type: 'function',
    name: 'compToken',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'treasury',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'matchCounter',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },

  // Match functions
  {
    type: 'function',
    name: 'createMatch',
    inputs: [
      { name: 'gameType', type: 'string' },
      { name: 'botCount', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'lockTime', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'botIndex', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'lockMatch',
    inputs: [{ name: 'matchId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveMatch',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'winnerIndex', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelMatch',
    inputs: [{ name: 'matchId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimWinnings',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'betIndex', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRefund',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'betIndex', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // View functions
  {
    type: 'function',
    name: 'getMatch',
    inputs: [{ name: 'matchId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'matchId', type: 'uint256' },
          { name: 'gameType', type: 'string' },
          { name: 'botCount', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'lockTime', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'winnerIndex', type: 'uint256' },
          { name: 'totalPool', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBotPool',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'botIndex', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOdds',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'botIndex', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserBets',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBet',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'betIndex', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'bettor', type: 'address' },
          { name: 'matchId', type: 'uint256' },
          { name: 'botIndex', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'oddsAtBet', type: 'uint256' },
          { name: 'claimed', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculatePayout',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'betIndex', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },

  // Events
  {
    type: 'event',
    name: 'MatchCreated',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'gameType', type: 'string', indexed: false },
      { name: 'botCount', type: 'uint256', indexed: false },
      { name: 'startTime', type: 'uint256', indexed: false },
      { name: 'lockTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'bettor', type: 'address', indexed: true },
      { name: 'botIndex', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'odds', type: 'uint256', indexed: false },
      { name: 'betIndex', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MatchLocked',
    inputs: [{ name: 'matchId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'MatchResolved',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'winnerIndex', type: 'uint256', indexed: false },
      { name: 'totalPool', type: 'uint256', indexed: false },
      { name: 'houseCut', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MatchCancelled',
    inputs: [{ name: 'matchId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'WinningsClaimed',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'bettor', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RefundClaimed',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'bettor', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// =============================================================================
// Helper Functions
// =============================================================================

export function getContractAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[CHAIN_IDS.LOCAL];
}

export function isChainSupported(chainId: number): boolean {
  return chainId in CONTRACT_ADDRESSES;
}

// Match status enum for TypeScript
export enum MatchStatus {
  Pending = 0,
  Open = 1,
  Locked = 2,
  Resolved = 3,
  Cancelled = 4,
}
