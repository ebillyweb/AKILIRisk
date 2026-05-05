import { StyleSheet } from '@react-pdf/renderer';
import { AdvisorBrandingData } from '@/lib/validation/branding';
import { paletteForRiskLevel } from '@/lib/assessment/risk-color-palette';

/**
 * Default color scheme for PDFs when no advisor branding is provided
 */
export const DEFAULT_PDF_COLORS = {
  primary: '#1a1a2e',
  secondary: '#16213e',
  accent: '#10b981',
  text: '#374151',
  textLight: '#6b7280',
  background: '#ffffff',
  border: '#e5e7eb',
  tableHeader: '#f9fafb',
};

/**
 * Creates branded PDF styles based on advisor branding data
 */
export function createBrandedStyles(branding?: AdvisorBrandingData) {
  const colors = {
    primary: branding?.primaryColor || DEFAULT_PDF_COLORS.primary,
    secondary: branding?.secondaryColor || DEFAULT_PDF_COLORS.secondary,
    accent: branding?.accentColor || DEFAULT_PDF_COLORS.accent,
    text: DEFAULT_PDF_COLORS.text,
    textLight: DEFAULT_PDF_COLORS.textLight,
    background: DEFAULT_PDF_COLORS.background,
    border: DEFAULT_PDF_COLORS.border,
    tableHeader: DEFAULT_PDF_COLORS.tableHeader,
  };

  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 11,
      paddingTop: 72,
      paddingBottom: 72,
      paddingHorizontal: 72,
      lineHeight: 1.5,
      color: colors.text,
      backgroundColor: colors.background,
    },

    // Headers with brand colors
    header: {
      fontSize: 24,
      marginBottom: 20,
      fontWeight: 'bold',
      color: colors.primary,
    },

    subheader: {
      fontSize: 18,
      marginBottom: 16,
      fontWeight: 'bold',
      color: colors.primary,
    },

    section: {
      marginBottom: 24,
    },

    paragraph: {
      marginBottom: 12,
      textAlign: 'justify',
      lineHeight: 1.6,
      color: colors.text,
    },

    // Branded cover styles
    coverHeader: {
      backgroundColor: colors.primary,
      padding: 20,
      textAlign: 'center',
      marginBottom: 0,
      borderRadius: 8,
    },

    coverTitle: {
      fontSize: 30,
      fontWeight: 'bold',
      color: colors.primary,
      textAlign: 'center',
      lineHeight: 1.2,
      maxWidth: 460,
      alignSelf: 'center',
      marginBottom: 40,
    },

    coverSubtitle: {
      fontSize: 20,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 60,
    },

    brandHeader: {
      fontSize: 18,
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      marginTop: 0,
    },

    brandTagline: {
      fontSize: 12,
      color: 'white',
      textAlign: 'center',
      marginTop: 4,
      opacity: 0.9,
    },

    // Score display with brand colors
    scoreDisplay: {
      textAlign: 'center',
      alignItems: 'center',
      marginVertical: 40,
    },

    scoreNumber: {
      fontSize: 48,
      lineHeight: 1.1,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 14,
    },

    riskBadge: {
      backgroundColor: '#dc2626', // Risk level color overrides brand color
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 9999,
      textAlign: 'center',
      alignSelf: 'center',
      marginTop: 0,
    },

    riskBadgeText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },

    // Tables with brand accents
    table: {
      width: '100%',
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: colors.border,
      borderRightWidth: 0,
      borderBottomWidth: 0,
    },

    tableRow: {
      margin: 'auto',
      flexDirection: 'row',
    },

    tableHeader: {
      backgroundColor: colors.tableHeader,
      fontWeight: 'bold',
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },

    tableCol: {
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 0,
      borderTopWidth: 0,
      padding: 8,
      flex: 1,
    },

    // Branded accents
    accentBar: {
      height: 4,
      backgroundColor: colors.accent,
      marginVertical: 10,
      borderRadius: 2,
    },

    primaryAccent: {
      backgroundColor: colors.primary,
    },

    secondaryAccent: {
      backgroundColor: colors.secondary,
    },

    // Progress bars with brand colors
    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      marginVertical: 4,
      flexDirection: 'row',
      borderRadius: 4,
    },

    progressFill: {
      backgroundColor: colors.accent,
      height: '100%',
      borderRadius: 4,
    },

    // Metric cards with brand styling
    metricGrid: {
      flexDirection: 'row',
      marginVertical: 20,
    },

    metricItem: {
      flex: 1,
      textAlign: 'center',
      padding: 12,
      backgroundColor: colors.tableHeader,
      margin: 4,
      borderRadius: 4,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },

    metricLabel: {
      fontSize: 10,
      color: colors.textLight,
      marginBottom: 4,
    },

    metricValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
    },

    // Footer styles
    footerContainer: {
      position: 'absolute',
      bottom: 18,
      left: 0,
      right: 0,
      width: '100%',
      paddingHorizontal: 72,
      alignItems: 'center',
    },

    footerText: {
      textAlign: 'center',
      fontSize: 9,
      color: colors.textLight,
    },

    footerPageText: {
      textAlign: 'center',
      fontSize: 9,
      marginTop: 1,
      color: colors.textLight,
    },

    footerTextStatic: {
      position: 'absolute',
      bottom: 24,
      left: 72,
      right: 72,
      textAlign: 'center',
      fontSize: 9,
      color: colors.textLight,
    },

    footerTextPage: {
      position: 'absolute',
      bottom: 12,
      left: 72,
      right: 72,
      textAlign: 'center',
      fontSize: 9,
      color: colors.textLight,
    },

    brandedFooter: {
      backgroundColor: colors.secondary,
      color: 'white',
      padding: 8,
      textAlign: 'center',
      borderRadius: 4,
    },

    confidential: {
      position: 'absolute',
      bottom: 72,
      left: 72,
      right: 72,
      textAlign: 'center',
      fontSize: 10,
      color: colors.textLight,
      borderTop: `1 solid ${colors.border}`,
      paddingTop: 12,
    },

    // Section dividers with brand colors
    sectionDivider: {
      height: 2,
      backgroundColor: colors.primary,
      marginVertical: 16,
      borderRadius: 1,
    },

    // Household table with brand styling
    householdTable: {
      width: '100%',
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: colors.border,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      marginVertical: 16,
    },

    roleSection: {
      marginBottom: 24,
      paddingLeft: 12,
      borderLeft: `3 solid ${colors.primary}`,
    },

    roleMemberList: {
      marginBottom: 8,
    },

    // Branded highlights
    highlightBox: {
      backgroundColor: colors.tableHeader,
      padding: 12,
      borderLeft: `4 solid ${colors.accent}`,
      marginVertical: 8,
      borderRadius: 4,
    },

    warningBox: {
      backgroundColor: '#fef2f2',
      padding: 12,
      borderLeft: '4 solid #ef4444',
      marginVertical: 8,
      borderRadius: 4,
    },

    successBox: {
      backgroundColor: '#f0f9ff',
      padding: 12,
      borderLeft: `4 solid ${colors.accent}`,
      marginVertical: 8,
      borderRadius: 4,
    },

    // Logo styling
    logoContainer: {
      textAlign: 'center',
      marginBottom: 20,
    },

    logo: {
      maxHeight: 60,
      maxWidth: 200,
      alignSelf: 'center',
    },

    logoLarge: {
      maxHeight: 80,
      maxWidth: 250,
      alignSelf: 'center',
    },

    // Brand name styling
    brandName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 8,
    },

    brandNameLarge: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
    },
  });
}

/**
 * Get risk level colors. Round-10: derived from the canonical
 * RISK_LEVEL_PALETTE (`src/lib/assessment/risk-color-palette.ts`) so the
 * PDF report and the web heat map use the same hexes.
 *
 * Note: pre-round-10, HIGH was '#ef4444' (red-500). The canonical palette
 * uses orange (#f97316) for HIGH so it's visually distinct from CRITICAL
 * (red). Affected surface: PDF report cover badge color for HIGH-risk reports.
 */
export function getRiskColor(level: string): string {
  return paletteForRiskLevel(level).hex;
}

/**
 * Get contrasting text color for a given background
 */
export function getContrastTextColor(backgroundColor: string): string {
  // Simple luminance calculation
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}