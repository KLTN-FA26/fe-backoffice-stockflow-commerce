"use client";

import { useState } from "react";

import { LOAD_ESTIMATE_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { estimateErrorMessage, packagingMissingItemIds } from "../../estimate-errors";
import {
  useCreateLoadEstimate,
  useCurrentEstimate,
  useEstimateVehicleTypes,
} from "../../estimate-queries";
import { CreateEstimateInputSchema } from "../../estimate-schemas";

import { EstimateControls, type SelectionMode } from "./EstimateControls";
import { EstimateResult } from "./EstimateResult";
import { PackagingMissingLinks } from "./PackagingMissingLinks";

interface EstimatePanelProps {
  orderId: string;
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
 * cách chọn xe và nút "Ước tính" (POST). Kết quả mới (của phiên này) thay bản hiện hành. Lỗi hiện tại chỗ bằng tiếng Việt.
 */
export function EstimatePanel({
  orderId,
  warehouseId,
  released,
  canCreate,
  canRead,
}: EstimatePanelProps) {
  const L = LOAD_ESTIMATE_LABELS;
  const current = useCurrentEstimate(orderId, canRead);
  const vehicleTypes = useEstimateVehicleTypes(canCreate);
  const create = useCreateLoadEstimate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<SelectionMode>("SINGLE_TYPE");
  const [error, setError] = useState<{ message: string; itemIds: string[] } | null>(null);

  const estimate = create.data ?? current.data ?? null;
  const blockedReason = !released && !warehouseId ? L.selectWarehouseFirst : null;

  const run = () => {
    const input = CreateEstimateInputSchema.safeParse({
      orderId,
      warehouseId: released ? null : warehouseId,
      vehicleTypeIds: selectedIds,
      selectionMode: mode,
    });
    if (!input.success) {
      setError({ message: L.controls.tooManyTypes, itemIds: [] });
      return;
    }
    setError(null);
    create.mutate(input.data, {
      onError: (apiError) =>
        setError({
          message: estimateErrorMessage(apiError),
          itemIds: packagingMissingItemIds(apiError),
        }),
    });
  };

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
          onRun={run}
          isPending={create.isPending}
          blockedReason={blockedReason}
          hasResult={estimate !== null}
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
