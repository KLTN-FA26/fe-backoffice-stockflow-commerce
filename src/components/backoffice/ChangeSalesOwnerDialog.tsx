"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import {
  SALES_OWNER_CHANGE_REASON_LABELS,
  SALES_OWNER_LABELS,
} from "@/constants/labels-sales-owner";
import { MANUAL_CHANGE_REASONS } from "@/constants/sales-owner";

import {
  salesOwnerErrorMessage,
  useChangeSalesOwner,
  useSalesOwner,
} from "@/lib/references/sales-owner";
import {
  suggestLeastLoaded,
  toSalesOption,
  useSalesWorkload,
} from "@/lib/references/sales-workload";

import { CheckboxField } from "@/components/shared/CheckboxField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { changeSalesOwnerSchema } from "./change-sales-owner-form";
import { ChoiceField } from "./ChoiceField";
import { NoteField } from "./NoteField";
import { SalesPickerField } from "./SalesPickerField";

import type { SalesOwnerChangeReason } from "@/constants/sales-owner";
import type { ChangeSalesOwnerValues } from "./change-sales-owner-form";

const L = SALES_OWNER_LABELS.dialog;

/**
 * "Đổi người phụ trách" (BR-S01, BR-S03, BR-S04, BR-S06, D3) — chỉ người có `customer-sales-owners:UPDATE` mở được
 * (UI-only; BE kiểm lại). Danh sách Sale lấy từ bảng tải (thấy ai đang tạm dừng / nghỉ); gửi kèm `version` của người
 * phụ trách đang xem — hai quản lý cùng đổi thì người sau nhận `SALES_OWNER_VERSION_CONFLICT`, hộp thoại tải lại bản
 * mới và giữ nguyên lựa chọn để làm lại (ca #15).
 */
export function ChangeSalesOwnerDialog({
  customerId,
  customerName,
  onClose,
  defaultReason = "",
  assign = false,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
  defaultReason?: SalesOwnerChangeReason | "";
  /** Khách chưa có / cần giao người phụ trách: tiêu đề "Giao người phụ trách", gợi ý Sale còn trống nhất. */
  assign?: boolean;
}) {
  const owner = useSalesOwner(customerId);
  const workload = useSalesWorkload();
  const change = useChangeSalesOwner();
  const [error, setError] = useState<string | null>(null);
  const current = owner.data;
  const currentOwnerId =
    current?.state === "ASSIGNED" && current.active ? current.salesOwnerId : null;
  const rows = workload.data ?? [];
  const suggested = assign ? suggestLeastLoaded(rows) : null;
  const form = useForm<ChangeSalesOwnerValues>({
    resolver: zodResolver(
      changeSalesOwnerSchema({
        reasons: MANUAL_CHANGE_REASONS,
        currentOwnerId: currentOwnerId ?? null,
      }),
    ),
    mode: "onChange",
    defaultValues: { salesOwnerId: "", reason: defaultReason, note: "", notifyCustomer: true },
  });
  const { errors } = form.formState;
  const loading = owner.isPending || workload.isPending;
  const unavailable = !loading && (!current || workload.data === null);
  const submit = form.handleSubmit((values) => {
    if (!current) return;
    setError(null);
    change.mutate(
      {
        customerId,
        salesOwnerId: values.salesOwnerId,
        reason: values.reason as SalesOwnerChangeReason,
        note: values.note,
        notifyCustomer: values.notifyCustomer,
        version: current.version,
      },
      { onSuccess: onClose, onError: (e) => setError(salesOwnerErrorMessage(e)) },
    );
  });

  return (
    <FormDialog open onOpenChange={(open) => !open && !change.isPending && onClose()}>
      <FormDialogBody
        title={assign ? L.assignTitle : L.title}
        description={L.description(customerName)}
        submitLabel={L.submit}
        canSubmit={!loading && !unavailable}
        isPending={change.isPending}
        error={unavailable ? "Chưa tải được danh sách Sale hoặc người phụ trách." : error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <Controller
          control={form.control}
          name="salesOwnerId"
          render={({ field }) => (
            <SalesPickerField
              id="sales-owner-new"
              label={L.sales}
              required
              value={field.value}
              onChange={field.onChange}
              options={rows.map(toSalesOption)}
              suggestedId={suggested?.userId}
              error={errors.salesOwnerId?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="reason"
          render={({ field }) => (
            <ChoiceField
              id="sales-owner-reason"
              label={L.reason}
              required
              placeholder={L.reasonPlaceholder}
              value={field.value}
              onChange={field.onChange}
              options={MANUAL_CHANGE_REASONS.map((value) => ({
                value,
                label: SALES_OWNER_CHANGE_REASON_LABELS[value],
              }))}
              error={errors.reason?.message}
            />
          )}
        />
        <NoteField
          id="sales-owner-note"
          label={L.note}
          rows={3}
          error={errors.note?.message}
          register={form.register("note")}
        />
        <div className="space-y-1">
          <CheckboxField control={form.control} name="notifyCustomer" label={L.notify} />
          <p className="text-ink-tertiary text-xs">{L.notifyHint}</p>
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
