import { describe, it, expect } from "vitest";
import {
  brandingAuditRowToGeneric,
  denamespaceBrandingAction,
  denamespaceSubscriptionAction,
  genericAuditRowToUnified,
  LEGACY_BRANDING_ACTION_NAMES,
  LEGACY_SUBSCRIPTION_ACTION_NAMES,
  namespaceBrandingAction,
  namespaceSubscriptionAction,
  parseUnifiedAuditId,
  subscriptionAuditRowToGeneric,
} from "./adapters";

describe("namespace mapping", () => {
  it("subscription: namespace + denamespace round-trip", () => {
    expect(namespaceSubscriptionAction("payment_failed")).toBe(
      "subscription.payment_failed"
    );
    expect(denamespaceSubscriptionAction("subscription.payment_failed")).toBe(
      "payment_failed"
    );
  });

  it("subscription: denamespace returns null for non-matching", () => {
    expect(denamespaceSubscriptionAction("user.create")).toBeNull();
    expect(denamespaceSubscriptionAction("branding.update_branding")).toBeNull();
  });

  it("branding: namespace lowercases SCREAMING_SNAKE; denamespace re-uppercases", () => {
    expect(namespaceBrandingAction("UPDATE_BRANDING")).toBe(
      "branding.update_branding"
    );
    expect(denamespaceBrandingAction("branding.update_branding")).toBe(
      "UPDATE_BRANDING"
    );
  });

  it("legacy action name lists are populated", () => {
    expect(LEGACY_SUBSCRIPTION_ACTION_NAMES).toContain("subscription.created");
    expect(LEGACY_SUBSCRIPTION_ACTION_NAMES).toContain("subscription.payment_failed");
    expect(LEGACY_BRANDING_ACTION_NAMES).toContain("branding.update_branding");
    expect(LEGACY_BRANDING_ACTION_NAMES).toContain("branding.upload_logo");
    expect(LEGACY_BRANDING_ACTION_NAMES.length).toBeGreaterThanOrEqual(9);
  });
});

describe("parseUnifiedAuditId", () => {
  it("recognizes generic prefix", () => {
    expect(parseUnifiedAuditId("gen:abc123")).toEqual({
      source: "generic",
      originalId: "abc123",
    });
  });

  it("recognizes subscription prefix", () => {
    expect(parseUnifiedAuditId("sub:abc123")).toEqual({
      source: "subscription",
      originalId: "abc123",
    });
  });

  it("recognizes branding prefix", () => {
    expect(parseUnifiedAuditId("brand:abc123")).toEqual({
      source: "branding",
      originalId: "abc123",
    });
  });

  it("returns null for unrecognized", () => {
    expect(parseUnifiedAuditId("unknown:abc")).toBeNull();
    expect(parseUnifiedAuditId("abc")).toBeNull();
  });
});

describe("subscriptionAuditRowToGeneric", () => {
  const TS = new Date("2026-05-04T12:00:00Z");

  it("maps fields with both tiers populated", () => {
    const row = {
      id: "sublog1",
      subscriptionId: "sub1",
      action: "stripe_sync",
      previousTier: "STARTER" as const,
      newTier: "GROWTH" as const,
      metadata: { stripeSubscriptionId: "sub_xx" },
      timestamp: TS,
    };
    const out = subscriptionAuditRowToGeneric(row);
    expect(out.id).toBe("sub:sublog1");
    expect(out.source).toBe("subscription");
    expect(out.createdAt).toBe(TS);
    expect(out.actorUserId).toBeNull();
    expect(out.actorRole).toBeNull();
    expect(out.actorEmailHash).toBeNull();
    expect(out.action).toBe("subscription.stripe_sync");
    expect(out.entityType).toBe("Subscription");
    expect(out.entityId).toBe("sub1");
    expect(out.beforeData).toEqual({ tier: "STARTER" });
    expect(out.afterData).toEqual({ tier: "GROWTH" });
    expect(out.metadata).toEqual({
      source: "stripe_webhook_or_admin",
      legacyAction: "stripe_sync",
      stripeSubscriptionId: "sub_xx",
    });
    expect(out.ipAddress).toBeNull();
    expect(out.userAgent).toBeNull();
  });

  it("sets beforeData=null when previousTier is missing (create event)", () => {
    const out = subscriptionAuditRowToGeneric({
      id: "id2",
      subscriptionId: "sub2",
      action: "created",
      previousTier: null,
      newTier: "STARTER" as const,
      metadata: null,
      timestamp: TS,
    });
    expect(out.beforeData).toBeNull();
    expect(out.afterData).toEqual({ tier: "STARTER" });
  });

  it("sets afterData=null when newTier is missing (delete-style event)", () => {
    const out = subscriptionAuditRowToGeneric({
      id: "id3",
      subscriptionId: "sub3",
      action: "payment_failed",
      previousTier: "GROWTH" as const,
      newTier: null,
      metadata: { invoiceId: "in_x" },
      timestamp: TS,
    });
    expect(out.beforeData).toEqual({ tier: "GROWTH" });
    expect(out.afterData).toBeNull();
    expect(out.metadata).toMatchObject({ invoiceId: "in_x" });
  });
});

describe("brandingAuditRowToGeneric", () => {
  const TS = new Date("2026-05-04T12:00:00Z");

  it("maps fields with full payload", () => {
    const row = {
      id: "blog1",
      advisorId: "adv1",
      action: "UPDATE_BRANDING",
      entityType: "BRANDING",
      entityId: "ent1",
      previousValues: { brandName: "Old" },
      newValues: { brandName: "New" },
      metadata: { source: "settings_page" },
      timestamp: TS,
      userId: "user1",
    };
    const out = brandingAuditRowToGeneric(row);
    expect(out.id).toBe("brand:blog1");
    expect(out.source).toBe("branding");
    expect(out.createdAt).toBe(TS);
    expect(out.actorUserId).toBe("user1");
    expect(out.action).toBe("branding.update_branding");
    expect(out.entityType).toBe("AdvisorBranding");
    expect(out.entityId).toBe("ent1");
    expect(out.beforeData).toEqual({ brandName: "Old" });
    expect(out.afterData).toEqual({ brandName: "New" });
    expect(out.metadata).toMatchObject({
      legacyAction: "UPDATE_BRANDING",
      legacyEntityType: "BRANDING",
      advisorProfileId: "adv1",
      source: "settings_page",
    });
  });

  it("falls back to advisorId when entityId is null", () => {
    const out = brandingAuditRowToGeneric({
      id: "blog2",
      advisorId: "adv1",
      action: "UPLOAD_LOGO",
      entityType: "LOGO",
      entityId: null,
      previousValues: null,
      newValues: { s3Key: "key" },
      metadata: null,
      timestamp: TS,
      userId: "user1",
    });
    expect(out.entityId).toBe("adv1");
  });
});

describe("genericAuditRowToUnified", () => {
  it("prefixes id and adds source field", () => {
    const TS = new Date("2026-05-04T12:00:00Z");
    const out = genericAuditRowToUnified({
      id: "gen-cuid-1",
      actorUserId: "user1",
      actorRole: "ADMIN",
      actorEmailHash: "abc12345",
      action: "user.create",
      entityType: "User",
      entityId: "user2",
      beforeData: null,
      afterData: { id: "user2" },
      metadata: null,
      ipAddress: "192.168.1.0",
      userAgent: "Mozilla",
      createdAt: TS,
    });
    expect(out.id).toBe("gen:gen-cuid-1");
    expect(out.source).toBe("generic");
    expect(out.action).toBe("user.create");
    expect(out.actorRole).toBe("ADMIN");
  });
});
