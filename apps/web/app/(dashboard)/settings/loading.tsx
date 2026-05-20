import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex gap-8 max-w-5xl">
      {/* Left nav */}
      <div className="w-56 shrink-0 space-y-1">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-2 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
        <div className="!mt-8 p-3.5 rounded-md bg-[#161618] border border-[#2a2a2c] space-y-3">
          <Skeleton className="h-2 w-16" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-2 w-20" />
              <Skeleton className="h-2 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6 space-y-4">
          <Skeleton className="h-2 w-16" />
          <div className="flex items-center gap-6">
            <Skeleton className="h-16 w-16 rounded-full shrink-0" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-7 rounded-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6 space-y-5">
          <Skeleton className="h-2 w-16" />
          <div className="space-y-1.5">
            <Skeleton className="h-2 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
