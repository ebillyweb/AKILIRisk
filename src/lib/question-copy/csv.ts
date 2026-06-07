import { createReadStream } from "fs";
import csvParser from "csv-parser";

/** Stable match key for a pillar question row. */
export function questionCopyKey(sectionId: string, questionNumber: string): string {
  return `${sectionId.trim()}\t${questionNumber.trim()}`;
}

export const QUESTION_COPY_CSV_COLUMNS = [
  "section_id",
  "category_code",
  "category_name",
  "section_code",
  "question_number",
  "answer_type",
  "question_text",
  "answer_0",
  "answer_1",
  "answer_2",
  "answer_3",
  "why_this_matters",
  "recommended_actions",
] as const;

export type QuestionCopyCsvColumn = (typeof QUESTION_COPY_CSV_COLUMNS)[number];

export type QuestionCopyRow = Record<QuestionCopyCsvColumn, string>;

export const EDITABLE_COPY_FIELDS = [
  "question_text",
  "answer_0",
  "answer_1",
  "answer_2",
  "answer_3",
  "why_this_matters",
  "recommended_actions",
] as const;

export type EditableCopyField = (typeof EDITABLE_COPY_FIELDS)[number];

export function csvCell(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const normalized = String(value);
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function serializeQuestionCopyCsv(rows: QuestionCopyRow[]): string {
  const header = QUESTION_COPY_CSV_COLUMNS.join(",");
  const body = rows.map((row) =>
    QUESTION_COPY_CSV_COLUMNS.map((col) => csvCell(row[col])).join(",")
  );
  return [header, ...body].join("\n") + "\n";
}

export function nullIfBlank(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function parseQuestionCopyCsv(filePath: string): Promise<QuestionCopyRow[]> {
  return new Promise((resolve, reject) => {
    const rows: QuestionCopyRow[] = [];
    createReadStream(filePath)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim() }))
      .on("data", (data: Record<string, string>) => {
        const row = {} as QuestionCopyRow;
        for (const col of QUESTION_COPY_CSV_COLUMNS) {
          row[col] = (data[col] ?? "").trim();
        }
        if (!row.section_id || !row.question_number) {
          return;
        }
        rows.push(row);
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}
