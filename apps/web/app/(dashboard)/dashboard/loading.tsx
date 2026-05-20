import { Skeleton } from "@/components/ui/skeleton";

function HeroSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-xl p-6">
      <div className="grid grid-cols-3 gap-6">
        {/* Streak block */}
        <div className="flex flex-col items-center p-4 rounded-lg bg-[#1e1e20]">
          <Skeleton className="h-3 w-16 mb-3" />
          <Skeleton className="h-12 w-16 mb-2" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-2 w-20 mt-3" />
        </div>
        {/* Consistency block */}
        <div className="flex flex-col items-center p-4 rounded-lg bg-[#1e1e20]">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-12 w-14 mb-2" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-2 w-full mt-3" />
          <Skeleton className="h-2 w-16 mt-2" />
        </div>
        {/* Weekly digest block */}
        <div className="flex flex-col items-center p-4 rounded-lg bg-[#1e1e20]">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-7 w-28 mb-2" />
          <Skeleton className="h-5 w-20 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

function ActivityCalendarSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
      <Skeleton className="h-3 w-36 mb-4" />
      <div className="flex gap-[3px]">
        {Array.from({ length: 13 }).map((_, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, dayIdx) => (
              <Skeleton key={dayIdx} className="w-3 h-3 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function LastSessionSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 h-full">
      <div className="flex justify-between mb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-36 mt-2" />
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full mt-5 rounded-full" />
    </div>
  );
}

function PaceEvolutionSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
      <div className="flex justify-between mb-4">
        <div className="space-y-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-[180px] w-full" />
      <div className="flex gap-4 mt-3 pt-3 border-t border-[#2a2a2c]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="w-2.5 h-2.5 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TopRecordsSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 h-full">
      <Skeleton className="h-3 w-24 mb-4" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-3 w-20 mt-4" />
    </div>
  );
}

function QuickStatsBarSkeleton() {
  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-4">
      <div className="flex justify-between divide-x divide-[#2a2a2c]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`flex-1 flex flex-col items-center ${i > 0 ? "pl-4" : ""}`}>
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="h-6 w-12" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickNavCardsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-[#161618] border border-[#2a2a2c] rounded-md p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right space-y-1">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Hero Card */}
      <HeroSkeleton />

      {/* Activity Calendar + Last Session */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <ActivityCalendarSkeleton />
        </div>
        <div className="col-span-2">
          <LastSessionSkeleton />
        </div>
      </div>

      {/* Pace Evolution + Top Records */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <PaceEvolutionSkeleton />
        </div>
        <div className="col-span-2">
          <TopRecordsSkeleton />
        </div>
      </div>

      {/* Quick Stats Bar */}
      <QuickStatsBarSkeleton />

      {/* Quick Navigation */}
      <QuickNavCardsSkeleton />
    </div>
  );
}
