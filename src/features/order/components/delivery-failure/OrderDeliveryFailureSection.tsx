"use client";

import { PackageX } from "lucide-react";

import { DELIVERY_FAILURE_LABELS, ORDER_PERMISSIONS } from "@/constants";

import { canCancelWithoutCase } from "../../delivery-failure-lifecycle";
import { useOrderDeliveryFailures } from "../../delivery-failure-queries";

import { CancelUndeliveredAction } from "./CancelUndeliveredAction";
import { DeliveryFailureCaseItem } from "./DeliveryFailureCaseItem";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../../types";

const L = DELIVERY_FAILURE_LABELS.section;

/** Đơn có thể có hồ sơ giao thất bại: đã có lô giao (lô hãng mang về), hoặc đang giữ vì giao thất bại. */
function mayHaveFailures(order: Pick<Order, "shipments" | "holdReason">): boolean {
  return (
    order.holdReason === "DELIVERY_FAILED" ||
    order.shipments.some((shipment) => shipment.status === "RETURNED")
  );
}

/**
 * Khối "Giao thất bại" trong chi tiết đơn (WF-05 GH-1; BE `GET /orders/{id}/delivery-failures`): mỗi hồ sơ với nút Giao lại
 * / Huỷ phần chưa giao, và — khi lô đã về mà kho chưa lập phiếu nhận hàng hoàn — nút huỷ phần chưa giao không cần hồ sơ.
 * Chỉ hiện khi đơn có lô hãng mang về / đang giữ vì giao thất bại. UI-only — Backend phải re-check (sales-orders:READ).
 */
export function OrderDeliveryFailureSection({
  order,
  can,
}: {
  order: Order;
  can: (code: PermissionCode) => boolean;
}) {
  const relevant = mayHaveFailures(order);
  const query = useOrderDeliveryFailures(order.orderId, {
    enabled: relevant && can(ORDER_PERMISSIONS.read),
  });
  if (!relevant || !can(ORDER_PERMISSIONS.read)) return null;
  const cases = query.data ?? [];
  const withoutCase = query.isSuccess && canCancelWithoutCase(order, cases, can);

  return (
    <section
      aria-label={L.title}
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-3 flex items-center gap-1.5 text-[0.9375rem] font-semibold">
        <PackageX className="text-warning size-3.5" aria-hidden="true" /> {L.title}
      </h2>
      {query.isPending ? (
        <p className="text-ink-tertiary text-xs">{L.loading}</p>
      ) : query.isError ? (
        <p role="alert" className="text-danger text-xs">
          {L.failed}
        </p>
      ) : cases.length === 0 && !withoutCase ? (
        <p className="text-ink-tertiary text-xs">{L.none}</p>
      ) : (
        <ul className="divide-y divide-[var(--table-line)]">
          {cases.map((failure) => (
            <DeliveryFailureCaseItem
              key={failure.caseId}
              failure={failure}
              currency={order.currency}
              can={can}
            />
          ))}
        </ul>
      )}
      {withoutCase && (
        <div className="border-border-default mt-3 space-y-2 border-t pt-3">
          <p className="text-ink-secondary text-xs">{L.uncased}</p>
          <CancelUndeliveredAction
            target={{ orderId: order.orderId, orderNumber: order.orderNumber }}
          />
        </div>
      )}
    </section>
  );
}
