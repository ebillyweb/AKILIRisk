import { prisma } from '@/lib/db';

/** Matches CLAUDE.md test client; override with EXAMPLE_ASSESSMENT_USER_EMAIL. */
const DEFAULT_EXAMPLE_USER_EMAIL = 'client@test.com';

/**
 * Returns a real User.id for example scripts (Assessment has FK to User).
 */
export async function resolveExampleAssessmentUserId(): Promise<string> {
  const email =
    process.env.EXAMPLE_ASSESSMENT_USER_EMAIL?.trim() || DEFAULT_EXAMPLE_USER_EMAIL;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `No user with email "${email}". Run seed scripts (e.g. scripts/seed-advisor-test-data.js) ` +
        `or set EXAMPLE_ASSESSMENT_USER_EMAIL to an existing user's email.`
    );
  }
  return user.id;
}
