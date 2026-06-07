/** Full calendar date stored as ISO `YYYY-MM-DD`. */
export type DateQuestionAnswer = string;

/** Month/year stored as ISO `YYYY-MM`. */
export type MonthYearQuestionAnswer = string;

export const STALE_DATE_THRESHOLD_MONTHS = 12;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AVG_DAYS_PER_MONTH = 365.2425 / 12;

/** Parse assessment date answers to UTC for comparisons. */
export function parseAssessmentDateAnswer(
  questionType: string | undefined,
  answer: unknown
): Date | null {
  if (questionType === "date" && isIsoDateAnswer(answer)) {
    const [y, m, d] = answer.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  if (questionType === "month-year" && isIsoMonthYearAnswer(answer)) {
    const [y, m] = answer.split("-").map(Number);
    // Last day of the answered month — avoids flagging the current month too early.
    return new Date(Date.UTC(y, m, 0));
  }
  return null;
}

/**
 * True when the answered date is strictly more than `months` before `now`.
 * Uses an average-month approximation so tests stay deterministic without date-fns.
 */
export function isAssessmentDateOlderThanMonths(
  questionType: string | undefined,
  answer: unknown,
  months: number,
  now: Date = new Date()
): boolean {
  const answeredAt = parseAssessmentDateAnswer(questionType, answer);
  if (!answeredAt) return false;

  const cutoffMs = now.getTime() - months * AVG_DAYS_PER_MONTH * MS_PER_DAY;
  return answeredAt.getTime() < cutoffMs;
}

/** Flag date / month-year answers that are stale for advisor review. */
export function dateAnswerNeedsReviewerAttention(
  questionType: string | undefined,
  answer: unknown,
  now: Date = new Date()
): boolean {
  if (questionType !== "date" && questionType !== "month-year") return false;
  return isAssessmentDateOlderThanMonths(
    questionType,
    answer,
    STALE_DATE_THRESHOLD_MONTHS,
    now
  );
}

/** Month-precision prompts (review cadence), not a specific calendar day. */
export function isMonthYearQuestionText(text: string): boolean {
  const t = text.trim();
  return (
    /\bwhen was the last time\b/i.test(t) ||
    /\bmonth and year\b/i.test(t) ||
    /\bmm\/yyyy\b/i.test(t)
  );
}

/** Fillable prompts that expect a calendar date answer. */
export function isDateQuestionText(text: string): boolean {
  const t = text.trim();
  if (isMonthYearQuestionText(t)) return false;
  return (
    /\bwhen was\b/i.test(t) ||
    /\bwhen is\b/i.test(t) ||
    /\bwhat date\b/i.test(t) ||
    /\bon what date\b/i.test(t) ||
    /\bdate of\b/i.test(t) ||
    /\bwhat is the date\b/i.test(t)
  );
}

export function isIsoDateAnswer(value: unknown): value is DateQuestionAnswer {
  return typeof value === "string" && ISO_DATE.test(value);
}

export function isIsoMonthYearAnswer(value: unknown): value is MonthYearQuestionAnswer {
  return typeof value === "string" && ISO_MONTH.test(value);
}

export function formatDateAnswerForDisplay(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatMonthYearAnswerForDisplay(value: string): string {
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}
