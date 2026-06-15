export const LEGAL_ENTITY_NAME = "AKILI Risk Intelligence";
export const LEGAL_CONTACT_EMAIL = "privacy@akilirisk.com";
export const LEGAL_LAST_UPDATED = "2026-05-22";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
}

const templateNotice: LegalSection = {
  id: "template-notice",
  title: "Important notice",
  paragraphs: [
    "This document is a template for legal review. It is not counsel-approved and may be updated before final publication.",
    `Questions about these policies may be directed to ${LEGAL_CONTACT_EMAIL}.`,
  ],
};

export const termsOfServiceSections: LegalSection[] = [
  templateNotice,
  {
    id: "agreement",
    title: "Agreement to terms",
    paragraphs: [
      `By accessing or using the ${LEGAL_ENTITY_NAME} platform ("Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.`,
      "If you use the Service on behalf of an organization, you represent that you have authority to bind that organization to these terms.",
    ],
  },
  {
    id: "description",
    title: "Description of service",
    paragraphs: [
      `${LEGAL_ENTITY_NAME} provides a digital governance risk assessment platform for families, advisors, and related professionals. Features may include structured questionnaires, scoring, recommendations, document workflows, and advisor-client collaboration tools.`,
      "We may modify, suspend, or discontinue features with reasonable notice where practicable.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts and eligibility",
    paragraphs: [
      "Client accounts are typically created through advisor invitation. You are responsible for maintaining the confidentiality of sign-in links and credentials and for all activity under your account.",
      "You must provide accurate information and promptly update it when it changes. We may suspend or terminate accounts that violate these terms or pose security risk.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: [
      "You agree not to misuse the Service, including attempting unauthorized access, interfering with platform operation, uploading malicious code, or using the Service in violation of applicable law.",
      "You will not scrape, reverse engineer, or resell access to the Service except as expressly permitted in writing.",
    ],
  },
  {
    id: "assessment-data",
    title: "Assessment and client data",
    paragraphs: [
      "Assessment responses and related outputs may be visible to your assigned advisor and authorized platform administrators according to product configuration and consent settings.",
      "You retain ownership of content you submit. You grant us a limited license to host, process, and display that content solely to operate and improve the Service.",
    ],
  },
  {
    id: "ip",
    title: "Intellectual property and confidentiality",
    paragraphs: [
      "The Service, including software, branding, and documentation, is owned by us or our licensors and protected by intellectual property laws.",
      "Confidential information shared through the Service should be handled according to your advisory relationship and applicable agreements between you and your advisor.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    paragraphs: [
      "The Service provides governance risk assessment tools and informational outputs. It does not constitute legal, tax, investment, or fiduciary advice.",
      "Recommendations and scores are aids to discussion with qualified professionals and should not be relied on as sole basis for decisions.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    paragraphs: [
      'To the maximum extent permitted by law, the Service is provided "as is" without warranties of any kind, whether express or implied.',
      "We are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill arising from use of the Service.",
    ],
  },
  {
    id: "termination",
    title: "Termination",
    paragraphs: [
      "You may stop using the Service at any time. We may suspend or terminate access for breach of these terms, legal requirements, or operational necessity.",
      "Provisions that by nature should survive termination (including disclaimers, limitations of liability, and dispute terms) will survive.",
    ],
  },
  {
    id: "changes",
    title: "Changes to these terms",
    paragraphs: [
      "We may update these Terms from time to time. Material changes will be indicated by updating the 'Last updated' date on this page.",
      "Continued use after changes become effective constitutes acceptance of the revised Terms.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing law",
    paragraphs: [
      "These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict-of-law principles, unless otherwise required by mandatory local law.",
      "Disputes will be resolved in the courts located in Delaware, unless applicable law requires a different forum.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      `For questions about these Terms, contact ${LEGAL_ENTITY_NAME} at ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
];

export const privacyPolicySections: LegalSection[] = [
  {
    id: "template-notice",
    title: "Important notice",
    paragraphs: [
      "This Privacy Policy is a template for legal review. It is not counsel-approved and may be updated before final publication.",
      `Questions about privacy practices may be directed to ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
  {
    id: "introduction",
    title: "Introduction",
    paragraphs: [
      `${LEGAL_ENTITY_NAME} ("we," "us," or "our") respects your privacy. This policy describes how we collect, use, disclose, and protect personal information when you use our personal risk profile platform.`,
      "This policy applies to the public website, authenticated application, and related services we operate.",
    ],
  },
  {
    id: "information-collected",
    title: "Information we collect",
    paragraphs: [
      "Account information such as name, email address, role, and authentication events.",
      "Assessment and intake responses, advisor assignments, consent preferences, and generated reports or recommendations.",
      "Technical data including device type, browser, IP address, logs, and security-related signals used to protect the platform.",
      "Communications you send to us, such as support requests or lead form submissions.",
    ],
  },
  {
    id: "how-we-use",
    title: "How we use information",
    paragraphs: [
      "To provide, secure, and maintain the Service, including scoring, reporting, and advisor-client workflows.",
      "To authenticate users, enforce access controls, detect fraud or abuse, and comply with legal obligations.",
      "To improve product quality, troubleshoot issues, and communicate service-related notices.",
      "Where permitted, to respond to inquiries and send operational messages about your account or assessment.",
    ],
  },
  {
    id: "sharing",
    title: "Sharing and processors",
    paragraphs: [
      "We share information with your assigned advisor and authorized administrators as required to deliver the Service.",
      "We use infrastructure and service providers (for example hosting, email, analytics, and payment processors) under contracts that limit use to providing services to us.",
      "We may disclose information when required by law, to protect rights and safety, or in connection with a merger, acquisition, or asset sale subject to appropriate safeguards.",
    ],
  },
  {
    id: "security",
    title: "Security",
    paragraphs: [
      "We implement administrative, technical, and organizational measures designed to protect personal information, including encryption in transit and access controls.",
      "No method of transmission or storage is completely secure. You are responsible for safeguarding credentials and sign-in links sent to you.",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    paragraphs: [
      "We retain personal information for as long as needed to provide the Service, meet legal obligations, resolve disputes, and enforce agreements.",
      "Retention periods may vary by data type and your relationship with an advisor. You may request deletion subject to applicable exceptions.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights",
    paragraphs: [
      "Depending on your location, you may have rights to access, correct, delete, or restrict processing of your personal information, and to object to certain processing.",
      "To exercise rights, contact us at the email below. We may verify your identity before responding.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and analytics",
    paragraphs: [
      "We use cookies and similar technologies for authentication, security, preferences, and basic usage analytics.",
      "You can control cookies through browser settings. Disabling certain cookies may affect Service functionality.",
    ],
  },
  {
    id: "children",
    title: "Children's privacy",
    paragraphs: [
      "The Service is not directed to children under 16, and we do not knowingly collect personal information from children without appropriate authorization.",
      "If you believe we have collected information from a child improperly, contact us so we can take appropriate action.",
    ],
  },
  {
    id: "policy-changes",
    title: "Policy changes",
    paragraphs: [
      "We may update this Privacy Policy from time to time. Material changes will be reflected by updating the 'Last updated' date on this page.",
      "We encourage you to review this policy periodically.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      `For privacy questions or requests, contact ${LEGAL_ENTITY_NAME} at ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
];
