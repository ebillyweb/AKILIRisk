import { describe, expect, it } from "vitest";

import { productionUserWhere } from "./metrics-user-filters";

describe("metrics-user-filters", () => {
  it("productionUserWhere always excludes test accounts", () => {
    expect(productionUserWhere({ role: "USER", deletedAt: null })).toEqual({
      role: "USER",
      deletedAt: null,
      isTestAccount: false,
    });
  });
});
