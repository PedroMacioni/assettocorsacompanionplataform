import { Skeleton } from "@/components/ui/skeleton";

export default function TracksLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-7 w-24" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-md overflow-hidden"
            style={{ opacity: 1 - i * 0.08 }}
          >
            <Skeleton className="h-36 w-full rounded-none" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-2 w-20" />
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-4 pt-1">
                <Skeleton className="h-2 w-16" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
