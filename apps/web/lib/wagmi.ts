import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';

export const config = createConfig({
  chains: [base, baseSepolia],
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
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
