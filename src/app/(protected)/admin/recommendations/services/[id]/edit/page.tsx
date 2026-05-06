import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/auth";
import { getServiceRecommendation, listDistinctCategories } from "@/lib/admin/recommendation-queries";
import { RecommendationServiceForm } from "@/components/admin/RecommendationServiceForm";

export default async function EditRecommendationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminRole();
  const { id } = await params;
  const [row, categories] = await Promise.all([
    getServiceRecommendation(id),
    listDistinctCategories(),
  ]);
  if (!row) notFound();

  // Cast to the form's expected shape — Prisma return type lines up at
  // runtime; TS doesn't see the new tier/complexity/implementationType
  // fields until prisma generate is rerun. Same shape, no behavior change.
  const existing = {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    tier: (row.tier as "BASELINE" | "ENHANCED" | undefined) ?? "BASELINE",
    complexity: row.complexity as "LOW" | "MEDIUM" | "HIGH" | null | undefined,
    implementationType: row.implementationType as "DIY" | "ADVISORY" | "HYBRID" | null | undefined,
    priority: row.priority as number,
    estimatedCost: row.estimatedCost as string | null | undefined,
    timeframe: row.timeframe as string | null | undefined,
    provider: row.provider as string | null | undefined,
    isActive: row.isActive as boolean,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/recommendations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to recommendations
        </Link>
        <Link
          href={`/admin/audit-log/entity/ServiceRecommendation/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View history (BRD §7.2)
        </Link>
      </div>
      <RecommendationServiceForm existing={existing} knownCategories={categories} />
    </div>
  );
}
