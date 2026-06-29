import { describe, expect, it } from "vitest";

import {
  resolveEnterpriseProvisionHealth,
  STUCK_PROVISIONING_THRESHOLD_MS,
} from "@/lib/admin/provisioning-health";

describe("resolveEnterpriseProvisionHealth", () => {
  it("marks down when queue mode but redis is down", () => {
    const result = resolveEnterpriseProvisionHealth({
      mode: "queue",
      redisStatus: "down",
      cronConfigured: true,
      jobCounts: null,
      provisioningFirms: 1,
      stuckProvisioningFirms: 0,
    });
    expect(result.status).toBe("down");
  });

  it("marks degraded when failed jobs or stuck firms exist", () => {
    expect(
      resolveEnterpriseProvisionHealth({
        mode: "queue",
        redisStatus: "healthy",
        cronConfigured: true,
        jobCounts: {
          waiting: 0,
          active: 0,
          delayed: 0,
          failed: 2,
          completed: 10,
        },
        provisioningFirms: 0,
        stuckProvisioningFirms: 0,
      }).status,
    ).toBe("degraded");

    expect(
      resolveEnterpriseProvisionHealth({
        mode: "legacy",
        redisStatus: "unknown",
        cronConfigured: true,
        jobCounts: null,
        provisioningFirms: 1,
        stuckProvisioningFirms: 1,
      }).status,
    ).toBe("degraded");
  });

  it("is healthy for idle queue with no stuck firms", () => {
    const result = resolveEnterpriseProvisionHealth({
      mode: "queue",
      redisStatus: "healthy",
      cronConfigured: true,
      jobCounts: {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 3,
      },
      provisioningFirms: 0,
      stuckProvisioningFirms: 0,
    });
    expect(result.status).toBe("healthy");
    expect(result.detail).toContain("BullMQ");
  });
});

describe("STUCK_PROVISIONING_THRESHOLD_MS", () => {
  it("is ten minutes", () => {
    expect(STUCK_PROVISIONING_THRESHOLD_MS).toBe(600_000);
  });
});
