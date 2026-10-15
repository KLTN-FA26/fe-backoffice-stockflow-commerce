import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { MONO } from "./primitives";

/** Tiến độ quét kiện lên xe: "đã lên / kế hoạch" + thanh mảnh. Đủ kiện → tone positive. */
export function LoadProgress({
  loaded,
  planned,
  size = "sm",
}: {
  loaded: number;
  planned: number;
  size?: "sm" | "md";
}) {
  const percent = planned === 0 ? 0 : Math.min(100, Math.floor((loaded / planned) * 100));
  const done = planned > 0 && loaded >= planned;
  return (
    <div className={cn("flex items-center gap-2", size === "md" ? "w-full" : "w-36")}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={planned}
        aria-valuenow={loaded}
        aria-label={UI_LABELS.shipping.info.progressAria}
        className={cn(
          "bg-bg-muted flex-1 overflow-hidden rounded-full",
          size === "md" ? "h-2" : "h-1.5",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-150",
            done ? "bg-positive" : "bg-info",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn("text-ink-primary shrink-0 text-[0.8125rem]", MONO)}>
        {loaded}/{planned}
      </span>
    </div>
  );
}
