"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  PUTAWAY_COLUMNS as C,
  PUTAWAY_LABELS,
  PUTAWAY_LIMITS,
  PUTAWAY_TASK_PERMISSIONS,
  WORKSPACE_PATHS,
} from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useWorkspaceHref } from "@/lib/workspace";
import { isPutawayTaskClosed } from "@/features/putaway/lifecycle";
import { usePutawayTasks } from "@/features/putaway/queries";
import { filterPutawayTasks, sortByLpn } from "@/features/putaway/selectors";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { ScanInput } from "@/components/backoffice/ScanInput";
import { Alert } from "@/components/shared/Alert";
import { ColumnFilterButton, withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { putawayColumns } from "./putaway-columns";
import { PutawayEmpty } from "./PutawayEmpty";
import { PutawayToolbar } from "./PutawayToolbar";
import { usePutawayColumns } from "./usePutawayColumns";
import { usePutawayFilters } from "./usePutawayFilters";

import type { ScanFeedback } from "@/components/backoffice/ScanInput";
import type { PutawayFiltersState } from "./usePutawayFilters";

const L = PUTAWAY_LABELS;

/** Lọc chữ trên header cột — chỉ lọc dòng đã tải, không gọi lại API (data-table-mode-a §4.1). */
function headerFilters({ filters, set }: PutawayFiltersState) {
  const text = (label: string, value: string, onChange: (next: string) => void) => (
    <ColumnFilterButton
      label={label}
      value={value}
      placeholder={L.columnSearch(label)}
      onChange={onChange}
    />
  );
  return {
    [C.LPN]: text(L.column.lpn, filters.lpn, (lpn) => set({ lpn })),
    [C.SKU]: text(L.column.sku, filters.sku, (sku) => set({ sku })),
    [C.SOURCE_LOCATION]: text(L.column.sourceLocation, filters.location, (location) =>
      set({ location }),
    ),
  };
}

function PutawayContent() {
  const state = usePutawayFilters();
  const columns = usePutawayColumns();
  const href = useWorkspaceHref();
  const query = usePutawayTasks(state.params);
  const data = query.data;
  const router = useRouter();
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  // Quét LPN → mở đúng thùng đó (không phân biệt hoa thường); không có thùng chờ cất nào khớp → báo ngay tại ô quét
  const onScan = (code: string) => {
    const hit = data?.items.find(
      (task) =>
        task.lpn?.toUpperCase() === code.trim().toUpperCase() && !isPutawayTaskClosed(task.status),
    );
    if (hit) {
      setScanFeedback({ tone: "positive", message: L.scanOpened(code), seq: Date.now() });
      router.push(href(WORKSPACE_PATHS.putawayTask(hit.id)));
    } else {
      setScanFeedback({ tone: "danger", message: L.scanNotFound(code), seq: Date.now() });
    }
  };
  const rows = data ? sortByLpn(filterPutawayTasks(data.items, state.text)) : [];
  // Lọc theo phiếu nhập mà phiếu không còn nhiệm vụ → vẫn là "lọc không ra" (kèm Bỏ bộ lọc), không phải kho trống
  const emptyKind = data?.items.length === 0 && !state.filters.receipt ? "none" : "noMatch";

  return (
    <>
      <PutawayToolbar state={state} columns={columns} />
      {data && data.items.length > 0 && (
        <div className="mb-3 max-w-xl">
          <ScanInput
            id="putaway-list-scan"
            label={L.scanLabel}
            placeholder={L.scanPlaceholder}
            hint={L.scanHint}
            maxLength={PUTAWAY_LIMITS.lpnMax}
            onScan={onScan}
            feedback={scanFeedback}
          />
        </div>
      )}
      {query.isError ? (
        <LoadErrorState
          inline
          error={query.error}
          copy={L.errorCopy}
          onRetry={() => void query.refetch()}
        />
      ) : !data ? (
        <PageSkeleton variant="list" />
      ) : (
        <div className="flex flex-col gap-3">
          {data && data.totalElements > data.items.length && (
            <Alert tone="warning">{L.truncated(data.items.length, data.totalElements)}</Alert>
          )}
          <div>
            <RefetchBar
              active={query.isFetching && !!data}
              label={L.refetching}
              className="-mt-0.5"
            />
            <DataTable
              data={rows}
              columns={withHeaderFilters(
                putawayColumns(columns.visible, (id) => href(WORKSPACE_PATHS.putawayTask(id))),
                headerFilters(state),
              )}
              rowKey={(row) => row.id}
              caption={L.title}
              stickyHeader
              emptyState={
                <PutawayEmpty
                  kind={emptyKind}
                  onClearFilters={() => {
                    state.clearText();
                    state.set({ receipt: null });
                  }}
                />
              }
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Màn "Cất hàng" (docs 05 §4.2, trang danh sách style Vercel): thùng chờ cất của kho đang làm việc (tab theo kho) — nhân viên kho thấy mọi
 * nhiệm vụ của kho, không giao theo người (§2). Bấm LPN / nút cất để sang màn cất một thùng có bin gợi ý.
 */
export function PutawayList() {
  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.title}</h1>
      <PermissionBoundary permissions={[PUTAWAY_TASK_PERMISSIONS.read]} variant="list">
        <PutawayContent />
      </PermissionBoundary>
    </div>
  );
}
