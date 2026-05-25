import { describe, it, expect, vi, beforeEach } from "vitest";

const { accessSpy, buildSpy } = vi.hoisted(() => ({
  accessSpy: vi.fn(),
  buildSpy: vi.fn(),
}));

vi.mock("@/lib/templates/policy-document-access", () => ({
  resolvePolicyDocumentAccess: (...args: unknown[]) => accessSpy(...args),
}));

vi.mock("@/lib/templates/build-policy-document", () => ({
  buildPolicyDocument: (...args: unknown[]) => buildSpy(...args),
}));

import { GET } from "./route";

beforeEach(() => {
  accessSpy.mockReset();
  buildSpy.mockReset();
});

function makeRequest(url: string) {
  return new Request(url, { method: "GET" });
}

const params = (id: string) => Promise.resolve({ id });

describe("GET /api/templates/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    accessSpy.mockResolvedValue({ ok: false, status: 401 });

    const res = await GET(
      makeRequest("http://localhost/api/templates/asmt-1?template=governance"),
      { params: params("asmt-1") }
    );

    expect(res.status).toBe(401);
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it("returns 404 for assessments the caller cannot access (US-62)", async () => {
    accessSpy.mockResolvedValue({ ok: false, status: 404 });

    const res = await GET(
      makeRequest(
        "http://localhost/api/templates/asmt-other?template=governance"
      ),
      { params: params("asmt-other") }
    );

    expect(res.status).toBe(404);
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it("returns 404 when pillar is not scored", async () => {
    accessSpy.mockResolvedValue({
      ok: true,
      clientUserId: "client-1",
      advisorProfileId: null,
      advisorView: false,
    });
    buildSpy.mockResolvedValue({ ok: false, reason: "not_scored" });

    const res = await GET(
      makeRequest(
        "http://localhost/api/templates/asmt-1?template=cyber-digital"
      ),
      { params: params("asmt-1") }
    );

    expect(res.status).toBe(404);
  });

  it("returns docx for authorized advisor", async () => {
    accessSpy.mockResolvedValue({
      ok: true,
      clientUserId: "client-1",
      advisorProfileId: "adv-profile-1",
      advisorView: true,
    });
    buildSpy.mockResolvedValue({
      ok: true,
      buffer: Buffer.from("docx"),
      fileName: "firm-household-governance.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const res = await GET(
      makeRequest("http://localhost/api/templates/asmt-1?template=governance"),
      { params: params("asmt-1") }
    );

    expect(res.status).toBe(200);
    expect(buildSpy).toHaveBeenCalledWith(
      expect.objectContaining({ format: "docx" }),
      expect.objectContaining({ id: "governance" })
    );
    expect(res.headers.get("Content-Type")).toMatch(/wordprocessingml/);
  });

  it("returns pdf when format=pdf", async () => {
    accessSpy.mockResolvedValue({
      ok: true,
      clientUserId: "client-1",
      advisorProfileId: "adv-profile-1",
      advisorView: true,
    });
    buildSpy.mockResolvedValue({
      ok: true,
      buffer: Buffer.from("%PDF"),
      fileName: "firm-client-governance-policy.pdf",
      contentType: "application/pdf",
    });

    const res = await GET(
      makeRequest(
        "http://localhost/api/templates/asmt-1?template=governance&format=pdf"
      ),
      { params: params("asmt-1") }
    );

    expect(res.status).toBe(200);
    expect(buildSpy).toHaveBeenCalledWith(
      expect.objectContaining({ format: "pdf" }),
      expect.anything()
    );
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(".pdf");
  });

  it("returns 400 for invalid format", async () => {
    const res = await GET(
      makeRequest(
        "http://localhost/api/templates/asmt-1?template=governance&format=rtf"
      ),
      { params: params("asmt-1") }
    );

    expect(res.status).toBe(400);
    expect(buildSpy).not.toHaveBeenCalled();
  });
});
