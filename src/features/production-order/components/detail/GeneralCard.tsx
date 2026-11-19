"use client";

import Link from "next/link";
import { Info } from "lucide-react";

import {
  ADMIN_ROUTES,
  ORDER_DELIVERY_BATCH_PERMISSIONS,
  PRODUCER_PERMISSIONS,
  PRODUCTION_LABELS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { useProducerDirectory } from "@/lib/references/producer-options";

import { useSalesOrderBatches } from "@/features/production-order/queries";
import { receivingWarehouseCode } from "@/features/production-order/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { EMPTY_CELL } from "@/components/shared/column-helpers";
import { DetailSection, InfoRow } from "@/components/shared/DetailSection";

import { formatWindow, producerLabel, ProductionStatusDot, shortId } from "../parts";

import type { ProductionOrder } from "@/features/production-order/types";

const L = PRODUCTION_LABELS.detail;

/** Người thao tác: "Bạn" khi là người đang đăng nhập, còn lại mã nhân viên rút gọn (không có API tra tên cho mọi vai). */
export function actorLabel(id: string | null | undefined, me: string | null | undefined): string {
  if (!id) return L.system;
  return id === me ? L.you : L.userShort(id);
}

const when = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : null);

/**
 * "Thông tin chung" (docs 17 §4.3 bảng đầu đơn): mã, trạng thái, đơn bán + đợt giao (cửa sổ), khách, đơn vị sản xuất,
 * kho nhận, ngày cần hàng / dự kiến, cờ duyệt mẫu, người lập / duyệt và các mốc, lý do trả lại / huỷ / đóng.
 */
export function GeneralCard({
  order,
  me,
}: {
  order: ProductionOrder;
  me: string | null | undefined;
}) {
  // Thiếu quyền đọc thì không gọi (403 làm tải lại quyền toàn app) — hiện mã rút gọn thay tên
  const can = usePermissionChecker();
  const producers = useProducerDirectory(can(PRODUCER_PERMISSIONS.read));
  const batches = useSalesOrderBatches(
    order.salesOrderId,
    can(ORDER_DELIVERY_BATCH_PERMISSIONS.read),
  );
  const batch = batches.data?.batches.find((b) => b.batchId === order.deliveryBatchId);
  const optionalRows: [string, string | null | undefined][] = [
    [L.submittedAt, when(order.submittedAt)],
    [L.approvedBy, order.approvedBy ? actorLabel(order.approvedBy, me) : null],
    [L.approvedAt, when(order.approvedAt)],
    [L.sentAt, when(order.sentAt)],
    [L.productionStartedAt, when(order.productionStartedAt)],
    [L.returnedReason, order.status === "DRAFT" ? order.returnedReason : null],
    [L.cancellationReason, order.cancellationReason],
    [L.closingReason, order.closingReason],
    [L.note, order.note],
  ];

  return (
    <DetailSection title={L.general} icon={Info}>
      <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
        <InfoRow label={PRODUCTION_LABELS.order.column.code}>
          <span className="inline-flex items-center gap-3">
            <span className="font-[family-name:var(--font-mono)] font-medium">{order.code}</span>
            <ProductionStatusDot status={order.status} />
          </span>
        </InfoRow>
        <InfoRow label={L.salesOrder}>
          <Link
            href={ADMIN_ROUTES.orders.detail(order.salesOrderId)}
            className="text-accent font-[family-name:var(--font-mono)] hover:underline"
          >
            {batches.data?.orderNumber ?? shortId(order.salesOrderId)}
          </Link>
        </InfoRow>
        <InfoRow label={L.deliveryBatch}>
          {batch
            ? `${PRODUCTION_LABELS.drawUp.batch} ${batch.seq} · ${formatWindow(batch.windowStart, batch.windowEnd)}`
            : EMPTY_CELL}
        </InfoRow>
        <InfoRow label={L.customer}>
          {order.customerId ? <CustomerName id={order.customerId} /> : EMPTY_CELL}
        </InfoRow>
        <InfoRow label={L.producer}>
          {producerLabel(producers.byId(order.producerId), order.producerId)}
        </InfoRow>
        <InfoRow label={L.warehouse}>
          <span className="font-[family-name:var(--font-mono)]">
            {receivingWarehouseCode(order) ?? shortId(order.receivingWarehouseId)}
          </span>
        </InfoRow>
        <InfoRow label={L.needBy}>{formatDate(order.needByDate)}</InfoRow>
        <InfoRow label={L.expected}>
          {order.expectedCompletionDate ? formatDate(order.expectedCompletionDate) : EMPTY_CELL}
        </InfoRow>
        <InfoRow label={L.sample}>
          {order.sampleApprovalRequired ? L.sampleOn : L.sampleOff}
          {order.sampleRequiredByDefault && (
            <span className="text-ink-tertiary block text-xs">{L.sampleDefaultHint}</span>
          )}
        </InfoRow>
        {!order.sampleApprovalRequired && order.sampleWaiverReason && (
          <InfoRow label={L.waiverReason}>{order.sampleWaiverReason}</InfoRow>
        )}
        <InfoRow label={L.drawnUpBy}>{actorLabel(order.drawnUpBy, me)}</InfoRow>
        {optionalRows
          .filter(([, value]) => Boolean(value))
          .map(([label, value]) => (
            <InfoRow key={label} label={label}>
              <span className="whitespace-pre-line">{value}</span>
            </InfoRow>
          ))}
      </div>
    </DetailSection>
  );
}
