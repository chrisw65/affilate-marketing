import crypto from 'crypto';
import prisma from '../config/database';
import config from '../config/env';
import { WebhookSource, OrderStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import commissionService from './commission.service';

interface WebhookPayload {
  id: string;
  type: string;
  data: any;
  created?: number;
}

export class WebhookService {
  /**
   * Verify Stripe webhook signature
   */
  verifyStripeSignature(payload: string, signature: string): boolean {
    if (!config.webhooks.stripe) {
      logger.warn('Stripe webhook secret not configured, skipping verification');
      return true; // Skip verification in development if not configured
    }

    try {
      const elements = signature.split(',');
      const timestamp = elements
        .find((el) => el.startsWith('t='))
        ?.split('=')[1];
      const sig = elements
        .find((el) => el.startsWith('v1='))
        ?.split('=')[1];

      if (!timestamp || !sig) return false;

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSig = crypto
        .createHmac('sha256', config.webhooks.stripe!)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    } catch (error) {
      logger.error('Stripe signature verification failed', error);
      return false;
    }
  }

  /**
   * Verify ClickFunnels webhook signature
   */
  verifyClickFunnelsSignature(payload: string, signature: string): boolean {
    if (!config.webhooks.clickfunnels) {
      logger.warn('ClickFunnels webhook secret not configured, skipping verification');
      return true;
    }

    try {
      const expectedSig = crypto
        .createHmac('sha256', config.webhooks.clickfunnels!)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    } catch (error) {
      logger.error('ClickFunnels signature verification failed', error);
      return false;
    }
  }

  /**
   * Check if webhook event has already been processed (idempotency)
   */
  async isEventProcessed(idempotencyKey: string): Promise<boolean> {
    const existing = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey },
    });
    return !!existing;
  }

  /**
   * Store webhook event for audit and idempotency
   */
  async storeWebhookEvent(
    source: WebhookSource,
    eventType: string,
    externalId: string,
    idempotencyKey: string,
    payload: any,
    headers: any,
    signatureValid: boolean
  ) {
    return await prisma.webhookEvent.create({
      data: {
        source,
        eventType,
        externalId,
        idempotencyKey,
        payload,
        headers,
        signatureValid,
        occurredAt: new Date(payload.created * 1000 || Date.now()),
      },
    });
  }

  /**
   * Process Stripe webhook
   */
  async processStripeWebhook(event: WebhookPayload) {
    logger.info('Processing Stripe webhook', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleStripeCheckoutCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await this.handleStripePaymentSucceeded(event.data.object);
        break;

      case 'charge.refunded':
        await this.handleStripeRefund(event.data.object);
        break;

      case 'invoice.paid':
        await this.handleStripeInvoicePaid(event.data.object);
        break;

      case 'charge.dispute.created':
        await this.handleStripeDisputeCreated(event.data.object);
        break;

      default:
        logger.info('Unhandled Stripe webhook type', { type: event.type });
    }
  }

  /**
   * Handle Stripe checkout session completed
   */
  private async handleStripeCheckoutCompleted(session: any) {
    try {
      const {
        id,
        customer,
        customer_email,
        amount_total,
        currency,
        metadata,
        payment_intent,
      } = session;

      // Extract affiliate attribution from metadata
      const clickId = metadata?.click_id;
      const affiliateId = metadata?.affiliate_id;

      // Create order
      const order = await prisma.order.create({
        data: {
          externalId: id,
          customerEmail: customer_email || '',
          customerId: customer,
          totalAmount: amount_total,
          currency: currency.toUpperCase(),
          status: OrderStatus.COMPLETED,
          source: WebhookSource.STRIPE,
          sourceMetadata: session,
          clickId: clickId || null,
          affiliateId: affiliateId || null,
          items: [],
          orderDate: new Date(),
        },
      });

      logger.info('Stripe checkout order created', { orderId: order.id, externalId: id });

      // Trigger commission calculation
      if (order.affiliateId) {
        await commissionService.calculateCommissionForOrder(order.id);
      }
    } catch (error) {
      logger.error('Failed to process Stripe checkout', error);
      throw error;
    }
  }

  /**
   * Handle Stripe payment succeeded
   */
  private async handleStripePaymentSucceeded(paymentIntent: any) {
    logger.info('Stripe payment succeeded', { id: paymentIntent.id });
    // Implementation for payment_intent.succeeded
  }

  /**
   * Handle Stripe refund
   */
  private async handleStripeRefund(charge: any) {
    try {
      const { id, amount_refunded, refunded } = charge;

      // Find order by charge ID
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { externalId: id },
            { sourceMetadata: { path: ['payment_intent'], equals: charge.payment_intent } },
          ],
        },
      });

      if (!order) {
        logger.warn('Order not found for refunded charge', { chargeId: id });
        return;
      }

      // Update order status
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: refunded ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED,
          refundedAmount: amount_refunded,
          refundedAt: new Date(),
        },
      });

      // Reverse commissions
      await commissionService.reverseCommissionsForOrder(order.id, amount_refunded);

      logger.info('Stripe refund processed', { orderId: order.id, amount: amount_refunded });
    } catch (error) {
      logger.error('Failed to process Stripe refund', error);
      throw error;
    }
  }

  /**
   * Handle Stripe invoice paid (for subscriptions)
   */
  private async handleStripeInvoicePaid(invoice: any) {
    logger.info('Stripe invoice paid', { id: invoice.id });
    // Implementation for recurring subscription payments
  }

  /**
   * Handle Stripe dispute created
   */
  private async handleStripeDisputeCreated(dispute: any) {
    logger.info('Stripe dispute created', { id: dispute.id });
    // Put related commissions on hold
  }

  /**
   * Process ClickFunnels webhook
   */
  async processClickFunnelsWebhook(event: any) {
    logger.info('Processing ClickFunnels webhook', { type: event.event_type });

    switch (event.event_type) {
      case 'order.created':
        await this.handleClickFunnelsOrder(event.order);
        break;

      case 'order.refunded':
        await this.handleClickFunnelsRefund(event.order);
        break;

      default:
        logger.info('Unhandled ClickFunnels webhook type', { type: event.event_type });
    }
  }

  /**
   * Handle ClickFunnels order created
   */
  private async handleClickFunnelsOrder(cfOrder: any) {
    try {
      const { id, contact, total, products, page, funnel } = cfOrder;

      // Try to find click via funnel/page metadata or contact email
      const click = await prisma.click.findFirst({
        where: {
          OR: [
            { landingPage: { contains: page?.id || '' } },
            { utmCampaign: funnel?.name },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      // Create order
      const order = await prisma.order.create({
        data: {
          externalId: `cf_${id}`,
          customerEmail: contact?.email || '',
          customerId: contact?.id || null,
          totalAmount: Math.round(parseFloat(total) * 100), // Convert to cents
          currency: 'USD',
          status: OrderStatus.COMPLETED,
          source: WebhookSource.CLICKFUNNELS,
          sourceMetadata: cfOrder,
          clickId: click?.id || null,
          affiliateId: click?.affiliateId || null,
          items: products || [],
          orderDate: new Date(),
        },
      });

      logger.info('ClickFunnels order created', { orderId: order.id, externalId: `cf_${id}` });

      // Trigger commission calculation
      if (order.affiliateId) {
        await commissionService.calculateCommissionForOrder(order.id);
      }
    } catch (error) {
      logger.error('Failed to process ClickFunnels order', error);
      throw error;
    }
  }

  /**
   * Handle ClickFunnels refund
   */
  private async handleClickFunnelsRefund(cfOrder: any) {
    try {
      const order = await prisma.order.findUnique({
        where: { externalId: `cf_${cfOrder.id}` },
      });

      if (!order) {
        logger.warn('Order not found for ClickFunnels refund', { orderId: cfOrder.id });
        return;
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REFUNDED,
          refundedAmount: order.totalAmount,
          refundedAt: new Date(),
        },
      });

      await commissionService.reverseCommissionsForOrder(order.id, order.totalAmount);

      logger.info('ClickFunnels refund processed', { orderId: order.id });
    } catch (error) {
      logger.error('Failed to process ClickFunnels refund', error);
      throw error;
    }
  }

  /**
   * Mark webhook event as processed
   */
  async markEventProcessed(eventId: string, orderId?: string) {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        processed: true,
        processedAt: new Date(),
        orderId: orderId || null,
      },
    });
  }

  /**
   * Mark webhook event as failed
   */
  async markEventFailed(eventId: string, error: string) {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        processingError: error,
        retryCount: { increment: 1 },
      },
    });
  }
}

export default new WebhookService();
