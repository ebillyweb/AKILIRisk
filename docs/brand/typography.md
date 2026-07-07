# Typography

## Logo & wordmark

| Element | Typeface | Notes |
|---------|----------|-------|
| **AKILI wordmark** | IBM Plex Sans | Semibold; bundled in SVG |
| **Risk Intelligence subline** | IBM Plex Sans | Regular, smaller cap height |

Logo SVGs embed font references — do not re-typeset the wordmark in other fonts.

---

## Product UI (web app)

Loaded in `src/app/layout.tsx`:

| Role | Font | CSS variable | Use |
|------|------|--------------|-----|
| **UI sans** | [Manrope](https://fonts.google.com/specimen/Manrope) | `--font-manrope` | Body, buttons, forms, nav |
| **Display** | [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) | `--font-cormorant` | Hero headlines, editorial moments |
| **Mono** | Geist Mono | `--font-geist-mono` | Code, IDs, technical labels |

### UI patterns

| Class / pattern | Style |
|-----------------|-------|
| `.editorial-kicker` | Uppercase, tracked label above section titles |
| `.hero-surface` | Large display type on gradient card surfaces |
| Page titles | `font-semibold tracking-tight` (Manrope) |

---

## Pitch decks & PowerPoint

PowerPoint lacks Manrope/Cormorant by default on all systems. Generated decks use:

| Role | Font | Fallback |
|------|------|----------|
| Titles | Calibri Light | Arial |
| Body | Calibri | Arial |

For **custom designed** decks in Figma/Keynote, prefer:

- **Titles:** Cormorant Garamond or IBM Plex Sans Light
- **Body:** Manrope or IBM Plex Sans

---

## PDF reports

React-PDF uses system fonts registered in PDF components. Default platform PDFs follow navy/zinc palette in `enhanced-styles.ts` — body text `#374151`, headings `#1a1a2e`.

When advisor branding is active, PDF headings may use advisor `primaryColor`.

---

## Email

HTML emails use system sans stack with inline styles:

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

Headlines may use brand blue `#4EA5D9`; body `#374151`.

---

## Hierarchy (marketing)

| Level | Size guidance | Weight |
|-------|---------------|--------|
| H1 / hero | 2rem–3.25rem | Semibold (display) or Bold |
| H2 / slide title | 1.75rem–2rem | Bold |
| Kicker | 0.75rem–0.875rem | Medium, uppercase, wide tracking |
| Body | 1rem / 16px | Regular |
| Caption | 0.75rem–0.875rem | Regular, muted color |

---

## Do / Don't

**Do**
- Use Cormorant for one hero line per page — not every heading
- Keep body copy in Manrope for readability
- Use tabular nums for scores (`font-variant-numeric: tabular-nums`)

**Don't**
- Use logo IBM Plex for long body paragraphs in app UI
- Mix more than two type families on one slide
- Use all-caps for sentences (kickers only)
