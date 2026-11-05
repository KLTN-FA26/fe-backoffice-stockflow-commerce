"use client";

import { RotateCw } from "lucide-react";

import { formatMoney } from "@/lib/format";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { CreditPosition } from "../../types";

/** Kết quả `useCreditPosition` thu gọn — panel không tự gọi API. */
export interface CreditPositionState {
  /** Có `customer-credit-profiles:READ` và id khách hợp lệ — có gọi API. */
  available: boolean;
  data: CreditPosition | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

const TITLE = "Công nợ hiện tại của khách";

/**
 * Công nợ HIỆN TẠI của khách (BE `GET /orders/credit-position/{customerId}`) để người duyệt cân
 * nhắc — KHÔNG phải lý do đơn này bị giữ (lý do lúc kiểm nằm ở hàng đợi công nợ). Tiền theo
 * `currency` của hồ sơ khách.
 */
export function CreditPositionPanel({ state }: { state: CreditPositionState }) {
  if (!state.available) return null;
  if (state.isError) {
    return (
      <Alert tone="warning" title="Không tải được công nợ hiện tại của khách">
        <div className="flex items-center justify-between gap-2">
          <span>Chuyển sang trả trước / đặt cọc chưa chọn được tới khi tải lại thành công.</span>
          <Button type="button" variant="outline" size="sm" onClick={state.refetch}>
            <RotateCw className="size-3.5" /> Thử lại
          </Button>
        </div>
      </Alert>
    );
  }
  if (state.isPending || !state.data) {
    return (
      <div role="status" aria-label={`Đang tải ${TITLE.toLowerCase()}`} className="grid gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
    );
  }
  const p = state.data;
  return (
    <section
      aria-label={TITLE}
      className="border-border-default bg-bg-subtle grid gap-1 rounded-[var(--r-sm)] border px-3 py-2"
    >
      <h3 className="text-ink-secondary text-xs font-medium">{TITLE}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8125rem]">
        <dt className="text-ink-tertiary">Hạn mức còn lại</dt>
        <dd className="text-right font-mono tabular-nums">
          {p.availableCredit === null
            ? "Không bán công nợ"
            : formatMoney(p.availableCredit, p.currency)}
        </dd>
        <dt className="text-ink-tertiary">Đang nợ</dt>
        <dd className="text-right font-mono tabular-nums">{formatMoney(p.exposure, p.currency)}</dd>
        <dt className="text-ink-tertiary">Nợ quá hạn</dt>
        <dd className={`text-right ${p.hasOverdue ? "text-danger font-medium" : ""}`}>
          {p.hasOverdue ? "Hiện có khoản quá hạn" : "Hiện không có"}
        </dd>
      </dl>
    </section>
  );
}
