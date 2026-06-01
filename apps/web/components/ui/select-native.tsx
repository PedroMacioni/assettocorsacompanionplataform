import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";

type SelectNativeProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
};

export function SelectNative({ className, children, ...props }: SelectNativeProps) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-background/80 pl-2.5 pr-8",
          "text-sm text-foreground outline-none",
          "transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "dark:bg-input/30 dark:text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}
