import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdvisorQuestionSource } from "@prisma/client";

const methodologyTransfer = vi.hoisted(() => vi.fn(async () => 0));
const ensurePlatformRules = vi.hoisted(() => vi.fn(async () => false));

vi.mock("@/lib/methodology/clone-enterprise-methodology", () => ({
  transferAdvisorMethodologyToEnterpriseInTx: methodologyTransfer,
}));
vi.mock("@/lib/methodology/clone-enterprise-defaults", () => ({
  ensureEnterprisePlatformRecommendationRulesInTx: ensurePlatformRules,
}));

import {
  buildEnterpriseBrandingTransferUpdate,
  transferAdvisorAssetsToEnterprise,
} from "./transfer-advisor-assets";

const emptyEnterprise = {
  brandName: null,
  tagline: null,
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  logoUrl: null,
  logoS3Key: null,
  logoContentType: null,
  logoFileSize: null,
  logoUploadedAt: null,
  websiteUrl: null,
  emailFooterText: null,
  supportEmail: null,
  supportPhone: null,
  brandingEnabled: true,
  customDomainEnabled: false,
};

function createTransferTx(overrides: Record<string, unknown> = {}) {
  return {
    advisorEnterprise: {
      findUnique: vi.fn().mockResolvedValue({
        ...emptyEnterprise,
        brandName: null,
      }),
      update: vi.fn(),
    },
    advisorProfile: {
      findUnique: vi.fn().mockResolvedValue({
        ...emptyEnterprise,
        firmName: "Solo Firm",
        brandName: "Solo Brand",
      }),
    },
    enterpriseRecommendationRule: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    advisorRecommendationRule: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    advisorSolutionCustomization: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    enterpriseSolutionCustomization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    ...overrides,
  };
}

describe("buildEnterpriseBrandingTransferUpdate", () => {
  it("returns null when advisor branding is disabled", () => {
    expect(
      buildEnterpriseBrandingTransferUpdate(emptyEnterprise, {
        ...emptyEnterprise,
        firmName: "Solo Firm",
        brandingEnabled: false,
      }),
    ).toBeNull();
  });

  it("fills empty enterprise branding from advisor profile", () => {
    const update = buildEnterpriseBrandingTransferUpdate(emptyEnterprise, {
      ...emptyEnterprise,
      firmName: "Solo Firm",
      brandName: "Solo Brand",
      tagline: "Protect what matters",
      primaryColor: "#112233",
      logoUrl: "https://cdn.example/logo.png",
      logoS3Key: "logos/solo.png",
      logoContentType: "image/png",
      logoFileSize: 1024,
      logoUploadedAt: new Date("2026-01-01T00:00:00.000Z"),
      websiteUrl: "https://solo.example",
      supportEmail: "help@solo.example",
      customDomainEnabled: true,
      brandingEnabled: true,
    });

    expect(update).toMatchObject({
      brandName: "Solo Brand",
      tagline: "Protect what matters",
      primaryColor: "#112233",
      logoUrl: "https://cdn.example/logo.png",
      logoS3Key: "logos/solo.png",
      websiteUrl: "https://solo.example",
      supportEmail: "help@solo.example",
      customDomainEnabled: true,
    });
  });

  it("uses firmName when advisor brandName is unset", () => {
    const update = buildEnterpriseBrandingTransferUpdate(emptyEnterprise, {
      ...emptyEnterprise,
      firmName: "Belvedere Group",
      brandName: null,
      brandingEnabled: true,
    });

    expect(update).toMatchObject({ brandName: "Belvedere Group" });
  });

  it("does not overwrite existing enterprise branding", () => {
    const update = buildEnterpriseBrandingTransferUpdate(
      {
        ...emptyEnterprise,
        brandName: "Existing Firm Brand",
        primaryColor: "#ffffff",
        logoUrl: "https://cdn.example/existing.png",
      },
      {
        ...emptyEnterprise,
        firmName: "Solo Firm",
        brandName: "Solo Brand",
        primaryColor: "#000000",
        logoUrl: "https://cdn.example/solo.png",
        brandingEnabled: true,
      },
    );

    expect(update).toBeNull();
  });
});

describe("transferAdvisorAssetsToEnterprise", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    methodologyTransfer.mockResolvedValue(4);
    ensurePlatformRules.mockResolvedValue(false);
  });

  it("promotes branding, rules, solutions, and methodology through the transfer pipeline", async () => {
    const tx = createTransferTx();

    const result = await transferAdvisorAssetsToEnterprise(
      tx as never,
      "profile-owner",
      "ent-1",
    );

    expect(tx.advisorEnterprise.update).toHaveBeenCalled();
    expect(ensurePlatformRules).toHaveBeenCalledWith(tx, "ent-1");
    expect(methodologyTransfer).toHaveBeenCalledWith(tx, "profile-owner", "ent-1");
    expect(result).toMatchObject({
      brandingUpdated: true,
      methodologyRowsTransferred: 4,
      customRulesTransferred: 0,
      solutionCustomizationsTransferred: 0,
    });
  });

  it("transfers custom recommendation rules to enterprise and relinks advisor copies", async () => {
    const customRule = {
      id: "rule-custom-1",
      pillarId: "pillar-gov",
      name: "Custom rule",
      triggerConditions: { pillarId: "governance" },
      servicePayload: { serviceRecommendationId: "svc-1", serviceId: "svc-1" },
      priority: 2,
      sourceKind: AdvisorQuestionSource.CUSTOM,
      isActive: true,
    };

    const tx = createTransferTx({
      advisorEnterprise: {
        findUnique: vi.fn().mockResolvedValue({
          ...emptyEnterprise,
          brandName: "Existing Firm Brand",
          primaryColor: "#ffffff",
          logoUrl: "https://cdn.example/existing.png",
        }),
      },
      enterpriseRecommendationRule: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: "ent-rule-1", ...data }),
        ),
      },
      advisorRecommendationRule: {
        findMany: vi.fn().mockResolvedValue([customRule]),
        update: vi.fn(),
      },
    });

    const result = await transferAdvisorAssetsToEnterprise(
      tx as never,
      "profile-owner",
      "ent-1",
    );

    expect(result.customRulesTransferred).toBe(1);
    expect(result.brandingUpdated).toBe(false);
    expect(tx.advisorRecommendationRule.update).toHaveBeenCalledWith({
      where: { id: "rule-custom-1" },
      data: {
        sourceKind: AdvisorQuestionSource.ENTERPRISE,
        enterpriseSourceId: "ent-rule-1",
        version: { increment: 1 },
      },
    });
  });

  it("copies advisor solution overlays when the firm has none yet", async () => {
    const tx = createTransferTx({
      advisorSolutionCustomization: {
        findMany: vi.fn().mockResolvedValue([
          {
            serviceRecommendationId: "svc-1",
            costOverride: "$5k",
            timeframeOverride: "30 days",
            providerOverride: null,
            additionalPlaybook: null,
            notes: "Firm notes",
            isActive: true,
          },
        ]),
      },
      enterpriseSolutionCustomization: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    });

    const result = await transferAdvisorAssetsToEnterprise(
      tx as never,
      "profile-owner",
      "ent-1",
    );

    expect(result.solutionCustomizationsTransferred).toBe(1);
    expect(tx.enterpriseSolutionCustomization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enterpriseId: "ent-1",
          serviceRecommendationId: "svc-1",
          notes: "Firm notes",
        }),
      }),
    );
  });
});
