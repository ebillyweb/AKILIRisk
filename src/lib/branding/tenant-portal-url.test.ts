import { describe, expect, it } from "vitest";

import {
  buildTenantPortalHost,
  buildTenantPortalUrl,
} from "./tenant-portal-url";

describe("tenant portal url helpers", () => {
  it("builds staging path-portal URLs from platformAppOrigin", () => {
    const config = {
      productionDomain: "akilirisk.com",
      useTenantPathPortals: true,
      platformAppOrigin: "https://preview.akilirisk.com",
    };

    expect(buildTenantPortalHost("ebilly", config)).toBe(
      "preview.akilirisk.com/t/ebilly",
    );
    expect(buildTenantPortalUrl("ebilly", config)).toBe(
      "https://preview.akilirisk.com/t/ebilly",
    );
  });

  it("builds local path-portal URLs during development", () => {
    const config = {
      productionDomain: "akilirisk.com",
      useTenantPathPortals: true,
      platformAppOrigin: "http://localhost:3000",
    };

    expect(buildTenantPortalHost("ebilly", config)).toBe(
      "localhost:3000/t/ebilly",
    );
    expect(buildTenantPortalUrl("ebilly", config)).toBe(
      "http://localhost:3000/t/ebilly",
    );
  });

  it("builds hostname-suffix tenant URLs when path portals are off", () => {
    const config = {
      productionDomain: "akilirisk.com",
      tenantSubdomainSuffix: "-staging",
      useTenantPathPortals: false,
    };

    expect(buildTenantPortalHost("ebilly", config)).toBe(
      "ebilly-staging.akilirisk.com",
    );
    expect(buildTenantPortalUrl("ebilly", config)).toBe(
      "https://ebilly-staging.akilirisk.com",
    );
  });

  it("builds production tenant hostnames without suffix", () => {
    const config = {
      productionDomain: "akilirisk.com",
      useTenantPathPortals: false,
    };

    expect(buildTenantPortalUrl("northbridge", config)).toBe(
      "https://northbridge.akilirisk.com",
    );
  });
});
