import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Range({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="range"
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[hsl(var(--primary))]",
        className
      )}
      {...props}
    />
  );
}

