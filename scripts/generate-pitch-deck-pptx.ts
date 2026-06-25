/**
 * Generate branded AKILI pitch deck PowerPoint files from markdown content.
 *
 * Usage: npx tsx scripts/generate-pitch-deck-pptx.ts
 * Output: docs/pitch-decks/Akili-Investor-Deck.pptx
 *         docs/pitch-decks/Akili-Product-Deck.pptx
 */

import fs from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import {
  AKILI_BRAND,
  AKILI_DECK_COLORS,
  AKILI_LOGO_ASSETS,
  AKILI_TAGLINES,
  AKILI_TYPOGRAPHY,
} from "../src/lib/brand/tokens";

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "pitch-decks");
const SCREENSHOT_DIR = path.join(OUT_DIR, "screenshots");
const LOGO_STACKED = path.join(ROOT, AKILI_LOGO_ASSETS.stackedWebJpg);
const LOGO_HORIZONTAL = path.join(ROOT, AKILI_LOGO_ASSETS.horizontalPng);

/** Deck colors from brand tokens (pptxgenjs expects hex without `#`). */
const C = AKILI_DECK_COLORS;

const FONT = AKILI_TYPOGRAPHY.deckBody;
const FONT_TITLE = AKILI_TYPOGRAPHY.deckTitle;

type SlideOpts = {
  title: string;
  subtitle?: string;
  dark?: boolean;
};

function ensureAssets() {
  for (const p of [LOGO_STACKED, LOGO_HORIZONTAL]) {
    if (!fs.existsSync(p)) {
      throw new Error(`Missing brand asset: ${p}`);
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function addFooter(slide: PptxGenJS.Slide, dark = false) {
  slide.addShape("rect", {
    x: 0,
    y: 5.15,
    w: 10,
    h: 0.35,
    fill: { color: dark ? C.navyDeep : C.offWhite },
    line: { color: dark ? C.navyDeep : C.offWhite, width: 0 },
  });
  slide.addImage({
    path: LOGO_HORIZONTAL,
    x: 0.35,
    y: 5.2,
    w: 1.35,
    h: 0.28,
  });
  slide.addText(AKILI_BRAND.website, {
    x: 8.2,
    y: 5.22,
    w: 1.4,
    h: 0.25,
    fontSize: 9,
    color: dark ? C.brandBlue : C.muted,
    align: "right",
    fontFace: FONT,
  });
}

function addAccentBar(slide: PptxGenJS.Slide, dark = false) {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 10,
    h: 0.08,
    fill: { color: C.brandBlue },
    line: { color: C.brandBlue, width: 0 },
  });
  if (!dark) {
    slide.addShape("rect", {
      x: 0.35,
      y: 0.55,
      w: 0.06,
      h: 0.55,
      fill: { color: C.trustAccent },
      line: { color: C.trustAccent, width: 0 },
    });
  }
}

function addContentHeader(slide: PptxGenJS.Slide, opts: SlideOpts) {
  slide.background = { color: opts.dark ? C.navy : C.white };
  addAccentBar(slide, opts.dark);
  const titleColor = opts.dark ? C.white : C.navy;
  const subColor = opts.dark ? C.brandBlue : C.muted;

  slide.addText(opts.title, {
    x: 0.55,
    y: 0.45,
    w: 8.9,
    h: 0.75,
    fontSize: 28,
    bold: true,
    color: titleColor,
    fontFace: FONT_TITLE,
    valign: "top",
  });

  if (opts.subtitle) {
    slide.addText(opts.subtitle, {
      x: 0.55,
      y: 1.15,
      w: 8.9,
      h: 0.4,
      fontSize: 14,
      color: subColor,
      fontFace: FONT,
      italic: true,
    });
  }

  addFooter(slide, opts.dark);
}

function addBullets(
  slide: PptxGenJS.Slide,
  items: string[],
  y = 1.65,
  opts: { fontSize?: number; color?: string; boldLead?: boolean } = {},
) {
  const fontSize = opts.fontSize ?? 15;
  const color = opts.color ?? C.navy;

  const rows = items.map((text) => {
    const colon = text.indexOf(":");
    if (opts.boldLead && colon > 0 && colon < 40) {
      return {
        text,
        options: {
          bullet: true,
          fontSize,
          color,
          fontFace: FONT,
          breakLine: true,
        },
      };
    }
    return {
      text,
      options: { bullet: true, fontSize, color, fontFace: FONT, breakLine: true },
    };
  });

  slide.addText(rows, {
    x: 0.55,
    y,
    w: 8.9,
    h: 5.5 - y,
    valign: "top",
    paraSpaceAfter: 8,
  });
}

function addTable(
  slide: PptxGenJS.Slide,
  headers: string[],
  rows: string[][],
  y = 1.55,
) {
  const tableRows: PptxGenJS.TableRow[] = [
    headers.map((h) => ({
      text: h,
      options: {
        bold: true,
        color: C.white,
        fill: { color: C.navy },
        fontSize: 11,
        fontFace: FONT,
        valign: "middle" as const,
      },
    })),
    ...rows.map((row, i) =>
      row.map((cell) => ({
        text: cell,
        options: {
          fontSize: 10,
          color: C.navy,
          fill: { color: i % 2 === 0 ? C.offWhite : C.white },
          fontFace: FONT,
          valign: "top" as const,
        },
      })),
    ),
  ];

  slide.addTable(tableRows, {
    x: 0.45,
    y,
    w: 9.1,
    colW: headers.map(() => 9.1 / headers.length),
    border: { type: "solid", color: C.lightBorder, pt: 0.5 },
    autoPage: false,
  });
}

function titleSlide(pres: PptxGenJS, lines: { main: string; sub: string; tag?: string }) {
  const slide = pres.addSlide();
  slide.background = { color: C.navyDeep };
  addAccentBar(slide, true);

  slide.addImage({
    path: LOGO_STACKED,
    x: 3.1,
    y: 0.85,
    w: 3.8,
    h: 2.2,
  });

  slide.addText(lines.main, {
    x: 0.6,
    y: 3.15,
    w: 8.8,
    h: 0.9,
    fontSize: 22,
    color: C.white,
    align: "center",
    fontFace: FONT_TITLE,
    italic: true,
  });

  if (lines.tag) {
    slide.addText(lines.tag, {
      x: 0.6,
      y: 4.05,
      w: 8.8,
      h: 0.55,
      fontSize: 14,
      color: C.brandBlue,
      align: "center",
      fontFace: FONT,
    });
  }

  slide.addText(lines.sub, {
    x: 0.6,
    y: 4.75,
    w: 8.8,
    h: 0.4,
    fontSize: 11,
    color: C.muted,
    align: "center",
    fontFace: FONT,
  });

  addFooter(slide, true);
}

function workflowDiagram(slide: PptxGenJS.Slide, y = 1.55) {
  const steps = [
    "Discovery",
    "Assessment",
    "Insights",
    "Recommendations",
    "Action Plan",
    "Monitoring",
  ];
  const boxW = 1.35;
  const gap = 0.12;
  const startX = 0.35;

  steps.forEach((label, i) => {
    const x = startX + i * (boxW + gap);
    slide.addShape("roundRect", {
      x,
      y,
      w: boxW,
      h: 0.55,
      fill: { color: i === steps.length - 1 ? C.trustAccent : C.brandBlue },
      line: { color: C.navy, width: 0 },
      rectRadius: 0.08,
    });
    slide.addText(label, {
      x,
      y: y + 0.08,
      w: boxW,
      h: 0.4,
      fontSize: 9,
      bold: true,
      color: C.white,
      align: "center",
      fontFace: FONT,
    });
    if (i < steps.length - 1) {
      slide.addText("→", {
        x: x + boxW,
        y: y + 0.1,
        w: gap,
        h: 0.35,
        fontSize: 12,
        color: C.muted,
        align: "center",
      });
    }
  });

  slide.addShape("arc", {
    x: 3.2,
    y: y + 0.75,
    w: 3.6,
    h: 0.45,
    line: { color: C.brandBlue, width: 1.5, dashType: "dash" },
  });
  slide.addText("annual reassessment · trend alerts", {
    x: 3.2,
    y: y + 1.15,
    w: 3.6,
    h: 0.3,
    fontSize: 9,
    color: C.muted,
    align: "center",
    italic: true,
    fontFace: FONT,
  });
}

function pillarWheel(slide: PptxGenJS.Slide) {
  const pillars = [
    "Governance",
    "Cyber & Digital",
    "Physical Security",
    "Protection & Risk Transfer",
    "Geographic & Environmental",
    "Reputation & Social",
    "Liquidity & Cash",
    "Tax Exposure",
    "Estate & Succession",
    "Behavioral Resilience",
  ];

  // Center hub
  slide.addShape("ellipse", {
    x: 4.05,
    y: 2.35,
    w: 1.9,
    h: 1.9,
    fill: { color: C.navy },
    line: { color: C.brandBlue, width: 2 },
  });
  slide.addText("10\nPillars", {
    x: 4.05,
    y: 2.75,
    w: 1.9,
    h: 1.1,
    fontSize: 16,
    bold: true,
    color: C.white,
    align: "center",
    valign: "middle",
    fontFace: FONT,
  });

  const cx = 5;
  const cy = 3.3;
  const radius = 2.35;

  pillars.forEach((label, i) => {
    const angle = (i / pillars.length) * 2 * Math.PI - Math.PI / 2;
    const x = cx + radius * Math.cos(angle) - 0.55;
    const y = cy + radius * Math.sin(angle) - 0.22;

    slide.addShape("roundRect", {
      x,
      y,
      w: 1.1,
      h: 0.44,
      fill: { color: i % 2 === 0 ? C.brandBlue : C.offWhite },
      line: { color: C.brandBlue, width: 0.75 },
      rectRadius: 0.05,
    });
    slide.addText(label, {
      x,
      y: y + 0.06,
      w: 1.1,
      h: 0.32,
      fontSize: 6.5,
      bold: true,
      color: i % 2 === 0 ? C.white : C.navy,
      align: "center",
      fontFace: FONT,
    });

    slide.addShape("line", {
      x: cx,
      y: cy,
      w: x + 0.55 - cx,
      h: y + 0.22 - cy,
      line: { color: C.lightBorder, width: 0.75 },
    });
  });
}

function connectedDomainsDiagram(slide: PptxGenJS.Slide) {
  const domains = [
    "Governance",
    "Cyber",
    "Estate",
    "Tax",
    "Reputation",
    "Behavior",
    "Security",
    "Liquidity",
    "Geography",
    "Protection",
  ];

  const cx = 5;
  const cy = 3.05;
  const radius = 2.05;

  slide.addShape("ellipse", {
    x: cx - 1.05,
    y: cy - 1.05,
    w: 2.1,
    h: 2.1,
    fill: { color: C.navy },
    line: { color: C.trustAccent, width: 2.5 },
  });
  slide.addText("Family\nContinuity", {
    x: cx - 1.05,
    y: cy - 0.45,
    w: 2.1,
    h: 0.9,
    fontSize: 14,
    bold: true,
    color: C.white,
    align: "center",
    valign: "middle",
    fontFace: FONT,
  });

  const points: Array<{ x: number; y: number; label: string }> = [];
  domains.forEach((label, i) => {
    const angle = (i / domains.length) * 2 * Math.PI - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push({ x, y, label });

    slide.addShape("line", {
      x: cx,
      y: cy,
      w: x - cx,
      h: y - cy,
      line: { color: C.brandBlue, width: 1.25 },
    });

    slide.addShape("ellipse", {
      x: x - 0.42,
      y: y - 0.22,
      w: 0.84,
      h: 0.44,
      fill: { color: C.offWhite },
      line: { color: C.brandBlue, width: 1 },
    });
    slide.addText(label, {
      x: x - 0.42,
      y: y - 0.16,
      w: 0.84,
      h: 0.32,
      fontSize: 7,
      bold: true,
      color: C.navy,
      align: "center",
      fontFace: FONT,
    });
  });

  // Cross-connections between adjacent and key domains
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    slide.addShape("line", {
      x: points[i].x,
      y: points[i].y,
      w: next.x - points[i].x,
      h: next.y - points[i].y,
      line: { color: C.lightBorder, width: 0.75, dashType: "dash" },
    });
  }
  const g = points[0];
  const c = points[1];
  const e = points[2];
  for (const [a, b] of [
    [g, c],
    [c, e],
    [e, points[3]],
  ] as const) {
    slide.addShape("line", {
      x: a.x,
      y: a.y,
      w: b.x - a.x,
      h: b.y - a.y,
      line: { color: C.trustAccent, width: 1, dashType: "sysDot" },
    });
  }
}

function demoScreenshotGrid(slide: PptxGenJS.Slide, y = 1.35) {
  const shots = [
    { label: "Heat Map", sub: "Family Governance Score", file: "heat-map.png" },
    { label: "Advisor Pipeline", sub: "Intake → deliverables", file: "pipeline.png" },
    { label: "Risk Profile", sub: "Missing controls & trends", file: "risk-profile.png" },
    { label: "Branded Report", sub: "Client-ready PDF", file: "report.png" },
  ];
  const w = 4.25;
  const h = 1.65;
  const gap = 0.35;

  shots.forEach((shot, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.55 + col * (w + gap);
    const sy = y + row * (h + 0.25);
    const imagePath = path.join(SCREENSHOT_DIR, shot.file);
    const hasImage = fs.existsSync(imagePath);

    slide.addShape("roundRect", {
      x,
      y: sy,
      w,
      h,
      fill: { color: hasImage ? C.white : C.offWhite },
      line: { color: C.brandBlue, width: hasImage ? 1 : 1.5, dashType: hasImage ? "solid" : "dash" },
      rectRadius: 0.1,
    });

    if (hasImage) {
      slide.addImage({ path: imagePath, x: x + 0.05, y: sy + 0.05, w: w - 0.1, h: h - 0.35 });
      slide.addText(shot.label, {
        x,
        y: sy + h - 0.28,
        w,
        h: 0.22,
        fontSize: 9,
        bold: true,
        color: C.navy,
        align: "center",
        fontFace: FONT,
      });
    } else {
      slide.addText(`${shot.label}\n[screenshot]`, {
        x,
        y: sy + 0.35,
        w,
        h: 0.7,
        fontSize: 16,
        bold: true,
        color: C.navy,
        align: "center",
        fontFace: FONT_TITLE,
      });
      slide.addText(shot.sub, {
        x,
        y: sy + 1.1,
        w,
        h: 0.35,
        fontSize: 11,
        color: C.muted,
        align: "center",
        fontFace: FONT,
      });
    }
  });
}

function buildInvestorDeck(): PptxGenJS {
  const pres = new PptxGenJS();
  pres.author = AKILI_BRAND.legalName;
  pres.company = AKILI_BRAND.legalName;
  pres.subject = "Investor Deck";
  pres.title = `${AKILI_BRAND.legalName} — Investor Deck`;
  pres.layout = "LAYOUT_16x9";

  titleSlide(pres, {
    main: AKILI_TAGLINES.platform,
    sub: `Investor Deck · ${AKILI_BRAND.website}`,
  });

  // Slide 2 — Problem
  {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: "The Problem" });
    slide.addText("Financial planning manages assets.\nNobody manages family risk.", {
      x: 0.55,
      y: 1.55,
      w: 8.9,
      h: 1.2,
      fontSize: 26,
      bold: true,
      color: C.navy,
      fontFace: FONT_TITLE,
    });
    slide.addText(
      "Families spend millions protecting their wealth — advisors, insurance, estate counsel, cybersecurity — but almost nothing measuring the operational risks that actually destroy it.",
      {
        x: 0.55,
        y: 2.85,
        w: 8.9,
        h: 1.5,
        fontSize: 16,
        color: C.muted,
        fontFace: FONT,
      },
    );
  }

  // Slide 3 — Story
  {
    const slide = pres.addSlide();
    addContentHeader(slide, {
      title: "When Everything Fails Operationally",
      subtitle: "Imagine a wealthy family. $40M net worth. Everything appears perfect.",
    });
    addBullets(slide, [
      "Dad dies unexpectedly",
      "No one knows who has signing authority",
      "The password manager is inaccessible",
      "The successor trustee doesn't know they're the trustee",
      "The family business stalls; children disagree over distributions",
      "The financial advisor wasn't included",
    ]);
    slide.addText("Nothing failed financially. Everything failed operationally.", {
      x: 0.55,
      y: 4.55,
      w: 8.9,
      h: 0.5,
      fontSize: 16,
      bold: true,
      color: C.trustAccent,
      fontFace: FONT,
    });
  }

  // Slide 4 — Why Now
  {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: "Why Now?" });
    addTable(
      slide,
      ["Force", "Why it matters"],
      [
        ["Largest intergenerational wealth transfer", "Trillions moving to unprepared heirs"],
        ["Rising cybercrime vs. affluent families", "HNW households are high-value targets"],
        ["AI-driven fraud & impersonation", "Social engineering scales faster than vigilance"],
        ["Advisor commoditization", "Differentiation beyond portfolio returns"],
        ["Estate complexity increasing", "Trusts, entities, digital assets, multi-jurisdiction"],
        ["Family offices growing rapidly", "Institutional governance without in-house build"],
      ],
      1.45,
    );
    slide.addText(
      "The window is open for a new category between financial planning and family continuity.",
      { x: 0.55, y: 4.85, w: 8.9, h: 0.4, fontSize: 12, bold: true, color: C.navy, fontFace: FONT },
    );
  }

  // Slide 5 — Solution
  {
    const slide = pres.addSlide();
    addContentHeader(slide, {
      title: "Governance Intelligence Platform",
      subtitle:
        "Traditional assessments generate reports. AKILI creates a living system of record for family governance.",
    });
    addTable(
      slide,
      ["", ""],
      [
        ["Remembers", "Household structure, roles, history, prior assessments"],
        ["Measures", "Posture across 10 risk domains with transparent scoring"],
        ["Tracks", "Change over time — not a one-time PDF in a drawer"],
        ["Compares", "Portfolio-wide patterns across an advisor's client book"],
        ["Connects", "Advisors, families, and deliverables in one workflow"],
        ["Creates continuity", "Discovery through action — and ongoing monitoring"],
      ],
      1.75,
    );
    slide.addText("We sell confidence, not questionnaires.", {
      x: 0.55,
      y: 4.85,
      w: 8.9,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: C.brandBlue,
      fontFace: FONT,
    });
  }

  // Slide 6 — Product demo (visual-first)
  {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: "Product", subtitle: "Show, don't tell." });
    demoScreenshotGrid(slide);
  }

  // Slide 7 — Everything is connected
  {
    const slide = pres.addSlide();
    addContentHeader(slide, {
      title: "Everything Is Connected",
      subtitle:
        "Traditional planning treats these risks independently. AKILI understands how they interact.",
    });
    connectedDomainsDiagram(slide);
  }

  // Slide 8 — 10 pillars
  {
    const slide = pres.addSlide();
    addContentHeader(slide, {
      title: "10-Pillar Framework",
      subtitle: "Shipped today · Family Governance Score",
    });
    pillarWheel(slide);
    slide.addText("Advisors scope 1–10 pillars per engagement.", {
      x: 0.55,
      y: 4.85,
      w: 8.9,
      h: 0.35,
      fontSize: 12,
      color: C.muted,
      align: "center",
      fontFace: FONT,
    });
  }

  // Slide 9 — Market + TAM
  {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: "Market", subtitle: "Beachhead: wealth advisors & RIAs serving HNW households" });
    addTable(
      slide,
      ["Market", "Scale"],
      [
        ["WealthTech", "$[X]B global — advisor digitization"],
        ["Intergenerational transfer", "$[X]T transferring (US, next decade)"],
        ["RIA-managed assets", "$[X]T+ under advisory"],
        ["HNW cybersecurity", "$[X]B protecting digital & financial exposure"],
      ],
      1.45,
    );
    addTable(
      slide,
      ["Segment", "Opportunity"],
      [
        ["~300K+ financial advisors (US)", "Differentiation beyond AUM"],
        ["~10K+ family offices (global)", "Standardize governance across generations"],
        ["Enterprise advisory firms", "White-label governance intelligence"],
      ],
      3.35,
    );
  }

  // Slide 10 — Business model
  {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: "Business Model", subtitle: "SaaS — advisor and firm subscriptions" });
    addTable(
      slide,
      ["Tier", "Clients", "Buyer"],
      [
        ["Starter", "25", "Solo advisor"],
        ["Growth", "50", "Small practice"],
        ["Professional", "100", "Established firm + branding"],
        ["Enterprise", "Negotiated", "Multi-advisor firms (sales-assisted)"],
      ],
      1.55,
    );
    addBullets(
      slide,
      [
        "Monthly / annual billing (Stripe live)",
        "Tier upgrades · enterprise seats · monitoring & reassessment · white-label",
      ],
      3.85,
      { fontSize: 12 },
    );
  }

  // Slide 11 — Why We're Different
  {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: "Why We're Different" });
    addTable(
      slide,
      ["", "Traditional planning", "AKILI"],
      [
        ["Focus", "Portfolio & assets", "Whole-family risk"],
        ["Format", "Static PDFs", "Living intelligence platform"],
        ["Cadence", "Episodic", "Continuous monitoring"],
        ["Scope", "Financial", "Governance + cyber + estate + 7 more"],
        ["Outcome", "Reports", "Confidence — Family Governance Score"],
      ],
      1.55,
    );
    slide.addText("The moat isn't the pillar list.", {
      x: 0.55,
      y: 4.35,
      w: 8.9,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: C.navy,
      fontFace: FONT,
    });
    slide.addText(
      "The system of record for family governance — the platform that compounds with every engagement.",
      { x: 0.55, y: 4.65, w: 8.9, h: 0.45, fontSize: 13, bold: true, color: C.trustAccent, fontFace: FONT },
    );
  }

  // Slide 12 — Traction
  {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: "Traction", subtitle: "The product is live. We are not pitching a roadmap." });
    slide.addShape("roundRect", {
      x: 0.55,
      y: 1.45,
      w: 8.9,
      h: 0.65,
      fill: { color: C.trustAccent },
      line: { color: C.trustAccent, width: 0 },
      rectRadius: 0.08,
    });
    slide.addText("Belvedere — first enterprise client · production white-label deployment", {
      x: 0.7,
      y: 1.58,
      w: 8.6,
      h: 0.4,
      fontSize: 14,
      bold: true,
      color: C.white,
      fontFace: FONT,
    });
    addTable(
      slide,
      ["Built & shipped", ""],
      [
        ["10 production pillars", "Full methodology catalog"],
        ["150+ questions", "Platform bank, advisor-customizable"],
        ["Advisor portal", "Pipeline, intelligence, facilitated sessions"],
        ["Enterprise + white-label", "Multi-seat, branded subdomains, Stripe billing"],
        ["AI-assisted intake", "Audio interview + transcription"],
      ],
      2.25,
    );
  }

  // Slide 13 — Roadmap & AI
  {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: "Roadmap & AI", subtitle: "Governance intelligence platform → category infrastructure" });
    addTable(
      slide,
      ["Phase", "What"],
      [
        ["Now (shipped)", "10-pillar assessment, advisor workflow, white-label, enterprise, billing"],
        ["Next", "Cross-pillar AI insights · action plans · continuity scoring"],
        ["Platform", "Living records · policy mgmt · continuous monitoring"],
      ],
      1.55,
    );
    slide.addShape("roundRect", {
      x: 0.55,
      y: 3.55,
      w: 8.9,
      h: 1.15,
      fill: { color: C.offWhite },
      line: { color: C.brandBlue, width: 1.5 },
      rectRadius: 0.1,
    });
    slide.addText("Household Risk Insight", {
      x: 0.75,
      y: 3.7,
      w: 8.5,
      h: 0.3,
      fontSize: 13,
      bold: true,
      color: C.navy,
      fontFace: FONT,
    });
    slide.addText(
      "High cyber risk combined with concentrated ownership and no documented successor increases business continuity risk by 42%.",
      {
        x: 0.75,
        y: 4.05,
        w: 8.5,
        h: 0.55,
        fontSize: 12,
        color: C.muted,
        italic: true,
        fontFace: FONT,
      },
    );
  }

  // Slide 14 — Why We Can Win
  {
    const slide = pres.addSlide();
    addContentHeader(slide, {
      title: "Why We Can Win",
      subtitle: "Founder-market fit — built with practitioners, shipped in production.",
    });
    addBullets(slide, [
      "25+ years building enterprise software and leading engineering organizations",
      "CTO of Habits — scaled AI products and enterprise SaaS",
      "Built alongside practitioners — real advisor and family-office workflows",
      "Enterprise platform live — white-label, multi-seat, billing, first enterprise client deployed",
    ], 1.75);
    slide.addText(
      "We combine enterprise platform depth with domain practitioners — and we've already shipped what most startups only pitch.",
      { x: 0.55, y: 4.45, w: 8.9, h: 0.55, fontSize: 13, bold: true, color: C.trustAccent, fontFace: FONT },
    );
  }

  // Slide 15 — The Ask
  {
    const slide = pres.addSlide();
    slide.background = { color: C.navyDeep };
    addAccentBar(slide, true);
    slide.addImage({ path: LOGO_STACKED, x: 3.4, y: 0.55, w: 3.2, h: 1.85 });
    slide.addText("The Ask", {
      x: 0.6,
      y: 2.45,
      w: 8.8,
      h: 0.45,
      fontSize: 32,
      bold: true,
      color: C.white,
      align: "center",
      fontFace: FONT_TITLE,
    });
    slide.addText(
      "We're raising $[X]M to become the governance intelligence platform powering the next generation of wealth advisory.",
      {
        x: 0.75,
        y: 3.05,
        w: 8.5,
        h: 0.75,
        fontSize: 16,
        color: C.brandBlue,
        align: "center",
        fontFace: FONT,
      },
    );
    addTable(
      slide,
      ["", ""],
      [
        ["Raising", "$[X]M Seed / Pre-Seed"],
        ["Outcome", "Category leadership — system of record for family governance"],
        ["Milestones", "[X] enterprise firms · [Y] households · [Z] ARR"],
        ["Contact", "hello@akilirisk.com"],
      ],
      3.95,
    );
    addFooter(slide, true);
  }

  return pres;
}

function buildProductDeck(): PptxGenJS {
  const pres = new PptxGenJS();
  pres.author = AKILI_BRAND.legalName;
  pres.company = AKILI_BRAND.legalName;
  pres.subject = "Product Deck";
  pres.title = `${AKILI_BRAND.legalName} — Product Deck`;
  pres.layout = "LAYOUT_16x9";

  titleSlide(pres, {
    main: AKILI_TAGLINES.product,
    tag: "10-pillar family risk framework · live in production",
    sub: `Product Deck · ${AKILI_BRAND.website}`,
  });

  const slides: Array<{ title: string; subtitle?: string; bullets?: string[]; table?: { h: string[]; r: string[][] }; extra?: (s: PptxGenJS.Slide) => void }> = [
    {
      title: "Mission",
      bullets: [
        "Legacy survives through governance, not assumption.",
        "AKILI helps modern family wealth operate with clearer governance — before informal structures become costly disputes.",
        "We give families and advisors a structured way to surface risks, align decision frameworks, and act with intention.",
      ],
    },
    {
      title: "The Problem We Solve",
      subtitle: "Wealth is managed. Governance is assumed.",
      bullets: [
        "HNW families rarely have a systematic view of non-financial risk",
        "Advisors lack a repeatable way to surface governance, cyber, succession, and continuity gaps",
        "When structures fail, cost is measured in disputes and lost legacy — not basis points",
        "Families need one coherent risk profile, not scattered conversations",
      ],
    },
    {
      title: "What AKILI Delivers",
      subtitle: "Family Risk Intelligence™",
      bullets: [
        "Surfaces structural gaps across 10 risk pillars",
        "Scores household posture with transparent, weighted algorithms",
        "Prioritizes missing controls and remediation actions",
        "Delivers advisor-ready reports, policy templates, and recommendations",
        "Tracks progress over time — living intelligence, not a one-time PDF",
      ],
    },
    {
      title: "How It Works",
      extra: (s) => {
        workflowDiagram(s, 1.45);
        addBullets(
          s,
          [
            "Discovery: branded invitation, secure onboarding, AI-assisted intake",
            "Assessment: advisor-scoped pillars (1–10), emphasis weighting",
            "Insights → Recommendations → Action plan → Monitoring",
            "Typical engagement: 12–15 minutes per pillar",
          ],
          2.95,
          { fontSize: 12 },
        );
      },
    },
    {
      title: "Dual Experience",
      table: {
        h: ["Advisors", "Families"],
        r: [
          ["Multi-client pipeline & portfolio intelligence", "Secure magic-link access & MFA"],
          ["Pillar scoping, facilitated sessions", "Guided intake & scoped assessment"],
          ["White-label subdomains & branded reports", "Household profiles & branded dashboard"],
          ["Enterprise: team seats & firm billing", "Documents, policies, advisor visibility"],
        ],
      },
    },
    {
      title: "10-Pillar Framework",
      subtitle: "Shipped today. Ten domains. One household profile.",
      extra: (s) => pillarWheel(s),
    },
    {
      title: "Advisor Workflow",
      table: {
        h: ["Stage", "Capability"],
        r: [
          ["Acquire", "Branded invitations, white-label subdomains"],
          ["Discover", "Audio intake + transcription; advisor review"],
          ["Customize", "Pillar scope, emphasis, intake waivers"],
          ["Assess", "Facilitated or self-service; auto-save"],
          ["Deliver", "PDF reports, policy templates, documents"],
          ["Manage", "Pipeline, notifications, intelligence"],
        ],
      },
    },
    {
      title: "Intelligence & Deliverables",
      bullets: [
        "Composite risk score (0–10) across all 10 pillars",
        "Risk heat map with trend tracking",
        "Missing controls ranked by severity",
        "Automated recommendations mapped to services",
        "Policy templates & branded PDF reports",
        "AI-assisted intake: audio + transcription",
      ],
    },
    {
      title: "Built for Trust",
      table: {
        h: ["Control", "Implementation"],
        r: [
          ["Authentication", "TOTP MFA, magic-link access, RBAC"],
          ["Encryption", "AES-256-GCM; presigned S3 document uploads"],
          ["Isolation", "Row-level data isolation; advisor–client enforcement"],
          ["Compliance", "Consent workflows, audit logging, PII controls"],
        ],
      },
    },
    {
      title: "Who We Serve",
      table: {
        h: ["Segment", "Need"],
        r: [
          ["Wealth advisors & RIAs", "Governance alongside financial planning"],
          ["Multi-family offices", "Standardized assessment across the book"],
          ["Family leadership", "Succession readiness & decision frameworks"],
          ["Enterprise firms", "White-label, team seats, firm client limits"],
        ],
      },
    },
    {
      title: "Business Model",
      table: {
        h: ["Tier", "Clients", "Target"],
        r: [
          ["Starter", "25", "Solo advisors"],
          ["Growth", "50", "Small practices"],
          ["Professional", "100", "Established firms"],
          ["Enterprise", "Negotiated", "Multi-advisor firms"],
        ],
      },
    },
    {
      title: "Product Status",
      subtitle: "Live in production today",
      bullets: [
        "Belvedere — first enterprise client on white-label platform",
        "10-pillar framework · 150+ questions · full advisor lifecycle",
        "Scoring engine, enterprise architecture, Stripe billing",
        "In flight: composite scoring, cross-pillar AI insights, action plans",
      ],
    },
    {
      title: "Platform Vision",
      bullets: [
        "Risk assessment is the first application",
        "Living family governance records & decision logs",
        "Annual reassessments & continuous monitoring",
        "Policy management, document vault, AI-guided planning",
        "Cross-generational continuity infrastructure",
      ],
    },
  ];

  for (const def of slides) {
    const slide = pres.addSlide();
    addContentHeader(slide, { title: def.title, subtitle: def.subtitle });
    if (def.table) addTable(slide, def.table.h, def.table.r, def.subtitle ? 1.65 : 1.55);
    if (def.bullets) addBullets(slide, def.bullets, def.subtitle ? 1.75 : 1.65);
    def.extra?.(slide);
  }

  // Get Started — closing
  {
    const slide = pres.addSlide();
    slide.background = { color: C.navyDeep };
    addAccentBar(slide, true);
    slide.addImage({ path: LOGO_STACKED, x: 3.4, y: 0.85, w: 3.2, h: 1.85 });
    slide.addText("Get Started", {
      x: 0.6,
      y: 2.85,
      w: 8.8,
      h: 0.5,
      fontSize: 32,
      bold: true,
      color: C.white,
      align: "center",
      fontFace: FONT_TITLE,
    });
    addTable(
      slide,
      ["Audience", "Next step"],
      [
        ["Advisors", "akilirisk.com/contact?intent=demo"],
        ["Enterprise firms", "sales@akilirisk.com"],
        ["General inquiries", "hello@akilirisk.com"],
      ],
      3.55,
    );
    addFooter(slide, true);
  }

  return pres;
}

async function main() {
  ensureAssets();

  const investor = buildInvestorDeck();
  const product = buildProductDeck();

  const investorPath = path.join(OUT_DIR, "Akili-Investor-Deck.pptx");
  const productPath = path.join(OUT_DIR, "Akili-Product-Deck.pptx");

  await investor.writeFile({ fileName: investorPath });
  await product.writeFile({ fileName: productPath });

  console.log(`✅ Investor deck: ${investorPath}`);
  console.log(`✅ Product deck:  ${productPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
