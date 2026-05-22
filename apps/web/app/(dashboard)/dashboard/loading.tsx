import { Skeleton } from "@/components/ui/skeleton";

function HeroSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg bg-[#1e1e20] flex flex-col items-center gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-12 w-16" />
            <Skeleton className="h-2 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-[#161618] border border-[#2a2a2c] rounded-md p-5 ${className}`}>
      <Skeleton className="h-2 w-24 mb-4" />
      <Skeleton className="h-5 w-40 mb-2" />
      <Skeleton className="h-3 w-28 mb-4" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-1.5 w-full rounded-full mt-4" />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-2 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordsSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
      <Skeleton className="h-2 w-28 mb-4" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-3/4" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NavCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[#161618] border border-[#2a2a2c] rounded-md p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-28" />
            </div>
          </div>
        </div>
      ))}
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
        <div className="flex items-center gap-3">
          <div className="space-y-1 text-right">
            <Skeleton className="h-2 w-24 ml-auto" />
            <Skeleton className="h-2 w-32 ml-auto" />
          </div>
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
      </div>

      {/* Hero Card */}
      <HeroSkeleton />

      {/* Last Session + Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <Skeleton className="h-2 w-16 mb-4" />
          <Skeleton className="h-[80px] w-full rounded-sm mb-4" />
          <div className="flex justify-between">
            <Skeleton className="h-2 w-24" />
            <Skeleton className="h-2 w-28" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <StatsSkeleton />

      {/* Pace Chart + Records */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
          <div className="flex justify-between mb-4">
            <div className="space-y-1.5">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-[280px] w-full rounded-md" />
        </div>
        <RecordsSkeleton />
      </div>

      {/* Quick Nav Cards */}
      <NavCardsSkeleton />
    </div>
  );
}
