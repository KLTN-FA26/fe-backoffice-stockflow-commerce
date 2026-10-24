"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useForm } from "react-hook-form";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { ApiError } from "@/lib/api/error";

import { Button } from "@/components/ui/button";

import { inventoryErrorView } from "../errors";
import { useCreateAdjustment } from "../mutations";
import { adjustmentCreateInput } from "../schemas";
import { AdjustmentFields } from "./AdjustmentFields";
import { InventoryOffline } from "./InventoryFeedback";
import { InventoryPermissionGate } from "./InventoryPermissionGate";

import type { CreateAdjustmentInput } from "../types";

export function AdjustmentCreate() {
  return (
    <InventoryPermissionGate permission={INVENTORY_PERMISSIONS.stockUpdate} variant="form">
      <AdjustmentCreateContent />
    </InventoryPermissionGate>
  );
}

function AdjustmentCreateContent() {
  const router = useRouter();
  const mutation = useCreateAdjustment();
  const form = useForm<CreateAdjustmentInput>({
    resolver: zodResolver(adjustmentCreateInput),
    mode: "onChange",
    defaultValues: { locationCode: "", sku: "", lotNumber: "", note: "" },
  });
  // `mutation.isPending` is a render snapshot: two submits in one frame both see false.
  // This ref flips synchronously after schema validation, before the first await.
  const submitting = useRef(false);
  const submitValid = async (input: CreateAdjustmentInput) => {
    if (submitting.current || mutation.isPending) return;
    submitting.current = true;
    form.clearErrors("root");
    try {
      const adjustment = await mutation.mutateAsync(input);
      router.push(INVENTORY_ROUTES.adjustment(adjustment.adjustmentId));
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        for (const field of [
          "locationCode",
          "sku",
          "lotNumber",
          "quantityDelta",
          "reason",
          "note",
        ] as const) {
          const message = error.fieldErrors?.[field];
          if (message) form.setError(field, { type: "server", message });
        }
      }
      form.setError("root", { message: inventoryErrorView(error).detail });
    } finally {
      submitting.current = false;
    }
  };
  return (
    // Giao diện kiểu Vercel như wizard sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có tên trang; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact space-y-[var(--card-pad)]">
      <h1 className="sr-only">{INVENTORY_LABELS.createAdjustment}</h1>
      <InventoryOffline />
      <form
        onSubmit={(event) => void form.handleSubmit(submitValid)(event)}
        className="border-border-default bg-bg-surface space-y-[var(--card-pad)] rounded-(--section-radius) border p-[var(--card-pad)] shadow-(--card-shadow)"
      >
        <fieldset disabled={mutation.isPending}>
          <AdjustmentFields form={form} />
        </fieldset>
        {form.formState.errors.root && (
          <p role="alert" className="text-danger">
            {form.formState.errors.root.message}
          </p>
        )}
        {mutation.error instanceof ApiError && mutation.error.traceId && (
          <p>
            {INVENTORY_LABELS.trace}: {mutation.error.traceId}
          </p>
        )}
        <div className="flex justify-end gap-[var(--el-gap)]">
          <Button
            className="h-(--action-h) rounded-(--action-radius) px-(--action-px)"
            asChild
            variant="outline"
          >
            <Link href={INVENTORY_ROUTES.adjustments}>{INVENTORY_LABELS.back}</Link>
          </Button>
          <Button
            className="h-(--action-h) rounded-(--action-radius) px-(--action-px)"
            type="submit"
            disabled={!form.formState.isValid || mutation.isPending}
            aria-busy={mutation.isPending}
          >
            {mutation.isPending ? INVENTORY_LABELS.submitting : INVENTORY_LABELS.submitAdjustment}
          </Button>
        </div>
      </form>
    </div>
  );
}
