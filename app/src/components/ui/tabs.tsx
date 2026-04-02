import { cn } from "@/lib/cn";

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
  className?: string;
}

export function Tabs({ value, onValueChange, items, className }: TabsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-[var(--surface-border)] bg-[var(--surface-soft)] text-muted-foreground hover:bg-[var(--surface-strong)] hover:text-foreground"
            )}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
