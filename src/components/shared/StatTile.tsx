import { cn } from "cn";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

type DeltaDirection = "up" | "down" | "flat";

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  subtitle?: string;
  delta?: string;
  deltaDirection?: DeltaDirection;
  className?: string;
}

const DELTA_STYLES: Record<DeltaDirection, { color: string; Icon: typeof TrendingUp }> = {
  up: { color: "text-positive", Icon: TrendingUp },
  down: { color: "text-danger", Icon: TrendingDown },
  flat: { color: "text-ink-tertiary", Icon: Minus },
};

export function StatTile({
  label,
  value,
  icon: LabelIcon,
  subtitle,
  delta,
  deltaDirection = "flat",
  className,
}: StatTileProps) {
  const { color, Icon } = DELTA_STYLES[deltaDirection];

  return (
    <div
      className={cn(
        "border-border-default bg-bg-surface relative min-h-[92px] overflow-hidden rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)] transition-shadow duration-200 hover:shadow-[var(--sh-md)]",
        className,
      )}
    >
      {LabelIcon && (
        <div className="bg-accent/6 pointer-events-none absolute -top-4 -right-4 size-24 rounded-full" />
      )}
      <div className="relative flex h-full items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-ink-secondary text-xs font-medium">{label}</div>
          <div className="text-ink-primary mt-2 font-[family-name:var(--font-display)] text-[2rem] leading-[1.05] font-bold tracking-[-0.03em] tabular-nums">
            {value}
          </div>
          {subtitle && <div className="text-ink-tertiary mt-1.5 text-[0.6875rem]">{subtitle}</div>}
          {delta && (
            <div className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", color)}>
              <Icon className="size-3" />
              {delta}
            </div>
          )}
        </div>
        {LabelIcon && (
          <div className="bg-accent text-ink-inverse flex size-11 shrink-0 items-center justify-center rounded-full shadow-[0_10px_24px_color-mix(in_srgb,var(--accent)_24%,transparent)]">
            <LabelIcon className="size-5" />
          </div>
        )}
      </div>
    </div>
  );
}
