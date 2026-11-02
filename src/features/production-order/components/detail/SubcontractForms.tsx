"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";

import { productionErrorMessage } from "@/features/production-order/errors";
import {
  lossApprovalInputSchema,
  reconcileInputSchema,
} from "@/features/production-order/input-schemas";
import { useApproveLoss, useReconcileReceipt } from "@/features/production-order/mutations";
import { LocationField } from "@/components/backoffice/LocationField";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

const NUM = `${FORM_INPUT_CLASS} text-right tabular-nums`;

/**
 * Đối soát phôi một lần nhận (Q9): kho nhập SL phôi hỏng / trả lại; chưa đối soát thì không coi
 * là hao hụt. Mỗi lần nhận chỉ đối soát một lần (BE: nhập lại số khác → 409 CONFLICT).
 */
export function ReconcileForm({
  order,
  receiptId,
  onDone,
}: {
  order: ProductionDetail;
  receiptId: string;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const reconcile = useReconcileReceipt();
  const form = useForm<z.input<typeof reconcileInputSchema>>({
    resolver: zodResolver(reconcileInputSchema),
    defaultValues: { spoilt: "0", returned: "0", returnLocation: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    reconcile.mutate(
      {
        id: order.summary.id,
        receiptId,
        spoilt: Number(v.spoilt),
        returned: Number(v.returned),
        ...(v.returnLocation ? { returnLocation: v.returnLocation } : {}),
      },
      { onSuccess: onDone, onError: (failure) => setError(productionErrorMessage(failure)) },
    ),
  );
  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="bg-bg-subtle grid gap-2 rounded-[var(--r-sm)] p-3 sm:grid-cols-3 sm:items-end"
    >
      <FormField
        id={`rc-spoilt-${receiptId}`}
        label="Phôi hỏng ở nhà gia công"
        error={errors.spoilt?.message}
      >
        <Input
          {...form.register("spoilt")}
          {...fieldA11y(`rc-spoilt-${receiptId}`, errors.spoilt?.message)}
          inputMode="numeric"
          className={NUM}
          autoFocus
        />
      </FormField>
      <FormField
        id={`rc-returned-${receiptId}`}
        label="Phôi trả lại kho"
        error={errors.returned?.message}
      >
        <Input
          {...form.register("returned")}
          {...fieldA11y(`rc-returned-${receiptId}`, errors.returned?.message)}
          inputMode="numeric"
          className={NUM}
        />
      </FormField>
      <Controller
        control={form.control}
        name="returnLocation"
        render={({ field }) => (
          <LocationField
            id={`rc-loc-${receiptId}`}
            label="Vị trí nhận phôi trả"
            warehouseId={order.summary.warehouseId}
            emptyHint="Để trống = về đúng nơi đã gửi đi."
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      {error && (
        <p role="alert" className="text-danger text-xs sm:col-span-3">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" size="sm" disabled={reconcile.isPending}>
          {reconcile.isPending && <LoaderCircle className="size-3.5 animate-spin" />} Ghi đối soát
        </Button>
      </div>
    </form>
  );
}

/**
 * QA1 (SPRINT2-FINISH-DECISIONS 2026-10-13): quản lý nhập mức bồi thường / phôi hao hụt vượt dung
 * sai đã thoả thuận, bắt buộc lý do; KHÔNG tự lấy giá NCC hay giá mua gốc. Đây là khấu trừ, không phải chi tiền.
 */
export function LossApprovalForm({ order }: { order: ProductionDetail }) {
  const [error, setError] = useState<string | null>(null);
  const approve = useApproveLoss();
  const form = useForm<z.input<typeof lossApprovalInputSchema>>({
    resolver: zodResolver(lossApprovalInputSchema),
    defaultValues: { deductionPerBlank: "", note: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    approve.mutate(
      { id: order.summary.id, deductionPerBlank: Number(v.deductionPerBlank), note: v.note },
      { onError: (failure) => setError(productionErrorMessage(failure)) },
    ),
  );
  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="bg-bg-subtle grid gap-2 rounded-[var(--r-sm)] p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
    >
      <FormField
        id="loss-per-blank"
        label="Khấu trừ / phôi vượt dung sai"
        required
        error={errors.deductionPerBlank?.message}
      >
        <Input
          {...form.register("deductionPerBlank")}
          {...fieldA11y("loss-per-blank", errors.deductionPerBlank?.message)}
          inputMode="decimal"
          className={NUM}
        />
      </FormField>
      <FormField id="loss-note" label="Căn cứ thoả thuận" required error={errors.note?.message}>
        <Input
          {...form.register("note")}
          {...fieldA11y("loss-note", errors.note?.message)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      <Button type="submit" size="sm" disabled={approve.isPending}>
        {approve.isPending && <LoaderCircle className="size-3.5 animate-spin" />} Duyệt khấu trừ
      </Button>
      {error && (
        <p role="alert" className="text-danger text-xs sm:col-span-3">
          {error}
        </p>
      )}
    </form>
  );
}
