#!/usr/bin/env node
/**
 * Approve intake for client+assessment@test.com to unlock assessment access
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { userEmailCiphertext } = require('./lib/user-email-ciphertext-cjs');

if (!process.env.ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY not set. Required for User email ciphertext lookups.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔓 Approving intake for assessment client...');

  // Find the client and their submitted interview
  const client = await prisma.user.findFirst({
    where: {
      emailCiphertext: userEmailCiphertext('client+assessment@test.com'),
    },
    include: {
      intakeInterviews: {
        where: { status: 'SUBMITTED' },
        orderBy: { submittedAt: 'desc' },
        take: 1
      }
    }
  });

  if (!client) {
    console.error('❌ Client not found');
    return;
  }

  if (!client.intakeInterviews.length) {
    console.error('❌ No submitted intake interview found');
    return;
  }

  const interview = client.intakeInterviews[0];

  // Find the advisor
  const advisor = await prisma.user.findFirst({
    where: { emailCiphertext: userEmailCiphertext('advisor@test.com') },
    include: { advisorProfile: true }
  });

  if (!advisor?.advisorProfile) {
    console.error('❌ Test advisor not found');
    return;
  }

  // Create or update intake approval
  const approval = await prisma.intakeApproval.upsert({
    where: { interviewId: interview.id },
    update: {
      status: 'APPROVED',
      focusAreas: ['insurance', 'cyber-digital', 'reputational-social'],
      notes: 'Intake approved for comprehensive governance assessment. Client demonstrates strong foundational understanding.',
      reviewedAt: new Date(),
      approvedAt: new Date()
    },
    create: {
      interviewId: interview.id,
      advisorId: advisor.advisorProfile.id,
      status: 'APPROVED',
      focusAreas: ['insurance', 'cyber-digital', 'reputational-social'],
      notes: 'Intake approved for comprehensive governance assessment. Client demonstrates strong foundational understanding.',
      reviewedAt: new Date(),
      approvedAt: new Date()
    }
  });

  console.log('✅ Intake approved for client+assessment@test.com');
  console.log(`   Interview ID: ${interview.id}`);
  console.log(`   Approval ID: ${approval.id}`);
  console.log(`   Status: ${approval.status}`);
  console.log(`   Focus Areas: ${approval.focusAreas.join(', ')}`);
  console.log('\n🎯 Client can now access full assessment functionality!');
  console.log('   Login: client+assessment@test.com / testpassword123');
}

main()
  .catch((e) => {
    console.error('❌ Error approving intake:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });