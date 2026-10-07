"use client";

import { cn } from "cn";
import { CircleDot } from "lucide-react";

import { PO_STATUS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import { getLifecycleSteps } from "./lifecycle-helpers";

import type { PoStatus } from "@/features/purchase-order";

export function PoLifecycleTimeline({ status }: { status: PoStatus }) {
  const steps = getLifecycleSteps(status);
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <CircleDot className="text-accent size-4" />
        Vòng đời PO
      </h2>
      <div className="relative pl-6">
        <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
        {steps.map((step) => (
          <div key={step.label} className="relative pb-5 last:pb-0">
            <div
              className={cn(
                "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                step.current
                  ? "bg-accent ring-accent/30 ring-2"
                  : step.done
                    ? "bg-positive"
                    : step.optional
                      ? "border-border-strong bg-bg-surface border-dashed"
                      : "bg-bg-muted",
              )}
            />
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[0.8125rem] font-medium",
                  step.current
                    ? "text-accent"
                    : step.done
                      ? "text-ink-primary"
                      : "text-ink-tertiary",
                )}
              >
                {STATUS_LABEL_VI[step.label] ?? step.label}
              </span>
              {step.current && (
                <span className="bg-accent/10 text-accent rounded-full px-2 py-0.5 text-[0.625rem] font-semibold">
                  Hiện tại
                </span>
              )}
              {step.optional && <span className="text-ink-tertiary text-[0.6875rem]">tuỳ đơn</span>}
            </div>
          </div>
        ))}
        {status === PO_STATUS.CANCELLED && (
          <div className="relative pb-0">
            <div className="border-bg-surface bg-danger ring-danger/30 absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2 ring-2" />
            <div className="flex items-center gap-2">
              <span className="text-danger text-[0.8125rem] font-medium">
                {STATUS_LABEL_VI[PO_STATUS.CANCELLED]}
              </span>
              <span className="bg-danger/10 text-danger rounded-full px-2 py-0.5 text-[0.625rem] font-semibold">
                Hiện tại
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
