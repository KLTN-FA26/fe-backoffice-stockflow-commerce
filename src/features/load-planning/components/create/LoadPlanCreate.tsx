"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { ADMIN_ROUTES, LOAD_PLAN_LIMITS, LOAD_PLAN_PERMISSIONS, UI_LABELS } from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useCan } from "@/lib/auth";
import { Alert } from "@/components/shared/Alert";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { WarehouseSelect } from "../WarehouseSelect";

import { PlanInputsFields } from "./PlanInputsFields";
import { useCreatePlanForm } from "./useCreatePlanForm";

const L = UI_LABELS.loadPlan;
const F = L.createForm;

function CreateForm() {
  const form = useCreatePlanForm();
  const error = form.fieldError ?? form.serverError;
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <Card className="space-y-4">
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="lp-create-warehouse">{F.warehouse}</Label>
          <WarehouseSelect
            id="lp-create-warehouse"
            value={form.warehouseId}
            onChange={form.changeWarehouse}
            disabled={form.pending}
          />
        </div>
        <PlanInputsFields
          idPrefix="lp-create"
          warehouseId={form.warehouseId}
          candidates={form.candidates}
          transferCandidates={form.transferCandidates}
          preselectedGone={form.preselectedGone}
          showSource
          types={form.types}
          inputs={form.inputs}
        />
        <div className="max-w-xl space-y-1.5">
          <Label htmlFor="lp-create-note">{F.note}</Label>
          <Textarea
            id="lp-create-note"
            value={form.note}
            onChange={(event) => form.setNote(event.target.value)}
            maxLength={LOAD_PLAN_LIMITS.noteMax}
            placeholder={F.notePlaceholder}
            rows={2}
          />
        </div>
      </Card>
      {error && (
        <Alert tone="danger" title={F.errorTitle}>
          {error}
        </Alert>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" asChild disabled={form.pending}>
          <Link href={ADMIN_ROUTES.loadPlans.list}>{F.back}</Link>
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={form.pending}
          className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse"
        >
          {form.pending ? F.submitting : F.submit}
        </Button>
      </div>
    </form>
  );
}

function CreateGate() {
  const canCreate = useCan(LOAD_PLAN_PERMISSIONS.create);
  const canRead = useCan(LOAD_PLAN_PERMISSIONS.read);
  if (!canCreate || !canRead)
    return (
      <EmptyState
        icon={<CalendarClock className="size-8" />}
        title={L.noCreateTitle}
        description={L.noCreateDescription}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={ADMIN_ROUTES.loadPlans.list}>{UI_LABELS.common.backToList}</Link>
          </Button>
        }
      />
    );
  return <CreateForm />;
}

/**
 * Lập kế hoạch xếp xe (docs 09 §4.2 bước 1–2): chọn kho, lô giao nguyên xe, loại xe, chế độ rồi tạo + tính. Cần
 * `fulfillment-load-plans:VIEW_PAGE`, `:READ` (đọc lô ứng viên) và `:CREATE` — UI-only, Backend phải re-check.
 */
export function LoadPlanCreate() {
  return (
    <PermissionBoundary permissions={[LOAD_PLAN_PERMISSIONS.viewPage]} variant="detail">
      <div className="surface-soft surface-compact">
        <h1 className="sr-only">{F.title}</h1>
        <CreateGate />
      </div>
    </PermissionBoundary>
  );
}
