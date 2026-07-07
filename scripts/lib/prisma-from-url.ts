import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function postgresUrlWithExplicitSslMode(url: string): string {
  return url.replace(
    /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/gi,
    "$1verify-full",
  );
}

export type ScriptPrismaBundle = {
  label: string;
  prisma: PrismaClient;
  pool: Pool;
};

export function createPrismaClient(label: string, databaseUrl: string): ScriptPrismaBundle {
  const pool = new Pool({
    connectionString: postgresUrlWithExplicitSslMode(databaseUrl),
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });
  return { label, prisma, pool };
}

export async function disconnectPrismaBundle(bundle: ScriptPrismaBundle): Promise<void> {
  await bundle.prisma.$disconnect().catch(() => {});
  await bundle.pool.end().catch(() => {});
}
