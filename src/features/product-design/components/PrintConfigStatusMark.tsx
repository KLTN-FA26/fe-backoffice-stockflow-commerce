import {
  PRINT_CONFIG_SCREEN_LABELS,
  PRINT_CONFIG_STATUS_LABELS,
} from "@/constants/labels-print-config";
import { cn } from "cn";

import type { PrintConfigStatus } from "../types";

// Dot tones from the semantic tokens (`StatusDot`): in use = positive, saved but off = muted, none yet = neutral.
const DOT: Record<PrintConfigStatus | "NONE", string> = {
  ACTIVE: "bg-dot-positive",
  INACTIVE: "bg-muted-tone",
  NONE: "bg-neutral",
};

/** The configuration's status as the page shows statuses (dot + words): "Đang dùng", "Chưa kích hoạt", or none yet. */
export function PrintConfigStatusMark({
  status,
  size = "sm",
}: {
  /** `null` = no configuration yet. */
  status: PrintConfigStatus | null;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "text-ink-primary inline-flex items-center gap-2 leading-[1.4] font-medium whitespace-nowrap",
        size === "sm" ? "text-[0.8125rem]" : "text-[0.9375rem]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 rounded-full",
          size === "sm" ? "size-2.5" : "size-3",
          DOT[status ?? "NONE"],
        )}
      />
      {status ? PRINT_CONFIG_STATUS_LABELS[status] : PRINT_CONFIG_SCREEN_LABELS.empty.title}
    </span>
  );
}
