import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary",
        className
      )}
      {...props}
    />
  );
}
