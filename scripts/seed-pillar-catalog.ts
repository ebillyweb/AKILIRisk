/**
 * Idempotent seed for platform Pillar catalog (10 pillars).
 * Usage: npm run seed:pillar-catalog
 */
import "./load-repo-env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PLATFORM_PILLAR_CATALOG } from "../src/lib/methodology/pillar-catalog-starter";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error("DATABASE_URL is missing");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    let created = 0;
    let updated = 0;
    for (const starter of PLATFORM_PILLAR_CATALOG) {
      const existing = await prisma.pillar.findUnique({
        where: { slug: starter.slug },
      });
      if (existing) {
        await prisma.pillar.update({
          where: { slug: starter.slug },
          data: {
            canonicalName: starter.canonicalName,
            description: starter.description,
            defaultOrder: starter.defaultOrder,
          },
        });
        updated++;
      } else {
        await prisma.pillar.create({
          data: {
            slug: starter.slug,
            canonicalName: starter.canonicalName,
            description: starter.description,
            defaultOrder: starter.defaultOrder,
            catalogVersion: 1,
          },
        });
        created++;
      }
    }
    const total = await prisma.pillar.count();
    console.log(
      `seed:pillar-catalog complete — created ${created}, updated ${updated}, total pillars: ${total}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
