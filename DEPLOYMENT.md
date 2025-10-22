# Deployment & Testing Guide

This guide covers deployment and testing for the Advanced Affiliate Management System (Phase 1 + Phase 2).

---

## Quick Start (Local Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and update these critical values:

```bash
# Database (update if not using Docker)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/affiliate_system?schema=public"

# CHANGE THESE IN PRODUCTION!
JWT_SECRET=<generate-32-char-random-string>
JWT_REFRESH_SECRET=<generate-32-char-random-string>
COOKIE_SECRET=<generate-32-char-random-string>

# Webhook Secrets (get from providers)
STRIPE_WEBHOOK_SECRET=whsec_your_actual_stripe_secret
CLICKFUNNELS_WEBHOOK_SECRET=your_actual_cf_secret
```

### 3. Start Database

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis.

### 4. Initialize Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed test data
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

---

## Testing the System

### Phase 1 Features

#### 1. **Test Authentication**

```bash
# Register new affiliate
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# Save the accessToken from response
```

#### 2. **Test Click Tracking**

```bash
# Track a click (replace affiliate_id with actual ID from seed data)
curl "http://localhost:3000/api/clicks/track?aid=<affiliate-id>&utm_source=test&utm_campaign=demo"

# This returns a clickId and sets a cookie
```

#### 3. **Test Webhook (Stripe)**

```bash
# Send test Stripe checkout webhook
curl -X POST http://localhost:3000/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=test,v1=test" \
  -d '{
    "id": "evt_test_123",
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_123",
        "amount_total": 10000,
        "currency": "usd",
        "customer_email": "customer@example.com",
        "metadata": {
          "click_id": "<click_token_from_cookie>",
          "affiliate_id": "<affiliate-id>"
        }
      }
    },
    "created": 1234567890
  }'
```

#### 4. **Test Dashboard**

```bash
# Get dashboard stats (use Bearer token from login)
curl http://localhost:3000/api/affiliate/dashboard \
  -H "Authorization: Bearer <your-token>"
```

#### 5. **Test Affiliate Portal**

Open browser: `http://localhost:3000/portal/`

Login with:
- Email: `affiliate1@example.com`
- Password: `Test123!`

### Phase 2 Features

#### 6. **Test Reconciliation**

```bash
# Run manual reconciliation
curl -X POST "http://localhost:3000/api/admin/reconciliation/run?auto_resolve=true"

# View reconciliation history
curl http://localhost:3000/api/admin/reconciliation/history
```

#### 7. **Test Automated Payouts**

```bash
# Process automated payouts
curl -X POST http://localhost:3000/api/admin/payouts/process-automated

# Retry failed payouts
curl -X POST http://localhost:3000/api/admin/payouts/retry-failed
```

#### 8. **Test Scheduler**

```bash
# Check scheduler status
curl http://localhost:3000/api/admin/scheduler/status

# Manually trigger a job
curl -X POST http://localhost:3000/api/admin/scheduler/trigger/approve-commissions
```

#### 9. **Test Commission Approval**

```bash
# Approve eligible commissions (past hold period)
curl -X POST http://localhost:3000/api/admin/commissions/approve-eligible

# Check affiliate dashboard for updated earnings
curl http://localhost:3000/api/affiliate/dashboard \
  -H "Authorization: Bearer <affiliate-token>"
```

---

## Production Deployment

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **Redis** (optional for Phase 3 queues)
- SSL certificate for HTTPS
- Stripe account with Connect enabled
- SMTP server for emails

### 1. Environment Setup

```bash
# Production environment variables
NODE_ENV=production
PORT=3000
API_BASE_URL=https://your-domain.com

# Database (use managed PostgreSQL for production)
DATABASE_URL="postgresql://user:pass@prod-db-host:5432/affiliate_system"

# Strong secrets (use 32+ character random strings)
JWT_SECRET=<use-openssl-rand-base64-32>
JWT_REFRESH_SECRET=<use-openssl-rand-base64-32>
COOKIE_SECRET=<use-openssl-rand-base64-32>

# Real webhook secrets
STRIPE_WEBHOOK_SECRET=<from-stripe-dashboard>
CLICKFUNNELS_WEBHOOK_SECRET=<from-clickfunnels>

# SMTP for emails
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-key>
SMTP_FROM=Affiliates <noreply@your-domain.com>

# Stripe Connect
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
```

### 2. Build Application

```bash
npm run build
```

### 3. Run Migrations

```bash
npm run prisma:migrate
```

### 4. Start with Process Manager

Using **PM2**:

```bash
npm install -g pm2

# Start application
pm2 start dist/index.js --name affiliate-system

# Save PM2 configuration
pm2 save

# Setup auto-restart on server reboot
pm2 startup
```

### 5. Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase body size for webhooks
    client_max_body_size 10M;
}
```

### 6. Database Backups

```bash
# Setup daily backup cron job
0 2 * * * pg_dump -U user affiliate_system | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz

# Keep last 30 days
find /backups -name "db-*.sql.gz" -mtime +30 -delete
```

### 7. Monitoring

- **Application Logs**: `pm2 logs affiliate-system`
- **Database Monitoring**: Use your database provider's monitoring
- **Uptime Monitoring**: Use services like UptimeRobot, Pingdom
- **Error Tracking**: Consider Sentry integration

---

## Health Checks

### Server Health

```bash
curl https://your-domain.com/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-10-22T12:00:00.000Z",
    "uptime": 3600,
    "environment": "production"
  }
}
```

### Database Health

```bash
# Check Prisma connection
npm run prisma:studio
```

### Scheduler Health

```bash
curl https://your-domain.com/api/admin/scheduler/status
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Fails

```bash
# Check PostgreSQL is running
docker-compose ps

# Check DATABASE_URL is correct
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL
```

#### 2. Webhooks Not Processing

```bash
# Check webhook endpoint is accessible
curl https://your-domain.com/webhooks/test

# Verify signature secrets are set
echo $STRIPE_WEBHOOK_SECRET

# Check webhook logs
pm2 logs affiliate-system | grep webhook
```

#### 3. Scheduler Jobs Not Running

```bash
# Check scheduler status
curl http://localhost:3000/api/admin/scheduler/status

# Check server logs
tail -f logs/combined.log | grep scheduler

# Manually trigger a job to test
curl -X POST http://localhost:3000/api/admin/scheduler/trigger/approve-commissions
```

#### 4. Emails Not Sending

```bash
# Check SMTP settings
echo $SMTP_HOST
echo $SMTP_USER

# Test SMTP connection (use actual SMTP test tools)
```

---

## Testing Checklist

### Pre-Deployment

- [ ] All environment variables set
- [ ] Database migrations run successfully
- [ ] Test data seeded (for staging)
- [ ] Build completes without errors
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)

### Post-Deployment

- [ ] Health check endpoint responds
- [ ] Can register new affiliate
- [ ] Can login and access dashboard
- [ ] Click tracking works
- [ ] Webhooks process correctly
- [ ] Commissions calculate accurately
- [ ] Scheduler jobs are running
- [ ] Emails send successfully
- [ ] Admin endpoints accessible
- [ ] Logs are being written
- [ ] Database backups configured

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test API endpoint
ab -n 1000 -c 10 http://localhost:3000/health

# Test click tracking
ab -n 1000 -c 50 "http://localhost:3000/api/clicks/track?aid=test-id"
```

---

## Scaling Considerations

### Horizontal Scaling

If you need to run multiple instances:

1. **Use Redis for session storage** (instead of memory)
2. **Use a queue system** (Bull/BullMQ with Redis)
3. **Configure sticky sessions** in load balancer
4. **Run scheduler on single instance** (or use distributed locks)

### Database Scaling

- Use **connection pooling** (Prisma handles this)
- Add **read replicas** for dashboard queries
- **Index optimization** for large tables
- **Partition** audit logs by date

---

## Security Checklist

- [ ] All secrets are randomly generated (32+ characters)
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Rate limiting configured
- [ ] CORS restricted to your domains
- [ ] Webhook signature verification enabled
- [ ] SQL injection protected (Prisma ORM)
- [ ] XSS protection (Helmet middleware)
- [ ] Environment variables not committed to git
- [ ] Database backups encrypted
- [ ] Admin endpoints protected (add auth middleware)

---

## Support

For issues during deployment:

1. Check server logs: `pm2 logs affiliate-system`
2. Check database logs
3. Review application logs in `./logs/`
4. Test individual components using the testing guide above
5. Create an issue in the repository with details

---

## Next Steps After Deployment

1. **Configure Stripe Connect** - Set up payout accounts for affiliates
2. **Add Admin Authentication** - Secure admin endpoints with proper auth
3. **Setup Email Templates** - Customize email branding
4. **Configure Tax Forms** - Implement W-9/W-8BEN collection (Phase 3)
5. **Add Analytics** - Connect to your BI tools
6. **Setup Monitoring** - Add error tracking and alerts

Good luck with your deployment! 🚀
