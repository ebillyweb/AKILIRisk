import { describe, expect, it } from "vitest";
import {
  parseQuestionCopyCsv,
  questionCopyKey,
  serializeQuestionCopyCsv,
} from "./csv";
import {
  extractQuestionSeedTuples,
  patchQuestionSeedSql,
  sqlStringLiteral,
  tokenizeSqlTupleValues,
  valuesFromQuestionTokens,
} from "./seed-sql";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("questionCopyKey", () => {
  it("builds stable section/question keys", () => {
    expect(questionCopyKey("00000000-0000-0000-0002-000000000001", "A1")).toBe(
      "00000000-0000-0000-0002-000000000001\tA1"
    );
  });
});

describe("serializeQuestionCopyCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = serializeQuestionCopyCsv([
      {
        section_id: "00000000-0000-0000-0002-000000000001",
        category_code: "1_governance",
        category_name: "Governance",
        section_code: "A",
        question_number: "A1",
        answer_type: "scored_0_3",
        question_text: 'Say "hello", family',
        answer_0: "None",
        answer_1: "",
        answer_2: "",
        answer_3: "",
        why_this_matters: "",
        recommended_actions: "",
      },
    ]);
    expect(csv).toContain('"Say ""hello"", family"');
  });
});

describe("parseQuestionCopyCsv", () => {
  it("round-trips exported csv", async () => {
    const dir = mkdtempSync(join(tmpdir(), "question-copy-"));
    const file = join(dir, "copy.csv");
    const rows = [
      {
        section_id: "00000000-0000-0000-0002-000000000001",
        category_code: "1_governance",
        category_name: "Governance",
        section_code: "A",
        question_number: "A2a",
        answer_type: "fillable",
        question_text: "Please attach copies.",
        answer_0: "",
        answer_1: "",
        answer_2: "",
        answer_3: "",
        why_this_matters: "Validates materials.",
        recommended_actions: "Review documents.",
      },
    ];
    writeFileSync(file, serializeQuestionCopyCsv(rows), "utf8");
    const parsed = await parseQuestionCopyCsv(file);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.question_text).toBe("Please attach copies.");
  });
});

describe("question seed SQL helpers", () => {
  const singleLine =
    "('00000000-0000-0000-0002-000000000001', 'A1', 'How would you describe your family''s mission?', 'scored_0_3', 'No documented mission', 'Verbal only', 'Documented', 'Documented + reviewed', 'Why it matters.', 'Do the thing.', FALSE, NULL, 1)";

  it("parses escaped single-line tuples", () => {
    const tokens = tokenizeSqlTupleValues(singleLine.slice(1, -1));
    const values = valuesFromQuestionTokens(tokens);
    expect(values.questionText).toBe("How would you describe your family's mission?");
    expect(values.answer3).toBe("Documented + reviewed");
  });

  it("extracts tuples from seed-like SQL", () => {
    const sql = `-- comment\nINSERT INTO questions VALUES\n${singleLine},\n${singleLine.replace("'A1'", "'A1a'")};`;
    const tuples = extractQuestionSeedTuples(sql);
    expect(tuples).toHaveLength(2);
    expect(tuples[0]?.values.questionNumber).toBe("A1");
  });

  it("patches copy fields without changing structure", () => {
    const sql = `INSERT VALUES\n${singleLine};`;
    const key = questionCopyKey("00000000-0000-0000-0002-000000000001", "A1");
    const result = patchQuestionSeedSql(
      sql,
      new Map([
        [
          key,
          {
            questionText: "How would you describe your family's governance mission?",
            answer0: "None documented",
          },
        ],
      ])
    );
    expect(result.patched).toBe(1);
    expect(result.sql).toContain(
      sqlStringLiteral("How would you describe your family's governance mission?")
    );
    expect(result.sql).toContain(sqlStringLiteral("None documented"));
    expect(result.sql).not.toContain("No documented mission");
  });
});
