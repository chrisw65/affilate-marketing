import { Request, Response, NextFunction } from 'express';
import clickService from '../services/click.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import config from '../config/env';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export class ClickController {
  /**
   * Record a click (public endpoint)
   */
  async recordClick(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        aid, // affiliate_id
        tid, // tracking_link_id
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        sub1,
        sub2,
        sub3,
        sub4,
        sub5,
        ref, // referrer
        lp, // landing_page
      } = req.query;

      if (!aid) {
        throw new AppError(400, 'Affiliate ID is required', 'MISSING_AFFILIATE_ID');
      }

      // Record click
      const result = await clickService.recordClick({
        affiliateId: aid as string,
        trackingLinkId: tid as string,
        utmSource: utm_source as string,
        utmMedium: utm_medium as string,
        utmCampaign: utm_campaign as string,
        utmTerm: utm_term as string,
        utmContent: utm_content as string,
        sub1: sub1 as string,
        sub2: sub2 as string,
        sub3: sub3 as string,
        sub4: sub4 as string,
        sub5: sub5 as string,
        referrer: (ref as string) || req.get('referer'),
        landingPage: lp as string,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Set click cookie
      res.cookie(config.attribution.cookieName, result.clickToken, {
        maxAge: config.attribution.cookieMaxAge,
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
      });

      const response: ApiResponse = {
        success: true,
        data: {
          clickId: result.clickId,
          tracked: true,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get click details by token
   */
  async getClickByToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;

      const click = await clickService.getClickByToken(token);

      if (!click) {
        throw new AppError(404, 'Click not found or expired', 'CLICK_NOT_FOUND');
      }

      const response: ApiResponse = {
        success: true,
        data: click,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get clicks for authenticated affiliate
   */
  async getMyClicks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const filters: any = {};

      if (req.query.start_date) {
        filters.startDate = new Date(req.query.start_date as string);
      }
      if (req.query.end_date) {
        filters.endDate = new Date(req.query.end_date as string);
      }
      if (req.query.converted !== undefined) {
        filters.converted = req.query.converted === 'true';
      }

      const result = await clickService.getAffiliateClicks(
        req.user.affiliateId,
        page,
        limit,
        filters
      );

      const response: ApiResponse = {
        success: true,
        data: result.clicks,
        meta: result.pagination,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get click stats for authenticated affiliate
   */
  async getMyClickStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      const days = Math.min(parseInt(req.query.days as string) || 30, 365);

      const stats = await clickService.getAffiliateClickStats(req.user.affiliateId, days);

      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Tracking pixel/redirect endpoint (for embedding in emails, ads, etc.)
   */
  async trackPixel(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        aid, // affiliate_id
        tid, // tracking_link_id
        redirect, // redirect URL after tracking
      } = req.query;

      if (!aid) {
        return res.status(400).send('Missing affiliate ID');
      }

      // Record click in background
      clickService
        .recordClick({
          affiliateId: aid as string,
          trackingLinkId: tid as string,
          referrer: req.get('referer'),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        })
        .then((result) => {
          logger.info('Pixel click tracked', { clickId: result.clickId });
        })
        .catch((error) => {
          logger.error('Failed to track pixel click', { error });
        });

      // If redirect URL provided, redirect user
      if (redirect) {
        return res.redirect(redirect as string);
      }

      // Otherwise return 1x1 transparent pixel
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(pixel);
    } catch (error) {
      next(error);
    }
  }
}

export default new ClickController();
