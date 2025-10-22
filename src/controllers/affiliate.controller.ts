import { Response, NextFunction } from 'express';
import affiliateService from '../services/affiliate.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';

export class AffiliateController {
  /**
   * Get dashboard statistics
   */
  async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      const days = Math.min(parseInt(req.query.days as string) || 30, 365);
      const stats = await affiliateService.getDashboardStats(req.user.affiliateId, days);

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
   * Get tracking links
   */
  async getTrackingLinks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      const links = await affiliateService.getTrackingLinks(req.user.affiliateId);

      const response: ApiResponse = {
        success: true,
        data: links,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create tracking link
   */
  async createTrackingLink(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      const link = await affiliateService.createTrackingLink(req.user.affiliateId, req.body);

      const response: ApiResponse = {
        success: true,
        data: link,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get commissions
   */
  async getCommissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.start_date) filters.startDate = new Date(req.query.start_date as string);
      if (req.query.end_date) filters.endDate = new Date(req.query.end_date as string);

      const result = await affiliateService.getCommissions(
        req.user.affiliateId,
        page,
        limit,
        filters
      );

      const response: ApiResponse = {
        success: true,
        data: result.commissions,
        meta: result.pagination,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payouts
   */
  async getPayouts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const result = await affiliateService.getPayouts(req.user.affiliateId, page, limit);

      const response: ApiResponse = {
        success: true,
        data: result.payouts,
        meta: result.pagination,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      const updated = await affiliateService.updateProfile(req.user.affiliateId, req.body);

      const response: ApiResponse = {
        success: true,
        data: updated,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new AffiliateController();
