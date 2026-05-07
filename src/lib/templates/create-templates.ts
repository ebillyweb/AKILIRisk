import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// Status output for the CLI entry point at the bottom of this file.
// Silent in production so a stray runtime caller doesn't pollute server logs.
const cliLog = (msg: string): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(msg);
  }
};

// Basic docx structure with minimal content
const createBaseDocx = (): PizZip => {
  const zip = new PizZip();

  // Add basic document structure
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  return zip;
};

// Template content for each policy type (six comprehensive risk pillars)
const templateContents = {
  governance: `
{familyName} Governance Policy

Assessment Date: {assessmentDate}
Overall Score: {overallScore}/10 ({riskLevel} risk)
Category Score: {categoryScore}/10 ({categoryRiskLevel} risk)

DECISION RIGHTS, MEETINGS, AND ADVISOR COORDINATION

This policy documents how the {familyName} family defines authority, runs governance meetings, maintains records, and coordinates professional advisors.

RESPONSIBLE PARTIES:
Primary Authority: {householdHead}
Decision Makers: {decisionMakers}

IDENTIFIED GAPS TO ADDRESS:
{#gaps}• {description} - {severity} Priority
  Recommendation: {recommendation}

{/gaps}

STRENGTHS TO MAINTAIN:
{#strengths}• {.}
{/strengths}

RECOMMENDATIONS FOR IMPLEMENTATION:
{#recommendations}• {.}
{/recommendations}

GOVERNANCE FRAMEWORK:
1. Documented roles, voting thresholds, and conflict escalation
2. Cadence for family meetings with agendas and minutes
3. Secure repository for wills, trusts, and governance policies
4. Single coordinated advisor team with shared factual baseline
`,

  'cyber-digital': `
{familyName} Cyber security & digital access policy

Assessment Date: {assessmentDate}
Overall Score: {overallScore}/10 ({riskLevel} risk)
Category Score: {categoryScore}/10 ({categoryRiskLevel} risk)

DIGITAL ACCESS, DEVICES, AND SENSITIVE INFORMATION

This policy defines authentication, access tiers, and safe handling of financial and estate information for the {familyName} family.

RESPONSIBLE PARTIES:
Primary Authority: {householdHead}
Access Approvers: {decisionMakers}

IDENTIFIED GAPS TO ADDRESS:
{#gaps}• {description} - {severity} Priority
  Recommendation: {recommendation}

{/gaps}

STRENGTHS TO MAINTAIN:
{#strengths}• {.}
{/strengths}

RECOMMENDATIONS FOR IMPLEMENTATION:
{#recommendations}• {.}
{/recommendations}

CYBER SECURITY FRAMEWORK:
1. MFA and hardened recovery paths for email and financial accounts
2. Home network segmentation and IoT inventory
3. Need-to-know access to trust, tax, and investment documents
4. Periodic access reviews as household roles change
`,

  'physical-security': `
{familyName} Physical security policy

Assessment Date: {assessmentDate}
Overall Score: {overallScore}/10 ({riskLevel} risk)
Category Score: {categoryScore}/10 ({categoryRiskLevel} risk)

RESIDENCE, TRAVEL, AND PERSONAL SAFETY

This policy defines physical security expectations for residences, travel, and dependents for the {familyName} family.

RESPONSIBLE PARTIES:
Primary Authority: {householdHead}

IDENTIFIED GAPS TO ADDRESS:
{#gaps}• {description} - {severity} Priority
  Recommendation: {recommendation}

{/gaps}

STRENGTHS TO MAINTAIN:
{#strengths}• {.}
{/strengths}

RECOMMENDATIONS FOR IMPLEMENTATION:
{#recommendations}• {.}
{/recommendations}

PHYSICAL SECURITY FRAMEWORK:
1. Layered controls at primary homes (entries, lighting, monitoring)
2. Neighborhood risk awareness and routine adjustments
3. Travel security briefings for elevated-risk destinations
4. Duress communication and escalation for household members
`,

  'insurance': `
{familyName} Insurance & asset protection policy

Assessment Date: {assessmentDate}
Overall Score: {overallScore}/10 ({riskLevel} risk)
Category Score: {categoryScore}/10 ({categoryRiskLevel} risk)

INSURANCE, STRUCTURES, MEDICAL CONTINUITY, AND CONCENTRATION

This policy addresses how the {familyName} family protects balance-sheet assets through insurance, legal structures, medical preparedness, and concentration awareness.

RESPONSIBLE PARTIES:
Primary Authority: {householdHead}
Trustees: {trustees}

IDENTIFIED GAPS TO ADDRESS:
{#gaps}• {description} - {severity} Priority
  Recommendation: {recommendation}

{/gaps}

STRENGTHS TO MAINTAIN:
{#strengths}• {.}
{/strengths}

RECOMMENDATIONS FOR IMPLEMENTATION:
{#recommendations}• {.}
{/recommendations}

INSURANCE & PROTECTION FRAMEWORK:
1. Property, liability, umbrella, and specialty coverage reviews
2. Trust, titling, marital, and business continuity documents
3. Liquidity stress tests for large private positions
4. Fraud controls on banking and investment workflows
5. Emergency medical plans, medication lists, and physician rosters
6. Travel health, evacuation coverage, and telehealth where appropriate
7. Contingencies for regional health disruptions affecting dependents
`,

  'geographic-environmental': `
{familyName} Geographic risk policy

Assessment Date: {assessmentDate}
Overall Score: {overallScore}/10 ({riskLevel} risk)
Category Score: {categoryScore}/10 ({categoryRiskLevel} risk)

NATURAL HAZARD EXPOSURE & PROPERTY RESILIENCE

This policy documents how the {familyName} household identifies regional hazards, maintains insurance, and plans for evacuation or prolonged disruption.

RESPONSIBLE PARTIES:
Primary Authority: {householdHead}

IDENTIFIED GAPS TO ADDRESS:
{#gaps}• {description} - {severity} Priority
  Recommendation: {recommendation}

{/gaps}

STRENGTHS TO MAINTAIN:
{#strengths}• {.}
{/strengths}

RECOMMENDATIONS FOR IMPLEMENTATION:
{#recommendations}• {.}
{/recommendations}

ENVIRONMENTAL & GEOGRAPHIC FRAMEWORK:
1. Hazard mapping and broker review cycle for primary residences
2. Catastrophe coverage aligned to replacement value and ordinance costs
3. Evacuation routes, rally points, and household communications
4. Continuity: records, secondary locations, and advisor contact tree
`,

  'reputational-social': `
{familyName} Reputational & social risk policy

Assessment Date: {assessmentDate}
Overall Score: {overallScore}/10 ({riskLevel} risk)
Category Score: {categoryScore}/10 ({categoryRiskLevel} risk)

CONDUCT, VISIBILITY, AND PUBLIC FOOTPRINT

This policy sets expectations for behavior, social media, and reputation-sensitive activities for the {familyName} family.

RESPONSIBLE PARTIES:
Primary Authority: {householdHead}

IDENTIFIED GAPS TO ADDRESS:
{#gaps}• {description} - {severity} Priority
  Recommendation: {recommendation}

{/gaps}

STRENGTHS TO MAINTAIN:
{#strengths}• {.}
{/strengths}

RECOMMENDATIONS FOR IMPLEMENTATION:
{#recommendations}• {.}
{/recommendations}

REPUTATIONAL & SOCIAL FRAMEWORK:
1. Written family standards and graduated enforcement
2. Social media, press, and confidentiality norms for wealth-related topics
3. Substance and behavioral health policies with support pathways
4. Periodic review of routines and exposure that affect reputation or safety
`
};

async function createTemplateFiles() {
  // Ensure templates directory exists
  const templatesDir = path.join(process.cwd(), 'templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  for (const [templateId, content] of Object.entries(templateContents)) {
    cliLog(`Creating template: ${templateId}.docx`);

    // Create base document
    const zip = createBaseDocx();

    // Create document.xml with template content
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t xml:space="preserve">${content.trim()}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', docXml);

    // Generate and save the file
    const buffer = zip.generate({ type: 'nodebuffer' });
    const filePath = path.join(templatesDir, `${templateId}.docx`);
    fs.writeFileSync(filePath, buffer);

    cliLog(`Created: ${filePath}`);
  }

  cliLog('All template files created successfully!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTemplateFiles().catch(console.error);
}

export { createTemplateFiles };