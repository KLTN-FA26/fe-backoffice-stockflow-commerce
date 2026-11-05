import { cn } from "cn";
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

type DeltaDirection = "up" | "down" | "flat";

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  subtitle?: string;
  delta?: string;
  deltaDirection?: DeltaDirection;
  /** Số tiền / mã → font mono (canh cột); mặc định font display cho số đếm. */
  mono?: boolean;
  className?: string;
}

const DELTA_STYLES: Record<DeltaDirection, { color: string; Icon: typeof TrendingUp }> = {
  up: { color: "text-positive", Icon: TrendingUp },
  down: { color: "text-danger", Icon: TrendingDown },
  flat: { color: "text-ink-tertiary", Icon: Minus },
};

/**
 * Ô số liệu kiểu card stats của shadcn: nhãn + icon nhỏ trung tính ở hàng đầu, số lớn, dòng phụ.
 * `h-full` để các ô trong cùng hàng grid cao bằng nhau dù nhãn / dòng phụ dài ngắn khác nhau.
 */
export function StatTile({
  label,
  value,
  icon: LabelIcon,
  subtitle,
  delta,
  deltaDirection = "flat",
  mono = false,
  className,
}: StatTileProps) {
  const { color, Icon } = DELTA_STYLES[deltaDirection];

  return (
    <div
      className={cn(
        "border-border-default bg-bg-surface flex h-full flex-col gap-1.5 rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-secondary text-[0.8125rem] leading-snug font-medium">{label}</p>
        {LabelIcon && (
          <LabelIcon className="text-ink-tertiary mt-0.5 size-4 shrink-0" aria-hidden />
        )}
      </div>
      <p
        className={cn(
          "text-ink-primary text-2xl leading-tight font-semibold tracking-tight tabular-nums",
          mono ? "font-[family-name:var(--font-mono)]" : "font-[family-name:var(--font-display)]",
        )}
      >
        {value}
      </p>
      {delta && (
        <p className={cn("flex items-center gap-1 text-xs font-medium tabular-nums", color)}>
          <Icon className="size-3" aria-hidden />
          {delta}
        </p>
      )}
      {subtitle && <p className="text-ink-tertiary text-xs leading-snug">{subtitle}</p>}
    </div>
  );
}
