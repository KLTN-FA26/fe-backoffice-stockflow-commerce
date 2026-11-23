"use client";

import Link from "next/link";
import { Factory } from "lucide-react";

import {
  ADMIN_ROUTES,
  PRODUCTION_ORDER_STATUS_DISPLAY,
  PRODUCTION_ORDER_STATUS_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format/date";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { isProductionForbidden } from "../errors";

import { OrderLoadError } from "./OrderLoadError";

import type { LineProductionOrders } from "../selectors";
import type { ProductionOrder } from "../types";

/* ── Thông báo cấp đơn ───────────────────────────────────────────────── */

interface ProductionQueryState {
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

const NO_PRODUCTION_PERMISSION = (
  <Alert tone="info" title="Không xem được đơn sản xuất">
    Tài khoản chưa có quyền xem đơn sản xuất (production-orders:READ). Thông tin đơn khác vẫn hiển
    thị bình thường.
  </Alert>
);

/**
 * Trạng thái tải đơn sản xuất ở cấp đơn — lỗi chỉ báo ở đây, KHÔNG làm hỏng trang đơn. Thiếu quyền
 * (FE biết trước, hoặc BE trả 403) → báo không có quyền, không gọi lại; lỗi khác (5xx, mạng, dữ liệu
 * sai định dạng) → báo lỗi + Thử lại. Danh sách rỗng KHÔNG phải lỗi — từng dòng tự báo "chưa có".
 */
export function ProductionStatusNotice({
  query,
  canRead,
}: {
  query: ProductionQueryState;
  /** `production-orders:READ` — UI-only, Backend phải re-check (ProductionOrderController#list). */
  canRead: boolean;
}) {
  if (!canRead) return NO_PRODUCTION_PERMISSION;
  if (!query.isError) return null;
  if (query.error instanceof ApiError && isProductionForbidden(query.error)) {
    return NO_PRODUCTION_PERMISSION;
  }
  // Lỗi gốc (không chỉ ApiError): sai hợp đồng (ZodError) phải báo "dữ liệu sai định dạng", không
  // rơi về "không tìm thấy đơn"
  return <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />;
}

/* ── Theo từng dòng in ───────────────────────────────────────────────── */

function ProductionRow({ po }: { po: ProductionOrder }) {
  const due = po.expectedCompletionDate ?? po.needByDate;
  return (
    <li
      aria-label={`Đơn sản xuất ${po.code}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-xs"
    >
      <Factory className="text-ink-tertiary size-3.5" aria-hidden="true" />
      <Link
        href={ADMIN_ROUTES.productionOrders.detail(po.productionOrderId)}
        className="text-accent-text font-[family-name:var(--font-mono)] font-medium hover:underline"
      >
        {po.code}
      </Link>
      <StatusDot
        domain="order"
        status={PRODUCTION_ORDER_STATUS_DISPLAY[po.status]}
        label={PRODUCTION_ORDER_STATUS_LABELS[po.status]}
      />
      <span className="text-ink-secondary ml-auto tabular-nums">
        Nhập kho {po.receivedCartons}/{po.cartons} thùng
        {due
          ? ` · ${po.expectedCompletionDate ? "dự kiến xong" : "cần hàng"} ${formatDate(due)}`
          : ""}
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
 * Đơn sản xuất của MỘT dòng in: mỗi đợt giao còn thiếu một Đơn sản xuất (docs 17 §4.3 bước 6), kèm số thùng đã nhập
 * kho. Đơn sản xuất `Received` là đã nhập đủ (§5.3).
 */
export function LineProductionOrdersView({ entry, state }: LineProductionProps) {
  if (state === "unavailable") return null;
  if (state === "loading") {
    return <Skeleton className="mt-2 h-5 w-1/2" aria-label="Đang tải đơn sản xuất" />;
  }
  if (!entry || entry.length === 0) {
    return (
      <p className="text-ink-tertiary mt-2 text-xs">
        Chưa có đơn sản xuất — Điều phối sản xuất lập cho phần thiếu của từng đợt giao.
      </p>
    );
  }
  const done = entry.filter((po) => po.status === "RECEIVED").length;
  return (
    <div className="bg-bg-subtle mt-2 rounded-[var(--r-sm)] px-2.5 py-1.5">
      <div className="text-ink-secondary text-[0.6875rem] font-medium">
        Đơn sản xuất · đã nhập đủ {done}/{entry.length}
      </div>
      <ul>
        {entry.map((po) => (
          <ProductionRow key={po.productionOrderId} po={po} />
        ))}
      </ul>
    </div>
  );
}
