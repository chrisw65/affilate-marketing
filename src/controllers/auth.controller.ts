import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { AuthenticatedRequest, ApiResponse } from '../types';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const profile = await authService.getProfile(req.user.affiliateId);

      const response: ApiResponse = {
        success: true,
        data: profile,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // In a production system, you'd invalidate the token here (add to blacklist, etc.)
      // For now, just return success - client should remove the token

      const response: ApiResponse = {
        success: true,
        data: { message: 'Logged out successfully' },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
