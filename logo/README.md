# AKILI Risk Intelligence - Logo Variations

This folder contains the official logo variations for AKILI Risk Intelligence, featuring a professional radar chart design that represents risk assessment and intelligence analysis.

## Logo Variations

### 1. Stacked Version (`akili-stacked.svg`)
- **Use case**: Business cards, letterheads, presentations, large displays
- **Layout**: Icon at top, "AKILI" in middle, "Risk Intelligence" at bottom
- **Dimensions**: 200×280px
- **Best for**: Vertical layouts, formal documents

### 2. Horizontal Compact (`akili-horizontal-compact.svg`)
- **Use case**: Website headers, email signatures, navigation bars
- **Layout**: Icon + "AKILI" text only (no "Risk Intelligence")
- **Dimensions**: 300×80px
- **Best for**: Horizontal layouts, digital interfaces

### 3. Trademark Only (`akili-trademark-only.svg`)
- **Use case**: Minimal usage, text signatures, favicon contexts
- **Layout**: "AKILI" text with ® trademark symbol only
- **Dimensions**: 180×60px
- **Best for**: Space-constrained contexts, text-based usage

## Design Features

- **Professional radar chart icon** with concentric rings and data visualization
- **IBM Plex Sans typography** for enterprise credibility
- **Semantic color system** with CSS variables for light/dark mode support
- **Risk assessment data polygon** showing intelligence capability
- **Registered trademark symbol** (®) for brand protection

## Color Palette

- **Brand Primary**: #4EA5D9 (light) / #7DD3FC (dark)
- **Trust Accent**: #D97706 (light) / #F59E0B (dark)
- **Foreground**: #1e293b (light) / #f1f5f9 (dark)
- **Muted Text**: #64748b (light) / #94a3b8 (dark)

## File Formats

### SVG Files (Vector)
- Scalable to any size without quality loss
- Perfect for web, print, and large displays
- Support dark/light mode theming
- Editable in design tools

### JPG Generation
To create JPG versions, use one of these methods:

1. **Automated Script** (Recommended):
   ```bash
   npm install sharp
   node convert-to-jpg.js
   ```

2. **Online Converters**:
   - convertio.co
   - cloudconvert.com

3. **Design Tools**:
   - Open SVG in Figma/Illustrator/Sketch
   - Export as JPG at desired resolution

4. **Command Line** (if ImageMagick installed):
   ```bash
   convert akili-stacked.svg akili-stacked.jpg
   ```

## Usage Guidelines

### Print Materials
- Use high-resolution versions (300 DPI)
- Ensure minimum clear space around logo
- Maintain aspect ratios when scaling

### Digital Use
- Use web-optimized versions (72-96 DPI)
- Test in both light and dark modes
- Ensure readability at small sizes

### Brand Consistency
- Always use official logo files
- Don't modify colors, proportions, or spacing
- Include ® trademark symbol when space allows
- Use appropriate variation for context

## File Preview

Open `logo-export-preview.html` in a browser to:
- View all logo variations
- Test dark/light mode versions
- Export individual logos as images
- Reference usage guidelines

## Support

For logo files and export tooling, see this folder. For the full brand kit (colors, typography, messaging, decks), see **[docs/brand/README.md](../docs/brand/README.md)**.

Canonical code tokens: **`src/lib/brand/tokens.ts`**