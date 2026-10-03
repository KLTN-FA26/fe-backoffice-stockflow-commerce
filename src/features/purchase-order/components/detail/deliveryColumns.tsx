import { Check } from "lucide-react";

import { SUPPLIER_CHANNEL_LABELS, UI_LABELS } from "@/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { deliveryRound, isFirstDelivery } from "@/features/purchase-order";
import { StatusDot } from "@/components/shared/StatusDot";

import type { DeliveryAttempt, DeliveryDecision } from "@/features/purchase-order";
import type { ColumnDef } from "@/components/shared/DataTable";

const NUM = "tabular-nums";
/** Số (lượt) được dùng font mono; ngày giờ thì không — khó đọc. */
const MONO_NUM = "font-[family-name:var(--font-mono)] tabular-nums";
const MUTED = "text-ink-tertiary";

const channelLabel = (c: string) => (c === "EMAIL" || c === "API" ? SUPPLIER_CHANNEL_LABELS[c] : c);

/** Ô chữ dài (người nhận, lý do, lỗi): cắt 1 dòng, hover xem đủ. */
function Truncate({
  text,
  className = "",
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return <span className={MUTED}>—</span>;
  return (
    <span title={text} className={`block max-w-[220px] truncate ${className}`}>
      {text}
    </span>
  );
}

const Yes = ({ value }: { value: boolean }) =>
  value ? (
    <Check aria-label="Có" className="text-positive size-4" />
  ) : (
    <span className={MUTED}>—</span>
  );

/** Loại quyết định suy từ lượt (BE: generation 0 = gửi lần đầu, ≥1 = khôi phục gửi). */
export const decisionTypeLabel = (generation: number) =>
  isFirstDelivery(generation) ? "Gửi lần đầu" : "Khôi phục gửi";

export { channelLabel };

const generationCell = <T extends { generation: number }>(): ColumnDef<T> => ({
  key: "generation",
  header: "Lượt",
  align: "right",
  cell: (r) => <span className={MONO_NUM}>{deliveryRound(r.generation)}</span>,
});

/** `/deliveries` — từng lần hệ thống gửi email/API tới NCC. */
export const ATTEMPT_COLUMNS: ColumnDef<DeliveryAttempt>[] = [
  generationCell<DeliveryAttempt>(),
  {
    key: "attemptedAt",
    header: UI_LABELS.purchaseOrder.delivery.attemptedAt,
    cell: (r) => <span className={NUM}>{formatDateTime(r.attemptedAt)}</span>,
  },
  { key: "channel", header: "Kênh", cell: (r) => channelLabel(r.channel) },
  {
    key: "recipient",
    header: UI_LABELS.purchaseOrder.delivery.recipient,
    cell: (r) => <Truncate text={r.recipient} />,
  },
  {
    key: "status",
    header: UI_LABELS.purchaseOrder.delivery.result,
    cell: (r) => <StatusDot domain="po" status={r.status} size="sm" withIcon />,
  },
  {
    key: "sentAt",
    header: UI_LABELS.purchaseOrder.delivery.deliveredAt,
    cell: (r) =>
      r.sentAt ? (
        <span className={NUM}>{formatDateTime(r.sentAt)}</span>
      ) : (
        <span className={MUTED}>—</span>
      ),
  },
];

/** `/delivery-decisions` — ai cho phép gửi lần đầu / khôi phục gửi, và vì sao. */
export const DECISION_COLUMNS: ColumnDef<DeliveryDecision>[] = [
  generationCell<DeliveryDecision>(),
  {
    key: "type",
    header: "Loại",
    cell: (r) => decisionTypeLabel(r.generation),
  },
  {
    key: "actor",
    header: UI_LABELS.purchaseOrder.delivery.actor,
    cell: (r) => r.actor ?? <span className={MUTED}>—</span>,
  },
  {
    key: "requestedAt",
    header: UI_LABELS.purchaseOrder.delivery.requestedAt,
    cell: (r) => <span className={NUM}>{formatDateTime(r.requestedAt)}</span>,
  },
  {
    key: "expectedAt",
    header: "Ngày giao",
    cell: (r) => {
      if (!r.expectedAt) return <span className={MUTED}>—</span>;
      const changed = r.previousExpectedAt && r.previousExpectedAt !== r.expectedAt;
      return (
        <span className={NUM}>
          {changed && r.previousExpectedAt ? `${formatDate(r.previousExpectedAt)} → ` : ""}
          {formatDate(r.expectedAt)}
        </span>
      );
    },
  },
  {
    key: "reconciled",
    header: "Đã đối chiếu",
    align: "center",
    cell: (r) => <Yes value={r.reconciled} />,
  },
  {
    key: "acknowledgePastDue",
    header: "Xác nhận quá hạn",
    align: "center",
    cell: (r) => <Yes value={r.acknowledgePastDue} />,
  },
];
