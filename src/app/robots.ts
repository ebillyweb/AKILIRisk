import type { MetadataRoute } from "next";

import { buildRobotsRules, getSeoSiteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: buildRobotsRules(),
    sitemap: `${getSeoSiteUrl()}/sitemap.xml`,
  };
}
