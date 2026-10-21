"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { PRODUCTION_QC_PERMISSIONS, SAMPLE_REQUEST_PERMISSIONS } from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";
import { formatNumber } from "@/lib/format/number";

import { productionErrorMessage, qcPackingFieldError } from "@/features/production-order/errors";
import { qcBaseSchema, qcSumMatches } from "@/features/production-order/input-schemas";
import { useRecordQc } from "@/features/production-order/mutations";
import { usePackingLocations, useQcRounds } from "@/features/production-order/queries";
import { awaitingQc, qcCompletesOrder } from "@/features/production-order/selectors";

import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MONO } from "../copy";
import { QcHistory } from "./QcHistory";
import { QcPackingField } from "./QcPackingField";
import { Reference } from "./QcReference";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

/** QC thành phẩm (SCRUM-418/419) + bàn giao đóng gói tự động khi hoàn tất (SCRUM-412 — đã chốt: không có bước xác nhận riêng). */
export function QcPanel({ order, active }: { order: ProductionDetail; active: boolean }) {
  const can = usePermissionChecker();
  const canRead = can(PRODUCTION_QC_PERMISSIONS.read);
  const rounds = useQcRounds(order.summary.id, canRead);
  const record = useRecordQc();
  const [error, setError] = useState<string | null>(null);
  const awaiting = rounds.data ? awaitingQc(order, rounds.data) : null;
  const form = useForm<z.input<typeof qcBaseSchema>>({
    resolver: zodResolver(qcBaseSchema),
    defaultValues: { passed: "", failed: "0", note: "", packingLocation: "" },
  });
  const { errors } = form.formState;
  const isOrder = order.summary.type === "ORDER";
  const packing = usePackingLocations(order.summary.id, isOrder && active && canRead);
  const failedNow = Number(useWatch({ control: form.control, name: "failed" })) || 0;
  // Lần QC thiếu (về READY in bù) không bàn giao gì → BE không cần khu đóng gói.
  const handsOver = isOrder && qcCompletesOrder(order.summary, failedNow);
  const packingBlocked =
    handsOver && (packing.isPending || packing.isError || !packing.data?.length);
  const submit = form.handleSubmit((values) => {
    if (packingBlocked) return;
    if (handsOver && (packing.data?.length ?? 0) > 1 && !values.packingLocation)
      return form.setError("packingLocation", { message: "Chọn khu đóng gói nhận hàng" });
    if (!qcSumMatches(values, awaiting ?? 0)) {
      form.setError("passed", {
        type: "validate",
        message: `Đạt + lỗi phải bằng ${awaiting ?? 0} cái đang chờ QC`,
      });
      return;
    }
    setError(null);
    record.mutate(
      {
        id: order.summary.id,
        passed: Number(values.passed),
        failed: Number(values.failed),
        ...(values.note ? { note: values.note } : {}),
        ...(handsOver && values.packingLocation ? { packingLocation: values.packingLocation } : {}),
      },
      {
        onSuccess: () => form.reset(),
        onError: (failure) => {
          const field = isOrder ? qcPackingFieldError(failure, values.packingLocation) : null;
          if (field) form.setError("packingLocation", { message: field });
          else setError(productionErrorMessage(failure));
        },
      },
    );
  });

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">QC thành phẩm</h2>
        {awaiting !== null && (
          <span className={`text-ink-secondary ${MONO}`}>Chờ QC: {formatNumber(awaiting)} cái</span>
        )}
      </div>
      <Reference
        order={order}
        canReadSample={can(SAMPLE_REQUEST_PERMISSIONS.read)}
        withPreview={active}
      />
      {active && can(PRODUCTION_QC_PERMISSIONS.create) && awaiting !== null && awaiting > 0 && (
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="grid gap-3 sm:grid-cols-2"
        >
          <FormField id="qc-passed" label="Đạt (cái)" required error={errors.passed?.message}>
            <Input
              {...form.register("passed")}
              {...fieldA11y("qc-passed", errors.passed?.message)}
              inputMode="numeric"
              className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
            />
          </FormField>
          <FormField
            id="qc-failed"
            label="Lỗi (cái — xuất huỷ)"
            required
            error={errors.failed?.message}
          >
            <Input
              {...form.register("failed")}
              {...fieldA11y("qc-failed", errors.failed?.message)}
              inputMode="numeric"
              className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
            />
          </FormField>
          {isOrder && <QcPackingField control={form.control} locations={packing} />}
          <FormField id="qc-note" label="Ghi chú lỗi" error={errors.note?.message}>
            <Input
              {...form.register("note")}
              {...fieldA11y("qc-note", errors.note?.message)}
              className={FORM_INPUT_CLASS}
            />
          </FormField>
          <div className="flex items-end justify-end sm:col-span-2">
            <Button type="submit" disabled={record.isPending || packingBlocked}>
              {record.isPending && <LoaderCircle className="size-4 animate-spin" />} Ghi kết quả QC
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {error}
        </p>
      )}
      <QcHistory order={order} rounds={rounds.data} canRead={canRead} />
    </Card>
  );
}
