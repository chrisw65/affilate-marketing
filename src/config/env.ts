import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  COOKIE_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_MAX_AGE: z.string().default('2592000000'),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CLICKFUNNELS_WEBHOOK_SECRET: z.string().optional(),
  GROOVE_WEBHOOK_SECRET: z.string().optional(),
  ATTRIBUTION_WINDOW_DAYS: z.string().default('30'),
  CLICK_COOKIE_NAME: z.string().default('aff_click_id'),
  CLICK_COOKIE_MAX_AGE: z.string().default('2592000000'),
  DEFAULT_COMMISSION_RATE: z.string().default('0.40'),
  COMMISSION_HOLD_DAYS: z.string().default('30'),
  MIN_PAYOUT_THRESHOLD_USD: z.string().default('50'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  API_BASE_URL: z.string().default('http://localhost:3000'),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
};

export const env = parseEnv();

export default {
  nodeEnv: env.NODE_ENV,
  port: parseInt(env.PORT, 10),
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  cookie: {
    secret: env.COOKIE_SECRET,
    domain: env.COOKIE_DOMAIN,
    maxAge: parseInt(env.COOKIE_MAX_AGE, 10),
  },
  webhooks: {
    stripe: env.STRIPE_WEBHOOK_SECRET,
    clickfunnels: env.CLICKFUNNELS_WEBHOOK_SECRET,
    groove: env.GROOVE_WEBHOOK_SECRET,
  },
  attribution: {
    windowDays: parseInt(env.ATTRIBUTION_WINDOW_DAYS, 10),
    cookieName: env.CLICK_COOKIE_NAME,
    cookieMaxAge: parseInt(env.CLICK_COOKIE_MAX_AGE, 10),
  },
  commission: {
    defaultRate: parseFloat(env.DEFAULT_COMMISSION_RATE),
    holdDays: parseInt(env.COMMISSION_HOLD_DAYS, 10),
    minPayoutThreshold: parseFloat(env.MIN_PAYOUT_THRESHOLD_USD),
  },
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  },
  logging: {
    level: env.LOG_LEVEL,
    filePath: env.LOG_FILE_PATH,
  },
  cors: {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  },
  api: {
    baseUrl: env.API_BASE_URL,
  },
};
