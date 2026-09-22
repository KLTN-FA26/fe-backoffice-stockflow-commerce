import { CircleDot } from "lucide-react";
import { cn } from "cn";

export function LifecycleSection({ isActive }: { isActive: boolean }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <CircleDot className="text-accent size-4" /> Vòng đời NCC
      </h2>
      <div className="relative pl-6">
        <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
        {[
          { label: "Active", done: isActive, current: isActive },
          { label: "Inactive", done: !isActive, current: !isActive },
        ].map((step) => (
          <div key={step.label} className="relative pb-5 last:pb-0">
            <div
              className={cn(
                "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                step.current
                  ? step.label === "Inactive"
                    ? "bg-ink-tertiary ring-ink-tertiary/30 ring-2"
                    : "bg-accent ring-accent/30 ring-2"
                  : step.done
                    ? "bg-positive"
                    : "bg-bg-muted",
              )}
            />
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[0.8125rem] font-medium",
                  step.current
                    ? step.label === "Inactive"
                      ? "text-ink-secondary"
                      : "text-accent"
                    : step.done
                      ? "text-ink-primary"
                      : "text-ink-tertiary",
                )}
              >
                {step.label}
              </span>
              {step.current && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.625rem] font-semibold",
                    step.label === "Inactive"
                      ? "bg-ink-tertiary/10 text-ink-secondary"
                      : "bg-accent/10 text-accent",
                  )}
                >
                  Hiện tại
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-ink-tertiary mt-3 text-xs">
        Vô hiệu hoá không xoá hồ sơ — NCC chỉ ẩn khỏi bộ chọn khi tạo PO mới.
      </p>
    </section>
  );
}
