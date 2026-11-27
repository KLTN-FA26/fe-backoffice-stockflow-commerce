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
import {
  codeNameLabel,
  producerLabelOf,
  receivingWarehouseCode,
  receivingWarehouseName,
} from "@/features/production-order/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { EMPTY_CELL } from "@/components/shared/column-helpers";
import { DetailSection, InfoRow } from "@/components/shared/DetailSection";

import { formatWindow, producerLabel, ProductionStatusDot, shortId } from "../parts";

import type { ProductionOrder } from "@/features/production-order/types";

const L = PRODUCTION_LABELS.detail;

/**
 * Người thao tác: "Bạn" khi là người đang đăng nhập; còn lại tên BE kèm sẵn (#286 `xxxByName`); BE cũ không kèm tên →
 * mã nhân viên rút gọn.
 */
export function actorLabel(
  id: string | null | undefined,
  me: string | null | undefined,
  name?: string | null,
): string {
  if (!id) return name || L.system;
  if (id === me) return L.you;
  return name || L.userShort(id);
}

const when = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : null);

/**
 * "Thông tin chung" (docs 17 §4.3 bảng đầu đơn): mã, trạng thái, đơn bán + đợt giao (cửa sổ), khách, đơn vị sản xuất,
 * kho nhận, ngày cần hàng / dự kiến, cờ duyệt mẫu, người lập / gửi và các mốc, ghi chú nhận đơn, lý do huỷ / đóng.
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
  // #286: BE kèm tên đơn vị → chỉ tra danh mục khi BE cũ chưa kèm
  const producers = useProducerDirectory(can(PRODUCER_PERMISSIONS.read) && !order.producerName);
  const batches = useSalesOrderBatches(
    order.salesOrderId,
    can(ORDER_DELIVERY_BATCH_PERMISSIONS.read),
  );
  const batch = batches.data?.batches.find((b) => b.batchId === order.deliveryBatchId);
  // Người gửi + giờ gửi (docs 17 §4.3 bước 7). Người duyệt / gửi duyệt chỉ có ở đơn trước 2026-11-20 (BR-23 chốt lại)
  const optionalRows: [string, string | null | undefined][] = [
    [L.sentBy, order.sentBy ? actorLabel(order.sentBy, me, order.sentByName) : null],
    [L.sentAt, when(order.sentAt)],
    [L.submittedAt, when(order.submittedAt)],
    [
      L.approvedBy,
      order.approvedBy ? actorLabel(order.approvedBy, me, order.approvedByName) : null,
    ],
    [L.approvedAt, when(order.approvedAt)],
    [L.acceptanceNote, order.acceptanceNote],
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
          {/* Mã luôn một dòng; trạng thái xuống dòng dưới để cột hẹp không bẻ mã giữa chừng */}
          <span className="flex flex-col items-start gap-1">
            <span className="font-[family-name:var(--font-mono)] font-medium whitespace-nowrap">
              {order.code}
            </span>
            <ProductionStatusDot status={order.status} />
          </span>
        </InfoRow>
        <InfoRow label={L.salesOrder}>
          <Link
            href={ADMIN_ROUTES.orders.detail(order.salesOrderId)}
            className="text-accent-text font-[family-name:var(--font-mono)] hover:underline"
          >
            {order.salesOrderNumber ?? batches.data?.orderNumber ?? shortId(order.salesOrderId)}
          </Link>
        </InfoRow>
        <InfoRow label={L.deliveryBatch}>
          {batch
            ? `${PRODUCTION_LABELS.drawUp.batch} ${batch.seq} · ${formatWindow(batch.windowStart, batch.windowEnd)}`
            : EMPTY_CELL}
        </InfoRow>
        <InfoRow label={L.customer}>
          {order.customerId ? (
            <CustomerName
              id={order.customerId}
              name={order.customerName}
              code={order.customerCode}
            />
          ) : (
            EMPTY_CELL
          )}
        </InfoRow>
        <InfoRow label={L.producer}>
          {producerLabelOf(order) ??
            producerLabel(producers.byId(order.producerId), order.producerId)}
        </InfoRow>
        <InfoRow label={L.warehouse}>
          {codeNameLabel(receivingWarehouseCode(order), receivingWarehouseName(order)) ??
            shortId(order.receivingWarehouseId)}
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
        <InfoRow label={L.drawnUpBy}>
          {actorLabel(order.drawnUpBy, me, order.drawnUpByName)}
        </InfoRow>
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
