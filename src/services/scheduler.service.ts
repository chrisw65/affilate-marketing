import cron from 'node-cron';
import logger from '../utils/logger';
import commissionService from './commission.service';
import reconciliationService from './reconciliation.service';
import stripePayoutService from './stripe-payout.service';
import emailService from './email.service';
import prisma from '../config/database';

export class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all scheduled jobs
   */
  initializeJobs() {
    logger.info('Initializing scheduled jobs');

    // Daily: Approve eligible commissions (runs at 2 AM)
    this.scheduleJob('approve-commissions', '0 2 * * *', async () => {
      logger.info('Running scheduled job: approve-commissions');
      await commissionService.approveEligibleCommissions();
    });

    // Daily: Reconcile Stripe orders (runs at 3 AM)
    this.scheduleJob('reconcile-orders', '0 3 * * *', async () => {
      logger.info('Running scheduled job: reconcile-orders');
      await reconciliationService.runDailyReconciliation();
    });

    // Weekly: Process automated payouts (runs on Mondays at 10 AM)
    this.scheduleJob('process-payouts', '0 10 * * 1', async () => {
      logger.info('Running scheduled job: process-payouts');
      await stripePayoutService.processAutomatedPayouts();
    });

    // Daily: Retry failed payouts (runs at 4 PM)
    this.scheduleJob('retry-failed-payouts', '0 16 * * *', async () => {
      logger.info('Running scheduled job: retry-failed-payouts');
      await stripePayoutService.retryFailedPayouts();
    });

    // Monthly: Send performance summaries (runs on 1st of month at 9 AM)
    this.scheduleJob('monthly-summaries', '0 9 1 * *', async () => {
      logger.info('Running scheduled job: monthly-summaries');
      await this.sendMonthlySummaries();
    });

    // Hourly: Cleanup old logs (runs at minute 30 of every hour)
    this.scheduleJob('cleanup-logs', '30 * * * *', async () => {
      logger.info('Running scheduled job: cleanup-logs');
      await this.cleanupOldLogs();
    });

    logger.info('All scheduled jobs initialized', {
      jobCount: this.jobs.size,
      jobs: Array.from(this.jobs.keys()),
    });
  }

  /**
   * Schedule a cron job
   */
  private scheduleJob(name: string, cronExpression: string, task: () => Promise<void>) {
    const job = cron.schedule(
      cronExpression,
      async () => {
        try {
          await task();
          logger.info(`Scheduled job completed: ${name}`);
        } catch (error) {
          logger.error(`Scheduled job failed: ${name}`, { error });
        }
      },
      {
        scheduled: true,
        timezone: 'UTC',
      }
    );

    this.jobs.set(name, job);
    logger.info(`Scheduled job registered: ${name}`, { cronExpression });
  }

  /**
   * Send monthly performance summaries to all active affiliates
   */
  private async sendMonthlySummaries() {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const affiliates = await prisma.affiliate.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const affiliate of affiliates) {
      try {
        // Get stats for last month
        const [clicks, orders, commissions] = await Promise.all([
          prisma.click.count({
            where: {
              affiliateId: affiliate.id,
              createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
            },
          }),
          prisma.click.count({
            where: {
              affiliateId: affiliate.id,
              converted: true,
              createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
            },
          }),
          prisma.commission.aggregate({
            where: {
              affiliateId: affiliate.id,
              createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
            },
            _sum: { commissionAmount: true },
          }),
        ]);

        const conversionRate = clicks > 0 ? (orders / clicks) * 100 : 0;

        await emailService.sendMonthlySummaryEmail(
          {
            email: affiliate.email,
            firstName: affiliate.firstName || undefined,
          },
          {
            clicks,
            conversions: orders,
            earnings: commissions._sum.commissionAmount || 0,
            currency: affiliate.payoutCurrency,
            conversionRate,
          }
        );
      } catch (error) {
        logger.error('Failed to send monthly summary', {
          affiliateId: affiliate.id,
          error,
        });
      }
    }
  }

  /**
   * Cleanup old audit logs (older than 90 days)
   */
  private async cleanupOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const deleted = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    logger.info('Old audit logs cleaned up', { deleted: deleted.count });
  }

  /**
   * Stop a specific job
   */
  stopJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      logger.info(`Scheduled job stopped: ${name}`);
    }
  }

  /**
   * Stop all jobs
   */
  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Scheduled job stopped: ${name}`);
    });
    this.jobs.clear();
    logger.info('All scheduled jobs stopped');
  }

  /**
   * Get job status
   */
  getJobStatus() {
    return Array.from(this.jobs.entries()).map(([name, job]) => ({
      name,
      running: true, // cron jobs don't have a running status, they're scheduled
    }));
  }

  /**
   * Manually trigger a job (for testing/admin)
   */
  async triggerJob(name: string) {
    logger.info(`Manually triggering job: ${name}`);

    switch (name) {
      case 'approve-commissions':
        return await commissionService.approveEligibleCommissions();
      case 'reconcile-orders':
        return await reconciliationService.runDailyReconciliation();
      case 'process-payouts':
        return await stripePayoutService.processAutomatedPayouts();
      case 'retry-failed-payouts':
        return await stripePayoutService.retryFailedPayouts();
      case 'monthly-summaries':
        return await this.sendMonthlySummaries();
      case 'cleanup-logs':
        return await this.cleanupOldLogs();
      default:
        throw new Error(`Unknown job: ${name}`);
    }
  }
}

export default new SchedulerService();
