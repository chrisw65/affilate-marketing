import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../types';
import { AppError } from './errorHandler';
import logger from '../utils/logger';

interface JWTPayload {
  id: string;
  email: string;
  affiliateId: string;
  role: 'affiliate' | 'admin';
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    // Fetch affiliate from database
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: decoded.affiliateId },
    });

    if (!affiliate) {
      throw new AppError(401, 'Invalid authentication token', 'INVALID_TOKEN');
    }

    if (affiliate.status !== 'ACTIVE') {
      throw new AppError(403, 'Account is not active', 'ACCOUNT_INACTIVE');
    }

    // Attach user to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      affiliateId: decoded.affiliateId,
      role: decoded.role,
    };
    req.affiliate = affiliate;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, 'Invalid authentication token', 'INVALID_TOKEN'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Authentication token expired', 'TOKEN_EXPIRED'));
    }
    next(error);
  }
};

export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AppError(401, 'API key required', 'API_KEY_REQUIRED');
    }

    // Fetch affiliate by API key
    const affiliate = await prisma.affiliate.findUnique({
      where: { apiKey },
    });

    if (!affiliate) {
      logger.warn('Invalid API key attempt', { apiKey: apiKey.substring(0, 8) + '...' });
      throw new AppError(401, 'Invalid API key', 'INVALID_API_KEY');
    }

    if (affiliate.status !== 'ACTIVE') {
      throw new AppError(403, 'Account is not active', 'ACCOUNT_INACTIVE');
    }

    // Attach user to request
    req.user = {
      id: affiliate.id,
      email: affiliate.email,
      affiliateId: affiliate.id,
      role: 'affiliate',
    };
    req.affiliate = affiliate;

    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: decoded.affiliateId },
      });

      if (affiliate && affiliate.status === 'ACTIVE') {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          affiliateId: decoded.affiliateId,
          role: decoded.role,
        };
        req.affiliate = affiliate;
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};
