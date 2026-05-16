"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

function toAllSentinel(v: string) {
  return v === "" ? ALL : v;
}

function fromAllSentinel(v: string) {
  return v === ALL ? "" : v;
}

export function RecommendationCatalogFilterForm({
  defaultQ = "",
  defaultCategory = "",
  defaultTier = "",
  defaultComplexity = "",
  defaultActive = "all",
  categories,
}: {
  defaultQ?: string;
  defaultCategory?: string;
  defaultTier?: string;
  defaultComplexity?: string;
  defaultActive?: string;
  categories: string[];
}) {
  const [category, setCategory] = useState(defaultCategory);
  const [tier, setTier] = useState(defaultTier);
  const [complexity, setComplexity] = useState(defaultComplexity);
  const [active, setActive] = useState(defaultActive);

  return (
    <form
      method="GET"
      action="/admin/recommendations"
      className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-6"
    >
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="complexity" value={complexity} />
      <input type="hidden" name="active" value={active} />

      <Input name="q" defaultValue={defaultQ} placeholder="Search name/description…" className="h-12 rounded-xl" />

      <Select
        value={toAllSentinel(category)}
        onValueChange={(v) => setCategory(fromAllSentinel(v))}
      >
        <SelectTrigger className="h-12 w-full" aria-label="Filter by domain">
          <SelectValue placeholder="All domains" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All domains</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={toAllSentinel(tier)} onValueChange={(v) => setTier(fromAllSentinel(v))}>
        <SelectTrigger className="h-12 w-full" aria-label="Filter by tier">
          <SelectValue placeholder="All tiers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All tiers</SelectItem>
          <SelectItem value="BASELINE">Baseline</SelectItem>
          <SelectItem value="ENHANCED">Enhanced</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={toAllSentinel(complexity)}
        onValueChange={(v) => setComplexity(fromAllSentinel(v))}
      >
        <SelectTrigger className="h-12 w-full" aria-label="Filter by complexity">
          <SelectValue placeholder="Any complexity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any complexity</SelectItem>
          <SelectItem value="LOW">LOW</SelectItem>
          <SelectItem value="MEDIUM">MEDIUM</SelectItem>
          <SelectItem value="HIGH">HIGH</SelectItem>
        </SelectContent>
      </Select>

      <Select value={active} onValueChange={setActive}>
        <SelectTrigger className="h-12 w-full" aria-label="Filter by active status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="active">Active only</SelectItem>
          <SelectItem value="inactive">Inactive only</SelectItem>
        </SelectContent>
      </Select>

      <Button type="submit" size="sm" variant="outline" className="h-12 w-full shrink-0 md:w-auto">
        Filter
      </Button>
    </form>
  );
}
