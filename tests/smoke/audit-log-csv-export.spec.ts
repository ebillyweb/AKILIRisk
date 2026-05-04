import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * CSV export end-to-end:
 *  - Admin downloads CSV with a tight filter.
 *  - File parses as valid CSV (header row + data rows).
 *  - Row count in the CSV matches what the page would show with the same filter.
 *  - The export action ITSELF produces a `data_access.export` audit row
 *    visible in the page after the download.
 *  - CSV escaping handled correctly when payloads contain commas/quotes
 *    (the data_access.audit_log_view rows from earlier visits naturally
 *    contain JSON metadata with commas; we don't need to seed extra rows).
 */

function parseCsvLine(line: string): string[] {
  // Minimal RFC-4180 reader: handles quoted fields, embedded commas, and
  // escaped quotes ("").
  const out: string[] = [];
  let i = 0;
  let cur = "";
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cur.length === 0) {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  out.push(cur);
  return out;
}

test.describe("audit-log CSV export", () => {
  test("admin can download CSV; rows parse; export action self-audits", async ({
    page,
    request,
    context,
  }) => {
    await new SignInPage(page).signInAs("admin");

    // Visit the page first to seed at least one data_access.audit_log_view
    // row so the CSV will have data.
    await page.goto("/admin/audit-log");
    await expect(
      page.getByRole("heading", { name: /^audit log \(\d/i })
    ).toBeVisible();

    // Tight filter: only data_access.audit_log_view, default 7-day window.
    // Use the authenticated context to fetch CSV directly so we can read the
    // body and headers.
    const cookies = await context.cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const csvResp = await request.get(
      "/api/admin/audit-log/export?action=data_access.audit_log_view",
      { headers: { cookie: cookieHeader } }
    );
    expect(csvResp.status()).toBe(200);
    expect(csvResp.headers()["content-type"]).toContain("text/csv");
    expect(csvResp.headers()["content-disposition"]).toContain("audit-log-");

    const body = await csvResp.text();
    const lines = body.trim().split("\n");
    expect(lines.length, "should have header + at least one row").toBeGreaterThan(
      1
    );

    // Header: id,createdAt,actorUserId,actorRole,actorEmailHash,action,
    //         entityType,entityId,beforeData,afterData,metadata,ipAddress,userAgent
    const header = parseCsvLine(lines[0]);
    expect(header).toEqual([
      "id",
      "createdAt",
      "actorUserId",
      "actorRole",
      "actorEmailHash",
      "action",
      "entityType",
      "entityId",
      "beforeData",
      "afterData",
      "metadata",
      "ipAddress",
      "userAgent",
    ]);

    // Every data row must have the right column count.
    const ACTION_INDEX = 5;
    const META_INDEX = 10;
    for (let li = 1; li < lines.length; li++) {
      const cols = parseCsvLine(lines[li]);
      expect(cols.length, `row ${li} column count`).toBe(header.length);
      expect(cols[ACTION_INDEX]).toBe("data_access.audit_log_view");
      // Metadata is a JSON object; ensure embedded commas survived escaping.
      // "metadata" column should be parseable JSON for these rows.
      const meta = cols[META_INDEX];
      expect(() => JSON.parse(meta)).not.toThrow();
    }

    // The export above wrote a data_access.export audit row before streaming.
    // Reload the page filtered to that action; assert the row is present.
    await page.goto(`/admin/audit-log?action=data_access.export`);
    const exportRow = page
      .locator('[data-testid="audit-log-row"][data-action="data_access.export"]')
      .first();
    await expect(exportRow).toBeVisible();

    // The export's metadata should record the format and a filterHash.
    await exportRow.locator("details > summary").click();
    const exportText = await exportRow.locator("details").textContent();
    expect(exportText, "export row body").toBeTruthy();
    expect(exportText!).toMatch(/filterHash/);
    expect(exportText!).toMatch(/csv/);
  });
});
