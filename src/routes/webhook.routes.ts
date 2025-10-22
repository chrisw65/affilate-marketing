import { Router } from 'express';
import webhookController from '../controllers/webhook.controller';

const router = Router();

// Stripe webhooks
router.post('/stripe', webhookController.handleStripe);

// ClickFunnels webhooks
router.post('/clickfunnels', webhookController.handleClickFunnels);

// Groove webhooks
router.post('/groove', webhookController.handleGroove);

// Test endpoint (for development)
router.post('/test', webhookController.test);
router.get('/test', webhookController.test);

export default router;
