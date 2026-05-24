/**
 * Import Belvedere cybersecurity questions from the household risk workbook (Cyber tab)
 * or legacy CSV export.
 */

import * as fs from "fs";
import * as path from "path";
import * as csv from "csv-parser";
import { prisma, disconnectPrismaScript } from "./lib/prisma-for-scripts";
import {
  workbookExists,
  resolveWorkbookPath,
  importBelvedereWorkbookAllSheets,
  sheetToMatrix,
  loadWorkbook,
  findCyberSheetName,
  parseBelvedereMatrix,
  CATEGORY_MAPPING,
  subcategoryIdForPillar,
} from "./lib/belvedere-workbook";

const DEFAULT_LEGACY_CSV = "Belvedere_Household_Risk_Profile.xlsx - 2_Cybersecurity.csv";

function resolveLegacyCsvPath(): string {
  const fromEnv = process.env.CYBERSECURITY_CSV_PATH?.trim();
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  return path.resolve(process.cwd(), DEFAULT_LEGACY_CSV);
}

function csvRowToArray(row: Record<string, string>): string[] {
  const first =
    row[""] ??
    row["\ufeff"] ??
    Object.entries(row).find(([k]) => k.trim() === "")?.[1] ??
    "";
  return [
    String(first ?? ""),
    row["1"] ?? "",
    "",
    row["3"] ?? "",
    row["4"] ?? "",
    row["5"] ?? "",
    row["6"] ?? "",
    row["7"] ?? "",
    row["8"] ?? "",
  ];
}

async function importCybersecurityFromLegacyCsv(): Promise<number> {
  const matrix: string[][] = [];

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (err != null) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve();
    };

    const csvPath = resolveLegacyCsvPath();
    const readStream = fs.createReadStream(csvPath);
    const parser = csv();
    readStream.on("error", (e) => finish(e));
    parser.on("error", (e) => finish(e));
    readStream.pipe(parser);

    parser
      .on("data", (row: Record<string, string>) => {
        matrix.push(csvRowToArray(row));
      })
      .on("end", () => finish());
  });

  const questions = parseBelvedereMatrix(matrix, "cyber-digital");
  if (questions.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const catConfig of Object.values(CATEGORY_MAPPING)) {
      const subcategoryId = subcategoryIdForPillar("cyber-digital", catConfig.id);
      await tx.subCategoryConfiguration.upsert({
        where: { subcategoryId },
        create: {
          subcategoryId,
          pillarId: "cyber-digital",
          name: catConfig.name,
          description: `Cybersecurity - ${catConfig.name}`,
          baseWeight: 1.0,
          sortOrder: catConfig.sortStart / 10,
          isActive: true,
        },
        update: {},
      });
    }

    let order = 0;
    for (const q of questions) {
      order += 1;
      await tx.assessmentBankQuestion.upsert({
        where: { questionId: q.questionId },
        create: {
          questionId: q.questionId,
          riskAreaId: q.riskAreaId,
          sortOrderGlobal: order,
          isVisible: true,
          text: q.text,
          helpText: q.helpText,
          learnMore: q.learnMore,
          riskRelevance: q.riskRelevance,
          type: q.type,
          options: q.options,
          required: q.required,
          weight: q.weight,
          scoreMap: q.scoreMap,
          branchingDependsOn: q.branchingDependsOn,
          branchingPredicate: q.branchingPredicate,
          profileConditionKey: q.profileConditionKey,
          omitMaturityScoreWhenYes: q.omitMaturityScoreWhenYes,
        },
        update: {
          text: q.text,
          helpText: q.helpText,
          learnMore: q.learnMore,
          riskRelevance: q.riskRelevance,
          options: q.options,
          weight: q.weight,
          scoreMap: q.scoreMap,
        },
      });
    }
  });

  return questions.length;
}

async function importCybersecurityFromWorkbookCyberTabOnly(): Promise<number> {
  const filePath = resolveWorkbookPath();
  const { questionCount } = await importBelvedereWorkbookAllSheets(prisma, filePath, {
    onlyPillarIds: ["cyber-digital"],
  });
  return questionCount;
}

/**
 * Prefer `.xlsx` workbook tab (name contains "Cyber"); else optional legacy CSV.
 */
async function importCybersecurityQuestions(): Promise<number> {
  throw new Error(
    "Cybersecurity AssessmentBankQuestion import was removed. Use npm run seed:pillar-ddl.",
  );
  console.log("Starting import of cybersecurity questions...");

  const wbPath = resolveWorkbookPath();
  if (workbookExists(wbPath)) {
    const wb = loadWorkbook(wbPath);
    const cyberSheet = findCyberSheetName(wb);
    if (cyberSheet) {
      const matrix = sheetToMatrix(wb.Sheets[cyberSheet]!);
      if (parseBelvedereMatrix(matrix, "cyber-digital").length > 0) {
        const n = await importCybersecurityFromWorkbookCyberTabOnly();
        console.log(`✅ Imported ${n} cybersecurity questions from workbook tab "${cyberSheet}"`);
        return n;
      }
    }
  }

  if (fs.existsSync(resolveLegacyCsvPath())) {
    const n = await importCybersecurityFromLegacyCsv();
    if (n > 0) {
      console.log(`✅ Imported ${n} cybersecurity questions from legacy CSV`);
      return n;
    }
  }

  throw new Error(
    `No cybersecurity data found. Add "${resolveWorkbookPath()}" with a tab whose name includes "Cyber", ` +
      `or set CYBERSECURITY_CSV_PATH / place "${DEFAULT_LEGACY_CSV}" in the project root.`
  );
}

async function addCybersecurityRecommendations() {
  console.log("Adding cybersecurity service recommendations...");

  const recommendations = [
    {
      id: "cyber_phishing_training",
      name: "Phishing Simulation & Training",
      description:
        "Regular phishing simulation and cybersecurity awareness training for family members",
      category: "training",
      priority: 1,
      estimatedCost: "$2,000 - $5,000 annually",
      timeframe: "Ongoing",
      metadata: {
        riskTiers: ["Low"],
        frequency: "Annual testing",
        deliverables: ["Phishing simulations", "Awareness training", "Incident reporting"],
      },
    },
    {
      id: "cyber_targeted_remediation",
      name: "Targeted Cybersecurity Remediation",
      description: "MFA rollout, device hardening, and targeted security improvements",
      category: "technology",
      priority: 2,
      estimatedCost: "$5,000 - $15,000",
      timeframe: "2-3 months",
      metadata: {
        riskTiers: ["Moderate"],
        services: ["MFA deployment", "Device hardening", "Security training"],
      },
    },
    {
      id: "cyber_full_uplift",
      name: "Complete Cybersecurity Uplift",
      description:
        "Comprehensive cybersecurity overhaul including access control, network segmentation, and monitoring",
      category: "technology",
      priority: 3,
      estimatedCost: "$15,000 - $50,000",
      timeframe: "3-6 months",
      metadata: {
        riskTiers: ["Elevated"],
        services: ["Full access control", "Network segmentation", "Security monitoring", "Incident response"],
      },
    },
    {
      id: "cyber_immediate_intervention",
      name: "Immediate Cybersecurity Intervention",
      description: "Emergency cybersecurity response including credential reset and system hardening",
      category: "emergency",
      priority: 4,
      estimatedCost: "$10,000 - $30,000",
      timeframe: "Immediate (1-2 weeks)",
      metadata: {
        riskTiers: ["High/Critical"],
        urgency: "Immediate",
        services: ["Incident readiness", "Credential reset", "System hardening", "24/7 monitoring"],
      },
    },
  ];

  await prisma.$transaction(async (tx) => {
    for (const rec of recommendations) {
      await tx.serviceRecommendation.upsert({
        where: { id: rec.id },
        create: rec,
        update: rec,
      });
    }
  });

  console.log(`✅ Added ${recommendations.length} cybersecurity service recommendations`);
}

async function main() {
  try {
    await importCybersecurityQuestions();
    await addCybersecurityRecommendations();
    console.log("🎉 Cybersecurity assessment import completed successfully!");
  } catch (error) {
    console.error("💥 Import failed:", error);
    process.exit(1);
  } finally {
    await disconnectPrismaScript();
  }
}

if (require.main === module) {
  main();
}

export { importCybersecurityQuestions, addCybersecurityRecommendations };
