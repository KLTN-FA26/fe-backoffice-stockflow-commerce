"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";
import { SALES_OWNER_PERMISSIONS, SALES_WORKLOAD_PERMISSIONS } from "@/constants/sales-owner";

import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useAssignableSales } from "@/lib/references/sales-agents";
import { toSalesOption, useSalesWorkload } from "@/lib/references/sales-workload";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DataTable } from "@/components/shared/DataTable";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { useChatWorkload } from "../queries";
import { mergeWorkload } from "../selectors";

import { AssignmentSettingsDialog } from "./AssignmentSettingsDialog";
import { boardColumns } from "./board-columns";
import { ASSIGNMENT_COPY } from "./copy";
import { TemporaryBatchesPanel } from "./TemporaryBatchesPanel";
import { TransferDialog } from "./TransferDialog";
import { UnownedCustomersPanel } from "./UnownedCustomersPanel";

import type { SalesOption } from "@/lib/references/sales-workload";
import type { BoardRow } from "../selectors";

type Transfer = { from: string; extra?: SalesOption };

function AssignmentContent() {
  // Thao tác ghi cần customer-sales-owners:UPDATE (BR-S01) — UI-only, Backend phải re-check
  const canUpdate = useCan(SALES_OWNER_PERMISSIONS.update);
  const sales = useSalesWorkload();
  const targets = useAssignableSales(canUpdate);
  const chat = useChatWorkload();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [settings, setSettings] = useState<BoardRow | null>(null);

  if (sales.isPending) return <PageSkeleton variant="list" />;
  if (sales.isError || sales.data === null)
    return (
      <LoadErrorState
        error={sales.error}
        copy={ASSIGNMENT_COPY}
        onRetry={() => void sales.refetch()}
      />
    );
  const rows = mergeWorkload(sales.data, chat.data);
  const options = rows.map(toSalesOption);
  const customerCounts = new Map(
    rows.flatMap((row) => (row.customers == null ? [] : [[row.userId, row.customers] as const])),
  );

  return (
    // §10.4: bảng tải hiện thẳng (dùng nhiều nhất), dưới là lô chuyển tạm và khách cần giao
    <div className="surface-soft space-y-6">
      <h1 className="sr-only">{SALES_OWNER_LABELS.nav.assignment}</h1>
      <DetailPanel
        title="Bảng tải Sale"
        count={rows.length}
        description="Số liệu của từng Sale đang làm — bấm tiêu đề cột để sắp xếp."
        actions={
          canUpdate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setTransfer({ from: "" })}
            >
              <ArrowRightLeft className="size-3.5" aria-hidden /> Chuyển khách…
            </Button>
          ) : undefined
        }
        flush
      >
        <DataTable
          data={rows}
          columns={boardColumns({
            canUpdate,
            onTransfer: (row) => setTransfer({ from: row.userId }),
            onSettings: setSettings,
          })}
          rowKey={(row) => row.userId}
          caption={chat.data === null ? "Chưa có số hội thoại từ chat." : undefined}
          emptyState="Chưa có Sale nào đang làm."
        />
      </DetailPanel>
      <TemporaryBatchesPanel canUpdate={canUpdate} />
      <UnownedCustomersPanel
        canUpdate={canUpdate}
        onTransferAllOf={(owner) =>
          setTransfer({
            from: owner.userId,
            extra: { ...owner, paused: false, onLeave: false, coverName: null, coverUntil: null },
          })
        }
      />
      {transfer && (
        <TransferDialog
          sales={
            transfer.extra && !options.some((o) => o.userId === transfer.extra?.userId)
              ? [transfer.extra, ...options]
              : options
          }
          targets={targets.options ?? []}
          fromUserId={transfer.from}
          customerCounts={customerCounts}
          onClose={() => setTransfer(null)}
        />
      )}
      {settings && <AssignmentSettingsDialog row={settings} onClose={() => setSettings(null)} />}
    </div>
  );
}

/** "Phân công khách" (`/admin/sales/assignment`, §10.4) — chỉ quản lý (`sales-workload:READ`). */
export function AssignmentPage() {
  return (
    <PermissionBoundary permissions={[SALES_WORKLOAD_PERMISSIONS.read]} variant="list">
      <AssignmentContent />
    </PermissionBoundary>
  );
}
