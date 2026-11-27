"use client";

import { parseAsString, useQueryState } from "nuqs";

import {
  PUTAWAY_LABELS,
  PUTAWAY_TASK_PERMISSIONS,
  PUTAWAY_TASK_STATUS,
  WORKSPACE_PATHS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { InWorkspaceWarehouse, useWorkspaceHref, useWorkspaceWarehouse } from "@/lib/workspace";
import { putawayTaskGate } from "@/features/putaway/lifecycle";
import { usePutawayTask, usePutawayTasks } from "@/features/putaway/queries";
import { nextPendingTask } from "@/features/putaway/selectors";

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
  // Ô kệ vừa dùng cho thùng trước (`?bin=` của nút "Cất thùng tiếp theo") — gợi ý dùng lại một chạm
  const [lastBin] = useQueryState("bin", parseAsString);
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
      {/* Màn hẹp (một cột): thẻ quét / xác nhận lên đầu trang, không nằm cuối (S01-12) */}
      <div className="order-first space-y-5 lg:order-none">
        <PutawayConfirmCard task={task} confirm={confirm} lastBin={lastBin} />
      </div>
    </div>
  );
}

function DetailContent({ taskId }: { taskId: string }) {
  const can = usePermissionChecker();
  const query = usePutawayTask(taskId);
  const href = useWorkspaceHref();
  const listHref = href(WORKSPACE_PATHS.putaway);
  const task = query.data;
  // Thùng đã cất xong: tìm thùng chờ cất kế tiếp của kho để đi tiếp một chạm, không quay lại danh sách (S13-2)
  const warehouseId = useWorkspaceWarehouse().id;
  const done = task?.status === PUTAWAY_TASK_STATUS.DONE;
  const pending = usePutawayTasks({ warehouseId }, { enabled: done });
  const next = nextPendingTask(done ? (pending.data?.items ?? []) : [], taskId);
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
            <PutawayStateCard
              task={task}
              reason={gate.reason}
              next={
                done && next.task
                  ? {
                      remaining: next.remaining,
                      href: href(
                        task.targetLocationCode
                          ? WORKSPACE_PATHS.putawayTaskWithBin(
                              next.task.id,
                              task.targetLocationCode,
                            )
                          : WORKSPACE_PATHS.putawayTask(next.task.id),
                      ),
                    }
                  : null
              }
              listHref={listHref}
              tripHref={href(WORKSPACE_PATHS.myTrip)}
            />
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
