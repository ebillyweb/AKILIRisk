import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { TemplateData } from "@/lib/templates/types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import {
  createBrandedPDFMetadata,
  pdfDisplayNameFromBranding,
} from "@/lib/pdf/branding-integration";
import { styles } from "../styles";
import { PageFooter } from "./PageFooter";

export interface PolicyDocumentProps {
  templateName: string;
  templateDescription: string;
  data: TemplateData;
  branding?: AdvisorBrandingData | null;
}

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case "high":
      return "#dc2626";
    case "medium":
      return "#f59e0b";
    case "low":
      return "#10b981";
    default:
      return "#6b7280";
  }
}

function responsibleParties(data: TemplateData): string[] {
  const lines: string[] = [];
  if (data.householdHead) {
    lines.push(`Primary authority: ${data.householdHead}`);
  }
  if (data.decisionMakers) {
    lines.push(`Decision makers: ${data.decisionMakers}`);
  }
  if (data.trustees) {
    lines.push(`Trustees: ${data.trustees}`);
  }
  if (data.successors) {
    lines.push(`Successors: ${data.successors}`);
  }
  if (data.executors) {
    lines.push(`Executors: ${data.executors}`);
  }
  return lines;
}

export function PolicyDocument({
  templateName,
  templateDescription,
  data,
  branding,
}: PolicyDocumentProps) {
  const firmName = pdfDisplayNameFromBranding(branding ?? undefined);
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const confidentiality = branding
    ? `CONFIDENTIAL: This document contains sensitive family governance information and is intended solely for the ${data.familyName} household. Distribution without written consent from ${firmName} is prohibited.`
    : `CONFIDENTIAL: Intended solely for the ${data.familyName} household.`;

  const metadata = createBrandedPDFMetadata(branding ?? undefined);
  metadata.title = templateName;
  metadata.subject = templateDescription;

  return (
    <Document
      title={metadata.title}
      author={metadata.author}
      creator={metadata.creator}
      producer={metadata.producer}
      subject={metadata.subject}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{templateName}</Text>
        {branding?.tagline ? (
          <Text style={[styles.paragraph, { fontStyle: "italic" }]}>
            {branding.tagline}
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.subheader}>Household summary</Text>
          <Text style={styles.paragraph}>Household: {data.familyName}</Text>
          <Text style={styles.paragraph}>
            Assessment date: {data.assessmentDate}
          </Text>
          <Text style={styles.paragraph}>
            Overall score: {data.overallScore}/10 ({data.riskLevel} risk)
          </Text>
          <Text style={styles.paragraph}>
            Pillar score: {data.categoryScore}/10 ({data.categoryRiskLevel}{" "}
            risk)
          </Text>
        </View>

        {branding ? (
          <View style={styles.section}>
            <Text style={styles.subheader}>Advisor contact</Text>
            <Text style={styles.paragraph}>{firmName}</Text>
            {branding.websiteUrl ? (
              <Text style={styles.paragraph}>{branding.websiteUrl}</Text>
            ) : null}
            {branding.supportEmail ? (
              <Text style={styles.paragraph}>{branding.supportEmail}</Text>
            ) : null}
            {branding.supportPhone ? (
              <Text style={styles.paragraph}>{branding.supportPhone}</Text>
            ) : null}
            {branding.emailFooterText ? (
              <Text style={styles.paragraph}>{branding.emailFooterText}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.subheader}>Policy scope</Text>
          <Text style={styles.paragraph}>{templateDescription}</Text>
        </View>

        {responsibleParties(data).length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.subheader}>Responsible parties</Text>
            {responsibleParties(data).map((line) => (
              <Text key={line} style={styles.paragraph}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={[styles.paragraph, { marginTop: 12, fontSize: 9 }]}>
          {confidentiality}
        </Text>
        <Text style={[styles.paragraph, { fontSize: 9 }]}>
          Generated on: {generatedDate}
        </Text>

        <PageFooter companyName={firmName} />
      </Page>

      {data.gaps.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.header}>Gaps to address</Text>
          {data.gaps.map((gap, index) => (
            <View key={`gap-${index}`} style={styles.section}>
              <Text
                style={[
                  styles.subheader,
                  { color: severityColor(gap.severity), fontSize: 14 },
                ]}
              >
                {gap.description} ({gap.severity} priority)
              </Text>
              {gap.recommendation ? (
                <Text style={styles.paragraph}>
                  Recommendation: {gap.recommendation}
                </Text>
              ) : null}
            </View>
          ))}
          <PageFooter companyName={firmName} />
        </Page>
      ) : null}

      {data.strengths.length > 0 || data.recommendations.length > 0 ? (
        <Page size="A4" style={styles.page}>
          {data.strengths.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.header}>Strengths to maintain</Text>
              {data.strengths.map((strength, index) => (
                <Text key={`strength-${index}`} style={styles.paragraph}>
                  • {strength}
                </Text>
              ))}
            </View>
          ) : null}

          {data.recommendations.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.header}>Implementation recommendations</Text>
              {data.recommendations.map((rec, index) => (
                <Text key={`rec-${index}`} style={styles.paragraph}>
                  • {rec}
                </Text>
              ))}
            </View>
          ) : null}

          <PageFooter companyName={firmName} />
        </Page>
      ) : null}
    </Document>
  );
}
