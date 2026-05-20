import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-2 w-48" />
        <Skeleton className="h-7 w-48" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2a2a2c] pb-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-none" />
        ))}
      </div>

      {/* Overview grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* DNA */}
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 space-y-3">
          <Skeleton className="h-2 w-20" />
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-10" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex gap-1.5 pt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-20 rounded" />
            ))}
          </div>
        </div>

        {/* Trajectory */}
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 space-y-3">
          <Skeleton className="h-2 w-32" />
          <Skeleton className="h-[140px] w-full" />
        </div>

        {/* Discipline */}
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 space-y-3">
          <Skeleton className="h-2 w-24" />
          <div className="flex justify-center">
            <Skeleton className="h-[160px] w-[160px] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
