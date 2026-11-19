"use client";

import { useState } from "react";
import { Factory, Plus } from "lucide-react";

import {
  PRODUCER_PERMISSIONS,
  PRODUCER_STATUS_LABELS,
  PRODUCER_STATUSES,
  PRODUCTION_LABELS,
  UI_LABELS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { producerActions } from "@/features/producer/lifecycle";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import {
  ListToolbar,
  TOOLBAR_ACTION_CLASS,
  TOOLBAR_PRIMARY_CLASS,
} from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { buildProducerColumns } from "./list/columns";
import { useProducerListState } from "./list/useProducerListState";
import { ProducerFormDialog } from "./ProducerFormDialog";

import type { ProducerStatus } from "@/constants";
import type { Producer } from "@/features/producer/types";

const L = PRODUCTION_LABELS.producer;
const STATUS_OPTIONS = PRODUCER_STATUSES.map((value) => ({
  value,
  label: PRODUCER_STATUS_LABELS[value],
}));

type Dialog = { kind: "create" } | { kind: "edit"; producer: Producer };

function ProducerListContent() {
  const can = usePermissionChecker();
  const actions = producerActions({ can });
  const s = useProducerListState(actions.read);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const onEdit = actions.edit
    ? (producer: Producer) => setDialog({ kind: "edit", producer })
    : null;

  return (
    // Style Vercel (`.surface-soft`): không title hiển thị — tên trang ở breadcrumb
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {actions.read && (
        <ListToolbar<ProducerStatus, string, string>
          search={s.q}
          onSearchChange={s.setQ}
          searchPlaceholder={L.searchPlaceholder}
          statusOptions={STATUS_OPTIONS}
          selectedStatuses={s.status ? [s.status] : []}
          // BE nhận MỘT trạng thái → chọn một, bấm lại để bỏ
          onToggleStatus={(value) => s.setStatus(s.status === value ? null : value)}
          onClearStatuses={() => s.setStatus(null)}
          hasStatusFilter={s.status !== null}
          summaryItems={[
            {
              label: L.summarySearch,
              value: s.q || UI_LABELS.common.notEntered,
              active: s.q !== "",
              onClear: () => s.setQ(""),
            },
            {
              label: L.statusFilter,
              value: s.status ? PRODUCER_STATUS_LABELS[s.status] : L.all,
              active: s.status !== null,
              onClear: () => s.setStatus(null),
            },
          ]}
          actions={
            actions.create && (
              <Button
                size="sm"
                className={`${TOOLBAR_ACTION_CLASS} ${TOOLBAR_PRIMARY_CLASS}`}
                onClick={() => setDialog({ kind: "create" })}
              >
                <Plus className="size-3.5" /> {L.create}
              </Button>
            )
          }
          onResetAll={s.clearFilters}
          resetDisabled={!s.hasFilters}
        />
      )}
      <ServerTableBody
        query={s.query}
        canRead={actions.read}
        columns={buildProducerColumns(onEdit)}
        rowKey={(row) => row.id}
        onRowClick={onEdit ?? undefined}
        noun={L.noun}
        errorCopy={L.errorCopy}
        hasFilters={s.hasFilters}
        onClearFilters={s.clearFilters}
        empty={{
          icon: <Factory className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={s.pageSize}
        onPageChange={s.setPage}
        onPageSizeChange={s.changePageSize}
        stickyHeader
      />
      {dialog?.kind === "create" && <ProducerFormDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && (
        <ProducerFormDialog producer={dialog.producer} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/**
 * Danh mục đơn vị sản xuất (docs 17 §4.3): xưởng / đối tác in nhận Đơn sản xuất. Xem cần `sales-producers:READ`;
 * thêm cần `:CREATE`, sửa / ngừng dùng cần `:UPDATE` (Điều phối sản xuất — UI-only, Backend phải re-check).
 */
export function ProducerList() {
  return (
    <PermissionBoundary permissions={[PRODUCER_PERMISSIONS.viewPage]} variant="list">
      <ProducerListContent />
    </PermissionBoundary>
  );
}
