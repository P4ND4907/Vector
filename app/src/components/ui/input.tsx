import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary",
        className
      )}
      {...props}
    />
  );
}
