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

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { moveErrorView, moveFieldErrors } from "../errors";
import { useCreateMove } from "../mutations";
import { useDestinationCodes, useStockRows } from "../queries";
import { moveCreateInput } from "../schemas";
import { findSourceRow, isCountHidden, movableQuantity } from "../selectors";
import { useMoveRequestId } from "../use-move-request-id";
import { MoveFields } from "./MoveFields";
import { MovePermissionGate } from "./MovePermissionGate";
import { MoveResult } from "./MoveResult";
import { StockRowPicker } from "./StockRowPicker";

import type { MoveCreateInput, StockMove, StockRow } from "../types";

const EMPTY_MOVE = { sku: "", lotNumber: "", fromLocation: "", toLocation: "" };

// Warehouse floor staff hold inventory-stock-items:UPDATE — the same guard as BE `POST /inventory/movements`.
export function MoveCreate() {
  return (
    <MovePermissionGate permission={INVENTORY_PERMISSIONS.stockUpdate}>
      <MoveCreateContent />
    </MovePermissionGate>
  );
}

function MoveCreateContent() {
  const mutation = useCreateMove();
  const requestId = useMoveRequestId();
  const [result, setResult] = useState<StockMove | null>(null);
  // Kept outside the form's error state: `setError` would mark the form invalid and block a retry
  // of an unchanged, still valid move (e.g. after a lost response).
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<MoveCreateInput>({
    resolver: zodResolver(moveCreateInput),
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
    SKU_INPUT_PATTERN.test(skuCode) ? skuCode : "",
    useCan(INVENTORY_PERMISSIONS.stockRead),
  );
  const destinations = useDestinationCodes(from, useCan(WAREHOUSE_LOCATION_PERMISSIONS.read));
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
    <form
      onSubmit={(event) => void form.handleSubmit(submitValid)(event)}
      className="border-border-default bg-bg-surface space-y-[var(--card-pad)] rounded-(--section-radius) border p-[var(--card-pad)] shadow-(--card-shadow)"
    >
      <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{MOVE_LABELS.formTitle}</h2>
      {result && <MoveResult move={result} />}
      <fieldset disabled={mutation.isPending} className="space-y-[var(--card-pad)]">
        <MoveFields form={form} destinations={destinations.codes} movable={movable} />
        {sourceHidden && <Alert tone="warning">{MOVE_MESSAGES.sourceUnderCount}</Alert>}
        {movable !== undefined && Number.isFinite(quantity) && quantity > movable && (
          <Alert tone="warning">{MOVE_MESSAGES.exceedsMovable}</Alert>
        )}
        {rows.isSuccess && (
          <section aria-label={MOVE_LABELS.stockTitle} className="space-y-2">
            <h3 className="text-ink-secondary text-sm font-medium">{MOVE_LABELS.stockTitle}</h3>
            {rows.data.length ? (
              <StockRowPicker rows={rows.data} selectedId={source?.id} onPick={pick} />
            ) : (
              <p className="text-ink-secondary text-sm">{MOVE_LABELS.stockEmpty}</p>
            )}
          </section>
        )}
        {rows.isFetching && <p className="text-ink-tertiary text-sm">{MOVE_LABELS.stockLoading}</p>}
        {rows.isError && (
          <p className="text-ink-secondary text-sm">{MOVE_LABELS.stockUnavailable}</p>
        )}
      </fieldset>
      {failure && (
        <p role="alert" className="text-danger">
          {failure}
        </p>
      )}
      {mutation.error instanceof ApiError && mutation.error.traceId && (
        <p className="text-ink-tertiary text-xs">
          {MOVE_LABELS.trace}: {mutation.error.traceId}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          className="h-(--action-h) rounded-(--action-radius) px-(--action-px)"
          type="submit"
          disabled={!form.formState.isValid || mutation.isPending || sourceHidden}
          aria-busy={mutation.isPending}
        >
          {mutation.isPending ? MOVE_LABELS.submitting : MOVE_LABELS.submit}
        </Button>
      </div>
    </form>
  );
}
