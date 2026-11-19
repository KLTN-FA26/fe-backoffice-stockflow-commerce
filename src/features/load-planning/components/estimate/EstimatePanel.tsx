"use client";

import { LOAD_ESTIMATE_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { FillLinesPicker } from "../create/FillLinesPicker";

import { ESTIMATE_MODE_OPTIONS, EstimateControls } from "./EstimateControls";
import { EstimateResult } from "./EstimateResult";
import { PackagingMissingLinks } from "./PackagingMissingLinks";
import { useEstimatePanel } from "./useEstimatePanel";

import type { EstimateOrderLine } from "./useEstimatePanel";

export type { EstimateOrderLine } from "./useEstimatePanel";

interface EstimatePanelProps {
  orderId: string;
  /** Dòng của đơn: ô "Hàng chèn" khi chọn "Ưu tiên + hàng chèn" (RTM-LPGROUP), mặc định là hàng chính. */
  lines: readonly EstimateOrderLine[];
  /** Kho đang chọn trong hộp thoại release (đơn CONFIRMED); null với đơn đã release. */
  warehouseId: string | null;
  released: boolean;
  /** `fulfillment-load-estimates:CREATE` — tính ước tính mới. UI-only: Backend phải re-check. */
  canCreate: boolean;
  /** `fulfillment-load-estimates:READ` — xem ước tính hiện hành. */
  canRead: boolean;
}

/**
 * Thân ngăn kéo ước tính: nạp ước tính hiện hành (GET) trước nếu có quyền đọc; có quyền tạo thì hiện ô chọn loại xe /
 * cách chọn xe (và ô "Hàng chèn" theo dòng đơn với "Ưu tiên + hàng chèn") và nút "Ước tính" (POST). Kết quả mới (của
 * phiên này) thay bản hiện hành. Lỗi hiện tại chỗ bằng tiếng Việt. State ở `useEstimatePanel`.
 */
export function EstimatePanel(props: EstimatePanelProps) {
  const L = LOAD_ESTIMATE_LABELS;
  const { canCreate, canRead, lines } = props;
  const {
    current,
    vehicleTypes,
    create,
    selectedIds,
    setSelectedIds,
    mode,
    setMode,
    priorityFill,
    fill,
    error,
    run,
    estimate,
    blockedReason,
  } = useEstimatePanel(props);

  return (
    <div className="space-y-4">
      {canCreate && (
        <EstimateControls
          vehicleTypes={vehicleTypes.data}
          vehicleTypesState={
            vehicleTypes.isError ? "error" : vehicleTypes.isPending ? "loading" : "ready"
          }
          onRetryVehicleTypes={() => void vehicleTypes.refetch()}
          selectedIds={selectedIds}
          onSelectedChange={setSelectedIds}
          mode={mode}
          onModeChange={setMode}
          modeOptions={ESTIMATE_MODE_OPTIONS}
          onRun={run}
          isPending={create.isPending}
          blockedReason={blockedReason}
          hasResult={estimate !== null}
        />
      )}
      {canCreate && priorityFill && (
        <FillLinesPicker
          idPrefix="estimate"
          options={lines.map((l) => ({
            orderLineId: l.lineId,
            label: L.controls.fillLine(l.sku, l.quantity),
            ariaLabel: L.controls.fillAria(l.sku),
          }))}
          ticked={fill.ids}
          onToggle={fill.toggle}
          emptyText={L.controls.fillEmpty}
        />
      )}
      {error && (
        <div role="alert" className="text-danger text-[0.8125rem]">
          <p>{error.message}</p>
          <PackagingMissingLinks itemIds={error.itemIds} />
        </div>
      )}
      {canRead && current.isPending && !create.data && (
        <Skeleton role="status" aria-label={L.current.loading} className="h-24 w-full" />
      )}
      {canRead && current.isError && !create.data && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {L.current.loadFailed}{" "}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => void current.refetch()}
          >
            {L.current.retry}
          </Button>
        </p>
      )}
      {estimate ? (
        <>
          {estimate.createdAt && (
            <p className="text-ink-tertiary text-xs">
              {L.current.createdAt(formatDateTime(estimate.createdAt))}
            </p>
          )}
          <EstimateResult estimate={estimate} />
        </>
      ) : (
        !current.isPending &&
        !current.isError && <p className="text-ink-tertiary text-[0.8125rem]">{L.current.none}</p>
      )}
    </div>
  );
}
