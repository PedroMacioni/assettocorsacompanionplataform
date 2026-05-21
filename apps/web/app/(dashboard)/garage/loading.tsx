import { Skeleton } from "@/components/ui/skeleton";

export default function GarageLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-7 w-24" />
      </div>

      <div className="flex gap-6">
        {/* Car list */}
        <div className="w-64 shrink-0 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="px-3 py-3 rounded-md"
              style={{ opacity: 1 - i * 0.12 }}
            >
              <Skeleton className="h-3.5 w-36 mb-1.5" />
              <Skeleton className="h-2 w-20" />
            </div>
          ))}
        </div>

        {/* Stats panel */}
        <div className="flex-1 space-y-4">
          {/* Car header */}
          <div className="bg-card border border-border rounded-md p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-2 w-32" />
                <Skeleton className="h-7 w-48" />
              </div>
              <div className="flex gap-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="text-right space-y-1.5">
                    <Skeleton className="h-2 w-16 ml-auto" />
                    <Skeleton className="h-5 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, col) => (
              <div key={col} className="bg-card border border-border rounded-md p-5 space-y-3">
                <Skeleton className="h-2 w-28" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-1" style={{ opacity: 1 - i * 0.15 }}>
                    <div className="space-y-1">
                      <Skeleton className="h-2.5 w-28" />
                      <Skeleton className="h-2 w-20" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

