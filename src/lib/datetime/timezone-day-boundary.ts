import "server-only";

/** IANA zone for Control Center daily metrics (US Central, DST-aware). */
export const US_CENTRAL_TIMEZONE = "America/Chicago";

function formatYmdInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** UTC instant for the start of `date`'s calendar day in `timeZone`. */
export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const targetYmd = formatYmdInTimeZone(date, timeZone);
  const [y, m, d] = targetYmd.split("-").map(Number);
  const utcAnchor = Date.UTC(y, m - 1, d, 0, 0, 0, 0);

  for (let hourOffset = -12; hourOffset <= 14; hourOffset++) {
    const candidate = new Date(utcAnchor + hourOffset * 3_600_000);
    if (formatYmdInTimeZone(candidate, timeZone) !== targetYmd) continue;
    const previousHour = new Date(candidate.getTime() - 3_600_000);
    if (formatYmdInTimeZone(previousHour, timeZone) < targetYmd) {
      return candidate;
    }
  }

  throw new Error(`Could not resolve start of day for ${targetYmd} in ${timeZone}`);
}

/** Start of the calendar day before `date`'s day in `timeZone`. */
export function startOfPriorDayInTimeZone(date: Date, timeZone: string): Date {
  const startOfToday = startOfDayInTimeZone(date, timeZone);
  return startOfDayInTimeZone(new Date(startOfToday.getTime() - 3_600_000), timeZone);
}
