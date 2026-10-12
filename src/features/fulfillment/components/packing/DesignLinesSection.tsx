"use client";

import { UI_LABELS } from "@/constants";
import { designLineViews, isOnDesignHold } from "@/features/fulfillment/selectors";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";

import { OrderReadError } from "../detail/OrderReadError";
import { Section } from "../primitives";
import { DesignLineCard } from "./DesignLineCard";

import type { UseQueryResult } from "@tanstack/react-query";
import type { FulfillmentOrder, FulfillmentTask } from "@/features/fulfillment/types";

const { fulfillment } = UI_LABELS;

/**
 * Các dòng tuỳ chỉnh của đơn kèm thiết kế đã khoá. Nguồn dòng: đơn hàng (cần `sales-orders:READ`);
 * không đọc được đơn thì suy từ evidence — chỉ có sau lần đóng gói đầu tiên.
 */
export function DesignLinesSection({
  task,
  canReadOrders,
  order,
  canDownload,
}: {
  task: FulfillmentTask;
  canReadOrders: boolean;
  order: UseQueryResult<FulfillmentOrder>;
  canDownload: boolean;
}) {
  const lines = designLineViews(task, order.data?.lines);

  function body() {
    if (lines.length > 0) {
      return (
        <div className="space-y-3">
          {lines.map((line, index) => (
            <DesignLineCard
              key={line.lineId}
              taskId={task.taskId}
              line={line}
              index={index}
              canDownload={canDownload}
              onDesignHold={isOnDesignHold(task)}
            />
          ))}
        </div>
      );
    }
    if (!canReadOrders) {
      return (
        <Alert tone="warning" title={fulfillment.noOrderReadTitle}>
          Dòng tuỳ chỉnh đọc từ đơn hàng. Tài khoản chưa được cấp quyền xem đơn hàng nên chưa hiện
          được thiết kế trước lần đối chiếu đầu tiên — liên hệ quản trị để được cấp.
        </Alert>
      );
    }
    if (order.isPending) return <Skeleton className="h-40 w-full" />;
    if (order.isError) {
      return (
        <OrderReadError scope="packing" error={order.error} onRetry={() => void order.refetch()} />
      );
    }
    return <p className="text-ink-secondary text-[0.8125rem]">{fulfillment.noDesignLines}</p>;
  }

  return (
    <Section
      title="Dòng tuỳ chỉnh — thiết kế đã khoá"
      description="So thành phẩm với thiết kế khách đã chốt trước khi xác nhận đóng gói."
    >
      {body()}
    </Section>
  );
}
