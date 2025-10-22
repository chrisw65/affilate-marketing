import { Router } from 'express';
import adminController from '../controllers/admin.controller';
import { validate } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Note: In production, add admin authentication middleware
// For now, these routes are open for development

// Platform stats
router.get('/stats', adminController.getStats);

// Affiliate management
router.get('/affiliates', adminController.getAffiliates);
router.patch(
  '/affiliates/:id/status',
  validate(
    z.object({
      body: z.object({
        status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED']),
        reason: z.string().optional(),
      }),
    })
  ),
  adminController.updateAffiliateStatus
);

// Commission management
router.get('/commissions', adminController.getCommissions);
router.post('/commissions/:id/approve', adminController.approveCommission);
router.post(
  '/commissions/:id/reject',
  validate(
    z.object({
      body: z.object({
        reason: z.string().min(1, 'Reason is required'),
      }),
    })
  ),
  adminController.rejectCommission
);
router.post('/commissions/approve-eligible', adminController.approveEligibleCommissions);

// Payout management
router.get('/payouts', adminController.getPayouts);
router.get('/payouts/summary', adminController.getPayoutSummary);
router.get('/payouts/csv', adminController.generatePayoutCSV);
router.post('/payouts/batch', adminController.createPayoutBatch);
router.patch('/payouts/:id/status', adminController.updatePayoutStatus);

export default router;
