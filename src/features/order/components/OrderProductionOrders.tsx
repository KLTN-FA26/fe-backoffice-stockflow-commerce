"use client";

import { Factory, Truck } from "lucide-react";

import {
  PRODUCTION_HOLD_REASON_LABELS,
  PRODUCTION_ORDER_MODE_LABELS,
  PRODUCTION_ORDER_STATUS_DISPLAY,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format/date";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { isProductionApiUnavailable } from "../errors";

import { OrderLoadError } from "./OrderLoadError";

import type { LineProductionOrders } from "../selectors";
import type { ProductionOrder } from "../types";

/* ── Thông báo cấp đơn ───────────────────────────────────────────────── */

interface ProductionQueryState {
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Trạng thái tải lệnh sản xuất của đơn. CONTRACT PENDING: BE chưa có endpoint → 404/405 hiện
 * thông báo trung thực, KHÔNG dựng dữ liệu giả; lỗi khác (5xx, mạng) vẫn báo lỗi + Thử lại.
 */
export function ProductionStatusNotice({ query }: { query: ProductionQueryState }) {
  if (!query.isError) return null;
  const apiError = query.error instanceof ApiError ? query.error : null;
  if (apiError && isProductionApiUnavailable(apiError)) {
    return (
      <Alert tone="info" title="Chưa có dữ liệu lệnh sản xuất">
        Máy chủ chưa cung cấp API lệnh sản xuất của đơn. Trạng thái lệnh sản xuất (gốc và gia công
        ngoài) sẽ hiển thị khi BE bổ sung endpoint.
      </Alert>
    );
  }
  return <OrderLoadError inline error={apiError} onRetry={() => void query.refetch()} />;
}

/* ── Theo từng dòng in ───────────────────────────────────────────────── */

function ProductionRow({ po, child = false }: { po: ProductionOrder; child?: boolean }) {
  const holdReason = po.holdReason
    ? (PRODUCTION_HOLD_REASON_LABELS[po.holdReason] ?? po.holdReason)
    : null;
  return (
    <li
      aria-label={`Lệnh sản xuất ${po.productionOrderNumber}`}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-xs ${child ? "border-border-default ml-4 border-l pl-3" : ""}`}
    >
      {child ? (
        <Truck className="text-ink-tertiary size-3.5" aria-hidden="true" />
      ) : (
        <Factory className="text-ink-tertiary size-3.5" aria-hidden="true" />
      )}
      <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
        {po.productionOrderNumber}
      </span>
      <span className="text-ink-secondary">
        {child ? "LSX con · " : "LSX gốc · "}
        {PRODUCTION_ORDER_MODE_LABELS[po.mode]}
        {po.subcontractorName ? ` · ${po.subcontractorName}` : ""}
      </span>
      <StatusDot domain="order" status={PRODUCTION_ORDER_STATUS_DISPLAY[po.status]} />
      {holdReason && <span className="text-warning">Treo: {holdReason}</span>}
      <span className="text-ink-secondary ml-auto tabular-nums">
        Đạt {po.goodQuantity}/{po.plannedQuantity}
        {po.dueDate ? ` · hạn ${formatDate(po.dueDate)}` : ""}
      </span>
    </li>
  );
}

interface LineProductionProps {
  entry: LineProductionOrders | undefined;
  /** Đang tải / lỗi đã báo ở cấp đơn → dòng chỉ hiện skeleton hoặc không gì. */
  state: "loading" | "ready" | "unavailable";
}

/**
 * Lệnh sản xuất của MỘT dòng in: LSX gốc (docs 19 BR-01) và LSX con tách gia công ngoài
 * (BR-12, `parentId` → gốc). Đơn chỉ rời In Production khi mọi LSX gốc + con Completed (BR-06).
 */
export function LineProductionOrdersView({ entry, state }: LineProductionProps) {
  if (state === "unavailable") return null;
  if (state === "loading") {
    return <Skeleton className="mt-2 h-5 w-1/2" aria-label="Đang tải lệnh sản xuất" />;
  }
  if (!entry || entry.parents.length === 0) {
    return (
      <p className="text-ink-tertiary mt-2 text-xs">
        Chưa có lệnh sản xuất — sinh khi đơn được release (docs 17 §4.2).
      </p>
    );
  }
  const all = [...entry.parents, ...entry.children];
  const done = all.filter((po) => po.status === "COMPLETED").length;
  return (
    <div className="bg-bg-subtle mt-2 rounded-[var(--r-sm)] px-2.5 py-1.5">
      <div className="text-ink-secondary text-[0.6875rem] font-medium">
        Lệnh sản xuất · hoàn tất {done}/{all.length}
      </div>
      <ul>
        {entry.parents.map((parent) => (
          <ProductionRow key={parent.productionOrderId} po={parent} />
        ))}
        {entry.children.map((child) => (
          <ProductionRow key={child.productionOrderId} po={child} child />
        ))}
      </ul>
    </div>
  );
}
