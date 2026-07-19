import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs/DocsArticle";
import { getDocsArticleSlugs, getDocsPage } from "@/lib/docs";
import { withCanonical } from "@/lib/seo/site";

type DocsSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getDocsArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: DocsSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocsPage(slug);
  if (!page) {
    return withCanonical(`/docs/${slug}`, {
      title: "Docs",
    });
  }

  return withCanonical(`/docs/${slug}`, {
    title: page.title,
    description: page.description,
  });
}

export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
  const { slug } = await params;
  const page = getDocsPage(slug);
  if (!page || page.slug === "") {
    notFound();
  }

  return <DocsArticle page={page} />;
}
