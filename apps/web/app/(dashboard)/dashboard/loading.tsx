import { Skeleton } from "@/components/ui/skeleton";

function KpiSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
      <Skeleton className="h-2 w-24 mb-3" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-2 w-28 mt-2" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-2 w-40" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-2 w-32 mt-2" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>

      {/* Last session + driver stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[#161618] border border-[#2a2a2c] rounded-md p-5 space-y-3">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-2.5 w-32" />
          <div className="pt-2">
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <Skeleton className="h-2 w-20 mb-5" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-2 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pace + records */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <Skeleton className="h-2 w-24 mb-2" />
          <Skeleton className="h-4 w-48 mb-5" />
          <Skeleton className="h-[200px] w-full" />
        </div>
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <Skeleton className="h-2 w-28 mb-5" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-2 w-3/4" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
