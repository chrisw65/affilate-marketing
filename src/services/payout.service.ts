import prisma from '../config/database';
import config from '../config/env';
import { CommissionStatus, PayoutStatus, PayoutMethod } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class PayoutService {
  /**
   * Generate payout CSV for eligible commissions
   */
  async generatePayoutCSV(filters?: {
    affiliateId?: string;
    minAmount?: number;
  }) {
    try {
      // Get approved commissions that haven't been paid
      const where: any = {
        status: CommissionStatus.APPROVED,
        payoutId: null,
      };

      if (filters?.affiliateId) {
        where.affiliateId = filters.affiliateId;
      }

      const commissions = await prisma.commission.findMany({
        where,
        include: {
          affiliate: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              payoutMethod: true,
              payoutEmail: true,
              payoutCurrency: true,
              minPayoutThreshold: true,
            },
          },
        },
      });

      // Group by affiliate
      const affiliateMap = new Map<string, any>();

      commissions.forEach((commission) => {
        const affiliateId = commission.affiliateId;

        if (!affiliateMap.has(affiliateId)) {
          affiliateMap.set(affiliateId, {
            affiliate: commission.affiliate,
            totalAmount: 0,
            commissionIds: [],
            currency: commission.currency,
          });
        }

        const data = affiliateMap.get(affiliateId);
        data.totalAmount += commission.commissionAmount;
        data.commissionIds.push(commission.id);
      });

      // Filter by minimum payout threshold
      const payoutData: any[] = [];
      const batchId = uuidv4();

      for (const [affiliateId, data] of affiliateMap.entries()) {
        const minThreshold = filters?.minAmount || data.affiliate.minPayoutThreshold || 0;

        if (data.totalAmount >= minThreshold) {
          payoutData.push({
            batchId,
            affiliateId,
            email: data.affiliate.email,
            firstName: data.affiliate.firstName || '',
            lastName: data.affiliate.lastName || '',
            amount: data.totalAmount / 100, // Convert cents to dollars
            currency: data.currency,
            payoutEmail: data.affiliate.payoutEmail || data.affiliate.email,
            payoutMethod: data.affiliate.payoutMethod,
            commissionCount: data.commissionIds.length,
            commissionIds: data.commissionIds,
          });
        }
      }

      // Generate CSV content
      const csvHeader = [
        'Affiliate ID',
        'Email',
        'First Name',
        'Last Name',
        'Payout Email',
        'Amount',
        'Currency',
        'Method',
        'Commission Count',
        'Batch ID',
      ].join(',');

      const csvRows = payoutData.map((row) =>
        [
          row.affiliateId,
          row.email,
          row.firstName,
          row.lastName,
          row.payoutEmail,
          row.amount.toFixed(2),
          row.currency,
          row.payoutMethod,
          row.commissionCount,
          row.batchId,
        ].join(',')
      );

      const csv = [csvHeader, ...csvRows].join('\n');

      logger.info('Payout CSV generated', {
        batchId,
        affiliates: payoutData.length,
        totalAmount: payoutData.reduce((sum, p) => sum + p.amount, 0),
      });

      return {
        csv,
        batchId,
        summary: {
          totalAffiliates: payoutData.length,
          totalAmount: payoutData.reduce((sum, p) => sum + p.amount, 0),
          payouts: payoutData,
        },
      };
    } catch (error) {
      logger.error('Failed to generate payout CSV', error);
      throw new AppError(500, 'Failed to generate payout CSV', 'CSV_GENERATION_FAILED');
    }
  }

  /**
   * Create payout records from batch
   */
  async createPayoutBatch(batchId: string, payouts: any[]) {
    try {
      const createdPayouts = [];

      for (const payoutData of payouts) {
        // Create payout record
        const payout = await prisma.payout.create({
          data: {
            affiliateId: payoutData.affiliateId,
            batchId,
            amount: Math.round(payoutData.amount * 100), // Convert to cents
            currency: payoutData.currency,
            method: payoutData.payoutMethod || PayoutMethod.MANUAL,
            status: PayoutStatus.PENDING,
            recipientEmail: payoutData.payoutEmail,
          },
        });

        // Update commissions with payout ID
        await prisma.commission.updateMany({
          where: {
            id: { in: payoutData.commissionIds },
          },
          data: {
            payoutId: payout.id,
            status: CommissionStatus.PAID,
            paidAt: new Date(),
          },
        });

        createdPayouts.push(payout);
      }

      logger.info('Payout batch created', {
        batchId,
        count: createdPayouts.length,
      });

      return createdPayouts;
    } catch (error) {
      logger.error('Failed to create payout batch', { batchId, error });
      throw new AppError(500, 'Failed to create payout batch', 'BATCH_CREATION_FAILED');
    }
  }

  /**
   * Mark payout as completed
   */
  async markPayoutCompleted(payoutId: string, externalId?: string) {
    return await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.COMPLETED,
        completedAt: new Date(),
        externalId: externalId || null,
      },
    });
  }

  /**
   * Mark payout as failed
   */
  async markPayoutFailed(payoutId: string, reason: string) {
    return await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.FAILED,
        failedAt: new Date(),
        failureReason: reason,
        retryCount: { increment: 1 },
      },
    });
  }
}

export default new PayoutService();
