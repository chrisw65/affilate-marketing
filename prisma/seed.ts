import { PrismaClient, AffiliateStatus, KYCStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create admin affiliate
  const adminPassword = await bcrypt.hash('Admin123!ChangeMe', 10);
  const admin = await prisma.affiliate.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      status: AffiliateStatus.ACTIVE,
      kycStatus: KYCStatus.APPROVED,
      country: 'US',
      commissionRate: 0.5, // 50% for admin
      payoutCurrency: 'USD',
      minPayoutThreshold: 5000, // $50
      tags: ['admin', 'internal'],
    },
  });
  console.log('Created admin affiliate:', admin.email);

  // Create test affiliates
  const testPassword = await bcrypt.hash('Test123!', 10);

  const affiliate1 = await prisma.affiliate.upsert({
    where: { email: 'affiliate1@example.com' },
    update: {},
    create: {
      email: 'affiliate1@example.com',
      password: testPassword,
      firstName: 'John',
      lastName: 'Doe',
      status: AffiliateStatus.ACTIVE,
      kycStatus: KYCStatus.APPROVED,
      country: 'US',
      commissionRate: 0.4, // 40%
      payoutCurrency: 'USD',
      minPayoutThreshold: 5000,
      tags: ['test', 'tier-1'],
    },
  });
  console.log('Created test affiliate 1:', affiliate1.email);

  const affiliate2 = await prisma.affiliate.upsert({
    where: { email: 'affiliate2@example.com' },
    update: {},
    create: {
      email: 'affiliate2@example.com',
      password: testPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      status: AffiliateStatus.ACTIVE,
      kycStatus: KYCStatus.APPROVED,
      country: 'GB',
      commissionRate: 0.35, // 35%
      payoutCurrency: 'GBP',
      minPayoutThreshold: 4000, // £40
      tags: ['test', 'tier-2'],
    },
  });
  console.log('Created test affiliate 2:', affiliate2.email);

  // Create tracking links for affiliate1
  const link1 = await prisma.trackingLink.create({
    data: {
      affiliateId: affiliate1.id,
      name: 'Main Landing Page',
      destinationUrl: 'https://example.com/product',
      utmSource: 'affiliate',
      utmMedium: 'link',
      utmCampaign: 'summer2025',
      isActive: true,
    },
  });
  console.log('Created tracking link 1:', link1.id);

  const link2 = await prisma.trackingLink.create({
    data: {
      affiliateId: affiliate1.id,
      name: 'Blog Post Link',
      destinationUrl: 'https://example.com/blog-offer',
      utmSource: 'blog',
      utmMedium: 'content',
      utmCampaign: 'content-marketing',
      couponCode: 'BLOG20',
      isActive: true,
    },
  });
  console.log('Created tracking link 2:', link2.id);

  // Create system config
  await prisma.systemConfig.upsert({
    where: { key: 'default_commission_rate' },
    update: {},
    create: {
      key: 'default_commission_rate',
      value: 0.4,
      description: 'Default commission rate for new affiliates (40%)',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'attribution_window_days' },
    update: {},
    create: {
      key: 'attribution_window_days',
      value: 30,
      description: 'Default attribution window in days',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'commission_hold_days' },
    update: {},
    create: {
      key: 'commission_hold_days',
      value: 30,
      description: 'Days to hold commission before payout eligibility',
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
