"use client";

import { History } from "lucide-react";

import { ORDER_HISTORY_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { useOrderHistory } from "../queries";

import { OrderHistoryItem } from "./OrderHistoryItem";

const L = ORDER_HISTORY_LABELS;

function HistoryBody({ id }: { id: string }) {
  const query = useOrderHistory(id);
  if (query.isError) {
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        {L.loadFailed}{" "}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => void query.refetch()}
        >
          {L.retry}
        </Button>
      </p>
    );
  }
  if (query.isPending) return <p className="text-ink-tertiary text-[0.8125rem]">{L.loading}</p>;
  if (query.data.length === 0) {
    return <p className="text-ink-tertiary text-[0.8125rem]">{L.empty}</p>;
  }
  return (
    <ol className="space-y-3">
      {query.data.map((entry, index) => (
        <OrderHistoryItem key={`${entry.occurredAt}-${index}`} entry={entry} />
      ))}
    </ol>
  );
}

/**
 * Lịch sử đơn (BE `GET /orders/{id}/history`, cũ nhất trước): đổi trạng thái (`STATUS_CHANGE`) xen với quyết
 * định giao một phần của Sales (`PARTIAL_SHIPMENT_DECISION`, BE PR #150) — mục sau render riêng: "Bật / Tắt giao
 * một phần", ai, khi nào, ghi chú; và đổi hình thức giao của điều phối viên (`DELIVERY_MODE_CHANGE`, BE PR #157)
 * — "Đổi hình thức giao: Giao lẻ → Nguyên xe (FTL)". Chỉ vẽ khi người xem đọc được đơn (cha kiểm quyền).
 */
export function OrderHistory({ orderId }: { orderId: string }) {
  return (
    <section
      aria-label={L.title}
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <History className="text-accent size-4" />
        {L.title}
      </h2>
      <HistoryBody id={orderId} />
    </section>
  );
}
