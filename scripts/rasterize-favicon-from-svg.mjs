/**
 * Rasterize public/favicon.svg to PNGs. Sharp/libvips does not resolve SVG
 * var(--*) / prefers-color-scheme; this script inlines the light palette from
 * the SVG's :root block, then resizes with sharp.
 *
 * Usage: node scripts/rasterize-favicon-from-svg.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const svgPath = path.join(root, 'public/favicon.svg')

const BRAND = '#4EA5D9'
const TRUST = '#D97706'
const BG = '#ffffff'

let svg = fs.readFileSync(svgPath, 'utf8')

const flattenedDefs = `<defs>
    <style>
      .brand-primary { fill: ${BRAND}; }
      .trust-accent { fill: ${TRUST}; stroke: ${TRUST}; }
      .background { fill: ${BG}; }
    </style>
  </defs>`

svg = svg.replace(/<defs>[\s\S]*?<\/defs>/, flattenedDefs)
svg = svg.replace(/var\(--brand-primary\)/g, BRAND)
svg = svg.replace(/var\(--trust-accent\)/g, TRUST)
svg = svg.replace(/var\(--background\)/g, BG)

const buf = Buffer.from(svg)

await sharp(buf).resize(1024, 1024).png().toFile(path.join(root, 'public/favicon.png'))
await sharp(buf).resize(512, 512).png().toFile(path.join(root, 'public/favicon-512.png'))

console.log('Wrote public/favicon.png (1024) and public/favicon-512.png (512)')
