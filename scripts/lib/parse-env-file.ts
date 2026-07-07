import { readFileSync } from "node:fs";

/**
 * Read a single KEY=value from a dotenv file without mutating process.env.
 */
export function readEnvFileValue(filePath: string, key: string): string | undefined {
  const raw = readFileSync(filePath, "utf8");
  const prefix = `${key}=`;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith(prefix)) continue;
    let value = trimmed.slice(prefix.length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value || undefined;
  }
  return undefined;
}

export function requireEnvFileValue(filePath: string, key: string): string {
  const value = readEnvFileValue(filePath, key)?.trim();
  if (!value) {
    throw new Error(`${key} is missing in ${filePath}`);
  }
  return value;
}
