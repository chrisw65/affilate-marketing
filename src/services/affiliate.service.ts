import prisma from '../config/database';
import commissionService from './commission.service';
import clickService from './click.service';
import logger from '../utils/logger';

export class AffiliateService {
  /**
   * Get affiliate dashboard stats
   */
  async getDashboardStats(affiliateId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [clickStats, commissionSummary, orders, recentActivity] = await Promise.all([
      clickService.getAffiliateClickStats(affiliateId, days),
      commissionService.getAffiliateSummary(affiliateId),
      this.getOrderStats(affiliateId, startDate),
      this.getRecentActivity(affiliateId, 10),
    ]);

    // Calculate EPC (Earnings Per Click)
    const totalEarnings = commissionSummary.total.amount;
    const epc = clickStats.totalClicks > 0 ? totalEarnings / clickStats.totalClicks : 0;

    return {
      clicks: clickStats,
      commissions: commissionSummary,
      orders: orders,
      epc: Math.round(epc) / 100, // Convert cents to dollars
      recentActivity,
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
    };
  }

  /**
   * Get order stats for affiliate
   */
  private async getOrderStats(affiliateId: string, startDate: Date) {
    const [totalOrders, totalRevenue, refundedOrders] = await Promise.all([
      prisma.order.count({
        where: {
          affiliateId,
          orderDate: { gte: startDate },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.order.aggregate({
        where: {
          affiliateId,
          orderDate: { gte: startDate },
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.order.count({
        where: {
          affiliateId,
          orderDate: { gte: startDate },
          status: 'REFUNDED',
        },
      }),
    ]);

    return {
      total: totalOrders,
      revenue: totalRevenue._sum.totalAmount || 0,
      refunded: refundedOrders,
    };
  }

  /**
   * Get recent activity for affiliate
   */
  private async getRecentActivity(affiliateId: string, limit: number = 10) {
    const [recentClicks, recentOrders, recentCommissions] = await Promise.all([
      prisma.click.findMany({
        where: { affiliateId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          converted: true,
          country: true,
          deviceType: true,
        },
      }),
      prisma.order.findMany({
        where: { affiliateId },
        take: 5,
        orderBy: { orderDate: 'desc' },
        select: {
          id: true,
          orderDate: true,
          totalAmount: true,
          currency: true,
          status: true,
        },
      }),
      prisma.commission.findMany({
        where: { affiliateId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          commissionAmount: true,
          currency: true,
          status: true,
        },
      }),
    ]);

    return {
      recentClicks,
      recentOrders,
      recentCommissions,
    };
  }

  /**
   * Get tracking links for affiliate
   */
  async getTrackingLinks(affiliateId: string) {
    return await prisma.trackingLink.findMany({
      where: { affiliateId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create tracking link for affiliate
   */
  async createTrackingLink(
    affiliateId: string,
    data: {
      name: string;
      destinationUrl: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      couponCode?: string;
    }
  ) {
    return await prisma.trackingLink.create({
      data: {
        affiliateId,
        name: data.name,
        destinationUrl: data.destinationUrl,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        couponCode: data.couponCode,
        isActive: true,
      },
    });
  }

  /**
   * Get commissions for affiliate
   */
  async getCommissions(
    affiliateId: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = { affiliateId };

    if (filters?.status) {
      where.status = filters.status;
    }

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
          order: {
            select: {
              externalId: true,
              totalAmount: true,
              currency: true,
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
   * Get payouts for affiliate
   */
  async getPayouts(affiliateId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: { affiliateId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          commissions: {
            select: {
              id: true,
              commissionAmount: true,
            },
          },
        },
      }),
      prisma.payout.count({ where: { affiliateId } }),
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

  /**
   * Update affiliate profile
   */
  async updateProfile(affiliateId: string, data: any) {
    const allowed = [
      'firstName',
      'lastName',
      'company',
      'phone',
      'country',
      'payoutEmail',
      'payoutCurrency',
      'minPayoutThreshold',
    ];

    const updateData: any = {};
    allowed.forEach((field) => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    return await prisma.affiliate.update({
      where: { id: affiliateId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        phone: true,
        country: true,
        payoutEmail: true,
        payoutCurrency: true,
        minPayoutThreshold: true,
        updatedAt: true,
      },
    });
  }
}

export default new AffiliateService();
