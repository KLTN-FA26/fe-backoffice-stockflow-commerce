"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { MOVE_LABELS, MOVE_MESSAGES } from "@/constants/move";
import { STOCK_PACKAGE_PERMISSIONS, WAREHOUSE_LOCATION_PERMISSIONS } from "@/constants/permissions";

import { ApiError } from "@/lib/api/error";
import { useCan } from "@/lib/auth";
import { useWorkspaceWarehouse } from "@/lib/workspace";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { useBinSuggestions, useDestinationCodes } from "../queries";
import { moveInWarehouseInput } from "../schemas";
import { cartonMarks, normalizeLocation } from "../selectors";
import { useCartonScan } from "../use-carton-scan";
import { useMoveSubmit } from "../use-move-submit";
import { CartonFinder } from "./CartonFinder";
import { CartonScanField } from "./CartonScanField";
import { DestinationPanel } from "./DestinationPanel";
import { MoveResult } from "./MoveResult";
import { ScannedCartons } from "./ScannedCartons";

import type { MoveCreateInput, ScannedCarton } from "../types";
import type { DestinationMap } from "./destination-map";

const EMPTY_MOVE: MoveCreateInput = { lpns: [], toLocation: "" };
const CHANGED = { shouldDirty: true, shouldValidate: true } as const;
const lpnOf = (carton: ScannedCarton) => carton.lpn;
type MapProp = { destinationMap?: DestinationMap };

/**
 * Modal tạo lệnh chuyển nguyên thùng (docs 11 §4.1) — khung `FormDialog` chung của Mode A. Quét LPN → chọn đích → gửi.
 * Chuyển xong danh sách trống lại và giữ modal mở, kèm thẻ kết quả: NV kho thường chuyển nhiều lệnh liên tiếp. Radix
 * unmount khi đóng nên mở lại là form mới.
 */
export function MoveCreateDialog({
  open,
  onOpenChange,
  destinationMap,
}: MapProp & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} className="sm:max-w-[880px]">
      <MoveForm onCancel={() => onOpenChange(false)} destinationMap={destinationMap} />
    </FormDialog>
  );
}

function MoveForm({ onCancel, destinationMap }: MapProp & { onCancel: () => void }) {
  const warehouse = useWorkspaceWarehouse();
  const form = useForm<MoveCreateInput>({
    resolver: zodResolver(moveInWarehouseInput(warehouse.prefix)),
    mode: "onChange",
    defaultValues: EMPTY_MOVE,
  });
  const toLocation = useWatch({ control: form.control, name: "toLocation" });
  const canLookup = useCan(STOCK_PACKAGE_PERMISSIONS.read);
  // Danh sách thùng là nguồn của `lpns`: mỗi lần thêm / bỏ ghi lại vào form (zod kiểm 1–500, bỏ trùng).
  const scan = useCartonScan({
    prefix: warehouse.prefix,
    canLookup,
    onChange: (cartons: ScannedCarton[]) => form.setValue("lpns", cartons.map(lpnOf), CHANGED),
  });
  const move = useMoveSubmit(form, () => {
    scan.clear();
    form.reset(EMPTY_MOVE);
  });
  const { here, alreadyAt, inList, flagged } = cartonMarks(
    scan.cartons,
    toLocation,
    move.failure?.lpn,
  );
  const destinations = useDestinationCodes(
    warehouse.id,
    useCan(WAREHOUSE_LOCATION_PERMISSIONS.read),
    here,
  );
  const suggestions = useBinSuggestions(scan.cartons.map(lpnOf));
  const value = normalizeLocation(toLocation);
  const pick = (code: string) => form.setValue("toLocation", code, CHANGED);
  return (
    <FormDialogBody
      title={MOVE_LABELS.formTitle}
      description={MOVE_LABELS.subtitle}
      submitLabel={move.isPending ? MOVE_LABELS.submitting : MOVE_LABELS.submit}
      canSubmit={form.formState.isValid && alreadyAt.length === 0 && !scan.pending}
      isPending={move.isPending}
      error={move.failure?.detail ?? null}
      onSubmit={move.submit}
      onCancel={onCancel}
    >
      {/* Danh sách thùng / bộ tìm có thể dài — cuộn trong thân modal, header / footer đứng yên */}
      <div className="-mx-1 max-h-[calc(100vh-16rem)] space-y-3 overflow-y-auto px-1">
        {move.result && <MoveResult cartons={move.result} />}
        <fieldset disabled={move.isPending} className="m-0 min-w-0 space-y-3 border-0 p-0">
          <div className="grid grid-cols-1 gap-[var(--card-pad)] md:grid-cols-2">
            <CartonScanField
              onScan={(lpn) => void scan.scan(lpn)}
              disabled={move.isPending}
              pending={scan.pending}
              feedback={scan.feedback}
            />
            <DestinationPanel
              form={form}
              destinations={destinations.codes}
              problem={alreadyAt.length ? MOVE_MESSAGES.alreadyThere(alreadyAt.join(", ")) : null}
              suggestions={{ ...suggestions, hasCartons: scan.cartons.length > 0 }}
              value={value}
              disabled={move.isPending}
              onPick={pick}
            />
          </div>
          <ScannedCartons
            cartons={scan.cartons}
            flagged={flagged}
            disabled={move.isPending}
            onRemove={scan.remove}
          />
          {/* Docs 11 §4.1 bước 1–2: tô nơi thùng đang nằm + bin gợi ý (BE #412), bấm bản đồ để chọn đích */}
          {destinationMap?.({
            marked: here,
            suggested: suggestions.data?.suggestions.map((s) => s.locationCode) ?? [],
            pickable: new Set(destinations.codes),
            value,
            disabled: move.isPending,
            onPick: pick,
          })}
          {canLookup && (
            <CartonFinder
              prefix={warehouse.prefix}
              added={inList}
              disabled={move.isPending}
              onAdd={scan.add}
            />
          )}
        </fieldset>
        {move.error instanceof ApiError && move.error.traceId && (
          <p className="text-ink-tertiary text-xs">
            {MOVE_LABELS.trace}: {move.error.traceId}
          </p>
        )}
      </div>
    </FormDialogBody>
  );
}
