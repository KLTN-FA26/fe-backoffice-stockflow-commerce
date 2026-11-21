"use client";

import Link from "next/link";
import { cn } from "cn";
import { parseAsString, useQueryState } from "nuqs";

import {
  ADMIN_ROUTES,
  PUTAWAY_LABELS,
  PUTAWAY_TASK_PERMISSIONS,
  SLOTTING_LABELS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { usePutawayTask, usePutawayTasks } from "@/features/putaway/queries";
import { sortByLpn } from "@/features/putaway/selectors";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { DETAIL_ACTION_CLASS, DETAIL_CARD_CLASS } from "@/components/shared/DetailSection";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Skeleton } from "@/components/shared/Skeleton";

import { PutawaySuggestionsSection } from "../detail/PutawaySuggestionsSection";
import { SlottingCartonList } from "./SlottingCartonList";
import { SlottingRulesCard } from "./SlottingRulesCard";

const L = SLOTTING_LABELS;
/** Cột trái cố định 340px: ở 1024px cột phải còn ≈ 390px — vừa bảng bin gợi ý bốn cột. */
const GRID = "grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]";

function Suggestions({ taskId }: { taskId: string }) {
  const canPutAway = useCan(PUTAWAY_TASK_PERMISSIONS.update);
  const query = usePutawayTask(taskId);
  const task = query.data;
  if (query.isError) {
    return (
      <LoadErrorState
        inline
        error={query.error}
        copy={PUTAWAY_LABELS.errorCopy}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!task) {
    return (
      <div className={`${DETAIL_CARD_CLASS} space-y-2`}>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return (
    <PutawaySuggestionsSection
      task={task}
      selected={null}
      title={L.suggestionsFor(task.lpn ?? task.sku)}
      footer={
        // Chỉ người cất được mới có lối sang màn cất — UI-only, BE re-check quyền khi xác nhận
        canPutAway ? (
          <Link
            href={ADMIN_ROUTES.putaway.detail(task.id)}
            className={cn(DETAIL_ACTION_CLASS.outline, "inline-flex w-auto items-center")}
          >
            {L.putAway}
          </Link>
        ) : null
      }
    />
  );
}

function SlottingContent({ prefix }: { prefix: string }) {
  const directory = useWarehouseDirectory();
  const warehouse = directory.data?.find((w) => w.code.toUpperCase() === prefix.toUpperCase());
  const query = usePutawayTasks({ warehouseId: warehouse?.warehouseId }, { enabled: !!warehouse });
  const [taskParam, setTask] = useQueryState("task", parseAsString);
  if (directory.isPending || (warehouse && query.isPending))
    return <PageSkeleton variant="detail" />;
  if (!warehouse) return <EmptyState title={L.warehouseUnknown} />;
  if (query.isError) {
    return (
      <LoadErrorState
        inline
        error={query.error}
        copy={PUTAWAY_LABELS.errorCopy}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const tasks = sortByLpn(query.data?.items ?? []);
  // Thùng trên URL không còn chờ cất (vừa cất xong) → về thùng đầu tiên
  const selectedId = tasks.find((t) => t.id === taskParam)?.id ?? tasks[0]?.id ?? null;
  return (
    <div className={GRID}>
      <div className="min-w-0">
        {tasks.length === 0 ? (
          <div className={DETAIL_CARD_CLASS}>
            <EmptyState
              className="py-8"
              title={L.noCartons.title}
              description={L.noCartons.description}
            />
          </div>
        ) : (
          <SlottingCartonList
            tasks={tasks}
            selectedId={selectedId}
            onSelect={(id) => void setTask(id)}
          />
        )}
      </div>
      <div className="min-w-0 space-y-5">
        {selectedId ? (
          <Suggestions key={selectedId} taskId={selectedId} />
        ) : (
          tasks.length > 0 && <p className="text-ink-tertiary text-[0.8125rem]">{L.pickCarton}</p>
        )}
        <SlottingRulesCard />
      </div>
    </div>
  );
}

/**
 * Trang "Gợi ý vị trí" của một kho (docs 06 §4.4): chọn thùng chờ cất → bin gợi ý xếp hạng kèm lý do + chỗ trống,
 * cùng nguồn với màn cất hàng (`GET /putaway-tasks/{id}`). Chỉ đọc — quy tắc cố định, không cấu hình (docs 06 §1).
 * Kho lấy từ prefix trên URL qua danh mục kho (`lib/references`); trang ngoài lo phạm vi kho (`WarehouseScope`).
 */
export function SlottingView({ prefix }: { prefix: string }) {
  return (
    <>
      <h1 className="sr-only">{L.title}</h1>
      <PermissionBoundary permissions={[PUTAWAY_TASK_PERMISSIONS.read]} variant="detail">
        <SlottingContent prefix={prefix} />
      </PermissionBoundary>
    </>
  );
}
