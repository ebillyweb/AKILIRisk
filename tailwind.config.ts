/**
 * Tailwind v4 applies utilities from CSS (`src/app/globals.css`).
 * Class-based dark mode is implemented there via `@custom-variant dark`.
 * This file keeps `darkMode: "class"` explicit for tooling and team conventions.
 */
const config = {
  darkMode: "class" as const,
};

export default config;
