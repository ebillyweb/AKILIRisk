import type { MetadataRoute } from "next";

import { getSeoSiteUrl, PUBLIC_SITEMAP_ENTRIES } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSeoSiteUrl();

  return PUBLIC_SITEMAP_ENTRIES.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? siteUrl : `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
