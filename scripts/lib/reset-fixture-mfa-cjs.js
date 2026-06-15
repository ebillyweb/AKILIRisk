const { MFA_OFF_FIELDS } = require("./mfa-off-fields-cjs");
const { userEmailCiphertext } = require("./user-email-ciphertext-cjs");

/** Default fixture emails — MFA disabled unless a smoke explicitly enables it. */
const FIXTURE_EMAILS = [
  "advisor@test.com",
  "advisor2@test.com",
  "advisor3@test.com",
  "advisor4@test.com",
  "advisor-unbranded@test.com",
  "client@test.com",
  "client-unbranded@test.com",
  "client-fresh@test.com",
  "platform-admin@test.com",
  "buddy@ebilly.com",
];

/**
 * Disable MFA for seeded / fixture accounts. MFA smokes enable it temporarily
 * via /api/test/mfa/prepare; this restores the default opt-in state.
 */
async function resetFixtureMfa(prisma, emails = FIXTURE_EMAILS) {
  let count = 0;
  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { emailCiphertext: userEmailCiphertext(email) },
      select: { id: true },
    });
    if (!user) continue;

    await prisma.user.update({
      where: { id: user.id },
      data: MFA_OFF_FIELDS,
    });
    await prisma.session.updateMany({
      where: { userId: user.id, expires: { gt: new Date() } },
      data: { mfaVerified: true },
    });
    count += 1;
  }
  return count;
}

module.exports = { FIXTURE_EMAILS, resetFixtureMfa };
