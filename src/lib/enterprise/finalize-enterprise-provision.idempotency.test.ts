import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Probe for the concurrent-finalize race in finalizeEnterpriseProvision.
 *
 * The status guard (`enterprise.status !== "PROVISIONING"`) is read OUTSIDE the
 * transaction, while the flip to ACTIVE happens INSIDE it. Two overlapping
 * finalize calls (BullMQ drain racing the unconditional legacy sweep in the
 * worker/cron routes, or the after() trigger racing the 5-min cron) both read
 * PROVISIONING and both run transferAdvisorAssetsToEnterprise, which
 * unconditionally CREATEs enterpriseRecommendationRule rows and increments
 * advisor-rule versions — silently duplicating firm methodology.
 *
 * Correct behavior: the second concurrent finalize is a no-op (atomic claim).
 * This test asserts the transfer runs exactly ONCE. finalize now claims the
 * PROVISIONING -> ACTIVE transition atomically (updateMany with a status filter
 * as the first statement inside the transaction), so the losing concurrent call
 * gets count 0 and skips the transfer.
 */

const ENTERPRISE_ID = "ent-race-1";
const OWNER_PROFILE_ID = "adv-owner-profile";

const transferSpy = vi.hoisted(() => vi.fn(async () => ({})));

// Shared mutable status the mocked DB reads/writes, so the test can model the
// interleave: both calls read PROVISIONING before either commits ACTIVE.
const state = vi.hoisted(() => ({ status: "PROVISIONING" as string }));

const prismaSpies = vi.hoisted(() => ({
  advisorEnterprise: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  subscription: { findUnique: vi.fn(async () => null) },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("./transfer-advisor-assets", () => ({
  transferAdvisorAssetsToEnterprise: transferSpy,
}));
vi.mock("./enterprise-provision-notifications", () => ({
  notifyEnterpriseProvisionComplete: vi.fn(async () => undefined),
}));
vi.mock("@/lib/billing/cancel-stripe-subscription", () => ({
  cancelStripeSubscriptionBestEffort: vi.fn(async () => undefined),
}));
vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: vi.fn(async () => undefined),
  AUDIT_ACTIONS: { USER_UPDATE: "USER_UPDATE" },
}));
vi.mock("@/lib/log-safe-error", () => ({ logSafeError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/methodology/clone-enterprise-defaults", () => ({
  syncEnterpriseRulesToMembers: vi.fn(async () => undefined),
}));
vi.mock("@/lib/methodology/clone-enterprise-methodology", () => ({
  syncEnterpriseMethodologyToMembers: vi.fn(async () => undefined),
}));

import { finalizeEnterpriseProvision } from "./finalize-enterprise-provision";

describe("finalizeEnterpriseProvision — concurrent idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.status = "PROVISIONING";

    prismaSpies.advisorEnterprise.findUnique.mockImplementation(async () => ({
      id: ENTERPRISE_ID,
      name: "Belvedere Group",
      slug: "belvedere-group",
      status: state.status,
      seatLimit: 10,
      clientLimit: 100,
      perAdvisorClientLimit: 25,
      paymentMethod: "WIRE",
      subscription: { tier: "PROFESSIONAL" },
      memberships: [{ userId: "owner-1", advisorProfileId: OWNER_PROFILE_ID }],
    }));

    // Atomic claim primitive the correct implementation should use: flip only
    // if still PROVISIONING; report how many rows changed.
    prismaSpies.advisorEnterprise.updateMany.mockImplementation(async () => {
      if (state.status === "PROVISIONING") {
        state.status = "ACTIVE";
        return { count: 1 };
      }
      return { count: 0 };
    });
    prismaSpies.advisorEnterprise.update.mockImplementation(async () => {
      state.status = "ACTIVE";
      return {};
    });

    prismaSpies.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prismaSpies),
    );
  });

  it(
    "runs the asset transfer exactly once when two finalize calls overlap",
    async () => {
      // Both reads happen before either transaction commits — models the race.
      await Promise.all([
        finalizeEnterpriseProvision(ENTERPRISE_ID),
        finalizeEnterpriseProvision(ENTERPRISE_ID),
      ]);

      expect(transferSpy).toHaveBeenCalledTimes(1);
    },
  );
});
