/** Convert browser-local HH:MM to UTC HH:MM for DB storage. */
export function localTimeStringToUtc(localHHMM: string): string {
  const trimmed = localHHMM.trim();
  if (!trimmed) return trimmed;

  const [hours, minutes = "0"] = trimmed.split(":");
  const d = new Date();
  d.setHours(Number(hours), Number(minutes), 0, 0);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Convert stored UTC HH:MM to browser-local HH:MM for form display. */
export function utcTimeStringToLocal(utcHHMM: string): string {
  const trimmed = utcHHMM.trim();
  if (!trimmed) return trimmed;

  const [hours, minutes = "0"] = trimmed.split(":");
  const d = new Date();
  d.setUTCHours(Number(hours), Number(minutes), 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
