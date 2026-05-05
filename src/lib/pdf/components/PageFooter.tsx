import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";

const generatedDate = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

interface PageFooterProps {
  companyName?: string;
}

export function PageFooter({ companyName }: PageFooterProps) {
  const displayCompany = companyName || "Akili Risk";
  const baseText = `Confidential | Generated ${generatedDate} | ${displayCompany}`;

  return (
    <>
      <Text style={styles.footerTextStatic} fixed>
        {baseText}
      </Text>
      <Text
        style={styles.footerTextPage}
        fixed
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </>
  );
}
