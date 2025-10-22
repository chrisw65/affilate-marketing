import { Request } from 'express';
import { Affiliate } from '@prisma/client';

// Extend Express Request to include authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'affiliate' | 'admin';
    affiliateId: string;
  };
  affiliate?: Affiliate;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
}

// Webhook payload types
export interface StripeWebhookPayload {
  id: string;
  object: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

export interface ClickFunnelsWebhookPayload {
  event_type: string;
  contact?: any;
  order?: any;
  subscription?: any;
  timestamp: string;
}

// Commission calculation inputs
export interface CommissionCalculationInput {
  orderId: string;
  affiliateId: string;
  orderTotal: number;
  orderItems: any[];
  currency: string;
  customRate?: number;
}

// Payout batch
export interface PayoutBatchSummary {
  batchId: string;
  totalAffiliates: number;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: Date;
}
