import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorEnterprise: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  subscription: { update: vi.fn() },
  subscriptionAuditLog: { create: vi.fn() },
  advisorSubdomain: { updateMany: vi.fn() },
  session: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    subscriptions: { cancel: vi.fn().mockResolvedValue({}) },
  })),
}));
vi.mock("@/lib/advisor/platform-subdomain", () => ({
  getSubdomainActivationData: () => ({
    isActive: true,
    dnsVerified: true,
    sslProvisioned: true,
    verifiedAt: new Date("2026-01-01"),
  }),
}));
vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: vi.fn(),
  AUDIT_ACTIONS: {
    ENTERPRISE_SUSPEND: "enterprise.suspend",
    ENTERPRISE_REACTIVATE: "enterprise.reactivate",
    ENTERPRISE_DELETE: "enterprise.delete",
  },
}));

import {
  deleteEnterpriseFirmByAdmin,
  EnterpriseLifecycleError,
  suspendEnterpriseFirmByAdmin,
} from "./firm-lifecycle";

describe("suspendEnterpriseFirmByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaSpies.$transaction.mockImplementation(async (fn: (tx: typeof prismaSpies) => unknown) =>
      fn(prismaSpies)
    );
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      id: "ent-1",
      name: "Belvedere",
      slug: "belvedere",
      status: "ACTIVE",
      subscription: {
        id: "sub-1",
        status: "ACTIVE",
        stripeSubscriptionId: null,
      },
      memberships: [{ userId: "user-1" }],
    });
  });

  it("marks the firm suspended and cancels the subscription", async () => {
    await suspendEnterpriseFirmByAdmin({
      enterpriseId: "ent-1",
      actor: { userId: "admin-1", role: "ADMIN" },
    });

    expect(prismaSpies.advisorEnterprise.update).toHaveBeenCalledWith({
      where: { id: "ent-1" },
      data: { status: "SUSPENDED" },
    });
    expect(prismaSpies.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
    expect(prismaSpies.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: ["user-1"] } },
    });
  });

  it("rejects when already suspended", async () => {
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValueOnce({
      id: "ent-1",
      name: "Belvedere",
      slug: "belvedere",
      status: "SUSPENDED",
      subscription: null,
      memberships: [],
    });

    await expect(
      suspendEnterpriseFirmByAdmin({
        enterpriseId: "ent-1",
        actor: { userId: "admin-1" },
      })
    ).rejects.toBeInstanceOf(EnterpriseLifecycleError);
  });
});

describe("deleteEnterpriseFirmByAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaSpies.$transaction.mockImplementation(async (fn: (tx: typeof prismaSpies) => unknown) =>
      fn(prismaSpies)
    );
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      id: "ent-1",
      name: "Belvedere",
      slug: "belvedere",
      status: "ACTIVE",
      subscription: null,
      memberships: [{ userId: "user-1" }],
    });
  });

  it("requires slug confirmation", async () => {
    await expect(
      deleteEnterpriseFirmByAdmin({
        enterpriseId: "ent-1",
        confirmSlug: "wrong-slug",
        actor: { userId: "admin-1" },
      })
    ).rejects.toThrow(/Confirmation slug does not match/);
  });

  it("deletes the enterprise when slug matches", async () => {
    await deleteEnterpriseFirmByAdmin({
      enterpriseId: "ent-1",
      confirmSlug: "belvedere",
      actor: { userId: "admin-1" },
    });

    expect(prismaSpies.advisorEnterprise.delete).toHaveBeenCalledWith({
      where: { id: "ent-1" },
    });
  });
});
