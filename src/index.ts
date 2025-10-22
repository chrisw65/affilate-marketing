import app from './app';
import config from './config/env';
import prisma from './config/database';
import logger from './utils/logger';

const PORT = config.port;

// Test database connection
async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`Server started successfully`, {
        port: PORT,
        environment: config.nodeEnv,
        apiBaseUrl: config.api.baseUrl,
      });

      if (config.nodeEnv === 'development') {
        console.log('\n🚀 Affiliate Management System API');
        console.log(`📍 Server running at: http://localhost:${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/health`);
        console.log(`📍 Portal: http://localhost:${PORT}/portal`);
        console.log(`📍 API Docs: http://localhost:${PORT}/api/docs\n`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', reason);
  throw reason;
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});
