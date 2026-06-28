export type FieldHelpContent = {
  title: string;
  description: string;
};

/** Contextual help for configuration form fields (recommendation rules + catalog). */
export const FIELD_HELP = {
  "rule-service": {
    title: "Service recommendation",
    description:
      "The catalog service surfaced in the client's action plan when this rule matches. Pick the offering that best addresses the situation you're targeting.",
  },
  "rule-name": {
    title: "Rule name",
    description:
      "A short internal label your team will recognize in lists and reports. Clients usually see the linked service name, not this rule name.",
  },
  "rule-description": {
    title: "Description",
    description:
      "Optional notes for admins and advisors. Helpful when several rules point at similar services.",
  },
  "rule-trigger-conditions": {
    title: "When should this rule fire?",
    description:
      "Add one or more checks. The rule matches when more than half of the total importance weight is satisfied — so heavier checks count more toward a match.",
  },
  "rule-pillar-thresholds": {
    title: "Pillar score ranges",
    description:
      "Optional reference ranges for documentation. These do not change whether the rule fires today; use trigger conditions for matching logic.",
  },
  "rule-priority": {
    title: "Priority",
    description:
      "When several rules match, higher priority surfaces first in the action plan. Use 1 for nice-to-have suggestions and larger numbers for urgent items.",
  },
  "rule-active": {
    title: "Active",
    description:
      "Inactive rules stay on file but are not evaluated for new assessments. Turn off instead of deleting when you might need the rule again.",
  },
  "condition-type": {
    title: "Check type",
    description:
      "Pillar score and risk level use assessment results. Intake answer and missing control inspect specific questions. Household profile is for advanced profile-field comparisons.",
  },
  "condition-pillar": {
    title: "Pillar",
    description:
      "The risk area whose score or risk label this check evaluates — for example Cyber & Digital or Family Governance.",
  },
  "condition-comparison": {
    title: "Comparison",
    description:
      "How the client's value should compare to your threshold — below, above, exactly, or one of several options.",
  },
  "condition-score-value": {
    title: "Score value",
    description:
      "Resilience scores use a 0–3 scale (higher is better). Example: \"below 1.8\" targets clients who scored weakly on that pillar.",
  },
  "condition-risk-levels": {
    title: "Risk level",
    description:
      "Platform labels for pillar results: Low, Medium, High, or Critical. Pick one level or several when using \"is one of\".",
  },
  "condition-question": {
    title: "Question",
    description:
      "The intake or assessment question this check inspects. Search by pillar or question text, or enter a legacy question ID manually.",
  },
  "condition-answer": {
    title: "Expected answer",
    description:
      "The answer value that should satisfy this check. For scored questions, pick from the list; for free-form answers, type the expected text or number.",
  },
  "condition-profile-field": {
    title: "Profile field",
    description:
      "Advanced: compare a household profile field (e.g. householdSize) against your value. Use only when you know the field name exposed in assessments.",
  },
  "condition-importance": {
    title: "Importance",
    description:
      "Weight from 1 (optional) to 10 (critical). Rules match when satisfied checks account for more than half of the total weight across all checks.",
  },
  "threshold-pillar": {
    title: "Pillar",
    description: "Which risk area this reference range documents.",
  },
  "threshold-min-max": {
    title: "Min / max score",
    description:
      "Document the score band you consider relevant for this rule. Does not affect engine matching.",
  },
  "service-name": {
    title: "Name",
    description:
      "Client-facing title for this service in recommendations and action plans. Keep it action-oriented (e.g. \"Enable MFA on email\").",
  },
  "service-description": {
    title: "Description",
    description:
      "What the client should do and why it reduces risk. Shown when advisors or clients review the recommendation.",
  },
  "service-category": {
    title: "Category",
    description:
      "Groups services in the catalog (e.g. cyber, governance). Helps advisors filter and organize offerings.",
  },
  "service-tier": {
    title: "Tier",
    description:
      "Baseline services are standard recommendations; Enhanced indicates a higher-touch or premium offering.",
  },
  "service-complexity": {
    title: "Complexity",
    description: "How hard this is for a typical household to implement — guides prioritization in action plans.",
  },
  "service-implementation-type": {
    title: "Implementation type",
    description:
      "DIY means the client can self-serve; Advisory needs professional help; Hybrid is a mix.",
  },
  "service-priority": {
    title: "Priority",
    description:
      "Default sort order in the catalog when multiple services could apply. Higher numbers surface first.",
  },
  "service-estimated-cost": {
    title: "Estimated cost",
    description: "Optional ballpark for advisors and clients (e.g. \"$500–$2,000\" or \"Included with advisor\").",
  },
  "service-timeframe": {
    title: "Timeframe",
    description: "How long implementation typically takes (e.g. \"1–2 weeks\" or \"Ongoing\").",
  },
  "service-provider": {
    title: "Provider",
    description: "Who delivers this service — the advisor, a vendor, or the client themselves.",
  },
  "service-active": {
    title: "Active",
    description: "Inactive services stay in the catalog but cannot be linked to new rules.",
  },
  "advisor-rule-active": {
    title: "Active for new intakes",
    description:
      "When off, this rule is ignored for clients who start intake after you save. In-flight clients keep their snapshotted rules.",
  },

  // Admin — score cutoffs
  "threshold-low-min": {
    title: "In good shape (low risk)",
    description:
      "Minimum score (0–100) labeled low risk. Must be the highest cutoff. Example: 80 means scores 80+ are in good shape.",
  },
  "threshold-medium-min": {
    title: "Needs attention (medium)",
    description:
      "Minimum score for medium risk. Must be lower than the low-risk line. Scores from here up to (low − 1) are medium.",
  },
  "threshold-high-min": {
    title: "Concerning (high risk)",
    description:
      "Minimum score for high risk. Scores from here up to (medium − 1) are high. Everything below this line is urgent.",
  },

  // Admin — password policy
  "password-min-length": {
    title: "Minimum length",
    description:
      "Shortest password advisors and admins may use. Changing rules bumps the policy revision and prompts affected staff to update on next sign-in.",
  },
  "password-uppercase": {
    title: "Uppercase letter",
    description: "Require at least one capital letter (A–Z) in new passwords.",
  },
  "password-number": {
    title: "Number",
    description: "Require at least one digit (0–9) in new passwords.",
  },
  "password-special": {
    title: "Special character",
    description: "Require at least one symbol (e.g. !, @, #) in new passwords.",
  },
  "password-compliance-notice": {
    title: "Compliance notice",
    description:
      "Shown to staff who must update their password after a policy change. Explain why they are being asked to reset.",
  },

  // Admin — advisor feature flags
  "flag-governance-dashboard": {
    title: "Governance dashboard",
    description:
      "Family portfolio metrics and analytics under /advisor/dashboard and /advisor/analytics. When off, nav links hide and routes redirect to Clients.",
  },
  "flag-risk-intelligence": {
    title: "Risk intelligence",
    description:
      "Portfolio risk views under /advisor/intelligence. When off, nav links hide and routes redirect to Clients.",
  },
  "flag-workflow-tasks": {
    title: "Workflow tasks",
    description: "Shows Tasks in the advisor Workflow nav. Leave off until the tasks workspace is ready.",
  },
  "flag-workflow-follow-ups": {
    title: "Workflow follow-ups",
    description:
      "Shows Follow-ups in the advisor Workflow nav. Leave off until the follow-ups workspace is ready.",
  },

  // Admin — intake question edit
  "intake-question-text": {
    title: "Question text",
    description: "Spoken aloud during the client audio interview. Keep it conversational and easy to answer on a recording.",
  },
  "intake-why-this-matters": {
    title: "Why we ask",
    description:
      "Optional context for advisors and clients. Also used as spoken preamble when set.",
  },
  "intake-recording-tips": {
    title: "Recording tips",
    description:
      "Shown before the client records. Enter one tip per line (e.g. \"Speak clearly\", \"Include examples\").",
  },
  "intake-related-pillars": {
    title: "Related assessment pillars",
    description:
      "Helps suggest which risk domains to include when an advisor approves intake. Select zero or more pillars.",
  },
  "intake-display-order": {
    title: "Order in script",
    description: "Lower numbers appear earlier within the same section of the live interview.",
  },
  "intake-visible": {
    title: "Interview visibility",
    description: "Hidden questions are skipped in the client intake script for new interview loads.",
  },

  // Admin — assessment question bank
  "bank-section": {
    title: "Section",
    description: "The subsection within this risk pillar where the question appears.",
  },
  "bank-answer-type": {
    title: "How clients answer",
    description:
      "Controls input type and scoring — maturity scale, yes/no, Likert, short text, number, or date.",
  },
  "bank-question-text": {
    title: "Question",
    description: "The prompt clients see during the personal risk profile assessment.",
  },
  "bank-help-text": {
    title: "Why this matters",
    description: "Help text explaining why the question matters, shown alongside the prompt.",
  },
  "bank-risk-relevance": {
    title: "Additional context",
    description: "Optional extra guidance displayed with the help text when needed.",
  },
  "bank-learn-more": {
    title: "Recommended actions",
    description: "Practical steps or resources suggested when clients score poorly on this item.",
  },
  "bank-visible": {
    title: "Visible to new assessments",
    description: "Hidden questions are excluded from new assessments but remain in the bank for reference.",
  },
  "bank-cross-reference": {
    title: "Cross-reference",
    description: "Optional link to a related question ID for internal documentation.",
  },
  "bank-question-number": {
    title: "Question number",
    description: "Optional display number (e.g. 3.2) shown in advisor views and exports.",
  },
  "bank-display-order": {
    title: "Order in section",
    description: "Sort order within the section. You can also reorder from the question list with arrow buttons.",
  },
  "bank-sub-question": {
    title: "Sub-question",
    description: "Nested under a parent question — shown only when the parent condition applies.",
  },
  "bank-key-risk-indicator": {
    title: "Key Risk Indicator",
    description: "When enabled, an answer of 1 or below on this question can fire an upsell trigger.",
  },

  // Advisor — pillar manager
  "pillar-active": {
    title: "Active for new intakes",
    description:
      "Inactive pillars are omitted from new client assessments. In-flight clients keep snapshotted pillars.",
  },
  "pillar-display-name": {
    title: "Display name",
    description:
      "Optional label override shown to your clients instead of the platform pillar name.",
  },
  "pillar-weight": {
    title: "Weight",
    description:
      "How much this pillar contributes to the overall household score relative to other active pillars.",
  },
  "pillar-thresholds": {
    title: "Risk thresholds",
    description:
      "Score cutoffs (0–100) for low, medium, and high labels on this pillar. Overrides platform defaults for your practice.",
  },
  "pillar-threshold-cutoff": {
    title: "Threshold value",
    description:
      "Minimum resilience % for this band. lowMin must be highest, then mediumMin, then highMin. Below highMin is urgent.",
  },

  // Advisor — intake script
  "advisor-intake-visible": {
    title: "Visible to clients",
    description: "Hidden questions are skipped in the audio interview for new intakes.",
  },
  "advisor-intake-question-text": {
    title: "Question text",
    description: "What the client hears during the audio intake interview.",
  },
  "advisor-intake-context": {
    title: "Context / coaching prompt",
    description: "Optional spoken or on-screen context to help the client answer thoughtfully.",
  },

  // Advisor — assessment questions
  "advisor-assessment-visible": {
    title: "Visible in assessments",
    description: "Hidden questions are excluded from new personal risk profile sessions.",
  },
  "advisor-assessment-question-text": {
    title: "Question text",
    description: "The assessment prompt your clients answer for this pillar.",
  },
  "advisor-assessment-why-matters": {
    title: "Why this matters",
    description: "Help copy explaining the importance of this question.",
  },
  "advisor-assessment-actions": {
    title: "Recommended actions",
    description: "Suggested next steps when clients score poorly on this question.",
  },

  // Advisor — pillar narratives
  "narrative-all-negative": {
    title: "All-negative band",
    description:
      "Bullet points when every answer in the pillar is weak. One recommendation per line — shown in reports and PDFs.",
  },
  "narrative-all-yes": {
    title: "All-yes band",
    description:
      "Bullet points when the client answered strongly across the pillar. One line per outcome.",
  },
  "narrative-mid-band": {
    title: "Mid-band copy",
    description:
      "Outcome bullets for partial maturity — split by critical, high, medium, and low score tiers within the mid range.",
  },

  // Advisor — settings
  "household-profiles-enabled": {
    title: "Household profiles",
    description:
      "When off, clients won't manage household members and assessments use generic copy. Existing member data is kept.",
  },
  "pii-policy-toggle": {
    title: "PII field",
    description:
      "Controls whether new clients are asked for this optional field during intake. Existing consented data stays visible.",
  },
  "branding-tagline": {
    title: "Tagline",
    description: "Short phrase shown on branded client surfaces alongside your firm name.",
  },
  "branding-website": {
    title: "Website URL",
    description: "Linked from client portals and emails so clients can visit your firm online.",
  },
  "branding-support-email": {
    title: "Support email",
    description: "Contact address clients see on branded emails and portals — not your personal advisor email.",
  },
  "branding-support-phone": {
    title: "Support phone",
    description: "Optional phone number for client support on branded surfaces.",
  },
  "branding-email-footer": {
    title: "Email footer text",
    description: "Custom disclaimer or contact block appended to client-facing emails.",
  },
  "branding-colors": {
    title: "Brand colors",
    description:
      "Primary, secondary, and accent colors applied to client portals, emails, and PDF reports. Requires Professional plan.",
  },
  "branding-logo": {
    title: "Logo",
    description: "PNG, JPEG, or SVG up to 5MB. Displayed on client portals and exported reports.",
  },

  // Advisor — team
  "team-invite-email": {
    title: "Invite email",
    description: "The advisor or admin receives an invitation to join your firm workspace at this address.",
  },
  "team-invite-role": {
    title: "Role",
    description:
      "Advisors access client workflows. Admins can additionally manage team members and firm defaults.",
  },

  // Advisor — assessment lifecycle (stale scores vs reassessment)
  "pipeline-stale-scores": {
    title: "Stale scores",
    description:
      "Clients who edited answers after marking the assessment complete. Their stored scores and recommendations still reflect the old responses — contact platform support to re-score. This is not the same as reassessment: a reassessment is a new assessment cycle where the client answers again so you can measure progress over time.",
  },
  "assessment-stale-scores-alert": {
    title: "Re-score vs reassessment",
    description:
      "Re-score recalculates results from the same assessment using the latest answers (admin action when answers change or scoring rules update). Reassessment starts a new linked assessment — full, single pillar, or targeted follow-up — so you can compare before/after scores and track improvement from completed recommendations.",
  },
} as const satisfies Record<string, FieldHelpContent>;

export type FieldHelpKey = keyof typeof FIELD_HELP;

export function getFieldHelp(key: FieldHelpKey): FieldHelpContent {
  return FIELD_HELP[key];
}
