# Logos

## Lockup variations

| Variant | File | When to use |
|---------|------|-------------|
| **Stacked** | `logo/akili-stacked.svg` | Presentations, letterhead, title slides, large displays |
| **Horizontal compact** | `logo/akili-horizontal-compact.svg` | Headers, footers, nav, deck footer |
| **Trademark only** | `logo/akili-trademark-only.svg` | Minimal contexts, tight signatures |
| **Email lockup** | `public/brand/akili-email-lockup.png` | HTML email (PNG — Gmail blocks SVG) |

Web copies also live in `public/brand/`.

---

## Raster exports

Generate from SVG via:

```bash
cd logo && node convert-to-jpg.js
```

| Export | DPI | Use |
|--------|-----|-----|
| `*-web.jpg` | 72 | Web, decks embedded in PPTX |
| `*.jpg` (full) | 300 | Print |

Preview all variants: open `logo/logo-export-preview.html` in a browser.

---

## Clear space

Maintain minimum clear space equal to **the height of the radar icon** on all sides. No text, rules, or other marks inside this zone.

On stacked lockups, the icon height is roughly **22% of total lockup height**.

---

## Minimum sizes

| Variant | Digital min width | Print min width |
|---------|-------------------|-----------------|
| Stacked | 120 px | 1.25 in |
| Horizontal compact | 160 px | 1.5 in |
| Trademark only | 100 px | 1 in |

Below these sizes, use **trademark only** or icon-only context if available.

---

## Backgrounds

| Background | Recommended lockup |
|------------|-------------------|
| White / off-white | Full color SVG (default) |
| Navy `#1A1A2E` | Full color — radar reads well on dark |
| Photography | Place on solid overlay; don't place directly on busy images |
| Advisor-branded portal | Advisor logo primary; AKILI "Powered by" footer optional |

---

## Trademark

Include **®** on the wordmark when space allows (`akili-trademark-only.svg` includes it).

Legal entity: **AKILI Risk Intelligence**

---

## Do / Don't

**Do**
- Use official files from `logo/` or `public/brand/`
- Preserve aspect ratio when scaling
- Use horizontal compact in deck footers and email headers

**Don't**
- Stretch, rotate, or add effects (shadows, outlines) to the lockup
- Change radar polygon colors independently of brand palette
- Recreate the logo in a different typeface

---

## Co-branding (enterprise white-label)

Enterprise clients (e.g. Belvedere) use **their** logo on client-facing portals. AKILI platform mark appears as "Powered by AkiliRisk Platform" in the footer when appropriate — not on investor or platform marketing materials unless co-branded by agreement.
