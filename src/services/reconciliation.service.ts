import prisma from '../config/database';
import { OrderStatus, WebhookSource } from '@prisma/client';
import logger from '../utils/logger';

interface ReconciliationMismatch {
  type: 'missing_order' | 'amount_mismatch' | 'status_mismatch' | 'missing_webhook';
  stripeChargeId?: string;
  orderId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  expectedStatus?: string;
  actualStatus?: string;
  details?: string;
}

interface ReconciliationResult {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalStripeCharges: number;
    totalInternalOrders: number;
    matchedOrders: number;
    mismatches: number;
  };
  mismatches: ReconciliationMismatch[];
  resolved: number;
}

export class ReconciliationService {
  /**
   * Reconcile Stripe charges with internal orders
   */
  async reconcileStripeOrders(
    startDate: Date,
    endDate: Date,
    autoResolve: boolean = false
  ): Promise<ReconciliationResult> {
    logger.info('Starting Stripe order reconciliation', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoResolve,
    });

    const mismatches: ReconciliationMismatch[] = [];
    let resolved = 0;

    // Get all internal orders from Stripe source in the period
    const internalOrders = await prisma.order.findMany({
      where: {
        source: WebhookSource.STRIPE,
        orderDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        commissions: true,
      },
    });

    // Get all webhook events from Stripe for the period
    const stripeWebhooks = await prisma.webhookEvent.findMany({
      where: {
        source: WebhookSource.STRIPE,
        eventType: {
          in: ['checkout.session.completed', 'payment_intent.succeeded'],
        },
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
        processed: true,
      },
    });

    logger.info('Reconciliation data loaded', {
      internalOrders: internalOrders.length,
      stripeWebhooks: stripeWebhooks.length,
    });

    // Check for webhooks without matching orders
    for (const webhook of stripeWebhooks) {
      const externalId = webhook.externalId;
      const matchingOrder = internalOrders.find((o) => o.externalId === externalId);

      if (!matchingOrder) {
        const webhookAmount = this.extractAmountFromWebhook(webhook.payload);

        mismatches.push({
          type: 'missing_order',
          stripeChargeId: externalId,
          expectedAmount: webhookAmount,
          details: `Webhook received but no order created for charge ${externalId}`,
        });

        // Auto-resolve: Create missing order
        if (autoResolve) {
          try {
            await this.createOrderFromWebhook(webhook);
            resolved++;
            logger.info('Auto-resolved missing order', { externalId });
          } catch (error) {
            logger.error('Failed to auto-resolve missing order', { externalId, error });
          }
        }
      }
    }

    // Check for orders without matching webhooks
    for (const order of internalOrders) {
      const matchingWebhook = stripeWebhooks.find((w) => w.externalId === order.externalId);

      if (!matchingWebhook) {
        mismatches.push({
          type: 'missing_webhook',
          orderId: order.id,
          stripeChargeId: order.externalId,
          actualAmount: order.totalAmount,
          details: `Order exists but no webhook found for charge ${order.externalId}`,
        });
      } else {
        // Verify amounts match
        const webhookAmount = this.extractAmountFromWebhook(matchingWebhook.payload);
        if (webhookAmount && webhookAmount !== order.totalAmount) {
          const tolerance = 100; // 1 dollar tolerance for rounding/fees
          if (Math.abs(webhookAmount - order.totalAmount) > tolerance) {
            mismatches.push({
              type: 'amount_mismatch',
              orderId: order.id,
              stripeChargeId: order.externalId,
              expectedAmount: webhookAmount,
              actualAmount: order.totalAmount,
              details: `Amount mismatch: Stripe=${webhookAmount}, Internal=${order.totalAmount}`,
            });
          }
        }
      }
    }

    const result: ReconciliationResult = {
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalStripeCharges: stripeWebhooks.length,
        totalInternalOrders: internalOrders.length,
        matchedOrders: internalOrders.length - mismatches.filter((m) => m.type === 'missing_webhook').length,
        mismatches: mismatches.length,
      },
      mismatches,
      resolved,
    };

    // Store reconciliation run
    await this.storeReconciliationRun(result);

    logger.info('Reconciliation completed', {
      mismatches: mismatches.length,
      resolved,
    });

    return result;
  }

  /**
   * Extract amount from Stripe webhook payload
   */
  private extractAmountFromWebhook(payload: any): number | null {
    try {
      if (payload.data?.object?.amount_total) {
        return payload.data.object.amount_total;
      }
      if (payload.data?.object?.amount) {
        return payload.data.object.amount;
      }
      return null;
    } catch (error) {
      logger.error('Failed to extract amount from webhook', { error });
      return null;
    }
  }

  /**
   * Create order from webhook (for auto-resolve)
   */
  private async createOrderFromWebhook(webhook: any) {
    const payload = webhook.payload;
    const session = payload.data?.object;

    if (!session) {
      throw new Error('Invalid webhook payload');
    }

    const order = await prisma.order.create({
      data: {
        externalId: webhook.externalId,
        customerEmail: session.customer_email || session.customer_details?.email || '',
        customerId: session.customer,
        totalAmount: session.amount_total || session.amount || 0,
        currency: (session.currency || 'USD').toUpperCase(),
        status: OrderStatus.COMPLETED,
        source: WebhookSource.STRIPE,
        sourceMetadata: session,
        items: [],
        orderDate: new Date(webhook.occurredAt),
      },
    });

    // Link to webhook
    await prisma.webhookEvent.update({
      where: { id: webhook.id },
      data: { orderId: order.id },
    });

    logger.info('Created order from webhook', {
      orderId: order.id,
      webhookId: webhook.id,
    });

    return order;
  }

  /**
   * Store reconciliation run results
   */
  private async storeReconciliationRun(result: ReconciliationResult) {
    // Store as system config or audit log
    await prisma.auditLog.create({
      data: {
        userId: 'system',
        userRole: 'system',
        action: 'reconciliation',
        resource: 'orders',
        newValue: {
          period: result.period,
          summary: result.summary,
          mismatchCount: result.mismatches.length,
          resolved: result.resolved,
        },
      },
    });
  }

  /**
   * Get reconciliation history
   */
  async getReconciliationHistory(limit: number = 10) {
    const runs = await prisma.auditLog.findMany({
      where: {
        action: 'reconciliation',
        resource: 'orders',
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return runs;
  }

  /**
   * Daily reconciliation job (to be called by cron)
   */
  async runDailyReconciliation() {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1); // Previous day

    logger.info('Running daily reconciliation', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const result = await this.reconcileStripeOrders(startDate, endDate, true);

    // Alert if significant mismatches
    if (result.mismatches.length > 10) {
      logger.warn('Significant reconciliation mismatches detected', {
        count: result.mismatches.length,
      });
      // TODO: Send alert email/notification
    }

    return result;
  }
}

export default new ReconciliationService();
