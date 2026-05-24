/**
 * Parse Belvedere-style household risk workbook tabs (same column layout per sheet).
 * Column layout matches exported CSV: category (A.–F.), question, …, score labels, risk, remediation.
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const DEFAULT_WORKBOOK_FILENAME = "Belvedere_Household_Risk_Profile.xlsx";

export const CATEGORY_MAPPING = {
  "A.": { id: "household_governance", name: "Household Governance", sortStart: 1 },
  "B.": { id: "devices_network", name: "Devices & Network", sortStart: 10 },
  "C.": { id: "accounts_access", name: "Accounts & Access", sortStart: 20 },
  "D.": { id: "data_privacy", name: "Data & Privacy", sortStart: 30 },
  "E.": { id: "financial_identity", name: "Financial & Identity Risk", sortStart: 40 },
  "F.": { id: "incident_response", name: "Incident Response & Recovery", sortStart: 50 },
} as const;

export type CategoryKey = keyof typeof CATEGORY_MAPPING;

const PILLAR_LABELS: Record<string, string> = {
  governance: "Governance",
  "cyber-digital": "Cybersecurity",
  "physical-security": "Physical Security",
  "insurance": "Insurance & Asset Protection",
  "geographic-environmental": "Geographic Risk",
  "reputational-social": "Reputational & Social Risk",
};

const PILLAR_DESCRIPTIONS: Record<string, string> = {
  governance:
    "Decision rights, family authority, advisor coordination, documentation, and dispute resolution.",
  "cyber-digital": "Digital security, identity, access, and cyber resilience.",
  "physical-security": "Personal safety, property security, travel, and physical access control.",
  "insurance":
    "Property, liability, and health continuity coverage; trusts, titling, succession, and concentration risk.",
  "geographic-environmental":
    "Climate and location factors, regional hazards, regulatory context, and geography-driven exposure.",
  "reputational-social":
    "Public footprint, conduct and social media norms, family standards, and reputation-sensitive behavior.",
};

const PILLAR_THRESHOLDS = {
  low: { min: 2.4, max: 3.0 },
  medium: { min: 1.8, max: 2.37 },
  high: { min: 1.2, max: 1.77 },
  critical: { min: 0.0, max: 1.19 },
};

export function resolveWorkbookPath(): string {
  const fromEnv = process.env.BELVEDERE_WORKBOOK_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }
  return path.resolve(process.cwd(), DEFAULT_WORKBOOK_FILENAME);
}

/** Map a worksheet tab name to intake/scoring pillar id (riskAreaId). */
export function inferPillarIdFromSheetName(sheetName: string): string | null {
  const n = sheetName.toLowerCase();
  if (/\bgovernance\b/.test(n)) return "governance";
  if (/cyber/.test(n)) return "cyber-digital";
  if (/physical/.test(n)) return "physical-security";
  if (/(insurance|financial|asset\s*protect)/.test(n)) return "insurance";
  if (/(geographic|environmental)/.test(n)) return "geographic-environmental";
  if (/(reputation|lifestyle|social|behavioral)/.test(n)) return "reputational-social";
  return null;
}

export function workbookExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function loadWorkbook(filePath: string): XLSX.WorkBook {
  return XLSX.readFile(filePath);
}

export function sheetToMatrix(sheet: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as string[][];
  return rows.map((row) => row.map((c) => (c == null ? "" : String(c)).trim()));
}

function cell(row: string[], i: number): string {
  return row[i] ?? "";
}

export function normalizeCategoryKey(raw: string): CategoryKey | null {
  const t = raw.trim();
  if (t in CATEGORY_MAPPING) return t as CategoryKey;
  const m = t.match(/^([A-Fa-f])\.?$/);
  if (m) return `${m[1].toUpperCase()}.` as CategoryKey;
  return null;
}

export function cleanText(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const s = text.trim().replace(/"/g, "").replace(/\s+/g, " ");
  return s || null;
}

export function generateOptions(
  level0: string,
  level1: string,
  level2: string,
  level3: string
) {
  return [
    { value: "level_0", label: cleanText(level0) || "Critical/Absent", description: cleanText(level0) },
    { value: "level_1", label: cleanText(level1) || "Partial/Inconsistent", description: cleanText(level1) },
    { value: "level_2", label: cleanText(level2) || "Implemented", description: cleanText(level2) },
    { value: "level_3", label: cleanText(level3) || "Mature/Resilient", description: cleanText(level3) },
  ].filter((opt) => opt.description);
}

export function determineWeight(questionText: string): number {
  const text = questionText.toLowerCase();
  const criticalKeywords = ["password", "mfa", "backup", "update", "incident"];
  const highKeywords = ["device", "network", "account", "access"];
  if (criticalKeywords.some((k) => text.includes(k))) return 3;
  if (highKeywords.some((k) => text.includes(k))) return 2;
  return 1;
}

export function subcategoryIdForPillar(pillarId: string, categoryBaseId: string): string {
  if (pillarId === "cyber-digital") return categoryBaseId;
  const safe = pillarId.replace(/-/g, "_");
  return `${safe}_${categoryBaseId}`;
}

export function generateQuestionId(
  pillarId: string,
  categoryMarker: string,
  questionText: string
): string {
  const categoryPrefix = categoryMarker.replace(".", "").toLowerCase();
  const textSlug = questionText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 40);
  if (pillarId === "cyber-digital") {
    return `cyber_${categoryPrefix}_${textSlug}`;
  }
  const p = pillarId.replace(/-/g, "_");
  return `${p}_${categoryPrefix}_${textSlug}`;
}

export type BelvedereParsedQuestion = {
  questionId: string;
  riskAreaId: string;
  text: string;
  helpText: string | null;
  riskRelevance: string | null;
  type: string;
  options: ReturnType<typeof generateOptions>;
  required: boolean;
  weight: number;
  scoreMap: Record<string, number>;
  branchingDependsOn: null;
  branchingPredicate: null;
  profileConditionKey: null;
  omitMaturityScoreWhenYes: boolean;
  learnMore: string | null;
};

export function parseBelvedereMatrix(
  matrix: string[][],
  pillarId: string
): BelvedereParsedQuestion[] {
  const questions: BelvedereParsedQuestion[] = [];
  let currentCategory: CategoryKey | null = null;

  for (const row of matrix) {
    const c0 = cell(row, 0);
    const c1 = cell(row, 1);
    if (!c1 || c1.includes("Critical Exposure") || c1.includes("Risk Tier")) continue;

    const catKey = normalizeCategoryKey(c0);
    if (catKey && catKey in CATEGORY_MAPPING) {
      currentCategory = catKey;
      continue;
    }

    if (c1 && currentCategory) {
      questions.push({
        questionId: generateQuestionId(pillarId, currentCategory, c1),
        riskAreaId: pillarId,
        text: cleanText(c1) ?? "",
        helpText: cleanText(cell(row, 7)),
        riskRelevance: cleanText(cell(row, 7)),
        type: "single-choice",
        options: generateOptions(cell(row, 3), cell(row, 4), cell(row, 5), cell(row, 6)),
        required: true,
        weight: determineWeight(c1),
        scoreMap: { level_0: 0, level_1: 1, level_2: 2, level_3: 3 },
        branchingDependsOn: null,
        branchingPredicate: null,
        profileConditionKey: null,
        omitMaturityScoreWhenYes: false,
        learnMore: cleanText(cell(row, 8)),
      });
    }
  }

  return questions;
}

async function upsertPillar(tx: Tx, pillarId: string) {
  const name = PILLAR_LABELS[pillarId] ?? pillarId;
  const description = PILLAR_DESCRIPTIONS[pillarId] ?? "Risk assessment pillar";
  await tx.pillarConfiguration.upsert({
    where: { pillarId },
    create: {
      pillarId,
      name,
      description,
      baseWeight: 1.0,
      thresholds: PILLAR_THRESHOLDS,
      isActive: true,
    },
    update: {
      name,
      description,
      thresholds: PILLAR_THRESHOLDS,
    },
  });
}

async function upsertSubcategoriesForSheet(tx: Tx, pillarId: string) {
  const pillarName = PILLAR_LABELS[pillarId] ?? pillarId;
  for (const catConfig of Object.values(CATEGORY_MAPPING)) {
    const subcategoryId = subcategoryIdForPillar(pillarId, catConfig.id);
    await tx.subCategoryConfiguration.upsert({
      where: { subcategoryId },
      create: {
        subcategoryId,
        pillarId,
        name: catConfig.name,
        description: `${pillarName} — ${catConfig.name}`,
        baseWeight: 1.0,
        sortOrder: catConfig.sortStart / 10,
        isActive: true,
      },
      update: {
        name: catConfig.name,
        description: `${pillarName} — ${catConfig.name}`,
        sortOrder: catConfig.sortStart / 10,
      },
    });
  }
}

export type BelvedereWorkbookImportOptions = {
  /** If set, only these pillar ids (e.g. only cybersecurity). */
  onlyPillarIds?: string[];
};

/**
 * Import every worksheet whose name maps to a pillar (same row layout as Belvedere cybersecurity export).
 */
export async function importBelvedereWorkbookAllSheets(
  _prisma: PrismaClient,
  _filePath: string,
  _options: BelvedereWorkbookImportOptions = {}
): Promise<{ sheets: string[]; questionCount: number }> {
  throw new Error(
    "Belvedere workbook import to AssessmentBankQuestion was removed. " +
      "Use `npm run seed:pillar-ddl` (or set PILLAR_DDL_SEED_PATH) to load the pillar question bank.",
  );
}

/** First worksheet matching cybersecurity by tab name. */
export function findCyberSheetName(workbook: XLSX.WorkBook): string | null {
  const explicit = process.env.CYBERSECURITY_SHEET_NAME?.trim();
  if (explicit && workbook.SheetNames.includes(explicit)) return explicit;
  for (const name of workbook.SheetNames) {
    if (inferPillarIdFromSheetName(name) === "cyber-digital") return name;
  }
  return null;
}
