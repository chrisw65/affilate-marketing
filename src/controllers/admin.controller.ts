import { Request, Response, NextFunction } from 'express';
import adminService from '../services/admin.service';
import payoutService from '../services/payout.service';
import commissionService from '../services/commission.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import { AffiliateStatus, CommissionStatus, PayoutStatus } from '@prisma/client';

export class AdminController {
  /**
   * Get platform statistics
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const days = Math.min(parseInt(req.query.days as string) || 30, 365);
      const stats = await adminService.getPlatformStats(days);

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
   * Get all affiliates
   */
  async getAffiliates(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as AffiliateStatus;
      if (req.query.search) filters.search = req.query.search as string;

      const result = await adminService.getAffiliates(page, limit, filters);

      const response: ApiResponse = {
        success: true,
        data: result.affiliates,
        meta: result.pagination,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update affiliate status
   */
  async updateAffiliateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!Object.values(AffiliateStatus).includes(status)) {
        throw new AppError(400, 'Invalid status', 'INVALID_STATUS');
      }

      const affiliate = await adminService.updateAffiliateStatus(id, status, reason);

      const response: ApiResponse = {
        success: true,
        data: affiliate,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all commissions
   */
  async getCommissions(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as CommissionStatus;
      if (req.query.affiliate_id) filters.affiliateId = req.query.affiliate_id as string;
      if (req.query.start_date) filters.startDate = new Date(req.query.start_date as string);
      if (req.query.end_date) filters.endDate = new Date(req.query.end_date as string);

      const result = await adminService.getCommissions(page, limit, filters);

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
   * Approve commission
   */
  async approveCommission(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminId = 'admin'; // In production, get from authenticated admin user

      const commission = await adminService.approveCommission(id, adminId);

      const response: ApiResponse = {
        success: true,
        data: commission,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject commission
   */
  async rejectCommission(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = 'admin';

      if (!reason) {
        throw new AppError(400, 'Reason is required', 'REASON_REQUIRED');
      }

      const commission = await adminService.rejectCommission(id, adminId, reason);

      const response: ApiResponse = {
        success: true,
        data: commission,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve eligible commissions (batch)
   */
  async approveEligibleCommissions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await commissionService.approveEligibleCommissions();

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate payout CSV
   */
  async generatePayoutCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: any = {};
      if (req.query.affiliate_id) filters.affiliateId = req.query.affiliate_id as string;
      if (req.query.min_amount) filters.minAmount = parseInt(req.query.min_amount as string);

      const result = await payoutService.generatePayoutCSV(filters);

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=payouts_${result.batchId}.csv`);

      res.send(result.csv);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payout summary (before generating CSV)
   */
  async getPayoutSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: any = {};
      if (req.query.affiliate_id) filters.affiliateId = req.query.affiliate_id as string;
      if (req.query.min_amount) filters.minAmount = parseInt(req.query.min_amount as string);

      const result = await payoutService.generatePayoutCSV(filters);

      const response: ApiResponse = {
        success: true,
        data: result.summary,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create payout batch
   */
  async createPayoutBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, payouts } = req.body;

      if (!batchId || !payouts || !Array.isArray(payouts)) {
        throw new AppError(400, 'Invalid payout batch data', 'INVALID_BATCH_DATA');
      }

      const createdPayouts = await payoutService.createPayoutBatch(batchId, payouts);

      const response: ApiResponse = {
        success: true,
        data: {
          count: createdPayouts.length,
          payouts: createdPayouts,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all payouts
   */
  async getPayouts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as PayoutStatus;
      if (req.query.affiliate_id) filters.affiliateId = req.query.affiliate_id as string;

      const result = await adminService.getPayouts(page, limit, filters);

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
   * Update payout status
   */
  async updatePayoutStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, externalId, failureReason } = req.body;

      let payout;

      if (status === PayoutStatus.COMPLETED) {
        payout = await payoutService.markPayoutCompleted(id, externalId);
      } else if (status === PayoutStatus.FAILED) {
        if (!failureReason) {
          throw new AppError(400, 'Failure reason required', 'REASON_REQUIRED');
        }
        payout = await payoutService.markPayoutFailed(id, failureReason);
      } else {
        throw new AppError(400, 'Invalid status', 'INVALID_STATUS');
      }

      const response: ApiResponse = {
        success: true,
        data: payout,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
