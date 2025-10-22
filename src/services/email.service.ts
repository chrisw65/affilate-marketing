import logger from '../utils/logger';
import config from '../config/env';

// Note: Install nodemailer: npm install nodemailer @types/nodemailer
// For now, we'll create the interface for email sending

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

interface EmailRecipient {
  email: string;
  name?: string;
}

export class EmailService {
  private transporter: any;

  constructor() {
    // TODO: Initialize nodemailer when package is installed
    // this.transporter = nodemailer.createTransporter({
    //   host: process.env.SMTP_HOST,
    //   port: parseInt(process.env.SMTP_PORT || '587'),
    //   secure: false,
    //   auth: {
    //     user: process.env.SMTP_USER,
    //     pass: process.env.SMTP_PASSWORD,
    //   },
    // });
  }

  /**
   * Send email
   */
  private async sendEmail(to: EmailRecipient, template: EmailTemplate) {
    try {
      // TODO: Send actual email
      // await this.transporter.sendMail({
      //   from: process.env.SMTP_FROM,
      //   to: to.email,
      //   subject: template.subject,
      //   html: template.html,
      //   text: template.text,
      // });

      // Mock email sending for now
      logger.info('Email sent (mocked)', {
        to: to.email,
        subject: template.subject,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', { to: to.email, error });
      return false;
    }
  }

  /**
   * Send welcome email to new affiliate
   */
  async sendWelcomeEmail(affiliate: { email: string; firstName?: string }) {
    const template: EmailTemplate = {
      subject: 'Welcome to the Affiliate Program!',
      html: `
        <h1>Welcome${affiliate.firstName ? `, ${affiliate.firstName}` : ''}!</h1>
        <p>Thank you for joining our affiliate program.</p>
        <p>Your account has been created and is pending approval. You'll receive another email once your account is approved.</p>
        <p>In the meantime, you can:</p>
        <ul>
          <li>Complete your profile</li>
          <li>Review our affiliate guidelines</li>
          <li>Explore available offers</li>
        </ul>
        <p><a href="${config.api.baseUrl}/portal/">Login to Dashboard</a></p>
        <p>Best regards,<br/>The Affiliate Team</p>
      `,
    };

    return await this.sendEmail({ email: affiliate.email, name: affiliate.firstName }, template);
  }

  /**
   * Send account approved email
   */
  async sendAccountApprovedEmail(affiliate: { email: string; firstName?: string }) {
    const template: EmailTemplate = {
      subject: 'Your Affiliate Account Has Been Approved!',
      html: `
        <h1>Congratulations${affiliate.firstName ? `, ${affiliate.firstName}` : ''}!</h1>
        <p>Your affiliate account has been approved and is now active.</p>
        <p>You can now:</p>
        <ul>
          <li>Create tracking links</li>
          <li>Start promoting our products</li>
          <li>Earn commissions on sales</li>
        </ul>
        <p><a href="${config.api.baseUrl}/portal/dashboard.html">Go to Dashboard</a></p>
        <p>Best regards,<br/>The Affiliate Team</p>
      `,
    };

    return await this.sendEmail({ email: affiliate.email, name: affiliate.firstName }, template);
  }

  /**
   * Send commission earned notification
   */
  async sendCommissionEarnedEmail(
    affiliate: { email: string; firstName?: string },
    commission: { amount: number; currency: string; orderTotal: number }
  ) {
    const formattedAmount = (commission.amount / 100).toFixed(2);
    const formattedOrderTotal = (commission.orderTotal / 100).toFixed(2);

    const template: EmailTemplate = {
      subject: `You Earned a ${commission.currency} ${formattedAmount} Commission!`,
      html: `
        <h1>New Commission Earned!</h1>
        <p>Hi${affiliate.firstName ? ` ${affiliate.firstName}` : ''},</p>
        <p>Great news! You've earned a new commission:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2 style="margin: 0; color: #2563eb;">${commission.currency} ${formattedAmount}</h2>
          <p style="margin: 5px 0 0 0; color: #666;">Commission Amount</p>
        </div>
        <p><strong>Order Total:</strong> ${commission.currency} ${formattedOrderTotal}</p>
        <p>This commission is currently pending and will be available for payout after the hold period.</p>
        <p><a href="${config.api.baseUrl}/portal/commissions.html">View Commissions</a></p>
        <p>Keep up the great work!</p>
      `,
    };

    return await this.sendEmail({ email: affiliate.email, name: affiliate.firstName }, template);
  }

  /**
   * Send payout processed notification
   */
  async sendPayoutProcessedEmail(
    affiliate: { email: string; firstName?: string },
    payout: { amount: number; currency: string; method: string; externalId?: string }
  ) {
    const formattedAmount = (payout.amount / 100).toFixed(2);

    const template: EmailTemplate = {
      subject: `Your ${payout.currency} ${formattedAmount} Payout is on the Way!`,
      html: `
        <h1>Payout Processed!</h1>
        <p>Hi${affiliate.firstName ? ` ${affiliate.firstName}` : ''},</p>
        <p>Your payout has been processed successfully:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2 style="margin: 0; color: #2563eb;">${payout.currency} ${formattedAmount}</h2>
          <p style="margin: 5px 0 0 0; color: #666;">Payout Amount</p>
        </div>
        <p><strong>Payment Method:</strong> ${payout.method}</p>
        ${payout.externalId ? `<p><strong>Transaction ID:</strong> ${payout.externalId}</p>` : ''}
        <p>Funds should arrive in your account within 2-5 business days.</p>
        <p><a href="${config.api.baseUrl}/portal/payouts.html">View Payout History</a></p>
        <p>Thank you for being a valued affiliate!</p>
      `,
    };

    return await this.sendEmail({ email: affiliate.email, name: affiliate.firstName }, template);
  }

  /**
   * Send payout failed notification
   */
  async sendPayoutFailedEmail(
    affiliate: { email: string; firstName?: string },
    payout: { amount: number; currency: string; failureReason?: string }
  ) {
    const formattedAmount = (payout.amount / 100).toFixed(2);

    const template: EmailTemplate = {
      subject: `Action Required: Payout Issue`,
      html: `
        <h1>Payout Issue</h1>
        <p>Hi${affiliate.firstName ? ` ${affiliate.firstName}` : ''},</p>
        <p>Unfortunately, we encountered an issue processing your payout:</p>
        <div style="background: #fef3c7; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0;"><strong>Amount:</strong> ${payout.currency} ${formattedAmount}</p>
          ${payout.failureReason ? `<p style="margin: 10px 0 0 0;"><strong>Reason:</strong> ${payout.failureReason}</p>` : ''}
        </div>
        <p>Please take the following actions:</p>
        <ul>
          <li>Verify your payout method is set up correctly</li>
          <li>Check that your account information is up to date</li>
          <li>Contact support if you need assistance</li>
        </ul>
        <p>We will automatically retry the payout once the issue is resolved.</p>
        <p><a href="${config.api.baseUrl}/portal/profile.html">Update Payment Settings</a></p>
      `,
    };

    return await this.sendEmail({ email: affiliate.email, name: affiliate.firstName }, template);
  }

  /**
   * Send commission approved notification
   */
  async sendCommissionApprovedEmail(
    affiliate: { email: string; firstName?: string },
    totalAmount: number,
    currency: string,
    commissionCount: number
  ) {
    const formattedAmount = (totalAmount / 100).toFixed(2);

    const template: EmailTemplate = {
      subject: `${commissionCount} Commission${commissionCount > 1 ? 's' : ''} Approved!`,
      html: `
        <h1>Commissions Approved!</h1>
        <p>Hi${affiliate.firstName ? ` ${affiliate.firstName}` : ''},</p>
        <p>Good news! ${commissionCount} of your commission${commissionCount > 1 ? 's have' : ' has'} been approved:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2 style="margin: 0; color: #2563eb;">${currency} ${formattedAmount}</h2>
          <p style="margin: 5px 0 0 0; color: #666;">Total Approved</p>
        </div>
        <p>These commissions are now eligible for payout once the minimum threshold is reached.</p>
        <p><strong>Current Balance:</strong> Available in your dashboard</p>
        <p><a href="${config.api.baseUrl}/portal/commissions.html">View Commissions</a></p>
      `,
    };

    return await this.sendEmail({ email: affiliate.email, name: affiliate.firstName }, template);
  }

  /**
   * Send monthly summary email
   */
  async sendMonthlySummaryEmail(
    affiliate: { email: string; firstName?: string },
    stats: {
      clicks: number;
      conversions: number;
      earnings: number;
      currency: string;
      conversionRate: number;
    }
  ) {
    const formattedEarnings = (stats.earnings / 100).toFixed(2);

    const template: EmailTemplate = {
      subject: 'Your Monthly Affiliate Summary',
      html: `
        <h1>Monthly Performance Summary</h1>
        <p>Hi${affiliate.firstName ? ` ${affiliate.firstName}` : ''},</p>
        <p>Here's how you performed this month:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0;"><strong>Total Clicks:</strong></td>
              <td style="padding: 10px 0; text-align: right;">${stats.clicks.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0;"><strong>Conversions:</strong></td>
              <td style="padding: 10px 0; text-align: right;">${stats.conversions}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0;"><strong>Conversion Rate:</strong></td>
              <td style="padding: 10px 0; text-align: right;">${stats.conversionRate.toFixed(2)}%</td>
            </tr>
            <tr style="border-top: 2px solid #ddd;">
              <td style="padding: 10px 0;"><strong>Total Earnings:</strong></td>
              <td style="padding: 10px 0; text-align: right;"><strong>${stats.currency} ${formattedEarnings}</strong></td>
            </tr>
          </table>
        </div>
        <p><a href="${config.api.baseUrl}/portal/dashboard.html">View Full Dashboard</a></p>
        <p>Keep up the great work!</p>
      `,
    };

    return await this.sendEmail({ email: affiliate.email, name: affiliate.firstName }, template);
  }
}

export default new EmailService();
