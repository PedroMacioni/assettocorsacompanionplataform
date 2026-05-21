import { Skeleton } from "@/components/ui/skeleton";

export default function SessionDetailLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <Skeleton className="h-3 w-24" />

      {/* Session header */}
      <div className="bg-card border border-border rounded-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="text-right space-y-2 shrink-0">
            <Skeleton className="h-2 w-14 ml-auto" />
            <Skeleton className="h-7 w-20 ml-auto" />
            <Skeleton className="h-3 w-24 ml-auto" />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-md p-5 space-y-2">
            <Skeleton className="h-2 w-16" />
            <Skeleton className={`h-8 ${i === 2 ? "w-36" : "w-24"}`} />
          </div>
        ))}
      </div>

      {/* Track sessions table */}
      <div className="space-y-3">
        <Skeleton className="h-2 w-48" />
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 px-4 py-3 border-b border-border last:border-0"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2.5 w-10 ml-auto" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
