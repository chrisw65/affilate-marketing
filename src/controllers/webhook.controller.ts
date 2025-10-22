import { Request, Response, NextFunction } from 'express';
import webhookService from '../services/webhook.service';
import { WebhookSource } from '@prisma/client';
import { ApiResponse } from '../types';
import logger from '../utils/logger';

export class WebhookController {
  /**
   * Handle Stripe webhooks
   */
  async handleStripe(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const rawBody = (req as any).rawBody || req.body.toString();

      if (!signature) {
        logger.warn('Stripe webhook received without signature');
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_SIGNATURE', message: 'Webhook signature required' },
        });
      }

      // Verify signature
      const isValid = webhookService.verifyStripeSignature(rawBody, signature);
      if (!isValid) {
        logger.warn('Stripe webhook signature verification failed');
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
        });
      }

      const event = JSON.parse(rawBody);
      const idempotencyKey = `stripe_${event.id}`;

      // Check idempotency
      const alreadyProcessed = await webhookService.isEventProcessed(idempotencyKey);
      if (alreadyProcessed) {
        logger.info('Stripe webhook already processed', { eventId: event.id });
        return res.status(200).json({ success: true, message: 'Event already processed' });
      }

      // Store webhook event
      const webhookEvent = await webhookService.storeWebhookEvent(
        WebhookSource.STRIPE,
        event.type,
        event.id,
        idempotencyKey,
        event,
        req.headers,
        isValid
      );

      // Process webhook asynchronously
      webhookService
        .processStripeWebhook(event)
        .then(async () => {
          await webhookService.markEventProcessed(webhookEvent.id);
          logger.info('Stripe webhook processed successfully', { eventId: event.id });
        })
        .catch(async (error) => {
          await webhookService.markEventFailed(webhookEvent.id, error.message);
          logger.error('Failed to process Stripe webhook', {
            eventId: event.id,
            error: error.message,
          });
        });

      // Respond immediately to acknowledge receipt
      res.status(200).json({ success: true, received: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle ClickFunnels webhooks
   */
  async handleClickFunnels(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-clickfunnels-signature'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // Verify signature if configured
      if (signature) {
        const isValid = webhookService.verifyClickFunnelsSignature(rawBody, signature);
        if (!isValid) {
          logger.warn('ClickFunnels webhook signature verification failed');
          return res.status(401).json({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
          });
        }
      }

      const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const idempotencyKey = `cf_${event.id || Date.now()}`;

      // Check idempotency
      const alreadyProcessed = await webhookService.isEventProcessed(idempotencyKey);
      if (alreadyProcessed) {
        logger.info('ClickFunnels webhook already processed', { event: idempotencyKey });
        return res.status(200).json({ success: true, message: 'Event already processed' });
      }

      // Store webhook event
      const webhookEvent = await webhookService.storeWebhookEvent(
        WebhookSource.CLICKFUNNELS,
        event.event_type || 'unknown',
        event.id || idempotencyKey,
        idempotencyKey,
        event,
        req.headers,
        !!signature
      );

      // Process webhook asynchronously
      webhookService
        .processClickFunnelsWebhook(event)
        .then(async () => {
          await webhookService.markEventProcessed(webhookEvent.id);
          logger.info('ClickFunnels webhook processed successfully');
        })
        .catch(async (error) => {
          await webhookService.markEventFailed(webhookEvent.id, error.message);
          logger.error('Failed to process ClickFunnels webhook', { error: error.message });
        });

      res.status(200).json({ success: true, received: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Groove webhooks
   */
  async handleGroove(req: Request, res: Response, next: NextFunction) {
    try {
      // Similar to ClickFunnels, implement Groove webhook handling
      const event = req.body;
      const idempotencyKey = `groove_${event.id || Date.now()}`;

      // Check idempotency
      const alreadyProcessed = await webhookService.isEventProcessed(idempotencyKey);
      if (alreadyProcessed) {
        return res.status(200).json({ success: true, message: 'Event already processed' });
      }

      // Store webhook event
      await webhookService.storeWebhookEvent(
        WebhookSource.GROOVE,
        event.event_type || 'unknown',
        event.id || idempotencyKey,
        idempotencyKey,
        event,
        req.headers,
        true
      );

      res.status(200).json({ success: true, received: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test webhook endpoint (for development)
   */
  async test(req: Request, res: Response, next: NextFunction) {
    try {
      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Webhook endpoint is working',
          receivedPayload: req.body,
          headers: req.headers,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default new WebhookController();
