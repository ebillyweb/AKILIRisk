import { readFileSync, writeFileSync } from "fs";

export type QuestionSeedValues = {
  sectionId: string;
  questionNumber: string;
  questionText: string;
  answerType: string;
  answer0: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
  whyThisMatters: string | null;
  recommendedActions: string | null;
  isSubQuestion: boolean;
  crossReference: string | null;
  displayOrder: number;
  isVisible?: boolean;
};

export type QuestionSeedTuple = {
  key: string;
  values: QuestionSeedValues;
  start: number;
  end: number;
  raw: string;
  multiline: boolean;
};

type SqlScalar = string | number | boolean | null;

function skipWhitespace(input: string, index: number): number {
  while (index < input.length && /\s/.test(input[index]!)) index++;
  return index;
}

function readSqlString(input: string, start: number): { value: string; next: number } {
  if (input[start] !== "'") {
    throw new Error(`Expected string literal at index ${start}`);
  }
  let value = "";
  let i = start + 1;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === "'") {
      if (input[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      return { value, next: i + 1 };
    }
    value += ch;
    i++;
  }
  throw new Error("Unterminated SQL string literal");
}

export function tokenizeSqlTupleValues(inner: string): SqlScalar[] {
  const tokens: SqlScalar[] = [];
  let i = skipWhitespace(inner, 0);

  while (i < inner.length) {
    i = skipWhitespace(inner, i);
    if (i >= inner.length) break;

    if (inputStartsWithKeyword(inner, i, "NULL")) {
      tokens.push(null);
      i += 4;
    } else if (inputStartsWithKeyword(inner, i, "TRUE")) {
      tokens.push(true);
      i += 4;
    } else if (inputStartsWithKeyword(inner, i, "FALSE")) {
      tokens.push(false);
      i += 5;
    } else if (inner[i] === "'") {
      const parsed = readSqlString(inner, i);
      tokens.push(parsed.value);
      i = parsed.next;
    } else if (/[-0-9]/.test(inner[i]!)) {
      const match = inner.slice(i).match(/^-?\d+/);
      if (!match) throw new Error(`Invalid numeric token near index ${i}`);
      tokens.push(Number(match[0]));
      i += match[0].length;
    } else {
      throw new Error(`Unexpected token near index ${i}: ${inner.slice(i, i + 20)}`);
    }

    i = skipWhitespace(inner, i);
    if (inner[i] === ",") {
      i++;
      continue;
    }
    if (i < inner.length) {
      throw new Error(`Expected comma after token near index ${i}`);
    }
  }

  return tokens;
}

function inputStartsWithKeyword(input: string, index: number, keyword: string): boolean {
  return input.slice(index, index + keyword.length).toUpperCase() === keyword;
}

function asString(value: SqlScalar): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string value, got ${String(value)}`);
  }
  return value;
}

function asNullableString(value: SqlScalar): string | null {
  if (value === null) return null;
  return asString(value);
}

function asBoolean(value: SqlScalar): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean value, got ${String(value)}`);
  }
  return value;
}

function asNumber(value: SqlScalar): number {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric value, got ${String(value)}`);
  }
  return value;
}

export function valuesFromQuestionTokens(tokens: SqlScalar[]): QuestionSeedValues {
  if (tokens.length !== 13 && tokens.length !== 14) {
    throw new Error(`Expected 13 or 14 question columns, got ${tokens.length}`);
  }

  const base: QuestionSeedValues = {
    sectionId: asString(tokens[0]),
    questionNumber: asString(tokens[1]),
    questionText: asString(tokens[2]),
    answerType: asString(tokens[3]),
    answer0: asNullableString(tokens[4]),
    answer1: asNullableString(tokens[5]),
    answer2: asNullableString(tokens[6]),
    answer3: asNullableString(tokens[7]),
    whyThisMatters: asNullableString(tokens[8]),
    recommendedActions: asNullableString(tokens[9]),
    isSubQuestion: asBoolean(tokens[10]),
    crossReference: asNullableString(tokens[11]),
    displayOrder: asNumber(tokens[12]),
  };

  if (tokens.length === 14) {
    base.isVisible = asBoolean(tokens[13]);
  }

  return base;
}

export function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function sqlNullableString(value: string | null | undefined): string {
  if (value == null || value === "") return "NULL";
  return sqlStringLiteral(value);
}

export function serializeQuestionTokens(values: QuestionSeedValues): SqlScalar[] {
  const tokens: SqlScalar[] = [
    values.sectionId,
    values.questionNumber,
    values.questionText,
    values.answerType,
    values.answer0,
    values.answer1,
    values.answer2,
    values.answer3,
    values.whyThisMatters,
    values.recommendedActions,
    values.isSubQuestion,
    values.crossReference,
    values.displayOrder,
  ];
  if (values.isVisible !== undefined) {
    tokens.push(values.isVisible);
  }
  return tokens;
}

function serializeSingleLineTuple(values: QuestionSeedValues): string {
  const tokens = serializeQuestionTokens(values);
  const rendered = tokens
    .map((token) => {
      if (token === null) return "NULL";
      if (typeof token === "boolean") return token ? "TRUE" : "FALSE";
      if (typeof token === "number") return String(token);
      return sqlStringLiteral(token);
    })
    .join(", ");
  return `(${rendered})`;
}

function serializeMultilineTuple(values: QuestionSeedValues): string {
  const lines = [
    "(",
    `    ${sqlStringLiteral(values.sectionId)}, ${sqlStringLiteral(values.questionNumber)},`,
    `    ${sqlStringLiteral(values.questionText)},`,
    `    ${sqlStringLiteral(values.answerType)},`,
    `    ${sqlNullableString(values.answer0)}, ${sqlNullableString(values.answer1)}, ${sqlNullableString(values.answer2)}, ${sqlNullableString(values.answer3)},`,
    `    ${sqlNullableString(values.whyThisMatters)},`,
    `    ${sqlNullableString(values.recommendedActions)},`,
    `    ${values.isSubQuestion ? "TRUE" : "FALSE"}, ${values.crossReference ? sqlStringLiteral(values.crossReference) : "NULL"}, ${values.displayOrder}`,
  ];
  if (values.isVisible !== undefined) {
    lines[lines.length - 1] += `, ${values.isVisible ? "TRUE" : "FALSE"}`;
  }
  lines.push(")");
  return lines.join("\n");
}

export function serializeQuestionTuple(values: QuestionSeedValues, multiline: boolean): string {
  return multiline ? serializeMultilineTuple(values) : serializeSingleLineTuple(values);
}

const SECTION_UUID = "00000000-0000-0000";

export function extractQuestionSeedTuples(sql: string): QuestionSeedTuple[] {
  const tuples: QuestionSeedTuple[] = [];
  let searchFrom = 0;

  while (searchFrom < sql.length) {
    const start = sql.indexOf("(", searchFrom);
    if (start < 0) break;

    const preview = sql.slice(start, start + 80);
    if (!preview.includes(`'${SECTION_UUID}`)) {
      searchFrom = start + 1;
      continue;
    }

    let depth = 0;
    let inString = false;
    let end = -1;

    for (let i = start; i < sql.length; i++) {
      const ch = sql[i]!;
      if (inString) {
        if (ch === "'") {
          if (sql[i + 1] === "'") {
            i++;
            continue;
          }
          inString = false;
        }
        continue;
      }

      if (ch === "'") {
        inString = true;
        continue;
      }
      if (ch === "(") depth++;
      if (ch === ")") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end < 0) break;

    const raw = sql.slice(start, end + 1);
    const inner = raw.slice(1, -1);
    try {
      const tokens = tokenizeSqlTupleValues(inner);
      const values = valuesFromQuestionTokens(tokens);
      if (!values.sectionId.startsWith(SECTION_UUID)) {
        searchFrom = end + 1;
        continue;
      }
      tuples.push({
        key: `${values.sectionId}\t${values.questionNumber}`,
        values,
        start,
        end: end + 1,
        raw,
        multiline: raw.includes("\n"),
      });
    } catch {
      // Not a question tuple (e.g. categories/sections INSERT).
    }

    searchFrom = end + 1;
  }

  return tuples;
}

export type SeedCopyPatch = Partial<
  Pick<
    QuestionSeedValues,
    | "questionText"
    | "answer0"
    | "answer1"
    | "answer2"
    | "answer3"
    | "whyThisMatters"
    | "recommendedActions"
  >
>;

export function patchQuestionSeedSql(
  sql: string,
  updates: Map<string, SeedCopyPatch>
): { sql: string; patched: number; missedKeys: string[] } {
  const tuples = extractQuestionSeedTuples(sql);
  if (tuples.length === 0) {
    return { sql, patched: 0, missedKeys: [...updates.keys()] };
  }

  let patched = 0;
  let output = "";
  let cursor = 0;

  for (const tuple of tuples) {
    output += sql.slice(cursor, tuple.start);
    const patch = updates.get(tuple.key);
    if (patch) {
      const nextValues: QuestionSeedValues = {
        ...tuple.values,
        ...patch,
      };
      output += serializeQuestionTuple(nextValues, tuple.multiline);
      updates.delete(tuple.key);
      patched++;
    } else {
      output += tuple.raw;
    }
    cursor = tuple.end;
  }

  output += sql.slice(cursor);
  return { sql: output, patched, missedKeys: [...updates.keys()] };
}

export function patchQuestionSeedFile(
  seedPath: string,
  updates: Map<string, SeedCopyPatch>
): { patched: number; missedKeys: string[] } {
  const original = readFileSync(seedPath, "utf8");
  const result = patchQuestionSeedSql(original, updates);
  if (result.patched > 0) {
    writeFileSync(seedPath, result.sql, "utf8");
  }
  return { patched: result.patched, missedKeys: result.missedKeys };
}
