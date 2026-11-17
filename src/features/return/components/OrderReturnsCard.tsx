"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { RETURN_LABELS, RETURN_REASON_LABELS } from "@/constants/labels-return";
import {
  RETURN_LATE_ORDER_STATUSES,
  RETURN_LIMITS,
  RETURN_OPENABLE_ORDER_STATUSES,
  RETURN_ROUTES,
  RMA_PERMISSIONS,
} from "@/constants/returns";
import { useCan } from "@/lib/auth/components/Can";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { getReturn } from "../api";
import { isReturnOpen } from "../lifecycle";
import { returnKeys, useOrderReturns } from "../queries";
import { openCaps, windowClosed } from "../selectors";

import { OpenReturnDialog } from "./OpenReturnDialog";
import { CodeLink, ReturnStatusDot, When } from "./primitives";

const L = RETURN_LABELS.orderCard;

/** Cùng hình `OrderReturnsSlotProps` của `features/order` (feature không import chéo — khớp theo cấu trúc). */
export interface OrderReturnsCardProps {
  orderId: string;
  orderNumber: string;
  status: string;
  deliveredAt: string | null;
  lines: { lineId: string; sku: string; deliveredQuantity: number; customPrinted: boolean }[];
}

const openable = (status: string) =>
  (RETURN_OPENABLE_ORDER_STATUSES as readonly string[]).includes(status);

/**
 * Thẻ "Trả hàng" trên màn đơn: các yêu cầu của đơn và nút Sale mở thay khách (docs 17 §4.10 bước 37). Không hiện với
 * đơn chưa giao và chưa có yêu cầu nào. Backend phải re-check (`sales-rmas:CREATE`, BR-RMA-001/002).
 */
export function OrderReturnsCard(props: OrderReturnsCardProps) {
  const canRead = useCan(RMA_PERMISSIONS.read);
  const canCreate = useCan(RMA_PERMISSIONS.create);
  const [opening, setOpening] = useState(false);
  const query = useOrderReturns(props.orderId, canRead);
  const rows = query.data?.items ?? [];
  // Chi tiết (có dòng) của các yêu cầu khác — chỉ khi mở form, để tính số còn trả được mỗi dòng
  const details = useQueries({
    queries: rows.map((row) => ({
      queryKey: returnKeys.detail(row.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getReturn(row.id, signal),
      enabled: opening,
    })),
  });
  if (!canRead || (!openable(props.status) && rows.length === 0)) return null;

  const loaded = details.flatMap((detail) => (detail.data ? [detail.data] : []));
  const caps = openCaps(props.lines, loaded, isReturnOpen);
  const late =
    (RETURN_LATE_ORDER_STATUSES as readonly string[]).includes(props.status) ||
    windowClosed(props.deliveredAt, RETURN_LIMITS.windowDays, new Date());
  const ready = details.every((detail) => !detail.isPending);

  return (
    <Card className="space-y-3 text-[0.8125rem]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">{L.title}</h2>
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <Link
              href={`${RETURN_ROUTES.list}?tab=all&q=${encodeURIComponent(props.orderNumber)}`}
              className="text-accent hover:underline"
            >
              {L.viewAll}
            </Link>
          )}
          {canCreate && openable(props.status) && (
            <Button size="sm" variant="outline" onClick={() => setOpening(true)}>
              <Plus className="size-3.5" /> {RETURN_LABELS.actions.openForCustomer}
            </Button>
          )}
        </div>
      </div>
      {query.isPending ? (
        <p className="text-ink-tertiary">{L.loading}</p>
      ) : query.isError ? (
        <p className="text-danger">{L.failed}</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-tertiary">{L.none}</p>
      ) : (
        <ul className="divide-y divide-[var(--table-line)]">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5"
            >
              <CodeLink href={RETURN_ROUTES.detail(row.id)}>{row.rmaNumber}</CodeLink>
              <span className="text-ink-secondary">{RETURN_REASON_LABELS[row.reasonCode]}</span>
              <When iso={row.requestedAt} />
              <ReturnStatusDot status={row.status} />
            </li>
          ))}
        </ul>
      )}
      <OpenReturnDialog
        open={opening && ready}
        orderId={props.orderId}
        orderNumber={props.orderNumber}
        late={late}
        lines={props.lines.map((line) => ({
          lineId: line.lineId,
          sku: line.sku,
          customPrinted: line.customPrinted,
          cap: caps.get(line.lineId) ?? line.deliveredQuantity,
        }))}
        onClose={() => setOpening(false)}
      />
    </Card>
  );
}
