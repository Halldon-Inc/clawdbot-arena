/**
 * Arena Server Entry Point
 */

import { ArenaServer } from './server.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

async function main() {
  const server = new ArenaServer({
    port: PORT,
    tickRate: 60,
    decisionTimeoutMs: 100,
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });

  await server.start();
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { ArenaServer } from './server.js';
export { ApiKeyManager } from './auth/ApiKeyManager.js';
export { AuthService } from './auth/AuthService.js';
export { MatchServer } from './match/MatchServer.js';
export { MatchStore } from './store/MatchStore.js';
export { ReplayRecorder, type ReplayData } from './match/ReplayRecorder.js';
export { ConnectionManager } from './ws/ConnectionManager.js';
export { WebSocketServerWrapper } from './ws/WebSocketServer.js';
