import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  isPrismaSchemaDriftError,
  SCHEMA_DRIFT_USER_MESSAGE,
} from "@/lib/db/schema-drift";

describe("isPrismaSchemaDriftError", () => {
  it("detects P2007 enum validation failures", () => {
    const error = new Prisma.PrismaClientKnownRequestError("validation", {
      code: "P2007",
      clientVersion: "7.8.0",
    });
    expect(isPrismaSchemaDriftError(error)).toBe(true);
  });

  it("detects invalid enum messages", () => {
    expect(
      isPrismaSchemaDriftError(
        new Error(
          'invalid input value for enum "AdvisorEnterpriseStatus": "PROVISIONING"',
        ),
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isPrismaSchemaDriftError(new Error("timeout"))).toBe(false);
  });
});

describe("SCHEMA_DRIFT_USER_MESSAGE", () => {
  it("mentions migrate deploy", () => {
    expect(SCHEMA_DRIFT_USER_MESSAGE).toContain("prisma migrate deploy");
  });
});
