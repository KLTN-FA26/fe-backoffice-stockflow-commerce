"use client";

import { CUSTOMER_STATUS_BY_API } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDateTime } from "@/lib/format/date";
import { useCustomerStatusHistory } from "@/features/customer/queries";
import { Card } from "@/components/shared/Card";
import { Skeleton } from "@/components/shared/Skeleton";

import type { CustomerApiStatus } from "@/constants";

function label(status: CustomerApiStatus) {
  const key = CUSTOMER_STATUS_BY_API[status];
  return STATUS_LABEL_VI[key] ?? key;
}

/** Lịch sử trạng thái thật từ BE (`customer_status_history`) — chỉ xem, không sửa tay. */
export function StatusHistoryCard({ customerId }: { customerId: string }) {
  const history = useCustomerStatusHistory(customerId);
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">Lịch sử trạng thái</h2>
      {history.isPending && <Skeleton className="h-16" />}
      {history.isError && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          Không tải được lịch sử trạng thái.{" "}
          <button type="button" className="underline" onClick={() => void history.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {history.data?.length === 0 && (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa có thay đổi trạng thái.</p>
      )}
      {!!history.data?.length && (
        <ol className="border-border-default space-y-3 border-l pl-4">
          {history.data.map((entry) => (
            <li key={`${entry.changedAt}-${entry.toStatus}`} className="text-[0.8125rem]">
              <div className="text-ink-primary font-medium">
                {entry.fromStatus ? `${label(entry.fromStatus)} → ` : "Tạo mới → "}
                {label(entry.toStatus)}
              </div>
              <div className="text-ink-tertiary tabular-nums">
                {formatDateTime(entry.changedAt)}
              </div>
              {entry.reason && (
                <div className="text-ink-secondary mt-0.5">Lý do: {entry.reason}</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
