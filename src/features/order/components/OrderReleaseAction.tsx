"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RELEASE_FIELD_ERRORS, releaseErrorView } from "../errors";
import { RELEASE_FORM_DEFAULTS, releaseFormSchema } from "../form-schemas";
import { useReleaseOrder } from "../mutations";
import { customLineCount } from "../selectors";

import { FormFieldError, RequiredMark } from "./FormFieldError";
import { OrderRefusalAlert } from "./OrderRefusalAlert";
import { STALE_CODES, useOrderActionErrors } from "./useOrderActionErrors";

import type { ReleaseFormValues } from "../form-schemas";
import type { Order, ReleaseOrderInput } from "../types";

type ReleaseOrder = Pick<Order, "orderId" | "orderNumber" | "lines">;

/**
 * Release đơn (SCRUM-423, docs 17 §4.2 bước 4–6): Order Coordinator chọn kho xuất. Có dòng in →
 * sinh lệnh sản xuất, đơn In Production; chỉ hàng sẵn → Ready to Fulfill. Lý do từ chối của BE
 * (BR-PRD-08 mẫu chưa duyệt, BR-PRD-09 chưa đủ cọc, công nợ quá hạn…) hiện ngay trong dialog.
 */
export function OrderReleaseAction({ order }: { order: ReleaseOrder }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        className="w-full rounded-[var(--r-sm)]"
        onClick={() => setOpen(true)}
      >
        <Send className="size-3.5" /> {UI_LABELS.order.actions.release}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        <ReleaseForm order={order} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}

function ReleaseForm({ order, onClose }: { order: ReleaseOrder; onClose: () => void }) {
  const warehouses = useWarehouseOptions();
  const { mutate: release, isPending } = useReleaseOrder();
  const form = useForm<ReleaseFormValues, unknown, ReleaseOrderInput>({
    resolver: zodResolver(releaseFormSchema),
    mode: "onChange",
    defaultValues: RELEASE_FORM_DEFAULTS,
  });
  const { refusal, clearRefusal, onError } = useOrderActionErrors(
    releaseErrorView,
    STALE_CODES.release,
    onClose,
    {
      map: RELEASE_FIELD_ERRORS,
      setError: (field, message) => form.setError(field, { type: "server", message }),
    },
  );
  const warehouseError = form.formState.errors.warehouseId?.message;
  const printLines = customLineCount(order);
  // BE seed chưa cấp warehouse-warehouses:READ cho ORDER_COORDINATOR → GET /warehouses 403
  const warehousesForbidden =
    warehouses.error instanceof ApiError && warehouses.error.status === 403;

  const submit = form.handleSubmit((input) => {
    clearRefusal();
    release({ id: order.orderId, ...input }, { onSuccess: onClose, onError });
  });

  return (
    <FormDialogBody
      title="Release đơn cho kho"
      description={`Chọn kho xuất cho đơn ${order.orderNumber}. ${
        printLines > 0
          ? `Đơn có ${printLines} dòng in — mỗi dòng sinh một lệnh sản xuất tại kho đã chọn.`
          : "Đơn chỉ gồm hàng sẵn — chuyển sang Sẵn sàng thực hiện."
      }`}
      submitLabel="Release"
      canSubmit={form.formState.isValid}
      isPending={isPending}
      error={null}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="release-warehouse" className="text-ink-secondary text-xs font-medium">
          Kho xuất <RequiredMark />
        </Label>
        <Controller
          control={form.control}
          name="warehouseId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={!warehouses.data}>
              <SelectTrigger
                id="release-warehouse"
                autoFocus
                aria-required="true"
                aria-invalid={warehouseError ? true : undefined}
                aria-describedby={
                  warehouses.isError
                    ? "release-warehouse-error"
                    : warehouseError
                      ? "release-warehouse-field-error"
                      : undefined
                }
                className="w-full"
              >
                <SelectValue
                  placeholder={warehouses.isPending ? "Đang tải kho…" : "Chọn kho xuất"}
                />
              </SelectTrigger>
              <SelectContent>
                {warehouses.data?.map((w) => (
                  <SelectItem key={w.warehouseId} value={w.warehouseId}>
                    {w.code ? `${w.code} — ${w.name}` : w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {warehouses.isError && (
          <p id="release-warehouse-error" role="alert" className="text-danger text-xs">
            {warehousesForbidden
              ? "Tài khoản chưa được cấp quyền xem danh sách kho (warehouse-warehouses:READ) — liên hệ quản trị."
              : "Không tải được danh sách kho."}
          </p>
        )}
        <FormFieldError id="release-warehouse-field-error" message={warehouseError} />
        {warehouses.data?.length === 0 && (
          <FormFieldError id="release-warehouse-empty" message="Chưa có kho nào đang hoạt động." />
        )}
        {printLines > 0 && (
          // docs 17 §4.2 bước 4: dòng in chỉ giao cho kho có khu PRODUCTION + trạm in Active
          <p className="text-ink-tertiary text-xs">
            Dòng in chỉ release được cho kho có xưởng in. Thiết kế mới cần mẫu được khách duyệt
            (BR-PRD-08) — máy chủ kiểm khi release.
          </p>
        )}
      </div>
      {refusal && <OrderRefusalAlert view={refusal} />}
    </FormDialogBody>
  );
}
