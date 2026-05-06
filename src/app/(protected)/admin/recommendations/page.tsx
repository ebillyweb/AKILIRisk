import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { requireAdminRole } from "@/lib/admin/auth";
import {
  listServiceRecommendations,
  listRecommendationRules,
  listDistinctCategories,
} from "@/lib/admin/recommendation-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * /admin/recommendations — round-10 / C1 (BRD §4.4).
 *
 * Tabbed view of the Service Recommendation catalog (default) and the
 * Recommendation Rules that the engine evaluates against scored
 * assessments. Tab is selected via `?view=services|rules` so deep links
 * round-trip cleanly.
 */
export default async function AdminRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    category?: string;
    tier?: string;
    complexity?: string;
    implementationType?: string;
    active?: string;
    q?: string;
    serviceRecommendationId?: string;
  }>;
}) {
  await requireAdminRole();
  const sp = await searchParams;
  const view = sp.view === "rules" ? "rules" : "services";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recommendations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            BRD §4.4: tiered service recommendations + matching rules. Catalog
            entries are surfaced by the recommendation engine when at least
            one rule&apos;s weighted conditions exceed 50% on a scored
            assessment.
          </p>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-6">
          <TabLink active={view === "services"} href="/admin/recommendations">Catalog</TabLink>
          <TabLink active={view === "rules"} href="/admin/recommendations?view=rules">Rules</TabLink>
        </nav>
      </div>

      {view === "services" ? (
        <ServicesView searchParams={sp} />
      ) : (
        <RulesView searchParams={sp} />
      )}
    </div>
  );
}

function TabLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`pb-3 -mb-px text-sm font-medium border-b-2 transition-colors ${
        active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

async function ServicesView({
  searchParams,
}: {
  searchParams: { category?: string; tier?: string; complexity?: string; implementationType?: string; active?: string; q?: string };
}) {
  const services = await listServiceRecommendations({
    category: searchParams.category || undefined,
    tier: (searchParams.tier as "BASELINE" | "ENHANCED" | undefined) || undefined,
    complexity: (searchParams.complexity as "LOW" | "MEDIUM" | "HIGH" | undefined) || undefined,
    implementationType: (searchParams.implementationType as "DIY" | "ADVISORY" | "HYBRID" | undefined) || undefined,
    active: (searchParams.active as "active" | "inactive" | "all" | undefined) ?? "all",
    q: searchParams.q || undefined,
  });
  const categories = await listDistinctCategories();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Service catalog ({services.length})</CardTitle>
          <Button asChild size="sm">
            <Link href="/admin/recommendations/services/new">
              <Plus className="h-4 w-4 mr-1" />
              New service
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4 text-sm">
            <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search name/description…" className="rounded-md border border-input px-2 py-1" />
            <select name="category" defaultValue={searchParams.category ?? ""} className="rounded-md border border-input px-2 py-1 bg-background">
              <option value="">All domains</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select name="tier" defaultValue={searchParams.tier ?? ""} className="rounded-md border border-input px-2 py-1 bg-background">
              <option value="">All tiers</option>
              <option value="BASELINE">Baseline</option>
              <option value="ENHANCED">Enhanced</option>
            </select>
            <select name="complexity" defaultValue={searchParams.complexity ?? ""} className="rounded-md border border-input px-2 py-1 bg-background">
              <option value="">Any complexity</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
            <select name="active" defaultValue={searchParams.active ?? "all"} className="rounded-md border border-input px-2 py-1 bg-background">
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
            <Button type="submit" size="sm" variant="outline">Filter</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Domain</th>
                  <th className="py-2 pr-2">Tier</th>
                  <th className="py-2 pr-2">Complexity</th>
                  <th className="py-2 pr-2">Impl</th>
                  <th className="py-2 pr-2">Priority</th>
                  <th className="py-2 pr-2">Rules</th>
                  <th className="py-2 pr-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No recommendations match.</td></tr>
                )}
                {services.map((s) => {
                  const r = s as Record<string, unknown> & { id: string; name: string; category: string; priority: number; isActive: boolean; tier?: string; complexity?: string; implementationType?: string; _count?: { recommendationRules?: number } };
                  return (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-2">
                        <Link href={`/admin/recommendations/services/${r.id}/edit`} className="hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.category}</td>
                      <td className="py-2 pr-2">
                        <Badge variant={r.tier === "ENHANCED" ? "default" : "secondary"}>{r.tier ?? "BASELINE"}</Badge>
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.complexity ?? "—"}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.implementationType ?? "—"}</td>
                      <td className="py-2 pr-2 tabular-nums">{r.priority}</td>
                      <td className="py-2 pr-2 tabular-nums text-muted-foreground">{r._count?.recommendationRules ?? 0}</td>
                      <td className="py-2 pr-2">
                        {r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function RulesView({
  searchParams,
}: {
  searchParams: { serviceRecommendationId?: string; active?: string };
}) {
  const rules = await listRecommendationRules({
    serviceRecommendationId: searchParams.serviceRecommendationId || undefined,
    active: (searchParams.active as "active" | "inactive" | "all" | undefined) ?? "all",
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Recommendation rules ({rules.length})</CardTitle>
        <Button asChild size="sm">
          <Link href="/admin/recommendations/rules/new">
            <Plus className="h-4 w-4 mr-1" />
            New rule
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Rule</th>
                <th className="py-2 pr-2">Service</th>
                <th className="py-2 pr-2">Conditions</th>
                <th className="py-2 pr-2">Priority</th>
                <th className="py-2 pr-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No rules. Create one above.</td></tr>
              )}
              {rules.map((rule) => {
                const r = rule as Record<string, unknown> & { id: string; ruleName: string; priority: number; isActive: boolean; triggerConditions?: unknown[]; serviceRecommendation?: { id: string; name: string; category: string; isActive: boolean } };
                const conditionCount = Array.isArray(r.triggerConditions) ? r.triggerConditions.length : 0;
                return (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-2">
                      <Link href={`/admin/recommendations/rules/${r.id}/edit`} className="hover:underline">
                        {r.ruleName}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground">
                      {r.serviceRecommendation ? (
                        <Link href={`/admin/recommendations/services/${r.serviceRecommendation.id}/edit`} className="hover:underline">
                          [{r.serviceRecommendation.category}] {r.serviceRecommendation.name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground">{conditionCount} condition{conditionCount === 1 ? "" : "s"}</td>
                    <td className="py-2 pr-2 tabular-nums">{r.priority}</td>
                    <td className="py-2 pr-2">
                      {r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
