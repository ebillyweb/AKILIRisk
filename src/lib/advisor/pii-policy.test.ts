import { describe, expect, it } from "vitest";

import { DEFAULT_PII_POLICY, parsePiiPolicy } from "./pii-policy";

describe("parsePiiPolicy", () => {
  it("defaults pseudonymous workspace labeling to false", () => {
    expect(parsePiiPolicy(DEFAULT_PII_POLICY).pseudonymousWorkspaceLabeling).toBe(
      false,
    );
  });

  it("reads explicit pseudonymous workspace labeling", () => {
    expect(
      parsePiiPolicy({
        ...DEFAULT_PII_POLICY,
        pseudonymousWorkspaceLabeling: true,
      }).pseudonymousWorkspaceLabeling,
    ).toBe(true);
  });

  it("infers pseudonymous labeling from legacy User.name disabled policies", () => {
    expect(
      parsePiiPolicy({
        schemaVersion: 1,
        fields: {
          ...DEFAULT_PII_POLICY.fields,
          "User.name": false,
        },
      }).pseudonymousWorkspaceLabeling,
    ).toBe(true);
  });
});
