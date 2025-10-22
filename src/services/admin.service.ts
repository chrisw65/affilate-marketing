import prisma from '../config/database';
import { AffiliateStatus, CommissionStatus, PayoutStatus, PayoutMethod } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export class AdminService {
  /**
   * Get all affiliates with filters
   */
  async getAffiliates(
    page: number = 1,
    limit: number = 50,
    filters?: {
      status?: AffiliateStatus;
      search?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [affiliates, total] = await Promise.all([
      prisma.affiliate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          kycStatus: true,
          commissionRate: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              clicks: true,
              orders: true,
              commissions: true,
            },
          },
        },
      }),
      prisma.affiliate.count({ where }),
    ]);

    return {
      affiliates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update affiliate status
   */
  async updateAffiliateStatus(affiliateId: string, status: AffiliateStatus, reason?: string) {
    const affiliate = await prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        status,
        ...(status === AffiliateStatus.ACTIVE && { approvedAt: new Date() }),
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        userId: 'admin',
        action: 'update_status',
        resource: 'affiliate',
        resourceId: affiliateId,
        newValue: { status },
        reason,
      },
    });

    logger.info('Affiliate status updated', { affiliateId, status, reason });

    return affiliate;
  }

  /**
   * Get all commissions with filters
   */
  async getCommissions(
    page: number = 1,
    limit: number = 50,
    filters?: {
      status?: CommissionStatus;
      affiliateId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.affiliateId) where.affiliateId = filters.affiliateId;

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          affiliate: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              externalId: true,
              totalAmount: true,
              orderDate: true,
            },
          },
        },
      }),
      prisma.commission.count({ where }),
    ]);

    return {
      commissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approve commission manually
   */
  async approveCommission(commissionId: string, adminId: string) {
    const commission = await prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: CommissionStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'approve',
        resource: 'commission',
        resourceId: commissionId,
      },
    });

    logger.info('Commission approved', { commissionId, adminId });

    return commission;
  }

  /**
   * Reject/cancel commission
   */
  async rejectCommission(commissionId: string, adminId: string, reason: string) {
    const commission = await prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: CommissionStatus.CANCELLED,
        notes: reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'reject',
        resource: 'commission',
        resourceId: commissionId,
        reason,
      },
    });

    logger.info('Commission rejected', { commissionId, adminId, reason });

    return commission;
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [affiliateStats, orderStats, commissionStats, clickStats] = await Promise.all([
      prisma.affiliate.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          orderDate: { gte: startDate },
        },
        _count: true,
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.commission.aggregate({
        where: {
          createdAt: { gte: startDate },
        },
        _count: true,
        _sum: {
          commissionAmount: true,
        },
      }),
      prisma.click.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),
    ]);

    return {
      affiliates: affiliateStats.reduce((acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {} as Record<string, number>),
      orders: {
        total: orderStats._count,
        revenue: orderStats._sum.totalAmount || 0,
      },
      commissions: {
        total: commissionStats._count,
        amount: commissionStats._sum.commissionAmount || 0,
      },
      clicks: {
        total: clickStats,
      },
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
    };
  }

  /**
   * Get payouts with filters
   */
  async getPayouts(
    page: number = 1,
    limit: number = 50,
    filters?: {
      status?: PayoutStatus;
      affiliateId?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.affiliateId) where.affiliateId = filters.affiliateId;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          affiliate: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.payout.count({ where }),
    ]);

    return {
      payouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new AdminService();
