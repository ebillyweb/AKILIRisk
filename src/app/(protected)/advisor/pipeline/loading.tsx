export default function PipelineLoading() {
  return (
    <div className="space-y-6">
      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-md bg-muted/50 px-3 py-2">
            <div className="space-y-2">
              <div className="h-6 w-8 bg-muted rounded animate-pulse" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
          <div className="w-48 h-10 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        {/* Table header */}
        <div className="grid grid-cols-6 gap-4 p-4 border-b">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 p-4 border-b last:border-b-0">
            {[...Array(6)].map((_, j) => (
              <div key={j} className="h-6 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}