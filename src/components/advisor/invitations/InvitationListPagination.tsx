import Link from "next/link";

import { buildInvitationsListHref } from "@/lib/invitations/parse-invitation-list-params";
import type { InvitationListFilters } from "@/lib/invitations/types";
import { Button } from "@/components/ui/button";

interface InvitationListPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  filters: InvitationListFilters;
}

export function InvitationListPagination({
  page,
  pageSize,
  totalCount,
  filters,
}: InvitationListPaginationProps) {
  if (totalCount === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalCount);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page.toLocaleString()} of {totalPages.toLocaleString()}
        {" · "}
        Showing {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of{" "}
        {totalCount.toLocaleString()} invitation{totalCount === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {hasPrevious ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildInvitationsListHref(filters, page - 1)}>← Previous</Link>
          </Button>
        ) : null}
        {hasNext ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildInvitationsListHref(filters, page + 1)}>Next →</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
