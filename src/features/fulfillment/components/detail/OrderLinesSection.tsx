"use client";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";
import { Badge } from "@/components/ui/badge";

import { MONO, NUM, Section } from "../primitives";
import { OrderReadError } from "./OrderReadError";

import type { UseQueryResult } from "@tanstack/react-query";
import type { FulfillmentOrder } from "@/features/fulfillment/types";
import type { FulfillmentScope } from "../primitives";

const { fulfillment } = UI_LABELS;
const TH = "text-ink-secondary px-3 py-2 text-left text-xs font-medium";
const TD = "px-3 py-2 text-[0.8125rem]";

/**
 * Dòng cần lấy — đọc từ ĐƠN HÀNG vì task BE không có dòng (chưa có pick line / quét / shortfall).
 * Chỉ để xem: SKU + SL đặt. BR-06 (docs 07 §6): dòng tuỳ chỉnh không lấy thành phẩm từ kệ.
 */
export function OrderLinesSection({
  scope,
  canReadOrders,
  order,
}: {
  scope: FulfillmentScope;
  canReadOrders: boolean;
  order: UseQueryResult<FulfillmentOrder>;
}) {
  return (
    <Section
      title="Dòng đơn hàng"
      description="SKU và số lượng theo đơn. Hệ thống chưa ghi nhận lấy hàng theo từng dòng."
    >
      {!canReadOrders ? (
        <Alert tone="warning" title={fulfillment.noOrderReadTitle}>
          {fulfillment.noOrderReadDescription}
        </Alert>
      ) : order.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : order.isError ? (
        <OrderReadError scope={scope} error={order.error} onRetry={() => void order.refetch()} />
      ) : (
        <div className="border-border-default overflow-hidden rounded-[var(--r-sm)] border">
          <table className="w-full">
            <caption className="sr-only">Dòng của đơn {order.data.orderNumber}</caption>
            <thead className="bg-bg-subtle border-border-default border-b">
              <tr>
                <th scope="col" className={TH}>
                  #
                </th>
                <th scope="col" className={TH}>
                  SKU
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  SL đặt
                </th>
                <th scope="col" className={TH}>
                  Loại dòng
                </th>
              </tr>
            </thead>
            <tbody>
              {order.data.lines.map((line, index) => (
                <tr key={line.lineId} className="border-border-default border-b last:border-b-0">
                  <td className={`${TD} text-ink-tertiary tabular-nums`}>{index + 1}</td>
                  <td className={`${TD} text-ink-primary ${MONO}`}>{line.sku}</td>
                  <td className={`${TD} text-ink-primary ${NUM}`}>{line.quantity}</td>
                  <td className={TD}>
                    {line.designSnapshotId ? (
                      <Badge variant="outline" className="rounded-[var(--r-sm)] font-normal">
                        Tuỳ chỉnh · có thiết kế đã khoá
                      </Badge>
                    ) : (
                      <span className="text-ink-secondary">Hàng thường</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
