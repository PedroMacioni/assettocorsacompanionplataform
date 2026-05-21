import { Skeleton } from "@/components/ui/skeleton";

export default function SessionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-2 w-16" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-2 w-16" />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        {/* Header row */}
        <div className="flex gap-4 px-4 py-3 border-b border-border">
          {[60, 120, 120, 70, 40, 70, 80].map((w, i) => (
            <Skeleton key={i} className="h-2" style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4 py-3.5 border-b border-border last:border-0"
            style={{ opacity: 1 - i * 0.055 }}
          >
            <Skeleton className="h-2.5 w-[60px]" />
            <Skeleton className="h-2.5 w-[120px]" />
            <Skeleton className="h-2.5 w-[120px]" />
            <Skeleton className="h-5 w-[70px] rounded" />
            <Skeleton className="h-2.5 w-[40px] ml-auto" />
            <Skeleton className="h-2.5 w-[70px]" />
            <Skeleton className="h-2.5 w-[80px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

