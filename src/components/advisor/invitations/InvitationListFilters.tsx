"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { InvitationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";

const STATUS_OPTIONS: { value: InvitationStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: InvitationStatus.SENT, label: "Sent" },
  { value: InvitationStatus.OPENED, label: "Opened" },
  { value: InvitationStatus.REGISTERED, label: "Registered" },
  { value: InvitationStatus.EXPIRED, label: "Expired" },
];

export function InvitationListFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState(
    searchParams.get("status") ?? "all"
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const applyFilters = useCallback(() => {
    const next = new URLSearchParams();
    if (status && status !== "all") {
      next.set("status", status);
    }
    const q = search.trim();
    if (q) {
      next.set("search", q);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/advisor/invitations?${qs}` : "/advisor/invitations");
    });
  }, [router, search, status]);

  const clearFilters = useCallback(() => {
    setStatus("all");
    setSearch("");
    startTransition(() => {
      router.push("/advisor/invitations");
    });
  }, [router]);

  const hasActiveFilters =
    (searchParams.get("status") ?? "") !== "" ||
    (searchParams.get("search") ?? "").trim() !== "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-1.5 min-w-[10rem]">
        <label htmlFor="invitation-status-filter" className="text-sm font-medium">
          Status
        </label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="invitation-status-filter" className="h-10 w-full sm:w-[11rem]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 flex-1 min-w-[12rem]">
        <label htmlFor="invitation-search" className="text-sm font-medium">
          Search
        </label>
        <Input
          id="invitation-search"
          type="search"
          placeholder="Client email or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyFilters();
            }
          }}
          className="h-10"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={applyFilters} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">Apply</span>
        </Button>
        {hasActiveFilters && (
          <Button type="button" variant="outline" onClick={clearFilters} disabled={isPending}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
