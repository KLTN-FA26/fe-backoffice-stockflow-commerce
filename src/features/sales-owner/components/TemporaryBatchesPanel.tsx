"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";

import { SALES_OWNER_CHANGE_REASON_LABELS } from "@/constants/labels-sales-owner";

import { formatDate } from "@/lib/format/date";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { transferErrorMessage } from "../errors";
import { useReturnTransferBatch } from "../mutations";
import { useTemporaryBatches } from "../queries";

import { TransferResultView } from "./TransferResultView";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { TransferBatch, TransferResult } from "../types";

const returnLabel = (batch: TransferBatch) => `Trả lại cho ${batch.fromName ?? "Sale cũ"}`;

function columns(onReturn: (batch: TransferBatch) => void, canUpdate: boolean) {
  const cols: ColumnDef<TransferBatch>[] = [
    { key: "from", header: "Của Sale", cell: (b) => b.fromName ?? "—" },
    { key: "to", header: "Đang ở", cell: (b) => (b.toNames ?? []).join(", ") || "—" },
    {
      key: "reason",
      header: "Lý do",
      cell: (b) => (b.reason ? SALES_OWNER_CHANGE_REASON_LABELS[b.reason] : "—"),
    },
    {
      key: "held",
      header: "Khách còn giữ",
      align: "right",
      cell: (b) => <span className="tabular-nums">{b.stillHeld ?? b.moved ?? "—"}</span>,
    },
    {
      key: "createdAt",
      header: "Ngày chuyển",
      cell: (b) => (b.createdAt ? formatDate(b.createdAt) : "—"),
    },
  ];
  return [
    ...cols,
    rowActionsColumn<TransferBatch>((batch) => ({
      label: `Thao tác — lô của ${batch.fromName ?? batch.batchId}`,
      actions: [
        {
          label: `${returnLabel(batch)}…`,
          icon: Undo2,
          onSelect: () => onReturn(batch),
          disabled: !canUpdate || !!batch.returnedAt,
          hint: batch.returnedAt ? `Đã trả ${formatDate(batch.returnedAt)}` : undefined,
        },
      ],
    })),
  ];
}

/**
 * Lô chuyển tạm (§10.1 nghỉ dài: "khi A đi làm lại, Manager trả lại đúng các khách đó trong một thao tác"). Khách của lô
 * đã bị chuyển tiếp vì lý do khác thì BE không tự trả, báo trong kết quả. BE chưa liệt kê được lô → phần này ẩn.
 */
export function TemporaryBatchesPanel({ canUpdate }: { canUpdate: boolean }) {
  const query = useTemporaryBatches();
  const returning = useReturnTransferBatch();
  const [target, setTarget] = useState<TransferBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);
  if (query.data === null || query.isError) return null;
  const batches = (query.data ?? []).filter((b) => b.temporary !== false);

  return (
    <DetailPanel title="Lô chuyển tạm" count={batches.length} flush>
      <DataTable
        data={batches}
        columns={columns((batch) => {
          setError(null);
          setResult(null);
          setTarget(batch);
        }, canUpdate)}
        rowKey={(b) => b.batchId}
        emptyState="Chưa có lô chuyển tạm nào."
      />
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target ? returnLabel(target) : ""}
        description="Khách của lô còn ở người nhận sẽ về lại Sale cũ. Khách đã được chuyển tiếp vì lý do khác thì giữ nguyên."
        confirmLabel="Trả lại"
        variant="default"
        closeOnConfirm={false}
        loading={returning.isPending}
        confirmDisabled={!!result}
        error={result ? <TransferResultView result={result} /> : error}
        onConfirm={() =>
          target &&
          returning.mutate(target.batchId, {
            onSuccess: setResult,
            onError: (e) => setError(transferErrorMessage(e)),
          })
        }
      />
    </DetailPanel>
  );
}
