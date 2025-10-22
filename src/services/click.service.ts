import prisma from '../config/database';
import config from '../config/env';
import attributionService from './attribution.service';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface RecordClickInput {
  affiliateId?: string;
  trackingLinkId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;
  referrer?: string;
  landingPage?: string;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
}

export class ClickService {
  /**
   * Record a click from an affiliate link
   */
  async recordClick(data: RecordClickInput) {
    try {
      // Generate unique click token
      const clickToken = attributionService.generateClickToken();

      // Parse device info from user agent
      const deviceInfo = this.parseUserAgent(data.userAgent || '');

      // Create click record
      const click = await prisma.click.create({
        data: {
          affiliateId: data.affiliateId!,
          trackingLinkId: data.trackingLinkId,
          clickToken,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
          utmTerm: data.utmTerm,
          utmContent: data.utmContent,
          sub1: data.sub1,
          sub2: data.sub2,
          sub3: data.sub3,
          sub4: data.sub4,
          sub5: data.sub5,
          referrer: data.referrer,
          landingPage: data.landingPage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          country: data.country,
        },
      });

      // Update tracking link stats
      if (data.trackingLinkId) {
        await prisma.trackingLink.update({
          where: { id: data.trackingLinkId },
          data: {
            totalClicks: { increment: 1 },
          },
        });
      }

      logger.info('Click recorded', {
        clickId: click.id,
        clickToken: click.clickToken,
        affiliateId: click.affiliateId,
      });

      return {
        clickId: click.id,
        clickToken: click.clickToken,
      };
    } catch (error) {
      logger.error('Failed to record click', { error });
      throw error;
    }
  }

  /**
   * Get click by token
   */
  async getClickByToken(clickToken: string) {
    const attributionWindow = new Date();
    attributionWindow.setDate(attributionWindow.getDate() - config.attribution.windowDays);

    return await prisma.click.findFirst({
      where: {
        clickToken,
        createdAt: { gte: attributionWindow },
      },
      include: {
        affiliate: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        trackingLink: true,
      },
    });
  }

  /**
   * Get clicks for affiliate with pagination
   */
  async getAffiliateClicks(
    affiliateId: string,
    page: number = 1,
    limit: number = 50,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      converted?: boolean;
    }
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      affiliateId,
    };

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    if (filters?.converted !== undefined) {
      where.converted = filters.converted;
    }

    const [clicks, total] = await Promise.all([
      prisma.click.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          trackingLink: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.click.count({ where }),
    ]);

    return {
      clicks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get click stats for affiliate
   */
  async getAffiliateClickStats(affiliateId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalClicks, conversions, uniqueIPs] = await Promise.all([
      prisma.click.count({
        where: {
          affiliateId,
          createdAt: { gte: startDate },
        },
      }),
      prisma.click.count({
        where: {
          affiliateId,
          createdAt: { gte: startDate },
          converted: true,
        },
      }),
      prisma.click.groupBy({
        by: ['ipAddress'],
        where: {
          affiliateId,
          createdAt: { gte: startDate },
          ipAddress: { not: null },
        },
      }),
    ]);

    const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

    return {
      totalClicks,
      uniqueClicks: uniqueIPs.length,
      conversions,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
    };
  }

  /**
   * Parse user agent to extract device info
   */
  private parseUserAgent(userAgent: string) {
    const ua = userAgent.toLowerCase();

    let deviceType = 'desktop';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      deviceType = 'tablet';
    } else if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      deviceType = 'mobile';
    }

    let browser = 'unknown';
    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

    let os = 'unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'MacOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    return { deviceType, browser, os };
  }
}

export default new ClickService();
