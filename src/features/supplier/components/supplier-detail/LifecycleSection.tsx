import { CircleDot } from "lucide-react";
import { cn } from "cn";

import { SUPPLIER_STATUSES } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/status-map";

import type { SupplierStatus } from "@/features/supplier/types";

export function LifecycleSection({ status }: { status: SupplierStatus }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <CircleDot className="text-accent size-4" /> Vòng đời NCC
      </h2>
      <div className="relative pl-6">
        <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
        {SUPPLIER_STATUSES.map((step) => {
          const current = step === status;
          const inactive = step === "Inactive";
          return (
            <div key={step} className="relative pb-5 last:pb-0">
              <div
                className={cn(
                  "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                  !current && "bg-bg-muted",
                  current && inactive && "bg-ink-tertiary ring-ink-tertiary/30 ring-2",
                  current && !inactive && "bg-accent ring-accent/30 ring-2",
                )}
              />
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[0.8125rem] font-medium",
                    !current && "text-ink-tertiary",
                    current && inactive && "text-ink-secondary",
                    current && !inactive && "text-accent",
                  )}
                >
                  {STATUS_LABEL_VI[step] ?? step}
                </span>
                {current && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.625rem] font-semibold",
                      inactive
                        ? "bg-ink-tertiary/10 text-ink-secondary"
                        : "bg-accent/10 text-accent",
                    )}
                  >
                    Hiện tại
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-ink-tertiary mt-3 text-xs">
        Ngừng hợp tác không xoá hồ sơ — NCC chỉ ẩn khỏi bộ chọn khi tạo PO mới.
      </p>
    </section>
  );
}
