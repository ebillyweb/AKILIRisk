import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Bundle-composition test (E2 / BRD §5.3).
 *
 * Mocks the queries layer so the test runs without a live Postgres.
 * Asserts the resulting ZIP contains the expected file list, the README
 * + metadata.json are present at the root, and the byte-cap mechanism
 * fires (truncates the stream) when the cap is set artificially low.
 *
 * The ZIP is parsed back via `yauzl-promise`-style loop using only
 * Node's built-in tooling — we don't take a new dependency just for the
 * test. We use a small DIY central-directory walker on the buffered
 * output instead.
 */

import { Readable } from "node:stream";

// Mock the queries layer BEFORE importing anything that pulls it in.
const fakeBundle = {
  advisor: { id: "adv-1", userId: "ua-1", firmName: "Acme" },
  advisorSubdomain: null,
  clients: [{ id: "u-1", email: "alice@example.com" }],
  clientProfiles: [],
  subscriptions: [],
  clientAdvisorAssignments: [{ id: "a-1", clientId: "u-1", advisorId: "adv-1" }],
  inviteCodes: [],
  householdMembers: [],
  intakeInterviews: [],
  intakeResponses: [],
  intakeApprovals: [],
  assessments: [],
  assessmentResponses: [],
  pillarScores: [],
  documentRequirements: [],
  advisorNotifications: [],
  governanceReviewLeads: [],
  notificationPreferences: [],
  auditLog: [],
};

const resolveTenantScopeMock = vi.fn();
const fetchTenantBundleMock = vi.fn();
const listAdvisorProfilesMock = vi.fn();

vi.mock("./queries", () => ({
  resolveTenantScope: (...args: unknown[]) => resolveTenantScopeMock(...args),
  fetchTenantBundle: (...args: unknown[]) => fetchTenantBundleMock(...args),
  listAdvisorProfilesForSystemExport: (...args: unknown[]) =>
    listAdvisorProfilesMock(...args),
}));

// Avoid importing server-only into the lib-bundle path during test load.
// (audit-merge has `import "server-only"` which our vitest alias stubs out;
// queries.ts also does — both safe.)

import { composeTenantZip, composeSystemZip } from "./bundle";

beforeEach(() => {
  resolveTenantScopeMock.mockReset();
  fetchTenantBundleMock.mockReset();
  listAdvisorProfilesMock.mockReset();
});

/** Drain a ReadableStream<Uint8Array> into a single Buffer. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
   
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((u) => Buffer.from(u.buffer, u.byteOffset, u.byteLength)));
}

/**
 * Minimal central-directory walker for ZIPs produced by `archiver`.
 * We don't need to decompress — we only need the file list. The central
 * directory entry signature is 0x02014b50; each entry has a fixed-layout
 * header followed by variable-length filename, extra, and comment fields.
 */
function listZipEntries(buf: Buffer): string[] {
  const SIG = 0x02014b50;
  const names: string[] = [];
  for (let i = 0; i + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== SIG) continue;
    const nameLen = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const commentLen = buf.readUInt16LE(i + 32);
    const name = buf.subarray(i + 46, i + 46 + nameLen).toString("utf8");
    names.push(name);
    i += 46 + nameLen + extraLen + commentLen - 1;
  }
  return names;
}

describe("composeTenantZip", () => {
  it("returns null when the advisor profile is not found", async () => {
    resolveTenantScopeMock.mockResolvedValue(null);
    const out = await composeTenantZip("does-not-exist");
    expect(out).toBeNull();
  });

  it("produces a ZIP containing README, metadata, and one CSV per table", async () => {
    resolveTenantScopeMock.mockResolvedValue({
      advisorProfileId: "adv-1",
      advisorUserId: "ua-1",
      clientUserIds: ["u-1"],
    });
    fetchTenantBundleMock.mockResolvedValue(fakeBundle);

    const result = await composeTenantZip("adv-1");
    expect(result).not.toBeNull();
    const buf = await drain(result!.stream);
    await result!.result; // surface any errors

    const entries = listZipEntries(buf);
    expect(entries).toContain("README.md");
    expect(entries).toContain("metadata.json");
    expect(entries).toContain("data.json");
    // 19 tables → 19 csv/<name>.csv files
    expect(entries.filter((e) => e.startsWith("csv/") && e.endsWith(".csv"))).toHaveLength(19);
    // Filename slugs the firm name
    expect(result!.filename).toMatch(/^tenant-acme-.+\.zip$/);
  });

  it("aborts the stream when the byte cap is exceeded", async () => {
    resolveTenantScopeMock.mockResolvedValue({
      advisorProfileId: "adv-1",
      advisorUserId: "ua-1",
      clientUserIds: ["u-1"],
    });
    // Make the bundle huge so it blows past a tiny cap.
    const big = { ...fakeBundle, clients: Array.from({ length: 5000 }, (_, i) => ({
      id: `u-${i}`, email: `user${i}@example.com`, name: `User ${i}`.repeat(10),
    })) };
    fetchTenantBundleMock.mockResolvedValue(big);

    const result = await composeTenantZip("adv-1", { byteCap: 1024 });
    expect(result).not.toBeNull();
    let caught: unknown = null;
    try {
      await drain(result!.stream);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    const final = await result!.result;
    expect(final.aborted).toBe(true);
    expect(final.abortReason).toMatch(/exceeded.+1024-byte cap/);
  });
});

describe("composeSystemZip", () => {
  it("organizes per-tenant data under tenants/<advisorId>/ subdirectories", async () => {
    listAdvisorProfilesMock.mockResolvedValue([
      { id: "adv-1", userId: "ua-1", email: "a@x.com", firmName: "Acme", brandName: null },
      { id: "adv-2", userId: "ua-2", email: "b@x.com", firmName: "Beta", brandName: null },
    ]);
    resolveTenantScopeMock.mockImplementation(async (id: string) => ({
      advisorProfileId: id,
      advisorUserId: id === "adv-1" ? "ua-1" : "ua-2",
      clientUserIds: [],
    }));
    fetchTenantBundleMock.mockResolvedValue(fakeBundle);

    const result = await composeSystemZip();
    const buf = await drain(result.stream);
    await result.result;

    const entries = listZipEntries(buf);
    expect(entries).toContain("README.md");
    expect(entries).toContain("metadata.json");
    expect(entries.some((e) => e.startsWith("tenants/adv-1/csv/"))).toBe(true);
    expect(entries.some((e) => e.startsWith("tenants/adv-2/csv/"))).toBe(true);
    expect(entries).toContain("tenants/adv-1/data.json");
    expect(entries).toContain("tenants/adv-2/data.json");
    expect(result.filename).toMatch(/^system-.+\.zip$/);
  });

  it("metadata.json contains aggregate row counts across tenants", async () => {
    listAdvisorProfilesMock.mockResolvedValue([
      { id: "adv-1", userId: "ua-1", email: "a@x.com", firmName: "Acme", brandName: null },
    ]);
    resolveTenantScopeMock.mockResolvedValue({
      advisorProfileId: "adv-1",
      advisorUserId: "ua-1",
      clientUserIds: ["u-1"],
    });
    fetchTenantBundleMock.mockResolvedValue(fakeBundle);

    const result = await composeSystemZip();
    const final = await result.result;
    expect(final.metadata.scope).toBe("system");
    expect(final.metadata.tenants).toHaveLength(1);
    expect(final.metadata.rowCounts.clients).toBe(1);
  });
});

// Suppress the no-op import warning if Readable is unused (kept for future
// stream-bridge tests).
void Readable;
