import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';

// Status output for the CLI entry point at the bottom of this file.
// Silent in production so a stray runtime caller (e.g. ensureEnhancedTemplatesExist)
// doesn't pollute server logs.
const cliLog = (msg: string): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(msg);
  }
};

/**
 * Enhanced template contents that include advisor branding variables
 */
const enhancedTemplateContents = {
  governance: `
{advisorBrandName}

{familyName} Governance Policy

{advisorTagline}

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

ADVISOR CONTACT INFORMATION:
{advisorBrandName}
{advisorWebsite}
{advisorSupportEmail}
{advisorSupportPhone}

{advisorFooterText}

{confidentialityStatement}

Generated on: {generatedDate}
Document Type: {documentType}
`,

  'environmental-geographic-risk': `
{advisorBrandName}

{familyName} Geographic risk policy

{advisorTagline}

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

GEOGRAPHIC FRAMEWORK:
1. Hazard mapping and broker review cycle for primary residences
2. Catastrophe coverage aligned to replacement value and ordinance costs
3. Evacuation routes, rally points, and household communications
4. Continuity: records, secondary locations, and advisor contact tree

ADVISOR CONTACT INFORMATION:
{advisorBrandName}
{advisorWebsite}
{advisorSupportEmail}
{advisorSupportPhone}

{advisorFooterText}

{confidentialityStatement}

Generated on: {generatedDate}
Document Type: {documentType}
`,

  'physical-security': `
{advisorBrandName}

{familyName} Physical security policy

{advisorTagline}

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

ADVISOR CONTACT INFORMATION:
{advisorBrandName}
{advisorWebsite}
{advisorSupportEmail}
{advisorSupportPhone}

{advisorFooterText}

{confidentialityStatement}

Generated on: {generatedDate}
Document Type: {documentType}
`,

  'cybersecurity': `
{advisorBrandName}

{familyName} Cyber security & digital access policy

{advisorTagline}

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

ADVISOR CONTACT INFORMATION:
{advisorBrandName}
{advisorWebsite}
{advisorSupportEmail}
{advisorSupportPhone}

{advisorFooterText}

{confidentialityStatement}

Generated on: {generatedDate}
Document Type: {documentType}
`,

  'financial-asset-protection': `
{advisorBrandName}

{familyName} Insurance & asset protection policy

{advisorTagline}

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

ADVISOR CONTACT INFORMATION:
{advisorBrandName}
{advisorWebsite}
{advisorSupportEmail}
{advisorSupportPhone}

{advisorFooterText}

{confidentialityStatement}

Generated on: {generatedDate}
Document Type: {documentType}
`,

  'lifestyle-behavioral-risk': `
{advisorBrandName}

{familyName} Reputational & social risk policy

{advisorTagline}

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

ADVISOR CONTACT INFORMATION:
{advisorBrandName}
{advisorWebsite}
{advisorSupportEmail}
{advisorSupportPhone}

{advisorFooterText}

{confidentialityStatement}

Generated on: {generatedDate}
Document Type: {documentType}
`
};

/**
 * Create base DOCX structure
 */
const createBaseDocx = (): PizZip => {
  const zip = new PizZip();

  // Add basic document structure
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="word/styles.xml"/>
</Relationships>`);

  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // Add basic styles for better formatting
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr>
      <w:spacing w:after="200" w:line="276" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="480" w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:bCs/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="360" w:after="180"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:bCs/>
      <w:sz w:val="26"/>
      <w:szCs w:val="26"/>
    </w:rPr>
  </w:style>
</w:styles>`);

  return zip;
};

/**
 * Create enhanced branded template files
 */
export async function createEnhancedTemplateFiles() {
  // Ensure templates directory exists
  const templatesDir = path.join(process.cwd(), 'templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  for (const [templateId, content] of Object.entries(enhancedTemplateContents)) {
    cliLog(`Creating enhanced template: ${templateId}-enhanced.docx`);

    // Create base document
    const zip = createBaseDocx();

    // Create document.xml with enhanced template content
    // Format content with proper paragraph breaks and structure
    const formattedContent = content
      .trim()
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (trimmed === '') {
          return '<w:p><w:r><w:t></w:t></w:r></w:p>';
        }

        // Check if it's a header (starts with {familyName} or is all caps)
        if (trimmed.includes('{advisorBrandName}') || trimmed.includes('{familyName}')) {
          return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${trimmed}</w:t></w:r></w:p>`;
        }

        if (trimmed === trimmed.toUpperCase() && trimmed.length > 5 && !trimmed.includes('{')) {
          return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${trimmed}</w:t></w:r></w:p>`;
        }

        return `<w:p><w:r><w:t xml:space="preserve">${trimmed}</w:t></w:r></w:p>`;
      })
      .join('');

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${formattedContent}
  </w:body>
</w:document>`;

    zip.file('word/document.xml', docXml);

    // Generate and save the enhanced file
    const buffer = zip.generate({ type: 'nodebuffer' });
    const filePath = path.join(templatesDir, `${templateId}-enhanced.docx`);
    fs.writeFileSync(filePath, buffer);

    cliLog(`Created enhanced template: ${filePath}`);
  }

  cliLog('All enhanced template files created successfully!');
}

/**
 * Check if enhanced templates exist
 */
export function enhancedTemplatesExist(): boolean {
  const templatesDir = path.join(process.cwd(), 'templates');
  const templateIds = Object.keys(enhancedTemplateContents);

  return templateIds.every(templateId => {
    const enhancedPath = path.join(templatesDir, `${templateId}-enhanced.docx`);
    return fs.existsSync(enhancedPath);
  });
}

/**
 * Generate enhanced templates if they don't exist
 */
export async function ensureEnhancedTemplatesExist(): Promise<void> {
  if (!enhancedTemplatesExist()) {
    cliLog('Enhanced templates not found, creating them...');
    await createEnhancedTemplateFiles();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createEnhancedTemplateFiles().catch(console.error);
}

export { enhancedTemplateContents };