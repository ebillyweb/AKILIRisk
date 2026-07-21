import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Hero skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Latest assessment summary skeleton */}
      <div className="p-6 border rounded-lg space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Trend chart skeleton */}
      <div className="p-6 border rounded-lg space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>

      {/* Category chart skeleton */}
      <div className="p-6 border rounded-lg space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>

      {/* Comparison skeleton */}
      <div className="p-6 border rounded-lg space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
