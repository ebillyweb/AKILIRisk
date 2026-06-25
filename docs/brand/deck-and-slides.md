# Decks & Presentations

## Available decks

| Deck | Markdown | PowerPoint |
|------|----------|------------|
| Investor | [pitch-deck-investor.md](../pitch-deck-investor.md) | [Akili-Investor-Deck.pptx](../pitch-decks/Akili-Investor-Deck.pptx) |
| Product | [pitch-deck-product.md](../pitch-deck-product.md) | [Akili-Product-Deck.pptx](../pitch-decks/Akili-Product-Deck.pptx) |

Index: [pitch-deck.md](../pitch-deck.md)

---

## Generate PowerPoint

```bash
npm run generate:pitch-decks
```

Script: `scripts/generate-pitch-deck-pptx.ts`  
Tokens: `src/lib/brand/tokens.ts`

---

## Investor deck layout spec

| Element | Spec |
|---------|------|
| **Aspect ratio** | 16:9 |
| **Title slide background** | `#1A1A2E` (navy deep) |
| **Content slides** | White background |
| **Top accent bar** | 8px `#4EA5D9` full width |
| **Title marker** | 6px `#D97706` left of title |
| **Footer** | Horizontal compact logo + `akilirisk.com` |
| **Title font** | Calibri Light 28pt |
| **Body font** | Calibri 15pt |

---

## Product screenshots (Investor Slide 6)

Drop PNGs into `docs/pitch-decks/screenshots/`:

| File | Panel |
|------|-------|
| `heat-map.png` | Family Governance Score heat map |
| `pipeline.png` | Advisor pipeline |
| `risk-profile.png` | Missing controls & trends |
| `report.png` | Branded PDF report |

Regenerate after adding files. See [screenshots/README.md](../pitch-decks/screenshots/README.md).

---

## Iconic slide: Everything Is Connected

Center hub: **Family Continuity**  
Ring: Governance · Cyber · Estate · Tax · Reputation · Behavior · Security · Liquidity · Geography · Protection

Subtitle: *Traditional planning treats these risks independently. AKILI understands how they interact.*

Built automatically in generated PPTX; reference diagram in investor markdown Slide 7.

---

## Before presenting

- [ ] Replace `$[X]M` raise amount (Slide 15)
- [ ] Fill TAM `$[X]B` / `$[X]T` with sourced figures (Slide 9)
- [ ] Add founder name + photo (Slide 14 — Why We Can Win)
- [ ] Drop product screenshots (Slide 6)
- [ ] Confirm Stripe price points if discussing tiers (Slide 10)

---

## Export for designers

| Asset | Path |
|-------|------|
| Logo SVGs | `logo/*.svg` |
| Logo PNG/JPG | `logo/*.png`, `logo/*-web.jpg` |
| Brand colors | [colors.md](./colors.md) |
| Preview HTML | `logo/logo-export-preview.html` |

For Figma: import SVG lockups; set color styles from logo palette table.
