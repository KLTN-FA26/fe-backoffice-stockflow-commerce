"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { ApiError } from "@/lib/api/error";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

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
  const submit = form.handleSubmit(async (input) => {
    if (mutation.isPending) return;
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
      form.setError("root", {
        message: error instanceof Error ? error.message : INVENTORY_LABELS.loadError,
      });
    }
  });
  return (
    <div className="space-y-[var(--card-pad)]">
      <PageHeader
        title={INVENTORY_LABELS.createAdjustment}
        subtitle={INVENTORY_LABELS.approvalPolicy}
      />
      <InventoryOffline />
      <form
        onSubmit={submit}
        className="border-border-default bg-bg-surface space-y-[var(--card-pad)] rounded-[var(--r-sm)] border p-[var(--card-pad)]"
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
          <Button className="rounded-[var(--r-sm)]" asChild variant="outline">
            <Link href={INVENTORY_ROUTES.adjustments}>{INVENTORY_LABELS.back}</Link>
          </Button>
          <Button
            className="rounded-[var(--r-sm)]"
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
