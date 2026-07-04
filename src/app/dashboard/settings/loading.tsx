import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-64 mt-2 rounded" />
      </div>

      <Skeleton className="h-10 w-[400px] mb-6 rounded-lg" />

      <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-gray-100 dark:border-white/[0.06] p-6">
        <Skeleton className="h-6 w-32 mb-1" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="space-y-4 flex-1 w-full">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-24 rounded" />
            </div>
          </div>
          <div className="flex-1 w-full flex justify-center">
            <Skeleton className="h-32 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
