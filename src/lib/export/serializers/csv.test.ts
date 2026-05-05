import { describe, it, expect } from "vitest";
import {
  COLUMNS_BY_TABLE,
  csvEscape,
  renderTenantCsvs,
  rowCountsForBundle,
  rowToCsv,
  tableToCsv,
  toCell,
} from "./csv";
import type { TenantBundle } from "../types";

describe("csvEscape (RFC-4180)", () => {
  it("passes through fields with no special characters", () => {
    expect(csvEscape("hello world")).toBe("hello world");
    expect(csvEscape("123")).toBe("123");
    expect(csvEscape("")).toBe("");
  });

  it("wraps fields containing comma in quotes", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
  });

  it("wraps fields containing double-quote and doubles the quote", () => {
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("wraps fields containing newline (LF) in quotes", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps fields containing CR in quotes", () => {
    expect(csvEscape("line1\rline2")).toBe('"line1\rline2"');
  });

  it("handles all special chars together", () => {
    const input = 'mix: "quote", comma,\nand newline';
    const escaped = csvEscape(input);
    expect(escaped.startsWith('"')).toBe(true);
    expect(escaped.endsWith('"')).toBe(true);
    // Round-trip: strip outer quotes and undouble doubled quotes.
    const stripped = escaped.slice(1, -1).replace(/""/g, '"');
    expect(stripped).toBe(input);
  });
});

describe("toCell", () => {
  it("renders null and undefined as empty string", () => {
    expect(toCell(null)).toBe("");
    expect(toCell(undefined)).toBe("");
  });

  it("renders Date as ISO 8601", () => {
    expect(toCell(new Date("2026-05-04T12:34:56.000Z"))).toBe("2026-05-04T12:34:56.000Z");
  });

  it("renders primitives as their string form", () => {
    expect(toCell("hello")).toBe("hello");
    expect(toCell(42)).toBe("42");
    expect(toCell(true)).toBe("true");
    expect(toCell(false)).toBe("false");
  });

  it("renders objects via JSON.stringify", () => {
    expect(toCell({ a: 1 })).toBe('{"a":1}');
    expect(toCell([1, 2, 3])).toBe("[1,2,3]");
  });
});

describe("rowToCsv", () => {
  it("emits cells in the column order", () => {
    expect(rowToCsv({ a: 1, b: 2, c: 3 }, ["c", "a", "b"])).toBe("3,1,2");
  });

  it("renders missing keys as empty cells", () => {
    expect(rowToCsv({ a: 1 }, ["a", "b", "c"])).toBe("1,,");
  });
});

describe("tableToCsv", () => {
  it("emits header even for empty input", () => {
    expect(tableToCsv([], ["a", "b"])).toBe("a,b\n");
  });

  it("emits header + body with trailing newline", () => {
    const rows = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ];
    expect(tableToCsv(rows, ["a", "b"])).toBe("a,b\n1,2\n3,4\n");
  });

  it("handles tricky payloads end-to-end (round-trip)", () => {
    const rows = [
      { id: "1", note: 'has "quote", comma\nand newline' },
      { id: "2", note: "plain" },
    ];
    const csv = tableToCsv(rows, ["id", "note"]);
    const lines = csv.trimEnd().split("\n");
    // header + 2 data rows (quoted note bleeds across multiple physical
    // newlines, but logical row count is 2). Parse minimally to assert.
    expect(lines[0]).toBe("id,note");
    // Manual round-trip parse: the combined CSV body should be parseable
    // by re-splitting on lines that start with a digit (id is "1" or "2").
    const body = csv.slice("id,note\n".length);
    expect(body.startsWith('1,"has ""quote"", comma\nand newline"')).toBe(true);
    expect(body.includes('2,plain')).toBe(true);
  });
});

describe("renderTenantCsvs + rowCountsForBundle", () => {
  function makeBundle(): TenantBundle {
    return {
      advisor: { id: "adv-1", firmName: "Acme Wealth" },
      advisorSubdomain: { id: "sub-1", advisorProfileId: "adv-1", subdomain: "acme" },
      clients: [
        { id: "u-1", email: "alice@example.com", name: "Alice" },
        { id: "u-2", email: "bob@example.com", name: 'Bob "Bobby"' },
      ],
      clientProfiles: [{ id: "cp-1", userId: "u-1", phone: "555-1212" }],
      subscriptions: [],
      clientAdvisorAssignments: [
        { id: "a-1", clientId: "u-1", advisorId: "adv-1" },
        { id: "a-2", clientId: "u-2", advisorId: "adv-1" },
      ],
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
  }

  it("produces one CSV per declared table", () => {
    const csvs = renderTenantCsvs(makeBundle());
    const expectedKeys = Object.keys(COLUMNS_BY_TABLE).sort();
    expect(Object.keys(csvs).sort()).toEqual(expectedKeys);
  });

  it("each CSV starts with the column header line", () => {
    const csvs = renderTenantCsvs(makeBundle());
    for (const [table, cols] of Object.entries(COLUMNS_BY_TABLE)) {
      const header = (cols as readonly string[]).join(",");
      expect(csvs[table as keyof typeof csvs].startsWith(header + "\n")).toBe(true);
    }
  });

  it("emits one row per data record (clients.csv: 2 rows + header = 3 lines)", () => {
    const csvs = renderTenantCsvs(makeBundle());
    // Bob's name has an embedded quote → that line is quoted; split on \n
    // would still give 3 lines because the quote contains no newline.
    const lines = csvs.clients.trimEnd().split("\n");
    expect(lines.length).toBe(3);
  });

  it("rowCountsForBundle matches the bundle contents", () => {
    const counts = rowCountsForBundle(makeBundle());
    expect(counts.clients).toBe(2);
    expect(counts.client_profiles).toBe(1);
    expect(counts.client_advisor_assignments).toBe(2);
    expect(counts.advisor).toBe(1);
    expect(counts.advisor_subdomain).toBe(1);
    expect(counts.assessments).toBe(0);
  });
});
