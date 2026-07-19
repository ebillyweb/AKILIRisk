import type { Metadata } from "next";
import { DocsHub } from "@/components/docs/DocsHub";
import { getDocsPage } from "@/lib/docs";
import type { DocsPage } from "@/lib/docs/types";
import { withCanonical } from "@/lib/seo/site";

function getWelcomeDocsPage(): DocsPage {
  const page = getDocsPage("");
  if (!page) {
    throw new Error("Docs welcome page is missing from the registry.");
  }
  return page;
}

const page = getWelcomeDocsPage();

export const metadata: Metadata = withCanonical("/docs", {
  title: "Docs",
  description: page.description,
});

export default function DocsIndexPage() {
  return <DocsHub page={page} />;
}
