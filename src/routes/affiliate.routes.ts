import { Router } from 'express';
import affiliateController from '../controllers/affiliate.controller';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// All affiliate routes require authentication
router.use(authenticateToken);

// Dashboard
router.get('/dashboard', affiliateController.getDashboard);

// Tracking links
router.get('/tracking-links', affiliateController.getTrackingLinks);
router.post(
  '/tracking-links',
  validate(
    z.object({
      body: z.object({
        name: z.string().min(1, 'Name is required'),
        destinationUrl: z.string().url('Valid URL is required'),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        couponCode: z.string().optional(),
      }),
    })
  ),
  affiliateController.createTrackingLink
);

// Commissions
router.get('/commissions', affiliateController.getCommissions);

// Payouts
router.get('/payouts', affiliateController.getPayouts);

// Profile
router.put('/profile', affiliateController.updateProfile);

export default router;
