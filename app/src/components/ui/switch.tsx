import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-[var(--surface-border)] transition-colors",
        checked ? "bg-primary" : "bg-[var(--surface-ghost)]",
        className
      )}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-background transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}
