# AKILI Brand Kit

Official brand reference for **AKILI Risk Intelligence** — logos, colors, typography, messaging, and presentation templates.

**Canonical code tokens:** [`src/lib/brand/tokens.ts`](../../src/lib/brand/tokens.ts)

---

## Quick reference

| | |
|---|---|
| **Legal name** | AKILI Risk Intelligence |
| **Primary tagline** | The governance intelligence platform for modern family wealth. |
| **Brand blue** | `#4EA5D9` |
| **Trust accent** | `#D97706` |
| **Navy (text / decks)** | `#1E293B` |
| **Logo font** | IBM Plex Sans |
| **App UI font** | Manrope (+ Cormorant Garamond display) |

---

## Contents

| Doc | Topic |
|-----|--------|
| [colors.md](./colors.md) | Palette, CSS variables, light/dark, deck & PDF |
| [logos.md](./logos.md) | Lockups, file paths, usage rules, clear space |
| [typography.md](./typography.md) | Product UI, logo, decks, email |
| [messaging.md](./messaging.md) | Taglines, voice, key phrases, contacts |
| [deck-and-slides.md](./deck-and-slides.md) | Pitch decks, PowerPoint generation, screenshots |

---

## Asset locations

```
logo/                          # Master SVG + raster exports
public/brand/                  # Web-deployed lockups (app + email)
docs/pitch-decks/              # Generated .pptx decks
docs/pitch-decks/screenshots/ # Product screenshots for Slide 6
src/lib/brand/tokens.ts        # Single source of truth (code)
```

---

## White-label vs. platform brand

**This kit is the AKILI platform brand.** Advisors on Enterprise / Professional tiers may override colors and logos for their client portal. Never mix advisor tenant branding into AKILI marketing materials unless co-branded intentionally.

See [EPIC-5.7 billing & white-label](../user-stories/EPIC-5.7-billing-branding-whitelabel.md).

---

## Regenerate pitch decks

```bash
npm run generate:pitch-decks
```

Uses tokens from `src/lib/brand/tokens.ts` and logos from `logo/`.
