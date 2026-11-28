import { Fragment } from "react";
import Link from "next/link";

import { ADMIN_ROUTES, CUSTOMER_FALLBACK_LABEL, ORDER_DELIVERY_FAILURE_LABELS } from "@/constants";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { LifecycleSteps, ProfileFact, ProfileFrame } from "@/components/shared/ObjectPage";

import { canChangeShippingAddress } from "../shipping-address";

import { orderLifecycle } from "./order-lifecycle-steps";

import { OrderShippingAddressAction } from "./OrderShippingAddressAction";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../types";

interface OrderInfoCardProps {
  order: Order;
  can: (code: PermissionCode) => boolean;
}

const EMPTY = "—";

/** Mốc thời gian vòng đời đơn (BE PR #133) — chỉ hiện mốc đã có. */
const MILESTONES = [
  ["packedAt", "Đóng gói xong"],
  ["shippedAt", "Bàn giao vận chuyển"],
  ["deliveredAt", "Đã giao"],
  ["completedAt", "Hoàn tất"],
  ["closedAt", "Đã đóng sổ"],
] as const satisfies readonly (readonly [keyof Order, string])[];

/**
 * Khung hồ sơ đơn (backoffice-erp-ui B11): vòng đời nằm ngang ở đầu khung, 8 thông số (khách, báo giá nguồn, ngày đặt,
 * người nhận, email, địa chỉ giao kèm nút đổi, kho xuất, release), cuối khung là các mốc thời gian đã có và lý do giao
 * thất bại. Mã đơn, trạng thái và thao tác nằm ở header.
 */
export function OrderInfoCard({ order, can }: OrderInfoCardProps) {
  const flow = orderLifecycle(order.status);
  const milestones = MILESTONES.filter(([key]) => order[key]);
  const footer =
    milestones.length > 0 || order.deliveryFailureReason ? (
      <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-[0.8125rem]">
        {milestones.map(([key, label]) => {
          const value = order[key];
          return value ? (
            <Fragment key={key}>
              <div className="flex gap-1.5">
                <dt className="text-ink-tertiary">{label}</dt>
                <dd className="text-ink-primary tabular-nums">{formatDateTime(value)}</dd>
              </div>
            </Fragment>
          ) : null;
        })}
        {order.deliveryFailureReason && (
          <div className="flex gap-1.5">
            <dt className="text-ink-tertiary">Giao thất bại</dt>
            <dd className="text-ink-primary">
              {order.deliveryFailureReason === "UNKNOWN"
                ? "Không rõ"
                : ORDER_DELIVERY_FAILURE_LABELS[order.deliveryFailureReason]}
            </dd>
          </div>
        )}
      </dl>
    ) : undefined;

  return (
    <ProfileFrame
      label="Hồ sơ đơn hàng"
      head={<LifecycleSteps label="Vòng đời đơn hàng" steps={flow.steps} current={flow.current} />}
      footer={footer}
    >
      <ProfileFact label="Khách hàng">
        {/* L-4: tên và mã khách trên hai dòng — không còn "Khách hàng demo0399990001". */}
        <span className="block truncate">
          {order.customerId
            ? order.customerName || order.customerCode || CUSTOMER_FALLBACK_LABEL
            : EMPTY}
        </span>
        {order.customerName && order.customerCode && (
          <span className="text-ink-secondary block font-[family-name:var(--font-mono)] text-xs font-normal">
            {order.customerCode}
          </span>
        )}
      </ProfileFact>
      <ProfileFact label="Báo giá">
        {order.sourceQuoteId ? (
          // BO-UX-25: quay về báo giá nguồn để so giá đã chốt (R5-7).
          <Link
            href={ADMIN_ROUTES.quotes.detail(order.sourceQuoteId)}
            className="text-accent-text hover:underline"
          >
            Từ báo giá{" "}
            <span className="font-[family-name:var(--font-mono)]">
              {order.sourceQuoteNumber ?? ""}
            </span>
          </Link>
        ) : (
          EMPTY
        )}
      </ProfileFact>
      <ProfileFact label="Ngày đặt">
        <span className="tabular-nums">{formatDate(order.placedAt)}</span>
      </ProfileFact>
      {/* bo-18: chữ dài cắt bằng "…" trong ô (ProfileFact), bản đầy đủ ở tooltip — email không tràn khỏi khung. */}
      <ProfileFact
        label="Người nhận"
        title={[order.recipientName, order.recipientPhone].filter(Boolean).join(" · ") || undefined}
      >
        {order.recipientName || EMPTY}
        {order.recipientPhone && ` · ${order.recipientPhone}`}
      </ProfileFact>
      <ProfileFact label="Email" title={order.contactEmail ?? undefined}>
        {order.contactEmail ?? EMPTY}
      </ProfileFact>
      <ProfileFact label="Địa chỉ giao" title={order.shippingAddressText ?? undefined}>
        <span className="block truncate">{order.shippingAddressText ?? EMPTY}</span>
        {/* Ẩn từ thùng đầu tiên dán nhãn (08 BR-04). UI-only — Backend phải re-check (BR-16, ORDER_ADDRESS_LOCKED) */}
        {canChangeShippingAddress(order, can) && (
          <span className="mt-0.5 block font-normal">
            <OrderShippingAddressAction order={order} />
          </span>
        )}
      </ProfileFact>
      <ProfileFact label="Kho xuất">
        {/* Issue #286: tên + mã kho BE kèm trên đơn — không tải cả danh mục kho, người thiếu quyền đọc kho vẫn thấy tên */}
        {order.warehouseId ? (
          <>
            <span className="block truncate">
              {order.warehouseName ?? order.warehouseCode ?? (
                <span className="text-ink-secondary">Đã chọn kho xuất</span>
              )}
            </span>
            {order.warehouseName && order.warehouseCode && (
              <span className="text-ink-secondary block font-[family-name:var(--font-mono)] text-xs font-normal">
                {order.warehouseCode}
              </span>
            )}
          </>
        ) : (
          "Chưa chọn kho xuất"
        )}
      </ProfileFact>
      <ProfileFact label="Xuất kho lúc">
        {order.releasedAt ? (
          <span className="tabular-nums">{formatDateTime(order.releasedAt)}</span>
        ) : (
          EMPTY
        )}
      </ProfileFact>
    </ProfileFrame>
  );
}
