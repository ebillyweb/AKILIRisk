import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/auth";
import { listDistinctCategories } from "@/lib/admin/recommendation-queries";
import { RecommendationServiceForm } from "@/components/admin/RecommendationServiceForm";

export default async function NewRecommendationPage() {
  await requireAdminRole();
  const categories = await listDistinctCategories();
  return (
    <div className="space-y-6">
      <Link href="/admin/recommendations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to recommendations
      </Link>
      <RecommendationServiceForm existing={null} knownCategories={categories} />
    </div>
  );
}
