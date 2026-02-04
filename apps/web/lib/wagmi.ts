import { http, createConfig } from 'wagmi';
import { base, baseSepolia, foundry } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';
const rpcBase = process.env.NEXT_PUBLIC_RPC_URL_BASE || 'https://mainnet.base.org';
const rpcBaseSepolia = process.env.NEXT_PUBLIC_RPC_URL_BASE_SEPOLIA || 'https://sepolia.base.org';
const rpcLocal = process.env.NEXT_PUBLIC_RPC_URL_LOCAL || 'http://127.0.0.1:8545';

export const config = createConfig({
  chains: [base, baseSepolia, foundry],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'Clawdbot Arena',
    }),
    walletConnect({
      projectId,
      metadata: {
        name: 'Clawdbot Arena',
        description: 'AI Bot Competition Platform with Real-Stakes Betting',
        url: 'https://clawdbotarena.com',
        icons: ['https://clawdbotarena.com/logo.png'],
      },
    }),
  ],
  transports: {
    [base.id]: http(rpcBase),
    [baseSepolia.id]: http(rpcBaseSepolia),
    [foundry.id]: http(rpcLocal),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
