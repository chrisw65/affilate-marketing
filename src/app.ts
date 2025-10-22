import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import logger from './utils/logger';

// Import routes (will be created next)
import authRoutes from './routes/auth.routes';
import webhookRoutes from './routes/webhook.routes';
import clickRoutes from './routes/click.routes';
import affiliateRoutes from './routes/affiliate.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

// ============================================================================
// Security Middleware
// ============================================================================

// Helmet for security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ============================================================================
// Body Parsing Middleware
// ============================================================================

// Raw body for webhooks (Stripe signature verification needs raw body)
app.use(
  '/webhooks',
  express.raw({ type: 'application/json', limit: '1mb' })
);

// JSON body parser for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser(config.cookie.secret));

// ============================================================================
// Request Logging
// ============================================================================

app.use(requestLogger);

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    },
  });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Affiliate Management System API',
      version: '0.1.0',
      phase: 'Phase 1 - MVP',
      documentation: '/api/docs',
    },
  });
});

// ============================================================================
// API Routes
// ============================================================================

app.use('/api/auth', authRoutes);
app.use('/api/clicks', clickRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/admin', adminRoutes);

// Webhooks (no /api prefix for easier provider configuration)
app.use('/webhooks', webhookRoutes);

// Static files for portal
app.use('/portal', express.static('public'));

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
