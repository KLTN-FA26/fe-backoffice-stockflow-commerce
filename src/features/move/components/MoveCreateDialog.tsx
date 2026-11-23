"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { INVENTORY_PERMISSIONS, WAREHOUSE_LOCATION_PERMISSIONS } from "@/constants/permissions";
import { MOVE_LABELS, MOVE_MESSAGES } from "@/constants/move";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiError } from "@/lib/api/error";
import { useCan } from "@/lib/auth";
import { SKU_INPUT_PATTERN } from "@/lib/validation/sku";
import { useWorkspaceWarehouse } from "@/lib/workspace";

import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { moveErrorView, moveFieldErrors } from "../errors";
import { useCreateMove } from "../mutations";
import { useDestinationCodes, useStockRows } from "../queries";
import { moveInWarehouseInput } from "../schemas";
import { findSourceRow, isCountHidden, movableQuantity } from "../selectors";
import { useMoveRequestId } from "../use-move-request-id";
import { MoveFields } from "./MoveFields";
import { MoveResult } from "./MoveResult";
import { StockRowPicker } from "./StockRowPicker";

import type { MoveCreateInput, StockMove, StockRow } from "../types";

const EMPTY_MOVE = { sku: "", lotNumber: "", fromLocation: "", toLocation: "" };

/**
 * Modal tạo lệnh di chuyển (docs 11) — khung `FormDialog` chung của Mode A. Chuyển xong form trống lại và giữ modal mở,
 * kèm thẻ kết quả: NV kho thường chuyển nhiều lệnh liên tiếp. Radix unmount khi đóng nên mở lại là form mới.
 */
export function MoveCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} className="sm:max-w-[880px]">
      <MoveForm onCancel={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function MoveForm({ onCancel }: { onCancel: () => void }) {
  const mutation = useCreateMove();
  const requestId = useMoveRequestId();
  const [result, setResult] = useState<StockMove | null>(null);
  // Kept outside the form's error state: `setError` would mark the form invalid and block a retry
  // of an unchanged, still valid move (e.g. after a lost response).
  const [failure, setFailure] = useState<string | null>(null);
  const warehouse = useWorkspaceWarehouse();
  const form = useForm<MoveCreateInput>({
    resolver: zodResolver(moveInWarehouseInput(warehouse.prefix)),
    mode: "onChange",
    defaultValues: EMPTY_MOVE,
  });
  const [sku, lot, from, to, quantity] = useWatch({
    control: form.control,
    name: ["sku", "lotNumber", "fromLocation", "toLocation", "quantity"],
  });
  // Cross-field rules (same location, other warehouse) attach to the destination: re-check it when
  // the source or quantity changes, otherwise its error would only show after the destination is edited.
  useEffect(() => {
    if (to) void form.trigger("toLocation");
  }, [form, from, to, quantity]);
  // Optional aids — each needs its own BE permission and degrades to plain typing without it.
  const skuCode = useDebouncedValue(sku.trim().toUpperCase(), 400);
  const rows = useStockRows(
    warehouse.id,
    SKU_INPUT_PATTERN.test(skuCode) ? skuCode : "",
    useCan(INVENTORY_PERMISSIONS.stockRead),
  );
  const destinations = useDestinationCodes(
    warehouse.id,
    useCan(WAREHOUSE_LOCATION_PERMISSIONS.read),
  );
  const source = findSourceRow(rows.data, from, lot);
  const sourceHidden = source ? isCountHidden(source) : false;
  const movable = source && !sourceHidden ? movableQuantity(source) : undefined;
  const pick = (row: StockRow) => {
    form.setValue("fromLocation", row.locationCode, { shouldDirty: true, shouldValidate: true });
    form.setValue("lotNumber", row.lotNumber ?? "", { shouldDirty: true, shouldValidate: true });
  };
  // `mutation.isPending` is a render snapshot; this ref flips synchronously so a double click
  // cannot send two requests.
  const submitting = useRef(false);
  const submitValid = async (input: MoveCreateInput) => {
    if (submitting.current) return;
    submitting.current = true;
    setFailure(null);
    setResult(null);
    try {
      setResult(await mutation.mutateAsync({ input, requestId: requestId.idFor(input) }));
      requestId.forget();
      // NaN empties the (uncontrolled) number input; leaving the key out would keep the old figure.
      form.reset({ ...EMPTY_MOVE, quantity: Number.NaN });
    } catch (error: unknown) {
      for (const [field, message] of Object.entries(moveFieldErrors(error))) {
        form.setError(field as keyof MoveCreateInput, { type: "server", message });
      }
      setFailure(moveErrorView(error).detail);
    } finally {
      submitting.current = false;
    }
  };
  return (
    <FormDialogBody
      title={MOVE_LABELS.formTitle}
      description={MOVE_LABELS.subtitle}
      submitLabel={mutation.isPending ? MOVE_LABELS.submitting : MOVE_LABELS.submit}
      canSubmit={form.formState.isValid && !sourceHidden}
      isPending={mutation.isPending}
      error={failure}
      onSubmit={() => void form.handleSubmit(submitValid)()}
      onCancel={onCancel}
    >
      {/* Bảng tồn của SKU có thể dài — cuộn trong thân modal, header / footer đứng yên */}
      <div className="-mx-1 max-h-[calc(100vh-16rem)] space-y-3 overflow-y-auto px-1">
        {result && <MoveResult move={result} />}
        <fieldset disabled={mutation.isPending} className="m-0 min-w-0 space-y-3 border-0 p-0">
          <MoveFields form={form} destinations={destinations.codes} movable={movable} />
          {sourceHidden && <Alert tone="warning">{MOVE_MESSAGES.sourceUnderCount}</Alert>}
          {movable !== undefined && Number.isFinite(quantity) && quantity > movable && (
            <Alert tone="warning">{MOVE_MESSAGES.exceedsMovable}</Alert>
          )}
          {rows.isSuccess && (
            <section aria-label={MOVE_LABELS.stockTitle} className="space-y-2">
              <h3 className="text-ink-secondary text-[0.8125rem] font-medium">
                {MOVE_LABELS.stockTitle}
              </h3>
              {rows.data.length ? (
                <StockRowPicker rows={rows.data} selectedId={source?.id} onPick={pick} />
              ) : (
                <p className="text-ink-secondary text-[0.8125rem]">{MOVE_LABELS.stockEmpty}</p>
              )}
            </section>
          )}
          {rows.isFetching && (
            <p className="text-ink-tertiary text-[0.8125rem]">{MOVE_LABELS.stockLoading}</p>
          )}
          {rows.isError && (
            <p className="text-ink-secondary text-[0.8125rem]">{MOVE_LABELS.stockUnavailable}</p>
          )}
        </fieldset>
        {mutation.error instanceof ApiError && mutation.error.traceId && (
          <p className="text-ink-tertiary text-xs">
            {MOVE_LABELS.trace}: {mutation.error.traceId}
          </p>
        )}
      </div>
    </FormDialogBody>
  );
}
