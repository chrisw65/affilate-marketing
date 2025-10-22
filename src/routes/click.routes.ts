import { Router } from 'express';
import clickController from '../controllers/click.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public click tracking endpoints
router.get('/track', clickController.recordClick);
router.get('/pixel', clickController.trackPixel);
router.get('/token/:token', clickController.getClickByToken);

// Authenticated affiliate endpoints
router.get('/my/clicks', authenticateToken, clickController.getMyClicks);
router.get('/my/stats', authenticateToken, clickController.getMyClickStats);

export default router;
