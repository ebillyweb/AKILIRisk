import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getAdvisorBySubdomain = vi.hoisted(() => vi.fn());

vi.mock("@/lib/advisor/subdomain", () => ({ getAdvisorBySubdomain }));

import { resolveAdvisorTenantRoute, withAkiliPathname } from "./proxy";

function makeReq(pathname: string): NextRequest {
  const url = new URL(`https://tenant.akilirisk.com${pathname}`);
  return {
    headers: new Headers(),
    nextUrl: Object.assign(url, { clone: () => new URL(url.href) }),
  } as unknown as NextRequest;
}

async function bodyOf(resolution: Awaited<ReturnType<typeof resolveAdvisorTenantRoute>>) {
  if (resolution?.type !== "short-circuit") throw new Error("expected short-circuit");
  return {
    status: resolution.response.status,
    text: await resolution.response.text(),
  };
}

describe("withAkiliPathname — client header scrub", () => {
  it("strips all proxy-asserted tenant headers a client could inject", async () => {
    const req = {
      headers: new Headers({
        "x-advisor-id": "adv-evil",
        "x-subdomain": "victim-firm",
        "x-branded-mode": "true",
        "x-tenant-path-prefix": "/t/victim-firm",
        "x-tenant-force-light": "true",
        "x-unrelated": "keep-me",
      }),
      nextUrl: new URL("https://app.akilirisk.com/dashboard"),
    } as unknown as NextRequest;

    const scrubbed = withAkiliPathname(req);

    expect(scrubbed.get("x-advisor-id")).toBeNull();
    expect(scrubbed.get("x-subdomain")).toBeNull();
    expect(scrubbed.get("x-branded-mode")).toBeNull();
    expect(scrubbed.get("x-tenant-path-prefix")).toBeNull();
    expect(scrubbed.get("x-tenant-force-light")).toBeNull();
    // Unrelated headers and the proxy-set pathname survive.
    expect(scrubbed.get("x-unrelated")).toBe("keep-me");
    expect(scrubbed.get("x-akili-pathname")).toBe("/dashboard");
  });
});

describe("resolveAdvisorTenantRoute — existence oracle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the SAME Not Available response for an unknown slug and an inactive tenant", async () => {
    getAdvisorBySubdomain.mockResolvedValueOnce(null); // unknown slug
    const unknown = await bodyOf(
      await resolveAdvisorTenantRoute(makeReq("/dashboard"), "ghost-firm", "/dashboard"),
    );

    getAdvisorBySubdomain.mockResolvedValueOnce({
      advisorId: "adv-1",
      isActive: false,
      dnsVerified: true,
    }); // registered but not live
    const inactive = await bodyOf(
      await resolveAdvisorTenantRoute(makeReq("/dashboard"), "pending-firm", "/dashboard"),
    );

    expect(unknown.status).toBe(404);
    expect(inactive.status).toBe(404);
    expect(unknown.text).toBe(inactive.text);
    expect(unknown.text).toContain("Subdomain Not Available");
  });

  it("returns the same Not Available response for an unverified tenant too", async () => {
    getAdvisorBySubdomain.mockResolvedValueOnce({
      advisorId: "adv-1",
      isActive: true,
      dnsVerified: false,
    });
    const unverified = await bodyOf(
      await resolveAdvisorTenantRoute(makeReq("/dashboard"), "unverified-firm", "/dashboard"),
    );
    expect(unverified.status).toBe(404);
    expect(unverified.text).toContain("Subdomain Not Available");
  });

  it("serves the branded portal (not a 404) for an active, verified tenant", async () => {
    getAdvisorBySubdomain.mockResolvedValueOnce({
      advisorId: "adv-1",
      isActive: true,
      dnsVerified: true,
    });
    // "/" is not a pass-through workspace path, so the active branch produces a
    // branded /branded/client-portal rewrite short-circuit.
    const resolution = await resolveAdvisorTenantRoute(makeReq("/"), "live-firm", "/");
    expect(resolution?.type).toBe("short-circuit");
    if (resolution?.type === "short-circuit") {
      expect(resolution.response.status).not.toBe(404);
    }
  });
});
