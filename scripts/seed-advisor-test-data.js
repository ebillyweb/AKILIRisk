#!/usr/bin/env node
/**
 * Seed test data for advisor portal verification
 * Creates: advisor user, advisor profile, client with submitted intake interview, client-advisor assignment
 */

// Load repo-root `.env.local` (Next.js loads this automatically for `next dev`).
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');
const { userEmailCiphertext } = require('./lib/user-email-ciphertext-cjs');

if (!process.env.ENCRYPTION_KEY) {
  console.error(
    'ENCRYPTION_KEY not set. Required to compute emailCiphertext for User rows — add it to .env.local (same value as Vercel for shared DB).'
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding advisor portal test data...');

  // Hash password for test users
  const hashedPassword = await bcryptjs.hash('testpassword123', 12);

  // Create advisor user
  const advisorEmail = 'advisor@test.com';
  const advisorCt = userEmailCiphertext(advisorEmail);
  const advisorUser = await prisma.user.upsert({
    where: { emailCiphertext: advisorCt },
    update: {
      emailCiphertext: advisorCt,
      password: hashedPassword,
      name: 'Test Advisor',
      firstName: 'Test',
      lastName: 'Advisor',
      role: 'ADVISOR'
    },
    create: {
      emailCiphertext: advisorCt,
      password: hashedPassword,
      name: 'Test Advisor',
      firstName: 'Test',
      lastName: 'Advisor',
      role: 'ADVISOR'
    }
  });

  console.log('✅ Created advisor user:', advisorEmail);

  // Create advisor profile (with personal details)
  const advisorProfile = await prisma.advisorProfile.upsert({
    where: { userId: advisorUser.id },
    update: {
      phone: '+1 (555) 100-2000',
      jobTitle: 'Senior Wealth Advisor'
    },
    create: {
      userId: advisorUser.id,
      specializations: ['financial-planning', 'risk-assessment', 'governance'],
      licenseNumber: 'TEST-12345',
      firmName: 'Test Advisory Firm',
      bio: 'Test advisor for portal verification',
      phone: '+1 (555) 100-2000',
      jobTitle: 'Senior Wealth Advisor'
    }
  });

  console.log('✅ Created advisor profile for:', advisorUser.name);

  // Create client user with submitted intake.
  // Round-11 commit 3 (BRD §5.1.AUTH): clients sign in via magic link;
  // password column is null. Existing Playwright fixtures that try to
  // sign in with `testpassword123` against this account will fail until
  // they're migrated to the magic-link flow.
  const clientEmail = 'client@test.com';
  const clientCt = userEmailCiphertext(clientEmail);
  const clientUser = await prisma.user.upsert({
    where: { emailCiphertext: clientCt },
    update: {
      emailCiphertext: clientCt,
      password: null,
      name: 'Test Client',
      firstName: 'Test',
      lastName: 'Client',
      role: 'USER'
    },
    create: {
      emailCiphertext: clientCt,
      password: null,
      name: 'Test Client',
      firstName: 'Test',
      lastName: 'Client',
      role: 'USER'
    }
  });

  console.log('✅ Created client user:', clientEmail);

  // Client profile (stub) — round-11 commit 2.1 dropped contact +
  // address + DOB columns per the §5.1 amendment. Profile row is
  // created with only id + userId + timestamps so FK relationships
  // still resolve.
  await prisma.clientProfile.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: { userId: clientUser.id }
  });
  console.log('✅ Created client profile (stub) for:', clientEmail);

  // Create intake interview with SUBMITTED status
  const intakeInterview = await prisma.intakeInterview.upsert({
    where: { id: `test-interview-${clientUser.id}` },
    update: {
      status: 'SUBMITTED',
      currentQuestionIndex: 10,
      startedAt: new Date(Date.now() - 1000 * 60 * 30),
      completedAt: new Date(Date.now() - 1000 * 60 * 5),
      submittedAt: new Date(Date.now() - 1000 * 60 * 2)
    },
    create: {
      id: `test-interview-${clientUser.id}`,
      userId: clientUser.id,
      status: 'SUBMITTED',
      currentQuestionIndex: 10,
      startedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      completedAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      submittedAt: new Date(Date.now() - 1000 * 60 * 2) // 2 minutes ago
    }
  });

  console.log('✅ Created intake interview with SUBMITTED status');

  // Use the same question ids as the app (intake-q1..intake-q10) so "View intake" shows responses
  const INTAKE_QUESTION_IDS = ['intake-q1', 'intake-q2', 'intake-q3', 'intake-q4', 'intake-q5', 'intake-q6', 'intake-q7', 'intake-q8', 'intake-q9', 'intake-q10'];

  await prisma.intakeResponse.deleteMany({ where: { interviewId: intakeInterview.id } });

  for (let i = 0; i < INTAKE_QUESTION_IDS.length; i++) {
    const questionId = INTAKE_QUESTION_IDS[i];
    const num = i + 1;
    await prisma.intakeResponse.upsert({
      where: {
        interviewId_questionId: {
          interviewId: intakeInterview.id,
          questionId
        }
      },
      update: {
        audioUrl: `/uploads/intake/${intakeInterview.id}/q${num}.webm`,
        audioDuration: 45.5,
        transcription: `[Seed] Sample transcription for intake question ${num}. The client provided a thoughtful response covering key aspects relevant to family wealth management.`,
        transcriptionStatus: 'COMPLETED',
        answeredAt: new Date(Date.now() - 1000 * 60 * Math.random() * 30)
      },
      create: {
        interviewId: intakeInterview.id,
        questionId,
        audioUrl: `/uploads/intake/${intakeInterview.id}/q${num}.webm`,
        audioDuration: 45.5,
        transcription: `[Seed] Sample transcription for intake question ${num}. The client provided a thoughtful response covering key aspects relevant to family wealth management.`,
        transcriptionStatus: 'COMPLETED',
        answeredAt: new Date(Date.now() - 1000 * 60 * Math.random() * 30)
      }
    });
  }

  console.log(`✅ Created ${INTAKE_QUESTION_IDS.length} intake responses with transcriptions (intake-q1..intake-q10)`);

  // Create client-advisor assignment
  const assignment = await prisma.clientAdvisorAssignment.upsert({
    where: {
      clientId_advisorId: {
        clientId: clientUser.id,
        advisorId: advisorProfile.id
      }
    },
    update: { status: 'ACTIVE' },
    create: {
      clientId: clientUser.id,
      advisorId: advisorProfile.id,
      status: 'ACTIVE',
      assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
    }
  });

  console.log('✅ Created client-advisor assignment');

  // Create DocumentRequirement records for first client
  const requirements = [
    {
      id: `doc-req-${clientUser.id}-1`,
      name: 'Trust Agreement',
      description: 'Current family trust documentation',
      required: true,
      fulfilled: false
    },
    {
      id: `doc-req-${clientUser.id}-2`,
      name: 'Tax Return (Most Recent)',
      description: 'Most recent federal tax return',
      required: true,
      fulfilled: false
    },
    {
      id: `doc-req-${clientUser.id}-3`,
      name: 'Estate Plan Summary',
      description: 'Summary of current estate planning documents',
      required: true,
      fulfilled: false
    },
    {
      id: `doc-req-${clientUser.id}-4`,
      name: 'Insurance Policies',
      description: 'Life insurance and liability coverage details',
      required: false,
      fulfilled: false
    }
  ];

  for (const req of requirements) {
    await prisma.documentRequirement.upsert({
      where: { id: req.id },
      update: {
        name: req.name,
        description: req.description,
        required: req.required,
        fulfilled: req.fulfilled
      },
      create: {
        id: req.id,
        advisorId: advisorProfile.id,
        clientId: clientUser.id,
        name: req.name,
        description: req.description,
        required: req.required,
        fulfilled: req.fulfilled
      }
    });
  }

  console.log(`✅ Created ${requirements.length} document requirements for ${clientEmail}`);

  // Second client user (round-11: MFA is no longer available for client
  // accounts; this fixture is preserved for legacy Playwright tests but
  // its name is misleading post-round-11. Password is null per the
  // BRD §5.1.AUTH magic-link policy).
  const clientMfaEmail = 'client-mfa@test.com';
  const clientMfaCt = userEmailCiphertext(clientMfaEmail);
  const client2User = await prisma.user.upsert({
    where: { emailCiphertext: clientMfaCt },
    update: {
      emailCiphertext: clientMfaCt,
      password: null,
      name: 'Test Client (MFA)',
      firstName: 'MFA',
      lastName: 'Client',
      role: 'USER'
    },
    create: {
      emailCiphertext: clientMfaCt,
      password: null,
      name: 'Test Client (MFA)',
      firstName: 'MFA',
      lastName: 'Client',
      role: 'USER'
    }
  });

  console.log('✅ Created second client user (for MFA testing):', clientMfaEmail);

  // Round-11 commit 2.1: ClientProfile reduced to id + userId stub.
  await prisma.clientProfile.upsert({
    where: { userId: client2User.id },
    update: {},
    create: { userId: client2User.id }
  });

  const intakeInterview2 = await prisma.intakeInterview.upsert({
    where: { id: `test-interview-${client2User.id}` },
    update: {
      status: 'SUBMITTED',
      currentQuestionIndex: 10,
      startedAt: new Date(Date.now() - 1000 * 60 * 30),
      completedAt: new Date(Date.now() - 1000 * 60 * 5),
      submittedAt: new Date(Date.now() - 1000 * 60 * 2)
    },
    create: {
      id: `test-interview-${client2User.id}`,
      userId: client2User.id,
      status: 'SUBMITTED',
      currentQuestionIndex: 10,
      startedAt: new Date(Date.now() - 1000 * 60 * 30),
      completedAt: new Date(Date.now() - 1000 * 60 * 5),
      submittedAt: new Date(Date.now() - 1000 * 60 * 2)
    }
  });

  await prisma.intakeResponse.deleteMany({ where: { interviewId: intakeInterview2.id } });

  for (let i = 0; i < INTAKE_QUESTION_IDS.length; i++) {
    const questionId = INTAKE_QUESTION_IDS[i];
    const num = i + 1;
    await prisma.intakeResponse.upsert({
      where: {
        interviewId_questionId: {
          interviewId: intakeInterview2.id,
          questionId
        }
      },
      update: {
        audioUrl: `/uploads/intake/${intakeInterview2.id}/q${num}.webm`,
        audioDuration: 45.5,
        transcription: `[Seed MFA client] Sample transcription for intake question ${num}.`,
        transcriptionStatus: 'COMPLETED',
        answeredAt: new Date(Date.now() - 1000 * 60 * Math.random() * 30)
      },
      create: {
        interviewId: intakeInterview2.id,
        questionId,
        audioUrl: `/uploads/intake/${intakeInterview2.id}/q${num}.webm`,
        audioDuration: 45.5,
        transcription: `[Seed MFA client] Sample transcription for intake question ${num}.`,
        transcriptionStatus: 'COMPLETED',
        answeredAt: new Date(Date.now() - 1000 * 60 * Math.random() * 30)
      }
    });
  }

  await prisma.clientAdvisorAssignment.upsert({
    where: {
      clientId_advisorId: {
        clientId: client2User.id,
        advisorId: advisorProfile.id
      }
    },
    update: { status: 'ACTIVE' },
    create: {
      clientId: client2User.id,
      advisorId: advisorProfile.id,
      status: 'ACTIVE',
      assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
    }
  });

  console.log('✅ Created second client-advisor assignment');

  // Create DocumentRequirement records for second client (MFA testing)
  const requirements2 = [
    {
      id: `doc-req-${client2User.id}-1`,
      name: 'Trust Agreement',
      description: 'Current family trust documentation',
      required: true,
      fulfilled: false
    },
    {
      id: `doc-req-${client2User.id}-2`,
      name: 'Financial Statements',
      description: 'Most recent financial statements',
      required: true,
      fulfilled: false
    }
  ];

  for (const req of requirements2) {
    await prisma.documentRequirement.upsert({
      where: { id: req.id },
      update: {
        name: req.name,
        description: req.description,
        required: req.required,
        fulfilled: req.fulfilled
      },
      create: {
        id: req.id,
        advisorId: advisorProfile.id,
        clientId: client2User.id,
        name: req.name,
        description: req.description,
        required: req.required,
        fulfilled: req.fulfilled
      }
    });
  }

  console.log(`✅ Created ${requirements2.length} document requirements for ${clientMfaEmail}`);

  // Third client user with NO intake interview row - used by Playwright intake
  // happy-path tests. Tests reset state via scripts/reset-fresh-client-intake.js
  // before each run.
  const clientFreshEmail = 'client-fresh@test.com';
  const clientFreshCt = userEmailCiphertext(clientFreshEmail);
  const clientFreshUser = await prisma.user.upsert({
    where: { emailCiphertext: clientFreshCt },
    update: {
      emailCiphertext: clientFreshCt,
      password: null,
      name: 'Test Client (Fresh)',
      firstName: 'Fresh',
      lastName: 'Client',
      role: 'USER'
    },
    create: {
      emailCiphertext: clientFreshCt,
      password: null,
      name: 'Test Client (Fresh)',
      firstName: 'Fresh',
      lastName: 'Client',
      role: 'USER'
    }
  });

  // Hard reset any prior intake state so this user always starts NOT_STARTED.
  // Cascades drop IntakeResponse + IntakeApproval rows automatically.
  await prisma.intakeInterview.deleteMany({ where: { userId: clientFreshUser.id } });

  await prisma.clientAdvisorAssignment.upsert({
    where: {
      clientId_advisorId: {
        clientId: clientFreshUser.id,
        advisorId: advisorProfile.id
      }
    },
    update: { status: 'ACTIVE' },
    create: {
      clientId: clientFreshUser.id,
      advisorId: advisorProfile.id,
      status: 'ACTIVE',
      assignedAt: new Date()
    }
  });

  console.log(`✅ Created fresh-intake client (no interview row): ${clientFreshEmail}`);

  // Second independent advisor "tenant" - has their own profile, no clients
  // assigned. Used by the cross-advisor isolation test to confirm advisor B
  // gets 404 when navigating to advisor A's client URL directly.
  const advisor2Email = 'advisor2@test.com';
  const advisor2Ct = userEmailCiphertext(advisor2Email);
  const advisor2User = await prisma.user.upsert({
    where: { emailCiphertext: advisor2Ct },
    update: {
      emailCiphertext: advisor2Ct,
      password: hashedPassword,
      name: 'Test Advisor Two',
      firstName: 'Second',
      lastName: 'Advisor',
      role: 'ADVISOR'
    },
    create: {
      emailCiphertext: advisor2Ct,
      password: hashedPassword,
      name: 'Test Advisor Two',
      firstName: 'Second',
      lastName: 'Advisor',
      role: 'ADVISOR'
    }
  });

  await prisma.advisorProfile.upsert({
    where: { userId: advisor2User.id },
    update: {
      firmName: 'Independent Wealth Group',
      brandName: 'Independent Wealth Group',
      jobTitle: 'Managing Partner',
      phone: '+1 (555) 300-4000',
      brandingEnabled: true,
      primaryColor: '#0c2d57',
      secondaryColor: '#fafafa',
      accentColor: '#f59e0b'
    },
    create: {
      userId: advisor2User.id,
      specializations: ['estate-planning'],
      licenseNumber: 'TEST-99999',
      firmName: 'Independent Wealth Group',
      brandName: 'Independent Wealth Group',
      bio: 'Second test advisor for tenant isolation tests',
      phone: '+1 (555) 300-4000',
      jobTitle: 'Managing Partner',
      brandingEnabled: true,
      primaryColor: '#0c2d57',
      secondaryColor: '#fafafa',
      accentColor: '#f59e0b'
    }
  });

  // Grace-period subscription so the advisor portal layout doesn't redirect
  // them to /advisor/billing before tenant-isolation logic runs. Mirrors the
  // pattern used in scripts/migrate-advisor-subscriptions.js (no Stripe id).
  const advisor2PeriodEnd = new Date();
  advisor2PeriodEnd.setDate(advisor2PeriodEnd.getDate() + 30);
  await prisma.subscription.upsert({
    where: { userId: advisor2User.id },
    update: {
      tier: 'STARTER',
      status: 'GRACE_PERIOD',
      clientLimit: 10,
      billingCycle: 'MONTHLY',
      currentPeriodEnd: advisor2PeriodEnd,
      cancelAtPeriodEnd: false
    },
    create: {
      userId: advisor2User.id,
      tier: 'STARTER',
      status: 'GRACE_PERIOD',
      clientLimit: 10,
      billingCycle: 'MONTHLY',
      currentPeriodEnd: advisor2PeriodEnd,
      cancelAtPeriodEnd: false
    }
  });

  console.log(`✅ Created second advisor (no client assignments): ${advisor2Email}`);

  // Active+verified subdomain for advisor2 -> exercises the proxy.ts branded
  // rewrite path. Bound in Vercel: `independent-wealth.akilirisk.com` -> staging.
  const advisor2Profile = await prisma.advisorProfile.findUnique({
    where: { userId: advisor2User.id },
    select: { id: true }
  });
  await prisma.advisorSubdomain.deleteMany({ where: { advisorId: advisor2Profile.id } });
  await prisma.advisorSubdomain.create({
    data: {
      advisorId: advisor2Profile.id,
      subdomain: 'independent-wealth',
      isActive: true,
      dnsVerified: true,
      sslProvisioned: true,
      verifiedAt: new Date(),
      lastCheckedAt: new Date()
    }
  });
  console.log("✅ Created AdvisorSubdomain 'independent-wealth' (active+verified) for advisor2");

  // Third advisor wired to an active-but-unverified subdomain so the proxy
  // returns the "Subdomain Not Available" 404 page. Bound in Vercel:
  // `inactive-tenant.akilirisk.com` -> staging.
  const advisor3Email = 'advisor3@test.com';
  const advisor3Ct = userEmailCiphertext(advisor3Email);
  const advisor3User = await prisma.user.upsert({
    where: { emailCiphertext: advisor3Ct },
    update: {
      emailCiphertext: advisor3Ct,
      password: hashedPassword,
      name: 'Test Advisor Three',
      firstName: 'Third',
      lastName: 'Advisor',
      role: 'ADVISOR'
    },
    create: {
      emailCiphertext: advisor3Ct,
      password: hashedPassword,
      name: 'Test Advisor Three',
      firstName: 'Third',
      lastName: 'Advisor',
      role: 'ADVISOR'
    }
  });
  const advisor3Profile = await prisma.advisorProfile.upsert({
    where: { userId: advisor3User.id },
    update: {
      firmName: 'Inactive Test Firm',
      brandName: 'Inactive Test Firm',
      brandingEnabled: true
    },
    create: {
      userId: advisor3User.id,
      firmName: 'Inactive Test Firm',
      brandName: 'Inactive Test Firm',
      bio: 'Third test advisor whose subdomain is intentionally unverified',
      brandingEnabled: true
    }
  });
  await prisma.advisorSubdomain.deleteMany({ where: { advisorId: advisor3Profile.id } });
  await prisma.advisorSubdomain.create({
    data: {
      advisorId: advisor3Profile.id,
      subdomain: 'inactive-tenant',
      isActive: true,
      dnsVerified: false,
      sslProvisioned: false
    }
  });
  console.log("✅ Created advisor3 + AdvisorSubdomain 'inactive-tenant' (active, NOT verified)");

  // Fourth advisor wired to a verified-but-deactivated subdomain so the
  // proxy returns "Subdomain Not Available" via the isActive=false branch.
  // Bound in Vercel: `disabled-tenant.akilirisk.com` -> staging.
  const advisor4Email = 'advisor4@test.com';
  const advisor4Ct = userEmailCiphertext(advisor4Email);
  const advisor4User = await prisma.user.upsert({
    where: { emailCiphertext: advisor4Ct },
    update: {
      emailCiphertext: advisor4Ct,
      password: hashedPassword,
      name: 'Test Advisor Four',
      firstName: 'Fourth',
      lastName: 'Advisor',
      role: 'ADVISOR'
    },
    create: {
      emailCiphertext: advisor4Ct,
      password: hashedPassword,
      name: 'Test Advisor Four',
      firstName: 'Fourth',
      lastName: 'Advisor',
      role: 'ADVISOR'
    }
  });
  const advisor4Profile = await prisma.advisorProfile.upsert({
    where: { userId: advisor4User.id },
    update: {
      firmName: 'Disabled Test Firm',
      brandName: 'Disabled Test Firm',
      brandingEnabled: true
    },
    create: {
      userId: advisor4User.id,
      firmName: 'Disabled Test Firm',
      brandName: 'Disabled Test Firm',
      bio: 'Fourth test advisor whose subdomain is intentionally deactivated',
      brandingEnabled: true
    }
  });
  await prisma.advisorSubdomain.deleteMany({ where: { advisorId: advisor4Profile.id } });
  await prisma.advisorSubdomain.create({
    data: {
      advisorId: advisor4Profile.id,
      subdomain: 'disabled-tenant',
      isActive: false,
      dnsVerified: true,
      sslProvisioned: true,
      verifiedAt: new Date()
    }
  });
  console.log("✅ Created advisor4 + AdvisorSubdomain 'disabled-tenant' (verified, NOT active)");

  // Fifth advisor with brandingEnabled=false, plus a client assigned to them.
  // Used by the "default Akili branding fallback" test - the protected layout
  // renders AkiliLogoLockup + the platform-name kicker when
  // getAssignedAdvisorBrandingForClient returns null (which happens when the
  // assigned advisor has brandingEnabled=false).
  const advisorUnbrandedEmail = 'advisor-unbranded@test.com';
  const advisorUnbrandedCt = userEmailCiphertext(advisorUnbrandedEmail);
  const advisorUnbrandedUser = await prisma.user.upsert({
    where: { emailCiphertext: advisorUnbrandedCt },
    update: {
      emailCiphertext: advisorUnbrandedCt,
      password: hashedPassword,
      name: 'Test Advisor Unbranded',
      firstName: 'Unbranded',
      lastName: 'Advisor',
      role: 'ADVISOR'
    },
    create: {
      emailCiphertext: advisorUnbrandedCt,
      password: hashedPassword,
      name: 'Test Advisor Unbranded',
      firstName: 'Unbranded',
      lastName: 'Advisor',
      role: 'ADVISOR'
    }
  });
  const advisorUnbrandedProfile = await prisma.advisorProfile.upsert({
    where: { userId: advisorUnbrandedUser.id },
    update: {
      firmName: 'Plain Advisory',
      brandName: null,
      brandingEnabled: false
    },
    create: {
      userId: advisorUnbrandedUser.id,
      firmName: 'Plain Advisory',
      bio: 'Fifth test advisor with branding intentionally off',
      brandingEnabled: false
    }
  });

  const clientUnbrandedEmail = 'client-unbranded@test.com';
  const clientUnbrandedCt = userEmailCiphertext(clientUnbrandedEmail);
  const clientUnbrandedUser = await prisma.user.upsert({
    where: { emailCiphertext: clientUnbrandedCt },
    update: {
      emailCiphertext: clientUnbrandedCt,
      password: null,
      name: 'Test Client (Unbranded)',
      firstName: 'Unbranded',
      lastName: 'Client',
      role: 'USER'
    },
    create: {
      emailCiphertext: clientUnbrandedCt,
      password: null,
      name: 'Test Client (Unbranded)',
      firstName: 'Unbranded',
      lastName: 'Client',
      role: 'USER'
    }
  });
  await prisma.clientAdvisorAssignment.upsert({
    where: {
      clientId_advisorId: {
        clientId: clientUnbrandedUser.id,
        advisorId: advisorUnbrandedProfile.id
      }
    },
    update: { status: 'ACTIVE' },
    create: {
      clientId: clientUnbrandedUser.id,
      advisorId: advisorUnbrandedProfile.id,
      status: 'ACTIVE',
      assignedAt: new Date()
    }
  });

  console.log(
    `✅ Created unbranded fixture: ${clientUnbrandedEmail} -> ${advisorUnbrandedEmail} (brandingEnabled=false)`
  );

  console.log('\n🎉 Test data seeded successfully!');
  console.log('\n📋 Verification credentials:');
  console.log(`   Advisor: advisor@test.com / testpassword123`);
  console.log(`   Advisor (no clients, isolation tests): advisor2@test.com / testpassword123`);
  console.log(`   Client: client@test.com / testpassword123`);
  console.log(`   Client (MFA testing): client-mfa@test.com / testpassword123`);
  console.log(`   Client (fresh intake): client-fresh@test.com / testpassword123`);
  console.log(`   Intake ID: ${intakeInterview.id}`);
  console.log('\n🚀 Application should be running at http://localhost:3000');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });