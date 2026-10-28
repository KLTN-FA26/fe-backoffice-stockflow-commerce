"use client";

import { FilterX, Undo2 } from "lucide-react";

import { PUT_BACK_ERROR_MESSAGES, PUT_BACK_LABELS, UI_LABELS } from "@/constants";
import { isOutOfDataScope } from "@/features/fulfillment/errors";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { FulfillmentLoadError } from "../FulfillmentLoadError";
import { PAGE_SIZE_OPTIONS } from "../list/constants";
import { putBackColumns } from "./put-back-columns";

import type { PutBackRow } from "@/features/fulfillment/types";
import type { PutBackListState } from "./usePutBackListState";

const P = PUT_BACK_LABELS;
const F = UI_LABELS.fulfillment.filter;

/**
 * Vùng bảng hàng đợi (api-conventions §8): tải lần đầu, kho lọc ngoài phạm vi (403), lỗi tải, chưa có hàng
 * chờ, kho đang lọc không có hàng, từ khoá không khớp — mỗi kiểu một EmptyState; bảng phân trang ở client.
 */
export function PutBackTable({
  s,
  canAct,
  canOpenTask,
  onPutBack,
}: {
  s: PutBackListState;
  canAct: boolean;
  canOpenTask: boolean;
  onPutBack: (row: PutBackRow) => void;
}) {
  const { query } = s;
  const clearWarehouse = (
    <Button type="button" variant="outline" size="sm" onClick={() => s.setWarehouse(null)}>
      {F.clearWarehouse}
    </Button>
  );
  if (query.isError && s.warehouse && isOutOfDataScope(query.error)) {
    return (
      <EmptyState
        icon={<FilterX className="size-8" />}
        title={PUT_BACK_ERROR_MESSAGES.outOfScope}
        action={clearWarehouse}
      />
    );
  }
  if (query.isError) {
    return (
      <FulfillmentLoadError
        inline
        scope="picking"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) return <PageSkeleton variant="list" />;
  if (s.emptyState === "no-rows") {
    return (
      <EmptyState
        icon={<Undo2 className="size-8" />}
        title={P.empty}
        description={P.emptyDescription}
      />
    );
  }
  if (s.emptyState === "no-rows-in-warehouse") {
    return (
      <EmptyState
        icon={<Undo2 className="size-8" />}
        title={P.emptyInWarehouse}
        action={clearWarehouse}
      />
    );
  }
  if (s.emptyState === "no-match") {
    return (
      <EmptyState
        icon={<FilterX className="size-8" />}
        title={P.noMatch}
        description={P.noMatchDescription}
        action={
          <Button type="button" variant="outline" size="sm" onClick={s.clearFilters}>
            {F.clear}
          </Button>
        }
      />
    );
  }
  return (
    <>
      <RefetchBar active={query.isFetching} label={P.title} />
      <DataTable
        stickyHeader
        columns={putBackColumns({ canAct, canOpenTask, onPutBack })}
        data={s.rows}
        rowKey={(row) => row.lineId}
        caption={`${P.title}: ${s.rows.length} dòng`}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </>
  );
}
