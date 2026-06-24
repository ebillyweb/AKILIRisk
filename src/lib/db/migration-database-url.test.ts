import { describe, expect, it, afterEach } from "vitest";
import { resolveMigrationDatabaseUrl } from "./migration-database-url";

describe("resolveMigrationDatabaseUrl", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("prefers DIRECT_URL when set", () => {
    process.env = {
      ...env,
      DIRECT_URL: "postgresql://user:pass@ep-direct.example/db",
      DATABASE_URL: "postgresql://user:pass@ep-host-pooler.example/db",
    };
    expect(resolveMigrationDatabaseUrl()).toBe(
      "postgresql://user:pass@ep-direct.example/db",
    );
  });

  it("strips Neon pooler hostname segment from DATABASE_URL", () => {
    process.env = {
      ...env,
      DIRECT_URL: "",
      DATABASE_URL:
        "postgresql://user:pass@ep-sparkling-dream-ae9m5yez-pooler.c-2.us-east-2.aws.neon.tech/akili_db?sslmode=require",
    };
    expect(resolveMigrationDatabaseUrl()).toBe(
      "postgresql://user:pass@ep-sparkling-dream-ae9m5yez.c-2.us-east-2.aws.neon.tech/akili_db?sslmode=require",
    );
  });

  it("returns DATABASE_URL unchanged when not pooled", () => {
    process.env = {
      ...env,
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5443/belvedere",
    };
    delete process.env.DIRECT_URL;
    expect(resolveMigrationDatabaseUrl()).toBe(
      "postgresql://postgres:postgres@localhost:5443/belvedere",
    );
  });
});
