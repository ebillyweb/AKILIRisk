import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_NAME,
  type LegalSection,
} from "@/lib/legal/documents";

export const CONTACT_EMAIL = "hello@akilirisk.com";

export const aboutUsHeroDescription =
  "We help modern family wealth operate with clearer governance—before informal structures become costly disputes.";

export const contactUsHeroDescription = `Use the form to reach our team, or email us at ${CONTACT_EMAIL}. We typically respond within two business days.`;

export const aboutUsSections: LegalSection[] = [
  {
    id: "mission",
    title: "Our mission",
    paragraphs: [
      `${LEGAL_ENTITY_NAME} helps modern family wealth operate with clearer governance—before informal structures become costly disputes.`,
      "We believe legacy survives through governance, not assumption. Our platform gives families and advisors a structured way to surface risks, align decision frameworks, and act with intention.",
    ],
  },
  {
    id: "ethos",
    title: "Our ethos",
    paragraphs: [
      "Governance requires clarity, not assumption.",
      "Wealth grows through investment. Legacy survives through governance.",
      "Families often operate with informal decision structures that work — until they don't.",
      "This assessment identifies governance gaps across succession planning, authority structure, and family decision frameworks so they can be addressed proactively.",
    ],
  },
  {
    id: "what-we-do",
    title: "What we do",
    paragraphs: [
      "We provide a discreet digital personal risk profile that identifies structural gaps across succession planning, authority, and family decision-making.",
      "Advisors use the platform to guide clients through a consistent interview, scoring, and recommendation workflow—so governance conversations are evidence-based, not anecdotal.",
    ],
  },
  {
    id: "who-we-serve",
    title: "Who we serve",
    paragraphs: [
      "Family offices and multi-generational households seeking continuity intelligence.",
      "Wealth advisors who want governance guidance alongside financial planning.",
      "Family leadership teams strengthening decision frameworks and succession readiness.",
    ],
  },
];

export const contactUsSections: LegalSection[] = [
  {
    id: "clients",
    title: "Clients and assessments",
    paragraphs: [
      "If you are completing a personal risk profile, contact your assigned advisor first—they manage your invitation and account access.",
      "Include the email address on your account when asking about sign-in links or access issues.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy and legal",
    paragraphs: [
      `For privacy requests or questions about our policies, contact ${LEGAL_CONTACT_EMAIL}.`,
      "See our Privacy Policy and Terms of Service for full details on data handling and platform use.",
    ],
  },
];
