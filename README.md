# Advanced Affiliate Management System - Phase 1 MVP

A robust, production-ready affiliate marketing platform with webhook ingestion, attribution tracking, commission calculation, and automated payouts.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Webhook Integration](#webhook-integration)
- [Affiliate Portal](#affiliate-portal)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)

---

## Features

### Phase 1 (Current)

✅ **Webhook Ingestion**
- Stripe integration (checkout, payments, refunds, disputes)
- ClickFunnels integration (orders, refunds)
- Groove webhook support
- HMAC signature verification
- Idempotent processing
- Async event handling

✅ **Click Tracking & Attribution**
- Server-side click tracking with cookies
- Last-click attribution (30-day window)
- Coupon code attribution fallback
- UTM parameter support
- SubID pass-through (sub1-sub5)
- Device, location, and browser tracking

✅ **Commission Engine**
- Configurable commission rates per affiliate
- Automatic commission calculation on orders
- Hold period enforcement (30 days default)
- Refund/chargeback clawback
- Multi-currency support
- Immutable calculation snapshots

✅ **Affiliate Portal**
- JWT-based authentication
- Real-time dashboard with metrics
- Click and conversion tracking
- Commission history and status
- Tracking link management
- Profile management

✅ **Admin Console**
- Platform statistics and analytics
- Affiliate management (approve/suspend/ban)
- Commission approval and rejection
- Manual payout CSV generation
- Audit logging

✅ **Payout System**
- Manual CSV export for payouts
- Minimum threshold enforcement
- Batch processing
- Multi-currency support
- Payout status tracking

---

## Architecture

```
┌─────────────────┐
│  Funnel Builder │ (ClickFunnels/Groove)
│  & Payments     │ (Stripe)
└────────┬────────┘
         │ Webhooks
         ▼
┌─────────────────┐
│ Webhook Layer   │ (Signature verification, idempotency)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Attribution     │ (Last-click, coupon, 30-day window)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Commission      │ (Calculate, hold period, clawback)
│ Engine          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Ledger &        │ (Immutable records, reconciliation)
│ Reconciliation  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Payout          │ (CSV export, threshold checks)
│ Orchestrator    │
└─────────────────┘
```

---

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14
- **npm** >= 9.0.0
- **Docker** (optional, for local development)

---

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd affilate-marketing
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment setup

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration](#configuration) section).

---

## Configuration

### Environment Variables

Key variables to configure in `.env`:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/affiliate_system?schema=public"

# JWT Secrets (CHANGE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-at-least-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production-32-chars

# Cookie Secret
COOKIE_SECRET=your-super-secret-cookie-key-change-this-in-production-32chars

# Webhook Secrets
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
CLICKFUNNELS_WEBHOOK_SECRET=your_clickfunnels_webhook_secret

# Attribution Settings
ATTRIBUTION_WINDOW_DAYS=30
COMMISSION_HOLD_DAYS=30
DEFAULT_COMMISSION_RATE=0.40

# Server
PORT=3000
NODE_ENV=development
```

---

## Database Setup

### Option 1: Using Docker Compose (Recommended)

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Wait for PostgreSQL to be ready
docker-compose ps
```

### Option 2: Manual PostgreSQL Installation

Install PostgreSQL locally and create database:

```bash
createdb affiliate_system
```

### Initialize Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed initial data
npm run prisma:seed
```

### Default Test Accounts

After seeding, you'll have:

```
Admin Account:
  Email: admin@example.com
  Password: Admin123!ChangeMe

Test Affiliate 1:
  Email: affiliate1@example.com
  Password: Test123!

Test Affiliate 2:
  Email: affiliate2@example.com
  Password: Test123!
```

---

## Running the Application

### Development Mode

```bash
npm run dev
```

Server will start at `http://localhost:3000`

### Production Mode

```bash
# Build TypeScript
npm run build

# Start server
npm start
```

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start            # Start production server
npm test             # Run tests
npm run lint         # Lint code
npm run format       # Format code with Prettier
npm run prisma:studio # Open Prisma Studio (database GUI)
```

---

## API Documentation

### Base URL

```
http://localhost:3000
```

### Authentication

Most endpoints require JWT authentication. Include token in header:

```
Authorization: Bearer <your_jwt_token>
```

### API Endpoints

#### Health Check

```http
GET /health
```

Returns server health status.

---

### Auth Endpoints

#### Register Affiliate

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "affiliate@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "country": "US"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "affiliate": {...},
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "affiliate@example.com",
  "password": "SecurePass123!"
}
```

#### Get Profile

```http
GET /api/auth/profile
Authorization: Bearer <token>
```

---

### Affiliate Endpoints

#### Get Dashboard Stats

```http
GET /api/affiliate/dashboard?days=30
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clicks": {
      "totalClicks": 1250,
      "uniqueClicks": 890,
      "conversions": 45,
      "conversionRate": 3.6
    },
    "commissions": {
      "pending": { "amount": 125000, "count": 15 },
      "approved": { "amount": 450000, "count": 45 },
      "paid": { "amount": 1200000, "count": 120 }
    },
    "epc": 9.6
  }
}
```

#### Get Tracking Links

```http
GET /api/affiliate/tracking-links
Authorization: Bearer <token>
```

#### Create Tracking Link

```http
POST /api/affiliate/tracking-links
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Summer Campaign",
  "destinationUrl": "https://example.com/product",
  "utmSource": "affiliate",
  "utmCampaign": "summer2025",
  "couponCode": "SUMMER20"
}
```

#### Get Commissions

```http
GET /api/affiliate/commissions?page=1&limit=50&status=APPROVED
Authorization: Bearer <token>
```

#### Get Payouts

```http
GET /api/affiliate/payouts?page=1&limit=50
Authorization: Bearer <token>
```

---

### Click Tracking

#### Track Click (Public)

```http
GET /api/clicks/track?aid=<affiliate_id>&utm_source=blog&utm_campaign=test&sub1=custom_id
```

Sets cookie and records click. Returns:

```json
{
  "success": true,
  "data": {
    "clickId": "uuid",
    "tracked": true
  }
}
```

#### Tracking Pixel

```http
GET /api/clicks/pixel?aid=<affiliate_id>&redirect=https://example.com
```

Returns 1x1 transparent GIF and optionally redirects.

#### Get My Clicks

```http
GET /api/clicks/my/clicks?page=1&limit=50&converted=true
Authorization: Bearer <token>
```

#### Get Click Stats

```http
GET /api/clicks/my/stats?days=30
Authorization: Bearer <token>
```

---

### Webhook Endpoints

#### Stripe Webhook

```http
POST /webhooks/stripe
Stripe-Signature: t=timestamp,v1=signature
Content-Type: application/json

{...stripe event payload...}
```

#### ClickFunnels Webhook

```http
POST /webhooks/clickfunnels
X-ClickFunnels-Signature: signature
Content-Type: application/json

{...clickfunnels event payload...}
```

#### Groove Webhook

```http
POST /webhooks/groove
Content-Type: application/json

{...groove event payload...}
```

---

### Admin Endpoints

#### Get Platform Stats

```http
GET /api/admin/stats?days=30
```

#### Get All Affiliates

```http
GET /api/admin/affiliates?page=1&status=ACTIVE&search=john
```

#### Update Affiliate Status

```http
PATCH /api/admin/affiliates/:id/status
Content-Type: application/json

{
  "status": "ACTIVE",
  "reason": "KYC approved"
}
```

#### Get All Commissions

```http
GET /api/admin/commissions?page=1&status=PENDING&affiliate_id=uuid
```

#### Approve Commission

```http
POST /api/admin/commissions/:id/approve
```

#### Reject Commission

```http
POST /api/admin/commissions/:id/reject
Content-Type: application/json

{
  "reason": "Fraudulent activity detected"
}
```

#### Approve Eligible Commissions (Batch)

```http
POST /api/admin/commissions/approve-eligible
```

Approves all commissions past hold period.

#### Get Payout Summary

```http
GET /api/admin/payouts/summary?min_amount=5000
```

Returns summary of eligible payouts without generating CSV.

#### Generate Payout CSV

```http
GET /api/admin/payouts/csv?min_amount=5000
```

Downloads CSV file with payout batch.

#### Create Payout Batch

```http
POST /api/admin/payouts/batch
Content-Type: application/json

{
  "batchId": "uuid",
  "payouts": [...]
}
```

---

## Webhook Integration

### Stripe Setup

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `charge.refunded`
   - `invoice.paid`
   - `charge.dispute.created`
4. Copy webhook secret to `.env` as `STRIPE_WEBHOOK_SECRET`

**Pass click_id to Stripe:**

```javascript
// In your checkout flow
const session = await stripe.checkout.sessions.create({
  // ... other params
  metadata: {
    click_id: getCookie('aff_click_id'),
    affiliate_id: 'optional_affiliate_id',
  },
});
```

### ClickFunnels Setup

1. Go to ClickFunnels Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/webhooks/clickfunnels`
3. Select events: `order.created`, `order.refunded`
4. Configure HMAC secret in `.env` as `CLICKFUNNELS_WEBHOOK_SECRET`

### Testing Webhooks Locally

Use ngrok for local testing:

```bash
ngrok http 3000
```

Then use the ngrok URL for webhooks: `https://xxxxx.ngrok.io/webhooks/stripe`

---

## Affiliate Portal

### Accessing the Portal

Navigate to: `http://localhost:3000/portal/`

### Features

- **Login/Register** - JWT-based authentication
- **Dashboard** - Real-time stats, EPC, earnings
- **Clicks** - View all clicks and conversions
- **Commissions** - Track pending, approved, paid commissions
- **Tracking Links** - Generate and manage tracking URLs
- **Payouts** - View payout history
- **Profile** - Update account settings

### Click Tracking Example

```html
<!-- Example affiliate link -->
<a href="http://localhost:3000/api/clicks/track?aid=affiliate-uuid&redirect=https://example.com/product&utm_source=blog&utm_campaign=winter2025&sub1=post-123">
  Buy Now
</a>
```

This will:
1. Record click with all UTM and SubID parameters
2. Set 30-day cookie with click token
3. Redirect to product page
4. Automatically attribute any Stripe checkout within 30 days

---

## Testing

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm test -- --coverage
```

### Manual Testing Checklist

- [ ] Register new affiliate
- [ ] Login and view dashboard
- [ ] Create tracking link
- [ ] Track test click
- [ ] Send test Stripe webhook (use Stripe CLI)
- [ ] Verify commission created
- [ ] Approve commission via admin
- [ ] Generate payout CSV

---

## Project Structure

```
affilate-marketing/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seeding
├── src/
│   ├── config/                # Configuration files
│   │   ├── database.ts        # Prisma client
│   │   └── env.ts             # Environment validation
│   ├── controllers/           # Request handlers
│   │   ├── admin.controller.ts
│   │   ├── affiliate.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── click.controller.ts
│   │   └── webhook.controller.ts
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts            # JWT & API key auth
│   │   ├── errorHandler.ts    # Global error handling
│   │   ├── requestLogger.ts   # Request logging
│   │   └── validation.ts      # Zod validation
│   ├── routes/                # API routes
│   │   ├── admin.routes.ts
│   │   ├── affiliate.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── click.routes.ts
│   │   └── webhook.routes.ts
│   ├── services/              # Business logic
│   │   ├── admin.service.ts
│   │   ├── affiliate.service.ts
│   │   ├── attribution.service.ts
│   │   ├── auth.service.ts
│   │   ├── click.service.ts
│   │   ├── commission.service.ts
│   │   ├── payout.service.ts
│   │   └── webhook.service.ts
│   ├── types/                 # TypeScript types
│   │   └── index.ts
│   ├── utils/                 # Utilities
│   │   ├── jwt.ts
│   │   └── logger.ts
│   ├── app.ts                 # Express app setup
│   └── index.ts               # Server entry point
├── public/                    # Affiliate portal frontend
│   ├── css/
│   ├── js/
│   ├── dashboard.html
│   └── index.html
├── tests/                     # Test files
├── logs/                      # Log files
├── .env                       # Environment variables
├── .env.example               # Environment template
├── docker-compose.yml         # Docker services
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── README.md                  # This file
```

---

## Roadmap

### Phase 2 - Reliability & Payouts (Weeks 5-9)

- [ ] Reconciliation jobs (Stripe vs internal orders)
- [ ] Automated Stripe Connect payouts
- [ ] PayPal Payouts integration
- [ ] Tax form collection (W-9, W-8BEN)
- [ ] KYC verification workflow
- [ ] Email notifications
- [ ] Payout statements

### Phase 3 - Advanced Features (Weeks 10-15)

- [ ] Multi-touch attribution models
- [ ] Tiered commission structures
- [ ] Recurring commission tracking
- [ ] Fraud detection heuristics
- [ ] Admin inspector tool
- [ ] Enhanced reporting
- [ ] Webhooks for external systems

### Phase 4 - Analytics & Scale (Ongoing)

- [ ] Data warehouse (ELT pipeline)
- [ ] BI dashboards (Looker/Metabase)
- [ ] Cohort analysis
- [ ] LTV tracking
- [ ] Multi-currency FX handling
- [ ] Anomaly detection

---

## Support

For issues and feature requests, please create an issue in the repository.

---

## License

MIT License - see LICENSE file for details.

---

## Contributors

Built with ❤️ by the Affiliate Management System team.