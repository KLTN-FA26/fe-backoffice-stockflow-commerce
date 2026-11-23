"use client";

import { PUTAWAY_LABELS, PUTAWAY_TASK_PERMISSIONS, WORKSPACE_PATHS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { InWorkspaceWarehouse, useWorkspaceHref } from "@/lib/workspace";
import { putawayTaskGate } from "@/features/putaway/lifecycle";
import { usePutawayTask } from "@/features/putaway/queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DETAIL_GRID_CLASS } from "@/components/shared/DetailSection";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { PutawayConfirmCard, PUTAWAY_FIELD_IDS } from "./PutawayConfirmCard";
import { PutawayInfoSection } from "./PutawayInfoSection";
import { PutawayStateCard } from "./PutawayStateCard";
import { PutawaySuggestionsSection } from "./PutawaySuggestionsSection";
import { usePutawayConfirm } from "./usePutawayConfirm";

import type { PutawayTask } from "@/features/putaway/types";

const L = PUTAWAY_LABELS;
const focusField = (id: string) => document.getElementById(id)?.focus();

/** Nhiệm vụ còn cất được: form dùng chung giữa danh sách gợi ý (nút Chọn) và thẻ xác nhận. */
function ConfirmLayout({ task, onStale }: { task: PutawayTask; onStale: () => void }) {
  const confirm = usePutawayConfirm({
    task,
    onFieldError: (field) => focusField(PUTAWAY_FIELD_IDS[field]),
    onStale,
  });
  const selected = confirm.form.watch("locationCode");
  return (
    <div className={DETAIL_GRID_CLASS}>
      <div className="min-w-0 space-y-5">
        <PutawayInfoSection task={task} />
        <PutawaySuggestionsSection
          task={task}
          selected={selected || null}
          onChoose={(code) => {
            confirm.chooseBin(code);
            // Chọn bin xong: LPN chưa quét → về ô LPN, đã quét → ô bin để Enter là gửi
            focusField(
              confirm.form.getValues("lpn")
                ? PUTAWAY_FIELD_IDS.locationCode
                : PUTAWAY_FIELD_IDS.lpn,
            );
          }}
        />
      </div>
      <div className="space-y-5">
        <PutawayConfirmCard task={task} confirm={confirm} />
      </div>
    </div>
  );
}

function DetailContent({ taskId }: { taskId: string }) {
  const can = usePermissionChecker();
  const query = usePutawayTask(taskId);
  const listHref = useWorkspaceHref()(WORKSPACE_PATHS.putaway);
  const task = query.data;
  useBreadcrumbLabel(taskId, task?.lpn ?? undefined);

  if (query.isLoading) return <PageSkeleton variant="detail" />;
  if (!task) {
    return (
      <LoadErrorState
        error={query.error}
        copy={L.errorCopy}
        onRetry={() => void query.refetch()}
        back={{ href: listHref }}
      />
    );
  }
  const gate = putawayTaskGate(task, can);
  return (
    // Nhiệm vụ của kho khác kho trên URL → chuyển sang đúng kho, không cất dưới kho sai (spec 2026-11-22 §2).
    // BE cũ chưa trả `warehouseId` (BE #394) thì hiện bình thường.
    <InWorkspaceWarehouse warehouseId={task.warehouseId} path={WORKSPACE_PATHS.putawayTask(taskId)}>
      <h1 className="sr-only">{L.detailTitle(task.lpn ?? task.sku)}</h1>
      {gate.canConfirm ? (
        // `key` theo nhiệm vụ: đổi thùng (điều hướng) thì form + key idempotency làm lại từ đầu
        <ConfirmLayout key={task.id} task={task} onStale={() => void query.refetch()} />
      ) : (
        <div className={DETAIL_GRID_CLASS}>
          <div className="min-w-0 space-y-5">
            <PutawayInfoSection task={task} />
            <PutawaySuggestionsSection task={task} selected={null} />
          </div>
          <div className="space-y-5">
            <PutawayStateCard task={task} reason={gate.reason} />
          </div>
        </div>
      )}
    </InWorkspaceWarehouse>
  );
}

/**
 * Màn cất một thùng (docs 05 §4.3–4.4, trang chi tiết style Vercel): thông tin thùng + bin gợi ý ở trái, thẻ xác nhận
 * ở góc phải trên (mode-a §4.3). Không tiêu đề / nút quay lại — breadcrumb hiện LPN và link về danh sách.
 */
export function PutawayTaskDetail({ taskId }: { taskId: string }) {
  return (
    <div className="surface-soft surface-compact">
      <PermissionBoundary permissions={[PUTAWAY_TASK_PERMISSIONS.read]} variant="detail">
        <DetailContent taskId={taskId} />
      </PermissionBoundary>
    </div>
  );
}
