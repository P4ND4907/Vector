import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-ghost)] px-3 py-1 text-xs font-medium text-foreground/85",
        className
      )}
      {...props}
    />
  );
}
