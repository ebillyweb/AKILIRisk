/**
 * Read the advisor primary CSS variable set by BrandingProvider / theme-utils.
 * Values are space-separated HSL components (e.g. "270 50% 40%").
 */
export async function readAdvisorPrimaryHsl(
  page: import("@playwright/test").Page
): Promise<string | null> {
  const raw = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--advisor-primary")
      .trim()
  );
  if (!raw) return null;
  return raw;
}

/** Convert #RRGGBB to space-separated HSL (matches theme-utils hexToHSL). */
export function hexToHslComponents(hex: string): string | null {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null;

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (diff !== 0) {
    s = diff / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / diff + 2) / 6;
        break;
      case b:
        h = ((r - g) / diff + 4) / 6;
        break;
    }
  }

  const hValue = Math.round(h * 360);
  const sValue = Math.round(s * 100);
  const lValue = Math.round(l * 100);
  return `${hValue} ${sValue}% ${lValue}%`;
}

export function normalizeHslForCompare(hsl: string): string {
  return hsl.replace(/\s+/g, " ").trim();
}
