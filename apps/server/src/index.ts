/**
 * Arena Server Entry Point
 */

import { ArenaServer } from './server.js';
import { logger } from './utils/Logger.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '0', 10);

async function main() {
  const server = new ArenaServer({
    port: PORT,
    httpPort: HTTP_PORT > 0 ? HTTP_PORT : undefined,
    tickRate: 60,
    decisionTimeoutMs: 100,
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await server.stop();
    logger.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await server.stop();
    logger.destroy();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  });

  await server.start();
}

main().catch((error) => {
  logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
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
export { HttpServer } from './http/HttpServer.js';
export { TournamentManager } from './tournament/TournamentManager.js';
export { SeasonManager } from './season/SeasonManager.js';
export { CosmeticStore } from './cosmetics/CosmeticStore.js';
