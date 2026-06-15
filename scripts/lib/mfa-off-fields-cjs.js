const { Prisma } = require("@prisma/client");

/** Clears opt-in MFA on a user row (MFA is disabled until enabled from Settings). */
const MFA_OFF_FIELDS = {
  mfaEnabled: false,
  mfaSecret: null,
  mfaRecoveryCodes: Prisma.DbNull,
};

module.exports = { MFA_OFF_FIELDS };
