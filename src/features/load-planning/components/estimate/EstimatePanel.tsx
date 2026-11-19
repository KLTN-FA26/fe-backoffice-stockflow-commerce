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

import { FillLinesPicker } from "../create/FillLinesPicker";

import { ESTIMATE_MODE_OPTIONS, EstimateControls, type SelectionMode } from "./EstimateControls";
import { EstimateResult } from "./EstimateResult";
import { PackagingMissingLinks } from "./PackagingMissingLinks";

/** Một dòng của đơn (đủ để vẽ ô "Hàng chèn"). */
export interface EstimateOrderLine {
  lineId: string;
  sku: string;
  quantity: number;
}

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
 * cách chọn xe và nút "Ước tính" (POST). Kết quả mới (của phiên này) thay bản hiện hành. Lỗi hiện tại chỗ bằng tiếng Việt.
 */
export function EstimatePanel({
  orderId,
  warehouseId,
  released,
  lines,
  canCreate,
  canRead,
}: EstimatePanelProps) {
  const L = LOAD_ESTIMATE_LABELS;
  const current = useCurrentEstimate(orderId, canRead);
  const vehicleTypes = useEstimateVehicleTypes(canCreate);
  const create = useCreateLoadEstimate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<SelectionMode>("SINGLE_TYPE");
  // Dòng đơn tick là hàng chèn — mặc định không dòng nào (mọi dòng là hàng chính, RTM-LPGROUP)
  const [fillLines, setFillLines] = useState<ReadonlySet<string>>(new Set());
  const toggleFillLine = (id: string) =>
    setFillLines((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [error, setError] = useState<{ message: string; itemIds: string[] } | null>(null);

  const estimate = create.data ?? current.data ?? null;
  const blockedReason = !released && !warehouseId ? L.selectWarehouseFirst : null;

  const run = () => {
    const input = CreateEstimateInputSchema.safeParse({
      orderId,
      warehouseId: released ? null : warehouseId,
      vehicleTypeIds: selectedIds,
      selectionMode: mode,
      // Chỉ chế độ "Ưu tiên + hàng chèn" đọc hàng chèn; chế độ khác không gửi
      fillOrderLineIds:
        mode === "PRIORITY_FILL"
          ? lines.map((l) => l.lineId).filter((id) => fillLines.has(id))
          : undefined,
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
          modeOptions={ESTIMATE_MODE_OPTIONS}
          onRun={run}
          isPending={create.isPending}
          blockedReason={blockedReason}
          hasResult={estimate !== null}
        />
      )}
      {canCreate && mode === "PRIORITY_FILL" && (
        <FillLinesPicker
          idPrefix="estimate"
          options={lines.map((l) => ({
            orderLineId: l.lineId,
            label: L.controls.fillLine(l.sku, l.quantity),
            ariaLabel: L.controls.fillAria(l.sku),
          }))}
          ticked={fillLines}
          onToggle={toggleFillLine}
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
