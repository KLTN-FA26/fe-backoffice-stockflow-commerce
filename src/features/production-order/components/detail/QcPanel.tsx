"use client";

import { useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { ADMIN_ROUTES, PRODUCTION_QC_PERMISSIONS, SAMPLE_REQUEST_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { productionErrorMessage } from "@/features/production-order/errors";
import { qcBaseSchema, qcSumMatches } from "@/features/production-order/input-schemas";
import { useRecordQc } from "@/features/production-order/mutations";
import { useQcRounds } from "@/features/production-order/queries";
import { awaitingQc } from "@/features/production-order/selectors";
import { LocationField } from "@/components/backoffice/LocationField";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MONO } from "../copy";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

function Reference({ order, canReadSample }: { order: ProductionDetail; canReadSample: boolean }) {
  // BR-PRD-05: LSX mẫu đối chiếu file in; LSX đơn đối chiếu mẫu khách đã duyệt.
  if (order.summary.type === "SAMPLE")
    return (
      <p className="text-ink-secondary text-[0.8125rem]">
        Chuẩn đối chiếu: file in đã khoá (xem thẻ File in).
      </p>
    );
  if (!order.approvedSampleId)
    return (
      <p className="text-ink-secondary text-[0.8125rem]">
        Thiết kế in lại — không có mẫu mới; đối chiếu file in đã khoá.
      </p>
    );
  return (
    <p className="text-ink-secondary text-[0.8125rem]">
      Chuẩn đối chiếu: mẫu khách đã duyệt{" "}
      {canReadSample ? (
        <Link
          href={ADMIN_ROUTES.sampleRequests.detail(order.approvedSampleId)}
          className="text-accent hover:underline"
        >
          mở mẫu
        </Link>
      ) : (
        <span className={MONO}>{order.approvedSampleId.slice(0, 8)}</span>
      )}
      .
    </p>
  );
}

/** QC thành phẩm (SCRUM-419) + bàn giao đóng gói khi hoàn tất (SCRUM-412 — BE tự chuyển, không có nút riêng). */
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
  const submit = form.handleSubmit((values) => {
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
        ...(isOrder && values.packingLocation ? { packingLocation: values.packingLocation } : {}),
      },
      {
        onSuccess: () => form.reset(),
        onError: (failure) => setError(productionErrorMessage(failure)),
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
      <Reference order={order} canReadSample={can(SAMPLE_REQUEST_PERMISSIONS.read)} />
      {order.summary.mode === "SUBCONTRACTED" && (
        <p className="text-ink-tertiary text-xs">
          Hàng gia công trả về chỉ QC một lần tại đây; kho chỉ đếm và đối soát (quyết định
          2026-10-13).
        </p>
      )}
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
          {isOrder && (
            <Controller
              control={form.control}
              name="packingLocation"
              render={({ field }) => (
                <LocationField
                  id="qc-packing"
                  label="Khu đóng gói nhận hàng"
                  warehouseId={order.summary.warehouseId}
                  areaType="PACKING"
                  emptyHint="Để trống nếu kho chỉ có một khu đóng gói."
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          )}
          <FormField id="qc-note" label="Ghi chú lỗi" error={errors.note?.message}>
            <Input
              {...form.register("note")}
              {...fieldA11y("qc-note", errors.note?.message)}
              className={FORM_INPUT_CLASS}
            />
          </FormField>
          <div className="flex items-end justify-end sm:col-span-2">
            <Button type="submit" disabled={record.isPending}>
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
      {order.summary.status === "COMPLETED" && isOrder && (
        <p className="text-positive text-[0.8125rem]">
          Đã hoàn tất và bàn giao sang khu đóng gói (giữ cho đơn bán).{" "}
          <Link href={ADMIN_ROUTES.packing.list} className="text-accent hover:underline">
            Mở đóng gói
          </Link>
        </p>
      )}
      {!canRead && (
        <p className="text-ink-tertiary text-[0.8125rem]">Bạn chưa có quyền xem kết quả QC.</p>
      )}
      {rounds.data && rounds.data.length > 0 && (
        <ol className="space-y-1 text-[0.8125rem]">
          {rounds.data.map((round) => (
            <li key={round.id} className={MONO}>
              Lần {round.round}: đạt {formatNumber(round.passed)} · lỗi {formatNumber(round.failed)}{" "}
              — {formatDateTime(round.inspectedAt)}
              {round.note ? ` — ${round.note}` : ""}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
