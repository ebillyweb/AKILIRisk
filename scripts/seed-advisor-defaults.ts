/**
 * Clone platform starter content into advisor-owned methodology tables.
 * Usage: npm run seed:advisor-defaults
 * Optional: ADVISOR_PROFILE_ID=cuid npm run seed:advisor-defaults
 * Optional: FORCE=1 to re-clone
 */
import "./load-repo-env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { cloneAdvisorDefaultsIfNeeded } from "../src/lib/methodology/clone-advisor-defaults";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error("DATABASE_URL is missing");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const force = process.env.FORCE === "1";
  const singleId = process.env.ADVISOR_PROFILE_ID?.trim();

  try {
    const advisors = singleId
      ? await prisma.advisorProfile.findMany({ where: { id: singleId } })
      : await prisma.advisorProfile.findMany({ select: { id: true } });

    if (advisors.length === 0) {
      console.log("No advisor profiles found.");
      return;
    }

    let cloned = 0;
    for (const advisor of advisors) {
      const did = await cloneAdvisorDefaultsIfNeeded(advisor.id, { force });
      if (did) cloned++;
    }
    console.log(
      `seed:advisor-defaults complete — processed ${advisors.length} advisors, cloned ${cloned}`,
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
