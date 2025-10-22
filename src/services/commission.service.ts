import prisma from '../config/database';
import config from '../config/env';
import { CommissionStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export class CommissionService {
  /**
   * Calculate commission for an order
   */
  async calculateCommissionForOrder(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          affiliate: true,
          click: true,
        },
      });

      if (!order) {
        throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND');
      }

      if (!order.affiliateId) {
        logger.warn('Order has no affiliate attribution', { orderId });
        return null;
      }

      if (!order.affiliate) {
        logger.warn('Affiliate not found for order', { orderId, affiliateId: order.affiliateId });
        return null;
      }

      // Check if commission already exists
      const existingCommission = await prisma.commission.findFirst({
        where: { orderId: order.id },
      });

      if (existingCommission) {
        logger.info('Commission already exists for order', { orderId, commissionId: existingCommission.id });
        return existingCommission;
      }

      // Calculate commission amount
      const commissionRate = order.affiliate.commissionRate || config.commission.defaultRate;
      const commissionAmount = Math.round(order.totalAmount * commissionRate);

      // Calculate hold until date
      const holdDays = config.commission.holdDays;
      const holdUntil = new Date();
      holdUntil.setDate(holdUntil.getDate() + holdDays);

      // Create commission record
      const commission = await prisma.commission.create({
        data: {
          affiliateId: order.affiliateId,
          orderId: order.id,
          commissionAmount,
          currency: order.currency,
          commissionRate,
          orderTotal: order.totalAmount,
          status: CommissionStatus.PENDING,
          holdUntil,
          calculationSnapshot: {
            orderTotal: order.totalAmount,
            commissionRate,
            orderDate: order.orderDate,
            orderItems: order.items,
            calculatedAt: new Date(),
          },
        },
      });

      logger.info('Commission calculated', {
        commissionId: commission.id,
        orderId: order.id,
        affiliateId: order.affiliateId,
        amount: commissionAmount,
        currency: order.currency,
      });

      return commission;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to calculate commission', { orderId, error });
      throw new AppError(500, 'Failed to calculate commission', 'COMMISSION_CALCULATION_FAILED');
    }
  }

  /**
   * Reverse commissions for refunded order
   */
  async reverseCommissionsForOrder(orderId: string, refundAmount: number) {
    try {
      const commissions = await prisma.commission.findMany({
        where: {
          orderId,
          status: { in: [CommissionStatus.PENDING, CommissionStatus.APPROVED, CommissionStatus.PAID] },
        },
      });

      for (const commission of commissions) {
        // Calculate reversal amount
        const reversalAmount = Math.round(commission.commissionAmount * (refundAmount / commission.orderTotal));

        // Create reversal commission (negative amount)
        await prisma.commission.create({
          data: {
            affiliateId: commission.affiliateId,
            orderId: commission.orderId,
            commissionAmount: -reversalAmount,
            currency: commission.currency,
            commissionRate: commission.commissionRate,
            orderTotal: commission.orderTotal,
            status: CommissionStatus.APPROVED,
            originalCommissionId: commission.id,
            calculationSnapshot: {
              originalCommission: commission.id,
              refundAmount,
              reversalAmount,
              reversedAt: new Date(),
            },
          },
        });

        // Mark original commission as reversed if fully refunded
        if (refundAmount >= commission.orderTotal) {
          await prisma.commission.update({
            where: { id: commission.id },
            data: {
              status: CommissionStatus.REVERSED,
              reversedAt: new Date(),
              reversalReason: 'Order refunded',
            },
          });
        }

        logger.info('Commission reversed', {
          originalCommissionId: commission.id,
          reversalAmount,
          refundAmount,
        });
      }
    } catch (error) {
      logger.error('Failed to reverse commissions', { orderId, error });
      throw error;
    }
  }

  /**
   * Approve commissions that have passed the hold period
   */
  async approveEligibleCommissions() {
    try {
      const eligibleCommissions = await prisma.commission.findMany({
        where: {
          status: CommissionStatus.PENDING,
          holdUntil: { lte: new Date() },
        },
      });

      let approvedCount = 0;

      for (const commission of eligibleCommissions) {
        await prisma.commission.update({
          where: { id: commission.id },
          data: {
            status: CommissionStatus.APPROVED,
            approvedAt: new Date(),
          },
        });
        approvedCount++;
      }

      logger.info('Approved eligible commissions', { count: approvedCount });
      return { approved: approvedCount };
    } catch (error) {
      logger.error('Failed to approve commissions', error);
      throw error;
    }
  }

  /**
   * Get commission summary for affiliate
   */
  async getAffiliateSummary(affiliateId: string) {
    const [pending, approved, paid, total] = await Promise.all([
      prisma.commission.aggregate({
        where: { affiliateId, status: CommissionStatus.PENDING },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      prisma.commission.aggregate({
        where: { affiliateId, status: CommissionStatus.APPROVED },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      prisma.commission.aggregate({
        where: { affiliateId, status: CommissionStatus.PAID },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      prisma.commission.aggregate({
        where: { affiliateId },
        _sum: { commissionAmount: true },
        _count: true,
      }),
    ]);

    return {
      pending: {
        amount: pending._sum.commissionAmount || 0,
        count: pending._count,
      },
      approved: {
        amount: approved._sum.commissionAmount || 0,
        count: approved._count,
      },
      paid: {
        amount: paid._sum.commissionAmount || 0,
        count: paid._count,
      },
      total: {
        amount: total._sum.commissionAmount || 0,
        count: total._count,
      },
    };
  }
}

export default new CommissionService();
