import { Text, View } from '@react-pdf/renderer';
import { createBrandedStyles } from '../enhanced-styles';
import { AdvisorBrandingData } from '@/lib/validation/branding';

interface EnhancedPageFooterProps {
  branding?: AdvisorBrandingData;
  pageNumber?: number;
  totalPages?: number;
  showBranding?: boolean;
  customText?: string;
}

export function EnhancedPageFooter({
  branding,
  pageNumber,
  totalPages,
  showBranding = true,
  customText,
}: EnhancedPageFooterProps) {
  const styles = createBrandedStyles(branding);

  // Determine company name with fallbacks
  const companyName = branding?.brandName || branding?.advisorFirmName || 'Akili Risk';

  return (
    <View style={styles.footerContainer}>
      {showBranding && (
        <>
          {/* Company branding line */}
          <Text style={styles.footerText}>
            {companyName}
            {branding?.websiteUrl && ` • ${branding.websiteUrl}`}
            {branding?.supportPhone && ` • ${branding.supportPhone}`}
          </Text>

          {/* Custom footer text if provided */}
          {(branding?.emailFooterText || customText) && (
            <Text style={[styles.footerText, { marginTop: 2, fontSize: 8 }]}>
              {branding?.emailFooterText || customText}
            </Text>
          )}
        </>
      )}

      {/* Page numbers */}
      {pageNumber && totalPages && (
        <Text style={styles.footerPageText}>
          Page {pageNumber} of {totalPages}
        </Text>
      )}
    </View>
  );
}

/**
 * Minimal footer for pages where full branding isn't needed
 */
export function MinimalPageFooter({
  branding,
  pageNumber,
  totalPages,
}: Pick<EnhancedPageFooterProps, 'branding' | 'pageNumber' | 'totalPages'>) {
  const styles = createBrandedStyles(branding);
  const companyName = branding?.brandName || branding?.advisorFirmName || 'Akili Risk';

  return (
    <View style={styles.footerContainer}>
      <Text style={styles.footerText}>
        {companyName} • Confidential
      </Text>
      {pageNumber && totalPages && (
        <Text style={styles.footerPageText}>
          {pageNumber} / {totalPages}
        </Text>
      )}
    </View>
  );
}

/**
 * Legacy footer component for backward compatibility
 */
interface LegacyPageFooterProps {
  companyName?: string;
}

export function BrandedPageFooter({ companyName }: LegacyPageFooterProps) {
  // Convert legacy props to new format
  const enhancedBranding: AdvisorBrandingData = {
    brandName: companyName,
    brandingEnabled: true,
    customDomainEnabled: false,
  };

  return (
    <EnhancedPageFooter
      branding={enhancedBranding}
      showBranding={true}
    />
  );
}

export default EnhancedPageFooter;