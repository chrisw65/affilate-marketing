import prisma from '../config/database';
import config from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class AttributionService {
  /**
   * Find affiliate by click token (last-click attribution)
   */
  async findAffiliateByClickToken(clickToken: string) {
    if (!clickToken) return null;

    try {
      const attributionWindow = new Date();
      attributionWindow.setDate(attributionWindow.getDate() - config.attribution.windowDays);

      const click = await prisma.click.findFirst({
        where: {
          clickToken,
          createdAt: { gte: attributionWindow },
        },
        include: {
          affiliate: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!click) {
        logger.debug('No valid click found for token', { clickToken });
        return null;
      }

      if (click.affiliate.status !== 'ACTIVE') {
        logger.warn('Click found but affiliate is not active', {
          clickToken,
          affiliateId: click.affiliateId,
          status: click.affiliate.status,
        });
        return null;
      }

      return {
        affiliateId: click.affiliateId,
        clickId: click.id,
      };
    } catch (error) {
      logger.error('Error finding affiliate by click token', { clickToken, error });
      return null;
    }
  }

  /**
   * Find affiliate by coupon code
   */
  async findAffiliateByCoupon(couponCode: string) {
    if (!couponCode) return null;

    try {
      const trackingLink = await prisma.trackingLink.findUnique({
        where: { couponCode },
        include: { affiliate: true },
      });

      if (!trackingLink || !trackingLink.isActive) {
        return null;
      }

      if (trackingLink.affiliate.status !== 'ACTIVE') {
        return null;
      }

      return {
        affiliateId: trackingLink.affiliateId,
        trackingLinkId: trackingLink.id,
      };
    } catch (error) {
      logger.error('Error finding affiliate by coupon', { couponCode, error });
      return null;
    }
  }

  /**
   * Attribute order to affiliate (last-click + coupon fallback)
   */
  async attributeOrder(orderId: string, clickToken?: string, couponCode?: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        logger.error('Order not found for attribution', { orderId });
        return null;
      }

      // Already attributed
      if (order.affiliateId) {
        logger.debug('Order already attributed', { orderId, affiliateId: order.affiliateId });
        return { affiliateId: order.affiliateId, clickId: order.clickId };
      }

      // Try click token attribution first (last-click)
      if (clickToken) {
        const clickAttribution = await this.findAffiliateByClickToken(clickToken);
        if (clickAttribution) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              affiliateId: clickAttribution.affiliateId,
              clickId: clickAttribution.clickId,
            },
          });

          // Mark click as converted
          await prisma.click.update({
            where: { id: clickAttribution.clickId },
            data: {
              converted: true,
              convertedAt: new Date(),
            },
          });

          logger.info('Order attributed via click token', {
            orderId,
            affiliateId: clickAttribution.affiliateId,
            clickId: clickAttribution.clickId,
          });

          return clickAttribution;
        }
      }

      // Fallback to coupon code attribution
      if (couponCode) {
        const couponAttribution = await this.findAffiliateByCoupon(couponCode);
        if (couponAttribution) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              affiliateId: couponAttribution.affiliateId,
            },
          });

          logger.info('Order attributed via coupon code', {
            orderId,
            affiliateId: couponAttribution.affiliateId,
            couponCode,
          });

          return { affiliateId: couponAttribution.affiliateId };
        }
      }

      logger.debug('No attribution found for order', { orderId, clickToken, couponCode });
      return null;
    } catch (error) {
      logger.error('Error attributing order', { orderId, error });
      return null;
    }
  }

  /**
   * Generate unique click token
   */
  generateClickToken(): string {
    return uuidv4();
  }
}

export default new AttributionService();
