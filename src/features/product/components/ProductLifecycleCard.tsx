"use client";

import { cn } from "cn";
import { Ruler } from "lucide-react";

import { PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import { PRODUCT_CARD_CLASS } from "./ProductSection";

import type { ProductStatus } from "@/features/product";

const S = PRODUCT_STATUS;
const L = UI_LABELS.product.lifecycle;
const NORMAL: readonly ProductStatus[] = [
  S.DRAFT,
  S.PENDING_APPROVAL,
  S.APPROVED,
  S.PUBLISHED,
  S.DISCONTINUED,
];
// Tạm ngưng rẽ ra từ Approved / Published — chỉ hiện khi sản phẩm đang ở đó.
const SUSPENDED: readonly ProductStatus[] = [
  S.DRAFT,
  S.PENDING_APPROVAL,
  S.APPROVED,
  S.PUBLISHED,
  S.INACTIVE,
  S.DISCONTINUED,
];
// BE không trả mốc xuất bản và cho ngừng kinh doanh ngay từ Approved / Inactive → đã ngừng thì không
// biết từng xuất bản chưa: bỏ bước Published thay vì tô "đã qua" sai.
const ENDED: readonly ProductStatus[] = [S.DRAFT, S.PENDING_APPROVAL, S.APPROVED, S.DISCONTINUED];

function lifecycleSteps(status: ProductStatus) {
  const order = status === S.INACTIVE ? SUSPENDED : status === S.DISCONTINUED ? ENDED : NORMAL;
  const idx = order.indexOf(status);
  return order.map((step, i) => ({
    status: step,
    // Một sản phẩm tạm ngưng có thể chưa từng xuất bản → không đánh dấu "Published" là đã qua.
    done: i <= idx && !(status === S.INACTIVE && step === S.PUBLISHED),
    current: i === idx,
  }));
}

/** Dòng thời gian vòng đời ở cột phải trang chi tiết — nhãn tiếng Việt theo status-map. */
export function ProductLifecycleCard({ status }: { status: ProductStatus }) {
  return (
    <section className={PRODUCT_CARD_CLASS}>
      <h2 className="text-ink-primary mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Ruler className="text-accent size-3.5" />
        {L.title}
      </h2>
      <div className="relative pl-6">
        <div aria-hidden className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
        <ol>
          {lifecycleSteps(status).map((step) => (
            <li
              key={step.status}
              aria-current={step.current ? "step" : undefined}
              className="relative pb-5 last:pb-0"
            >
              <div
                aria-hidden
                className={cn(
                  "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                  step.current
                    ? "bg-accent ring-accent/30 ring-2"
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
                      ? "text-accent"
                      : step.done
                        ? "text-ink-primary"
                        : "text-ink-tertiary",
                  )}
                >
                  {statusLabelVi(step.status, "product") ?? step.status}
                </span>
                {step.current && (
                  <span className="bg-accent/10 text-accent rounded-full px-2 py-0.5 text-[0.625rem] font-semibold">
                    {L.current}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
