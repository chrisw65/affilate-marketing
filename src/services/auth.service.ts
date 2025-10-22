import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { Affiliate, AffiliateStatus, KYCStatus } from '@prisma/client';
import logger from '../utils/logger';

interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  country?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResponse {
  affiliate: Partial<Affiliate>;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(data: RegisterInput): Promise<AuthResponse> {
    try {
      // Check if affiliate already exists
      const existing = await prisma.affiliate.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        throw new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create affiliate
      const affiliate = await prisma.affiliate.create({
        data: {
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
          country: data.country,
          status: AffiliateStatus.PENDING, // Requires approval
          kycStatus: KYCStatus.NOT_STARTED,
        },
      });

      logger.info('New affiliate registered', {
        affiliateId: affiliate.id,
        email: affiliate.email,
      });

      // Generate tokens
      const tokenPayload = {
        id: affiliate.id,
        email: affiliate.email,
        affiliateId: affiliate.id,
        role: 'affiliate' as const,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Remove password from response
      const { password: _, ...affiliateData } = affiliate;

      return {
        affiliate: affiliateData,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Registration error', error);
      throw new AppError(500, 'Failed to create account', 'REGISTRATION_FAILED');
    }
  }

  async login(data: LoginInput): Promise<AuthResponse> {
    try {
      // Find affiliate
      const affiliate = await prisma.affiliate.findUnique({
        where: { email: data.email },
      });

      if (!affiliate) {
        throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      }

      // Verify password
      const validPassword = await bcrypt.compare(data.password, affiliate.password);

      if (!validPassword) {
        throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      }

      // Check if account is active
      if (affiliate.status === AffiliateStatus.BANNED) {
        throw new AppError(403, 'Your account has been banned', 'ACCOUNT_BANNED');
      }

      if (affiliate.status === AffiliateStatus.SUSPENDED) {
        throw new AppError(403, 'Your account has been suspended', 'ACCOUNT_SUSPENDED');
      }

      // Update last login
      await prisma.affiliate.update({
        where: { id: affiliate.id },
        data: { lastLoginAt: new Date() },
      });

      logger.info('Affiliate logged in', {
        affiliateId: affiliate.id,
        email: affiliate.email,
      });

      // Generate tokens
      const tokenPayload = {
        id: affiliate.id,
        email: affiliate.email,
        affiliateId: affiliate.id,
        role: 'affiliate' as const,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Remove password from response
      const { password: _, ...affiliateData } = affiliate;

      return {
        affiliate: affiliateData,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Login error', error);
      throw new AppError(500, 'Login failed', 'LOGIN_FAILED');
    }
  }

  async getProfile(affiliateId: string): Promise<Partial<Affiliate>> {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        status: true,
        kycStatus: true,
        phone: true,
        country: true,
        payoutMethod: true,
        payoutEmail: true,
        payoutCurrency: true,
        minPayoutThreshold: true,
        commissionRate: true,
        commissionTier: true,
        apiKey: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        approvedAt: true,
      },
    });

    if (!affiliate) {
      throw new AppError(404, 'Affiliate not found', 'NOT_FOUND');
    }

    return affiliate;
  }
}

export default new AuthService();
