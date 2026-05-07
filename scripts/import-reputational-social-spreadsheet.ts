/**
 * Import Reputational & social risk (`lifestyle-behavioral-risk`) questions via SpreadsheetImporter.
 *
 * Spreadsheet columns (header row) must map to SpreadsheetImporter expectations, e.g.:
 *   Pillar | Category | Question ID | Question Text | Type | Weight | Score Map | ...
 *   Reputational & Social Risk | digital_reputation | social_media_policies | ... | single-choice | 2 | {"none":0,"basic":1}
 *
 * Env:
 *   REPUTATIONAL_SOCIAL_IMPORT_PATH — required .xlsx or .xls path (absolute or relative to repo root)
 *   REPUTATIONAL_SOCIAL_SHEET_NAME — optional worksheet name (default: first sheet)
 *
 * Run: npm run import:reputational-social
 *
 * Example file (copy and edit): examples/reputational-social-import-template.csv
 *   REPUTATIONAL_SOCIAL_IMPORT_PATH=examples/reputational-social-import-template.csv npm run import:reputational-social
 */
import "./load-repo-env";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { SpreadsheetImporter } from "../src/lib/assessment/import/spreadsheet-importer";
import { prisma } from "../src/lib/db";

const RISK_AREA_ID = "reputational-social";

function resolveImportPath(): string {
  const raw = process.env.REPUTATIONAL_SOCIAL_IMPORT_PATH?.trim();
  if (!raw) {
    throw new Error(
      "Set REPUTATIONAL_SOCIAL_IMPORT_PATH to your .xlsx (or .xls) containing Reputational & social risk rows."
    );
  }
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function defaultSheetName(filePath: string): string {
  const explicit = process.env.REPUTATIONAL_SOCIAL_SHEET_NAME?.trim();
  if (explicit) return explicit;
  const wb = XLSX.readFile(filePath, { sheetRows: 0 });
  const inferred = wb.SheetNames.find((n) =>
    /reputation|lifestyle|social|behavioral/i.test(n)
  );
  return inferred ?? wb.SheetNames[0]!;
}

async function main(): Promise<void> {
  const filePath = resolveImportPath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const sheetName = defaultSheetName(filePath);
  console.log(`Importing Reputational & social risk from:\n  ${filePath}\n  sheet: "${sheetName}"`);

  const agg = await prisma.assessmentBankQuestion.aggregate({
    where: { riskAreaId: RISK_AREA_ID },
    _max: { sortOrderGlobal: true },
  });
  const sortOrderBase = agg._max.sortOrderGlobal ?? 0;
  if (sortOrderBase > 0) {
    console.log(`Appending after existing sortOrderGlobal max for pillar: ${sortOrderBase}`);
  }

  const importer = new SpreadsheetImporter();
  const result = await importer.importFromFile(filePath, {
    sheetName,
    pillarRiskAreaId: RISK_AREA_ID,
    sortOrderBase,
    updateExisting: true,
  });

  if (!result.success) {
    console.error("Import failed:", JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }

  console.log(`Done. Upserted ${result.importedCount} question(s) for risk area ${RISK_AREA_ID}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
