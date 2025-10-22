import prisma from '../config/database';
import { CommissionStatus, PayoutStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

// Note: Install stripe SDK: npm install stripe
// For now, we'll create the interface for Stripe integration

interface StripeConnectAccount {
  id: string;
  email: string;
  country: string;
  currency: string;
}

interface PayoutRequest {
  affiliateId: string;
  amount: number;
  currency: string;
  commissionIds: string[];
}

export class StripePayoutService {
  private stripe: any; // Will be Stripe instance when SDK is installed

  constructor() {
    // TODO: Initialize Stripe when SDK is installed
    // this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  }

  /**
   * Create Stripe Connect account for affiliate
   */
  async createConnectAccount(affiliateId: string): Promise<string> {
    try {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
      });

      if (!affiliate) {
        throw new AppError(404, 'Affiliate not found', 'NOT_FOUND');
      }

      // TODO: Create Stripe Connect account
      // const account = await this.stripe.accounts.create({
      //   type: 'express',
      //   country: affiliate.country || 'US',
      //   email: affiliate.email,
      //   capabilities: {
      //     transfers: { requested: true },
      //   },
      // });

      const mockAccountId = `acct_mock_${affiliateId}`;

      // Store Connect account ID
      await prisma.affiliate.update({
        where: { id: affiliateId },
        data: {
          customData: {
            stripeConnectAccountId: mockAccountId,
          },
        },
      });

      logger.info('Stripe Connect account created', {
        affiliateId,
        accountId: mockAccountId,
      });

      return mockAccountId;
    } catch (error) {
      logger.error('Failed to create Stripe Connect account', { affiliateId, error });
      throw new AppError(500, 'Failed to create payout account', 'STRIPE_ERROR');
    }
  }

  /**
   * Generate Stripe Connect onboarding link
   */
  async createOnboardingLink(affiliateId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    try {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
      });

      if (!affiliate) {
        throw new AppError(404, 'Affiliate not found', 'NOT_FOUND');
      }

      const accountId = (affiliate.customData as any)?.stripeConnectAccountId;

      if (!accountId) {
        throw new AppError(400, 'Stripe Connect account not created', 'NO_CONNECT_ACCOUNT');
      }

      // TODO: Create account link
      // const accountLink = await this.stripe.accountLinks.create({
      //   account: accountId,
      //   refresh_url: refreshUrl,
      //   return_url: returnUrl,
      //   type: 'account_onboarding',
      // });

      const mockLink = `https://connect.stripe.com/setup/s/${accountId}`;

      logger.info('Stripe onboarding link created', { affiliateId, accountId });

      return mockLink;
    } catch (error) {
      logger.error('Failed to create onboarding link', { affiliateId, error });
      throw new AppError(500, 'Failed to create onboarding link', 'STRIPE_ERROR');
    }
  }

  /**
   * Check if affiliate's Stripe Connect account is ready
   */
  async isAccountReady(affiliateId: string): Promise<boolean> {
    try {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
      });

      if (!affiliate) {
        return false;
      }

      const accountId = (affiliate.customData as any)?.stripeConnectAccountId;

      if (!accountId) {
        return false;
      }

      // TODO: Check account status
      // const account = await this.stripe.accounts.retrieve(accountId);
      // return account.charges_enabled && account.payouts_enabled;

      // Mock: assume ready for testing
      return true;
    } catch (error) {
      logger.error('Failed to check account status', { affiliateId, error });
      return false;
    }
  }

  /**
   * Execute payout via Stripe Connect transfer
   */
  async executePayout(payoutRequest: PayoutRequest): Promise<string> {
    try {
      const { affiliateId, amount, currency, commissionIds } = payoutRequest;

      const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
      });

      if (!affiliate) {
        throw new AppError(404, 'Affiliate not found', 'NOT_FOUND');
      }

      const accountId = (affiliate.customData as any)?.stripeConnectAccountId;

      if (!accountId) {
        throw new AppError(400, 'Stripe Connect account not set up', 'NO_CONNECT_ACCOUNT');
      }

      // Check if account is ready
      const isReady = await this.isAccountReady(affiliateId);
      if (!isReady) {
        throw new AppError(400, 'Stripe Connect account not ready', 'ACCOUNT_NOT_READY');
      }

      // Create payout record
      const payout = await prisma.payout.create({
        data: {
          affiliateId,
          amount,
          currency,
          method: 'STRIPE_CONNECT',
          status: PayoutStatus.PROCESSING,
          recipientAccount: accountId,
        },
      });

      try {
        // TODO: Create Stripe transfer
        // const transfer = await this.stripe.transfers.create({
        //   amount: amount,
        //   currency: currency.toLowerCase(),
        //   destination: accountId,
        //   metadata: {
        //     payout_id: payout.id,
        //     affiliate_id: affiliateId,
        //   },
        // });

        const mockTransferId = `tr_mock_${payout.id}`;

        // Update payout with Stripe transfer ID
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: PayoutStatus.COMPLETED,
            externalId: mockTransferId,
            processedAt: new Date(),
            completedAt: new Date(),
          },
        });

        // Update commissions to PAID status
        await prisma.commission.updateMany({
          where: {
            id: { in: commissionIds },
          },
          data: {
            status: CommissionStatus.PAID,
            payoutId: payout.id,
            paidAt: new Date(),
          },
        });

        logger.info('Stripe payout executed successfully', {
          payoutId: payout.id,
          affiliateId,
          amount,
          transferId: mockTransferId,
        });

        return payout.id;
      } catch (stripeError: any) {
        // Update payout as failed
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: PayoutStatus.FAILED,
            failureReason: stripeError.message,
            failedAt: new Date(),
          },
        });

        logger.error('Stripe payout failed', {
          payoutId: payout.id,
          error: stripeError.message,
        });

        throw new AppError(500, `Payout failed: ${stripeError.message}`, 'STRIPE_PAYOUT_FAILED');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to execute payout', { payoutRequest, error });
      throw new AppError(500, 'Failed to execute payout', 'PAYOUT_FAILED');
    }
  }

  /**
   * Process pending payouts automatically
   */
  async processAutomatedPayouts() {
    logger.info('Starting automated payout processing');

    // Get all affiliates with approved commissions above threshold
    const affiliates = await prisma.affiliate.findMany({
      where: {
        status: 'ACTIVE',
        payoutMethod: 'STRIPE_CONNECT',
      },
      include: {
        commissions: {
          where: {
            status: CommissionStatus.APPROVED,
            payoutId: null,
          },
        },
      },
    });

    let processed = 0;
    let failed = 0;

    for (const affiliate of affiliates) {
      const totalEligible = affiliate.commissions.reduce(
        (sum, c) => sum + c.commissionAmount,
        0
      );

      // Check if above minimum threshold
      if (totalEligible >= affiliate.minPayoutThreshold) {
        try {
          const commissionIds = affiliate.commissions.map((c) => c.id);

          await this.executePayout({
            affiliateId: affiliate.id,
            amount: totalEligible,
            currency: affiliate.payoutCurrency,
            commissionIds,
          });

          processed++;
        } catch (error) {
          logger.error('Failed to process automated payout', {
            affiliateId: affiliate.id,
            error,
          });
          failed++;
        }
      }
    }

    logger.info('Automated payout processing completed', { processed, failed });

    return { processed, failed };
  }

  /**
   * Retry failed payouts
   */
  async retryFailedPayouts() {
    const failedPayouts = await prisma.payout.findMany({
      where: {
        status: PayoutStatus.FAILED,
        retryCount: { lt: 3 }, // Max 3 retries
      },
      include: {
        affiliate: true,
        commissions: true,
      },
    });

    logger.info('Retrying failed payouts', { count: failedPayouts.length });

    let retried = 0;

    for (const payout of failedPayouts) {
      try {
        const commissionIds = payout.commissions.map((c) => c.id);

        // Reset commissions to APPROVED
        await prisma.commission.updateMany({
          where: { id: { in: commissionIds } },
          data: {
            status: CommissionStatus.APPROVED,
            payoutId: null,
          },
        });

        // Delete failed payout
        await prisma.payout.delete({
          where: { id: payout.id },
        });

        // Retry payout
        await this.executePayout({
          affiliateId: payout.affiliateId,
          amount: payout.amount,
          currency: payout.currency,
          commissionIds,
        });

        retried++;
      } catch (error) {
        logger.error('Failed to retry payout', { payoutId: payout.id, error });
      }
    }

    logger.info('Failed payout retry completed', { retried });

    return { retried };
  }
}

export default new StripePayoutService();
