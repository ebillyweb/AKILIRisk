# Colors

## Logo palette (official lockup)

Used in the radar icon, email lockups, and pitch decks. **Do not substitute the editorial UI `--brand` token for logo blue.**

| Role | Light | Dark | Usage |
|------|-------|------|--------|
| **Brand primary** | `#4EA5D9` | `#7DD3FC` | Radar rings, links, deck accent bar |
| **Trust accent** | `#D97706` | `#F59E0B` | Highlights, callouts, secondary emphasis |
| **Foreground** | `#1e293b` | `#f1f5f9` | Headlines on light backgrounds |
| **Muted** | `#64748b` | `#94a3b8` | Body secondary, captions |
| **Border** | `#e2e8f0` | `#334155` | Dividers, table borders |

CSS variables (`src/app/globals.css`):

```css
--logo-brand-primary: #4ea5d9;
--logo-trust-accent: #d97706;
--logo-foreground: #1e293b;
--logo-muted-foreground: #64748b;
--logo-border: #e2e8f0;
```

---

## UI palette (product)

Warm editorial neutrals with oklch tokens in `globals.css`. Used for app chrome, cards, and dashboards — distinct from logo blue.

| Token | Purpose |
|-------|---------|
| `--background` / `--foreground` | Page base |
| `--primary` | Buttons, key actions |
| `--brand` / `--trust-accent` | Editorial accents (not logo radar) |
| `--muted` / `--muted-foreground` | Secondary surfaces and text |
| `--destructive` | Errors, critical risk |

Use **logo palette** for external/marketing; **UI tokens** for in-app screens.

---

## Deck & presentation

| Role | Hex | Use |
|------|-----|-----|
| Navy | `#1E293B` | Slide titles, table headers |
| Navy deep | `#1A1A2E` | Title slide & closing backgrounds |
| Brand blue | `#4EA5D9` | Top accent bar, links, diagram nodes |
| Trust accent | `#D97706` | Title marker, traction banner, moat callouts |
| Off-white | `#F8FAFC` | Content slide background alt, diagram fills |
| Muted | `#64748B` | Subtitles, footnotes |

Defined in code as `AKILI_DECK_COLORS` in [`src/lib/brand/tokens.ts`](../../src/lib/brand/tokens.ts).

---

## PDF reports (default platform)

When no advisor branding is applied:

| Role | Hex |
|------|-----|
| Primary | `#1a1a2e` |
| Secondary | `#16213e` |
| Accent | `#10b981` |
| Text | `#374151` |
| Border | `#e5e7eb` |

Source: `src/lib/pdf/enhanced-styles.ts`

---

## Email

| Role | Value |
|------|--------|
| Brand blue | `#4EA5D9` |
| Trust accent | `#D97706` |
| CTA background | `#18181b` |
| Header gradient | `linear-gradient(145deg,#1e293b 0%,#0f172a 55%,#172554 100%)` |

Source: `src/lib/email/platform-brand.ts` (imports from brand tokens).

---

## Do / Don't

**Do**
- Use `#4EA5D9` for AKILI logo contexts and investor materials
- Test lockups on both white and `#1A1A2E` backgrounds
- Use trust accent sparingly — one focal element per slide

**Don't**
- Recolor the radar icon or wordmark
- Use advisor tenant colors in AKILI corporate decks
- Mix logo blue with unrelated blues (e.g. default Bootstrap `#0d6efd`)
