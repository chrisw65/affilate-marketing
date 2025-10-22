import app from './app';
import config from './config/env';
import prisma from './config/database';
import logger from './utils/logger';
import schedulerService from './services/scheduler.service';

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

// Initialize scheduled jobs
function initializeScheduler() {
  try {
    schedulerService.initializeJobs();
    logger.info('Scheduler initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize scheduler', error);
    // Don't exit - scheduler is not critical for basic operation
  }
}

// Start server
async function startServer() {
  try {
    await connectDatabase();

    // Initialize scheduler for automated tasks
    initializeScheduler();

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

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  schedulerService.stopAllJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  schedulerService.stopAllJobs();
  process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', reason);
  throw reason;
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});
