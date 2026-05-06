#!/usr/bin/env node
/**
 * Create two specific test clients:
 * 1. client+intake@test.com - Intake pending (partially completed)
 * 2. client+assessment@test.com - Intake submitted (ready for assessment)
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const INTAKE_QUESTION_IDS = [
  'intake-q1', 'intake-q2', 'intake-q3', 'intake-q4', 'intake-q5',
  'intake-q6', 'intake-q7', 'intake-q8', 'intake-q9', 'intake-q10'
];

async function createTestAdvisor() {
  const hashedPassword = await bcryptjs.hash('testpassword123', 12);

  const advisorUser = await prisma.user.upsert({
    where: { email: 'advisor@test.com' },
    update: {},
    create: {
      email: 'advisor@test.com',
      password: hashedPassword,
      name: 'Test Advisor',
      firstName: 'Test',
      lastName: 'Advisor',
      role: 'ADVISOR'
    }
  });

  const advisorProfile = await prisma.advisorProfile.upsert({
    where: { userId: advisorUser.id },
    update: {},
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

  return { advisorUser, advisorProfile };
}

async function createIntakePendingClient(advisorProfile) {
  console.log('Creating client with pending intake...');

  // Round-11 commit 3 (BRD §5.1.AUTH): clients sign in via magic link;
  // password column is null for USER-role rows.
  const clientUser = await prisma.user.upsert({
    where: { email: 'client+intake@test.com' },
    update: {
      password: null,
      name: 'Test Client (Intake Pending)',
      firstName: 'Intake',
      lastName: 'Pending',
      role: 'USER'
    },
    create: {
      email: 'client+intake@test.com',
      password: null,
      name: 'Test Client (Intake Pending)',
      firstName: 'Intake',
      lastName: 'Pending',
      role: 'USER'
    }
  });

  // Round-11 commit 2.1: ClientProfile reduced to a stub.
  await prisma.clientProfile.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: { userId: clientUser.id }
  });

  // Create intake interview with IN_PROGRESS status
  const intakeInterview = await prisma.intakeInterview.upsert({
    where: { id: `intake-pending-${clientUser.id}` },
    update: {
      status: 'IN_PROGRESS',
      currentQuestionIndex: 3, // Partially completed
      startedAt: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
      completedAt: null,
      submittedAt: null
    },
    create: {
      id: `intake-pending-${clientUser.id}`,
      userId: clientUser.id,
      status: 'IN_PROGRESS',
      currentQuestionIndex: 3, // Stopped at question 4
      startedAt: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
      completedAt: null,
      submittedAt: null
    }
  });

  // Delete existing responses for clean slate
  await prisma.intakeResponse.deleteMany({
    where: { interviewId: intakeInterview.id }
  });

  // Create partial responses (first 3 questions answered)
  for (let i = 0; i < 3; i++) {
    const questionId = INTAKE_QUESTION_IDS[i];
    const num = i + 1;
    await prisma.intakeResponse.create({
      data: {
        interviewId: intakeInterview.id,
        questionId,
        audioUrl: `/uploads/intake/${intakeInterview.id}/q${num}.webm`,
        audioDuration: 42.3,
        transcription: `[Partial] Sample transcription for intake question ${num}. The client provided a response covering key aspects.`,
        transcriptionStatus: 'COMPLETED',
        answeredAt: new Date(Date.now() - 1000 * 60 * (45 - i * 5))
      }
    });
  }

  // Create client-advisor assignment
  await prisma.clientAdvisorAssignment.upsert({
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
      assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
    }
  });

  console.log(`✅ Created client with pending intake: ${clientUser.email}`);
  console.log(`   Status: IN_PROGRESS (3/10 questions completed)`);

  return { clientUser, intakeInterview };
}

async function createAssessmentReadyClient(advisorProfile) {
  console.log('Creating client ready for assessment...');

  // Round-11 commit 3 (BRD §5.1.AUTH): clients sign in via magic link;
  // password column is null for USER-role rows.
  const clientUser = await prisma.user.upsert({
    where: { email: 'client+assessment@test.com' },
    update: {
      password: null,
      name: 'Test Client (Assessment Ready)',
      firstName: 'Assessment',
      lastName: 'Ready',
      role: 'USER'
    },
    create: {
      email: 'client+assessment@test.com',
      password: null,
      name: 'Test Client (Assessment Ready)',
      firstName: 'Assessment',
      lastName: 'Ready',
      role: 'USER'
    }
  });

  // Round-11 commit 2.1: ClientProfile reduced to a stub.
  await prisma.clientProfile.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: { userId: clientUser.id }
  });

  // Create intake interview with SUBMITTED status
  const intakeInterview = await prisma.intakeInterview.upsert({
    where: { id: `assessment-ready-${clientUser.id}` },
    update: {
      status: 'SUBMITTED',
      currentQuestionIndex: 10,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      completedAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      submittedAt: new Date(Date.now() - 1000 * 60 * 10) // 10 minutes ago
    },
    create: {
      id: `assessment-ready-${clientUser.id}`,
      userId: clientUser.id,
      status: 'SUBMITTED',
      currentQuestionIndex: 10,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      completedAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      submittedAt: new Date(Date.now() - 1000 * 60 * 10) // 10 minutes ago
    }
  });

  // Delete existing responses for clean slate
  await prisma.intakeResponse.deleteMany({
    where: { interviewId: intakeInterview.id }
  });

  // Create complete responses (all 10 questions)
  for (let i = 0; i < INTAKE_QUESTION_IDS.length; i++) {
    const questionId = INTAKE_QUESTION_IDS[i];
    const num = i + 1;
    await prisma.intakeResponse.create({
      data: {
        interviewId: intakeInterview.id,
        questionId,
        audioUrl: `/uploads/intake/${intakeInterview.id}/q${num}.webm`,
        audioDuration: 48.7,
        transcription: `[Complete] Sample transcription for intake question ${num}. The client provided a comprehensive response covering all key aspects relevant to family wealth management and governance.`,
        transcriptionStatus: 'COMPLETED',
        answeredAt: new Date(Date.now() - 1000 * 60 * (120 - i * 8))
      }
    });
  }

  // Create client-advisor assignment
  await prisma.clientAdvisorAssignment.upsert({
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
      assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 48) // 2 days ago
    }
  });

  // Create some document requirements
  const requirements = [
    {
      name: 'Family Trust Agreement',
      description: 'Current family trust documentation',
      required: true,
      fulfilled: false
    },
    {
      name: 'Investment Portfolio Summary',
      description: 'Current investment holdings and allocation',
      required: true,
      fulfilled: false
    }
  ];

  for (const [index, req] of requirements.entries()) {
    await prisma.documentRequirement.upsert({
      where: { id: `doc-req-assessment-${clientUser.id}-${index + 1}` },
      update: {
        name: req.name,
        description: req.description,
        required: req.required,
        fulfilled: req.fulfilled
      },
      create: {
        id: `doc-req-assessment-${clientUser.id}-${index + 1}`,
        advisorId: advisorProfile.id,
        clientId: clientUser.id,
        name: req.name,
        description: req.description,
        required: req.required,
        fulfilled: req.fulfilled
      }
    });
  }

  console.log(`✅ Created client ready for assessment: ${clientUser.email}`);
  console.log(`   Status: SUBMITTED (10/10 questions completed)`);
  console.log(`   Document requirements: ${requirements.length} created`);

  return { clientUser, intakeInterview };
}

async function main() {
  console.log('🌱 Creating intake test clients...\n');

  // Ensure we have an advisor
  const { advisorProfile } = await createTestAdvisor();
  console.log('✅ Test advisor ready\n');

  // Create the two test clients
  await createIntakePendingClient(advisorProfile);
  console.log('');
  await createAssessmentReadyClient(advisorProfile);

  console.log('\n🎉 Intake test clients created successfully!');
  console.log('\n📋 Test credentials:');
  console.log('   Advisor: advisor@test.com / testpassword123');
  console.log('   Client (Intake Pending): client+intake@test.com / testpassword123');
  console.log('   Client (Assessment Ready): client+assessment@test.com / testpassword123');
  console.log('\n🔄 Client statuses:');
  console.log('   client+intake@test.com: IN_PROGRESS (3/10 questions)');
  console.log('   client+assessment@test.com: SUBMITTED (10/10 questions, eligible for assessment)');
  console.log('\n🚀 Login at http://localhost:3000');
}

main()
  .catch((e) => {
    console.error('❌ Error creating test clients:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });