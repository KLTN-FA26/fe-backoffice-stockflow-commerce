"use client";

import { useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { ORDER_SHIPPING_WAREHOUSE_LABELS } from "@/constants";
import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { defaultWarehouseId } from "../../shipping-warehouse-rules";
import { chooseShippingWarehouseSchema } from "../../shipping-warehouse-schemas";
import { useShippingWarehouseOptions } from "../../shipping-warehouse-queries";

import { WarehouseOptionList } from "./WarehouseOptionList";

import type { ChooseShippingWarehouseValues } from "../../shipping-warehouse-schemas";
import type { Order } from "../../types";

const L = ORDER_SHIPPING_WAREHOUSE_LABELS.dialog;

interface ChooseShippingWarehouseDialogProps {
  order: Pick<Order, "orderId" | "orderNumber">;
  isPending: boolean;
  /** Lỗi BE đã dịch sang tiếng Việt (giữ hộp thoại và lựa chọn của Sale). */
  error: string | null;
  onSubmit: (values: ChooseShippingWarehouseValues) => void;
  onClose: () => void;
}

/** Nội dung danh sách: đang tải / lỗi / rỗng / danh sách kho để chọn. */
function OptionsBody({
  orderId,
  value,
  onChange,
  error,
}: {
  orderId: string;
  value: string;
  onChange: (warehouseId: string) => void;
  error: string | undefined;
}) {
  const options = useShippingWarehouseOptions(orderId);
  // R6 (S10-1): chọn sẵn kho gợi ý (có lý do) hoặc kho duy nhất — một lần, khi danh sách vừa tải; Sale vẫn bấm xác nhận.
  const preselected = useRef(false);
  const initial = options.data
    ? defaultWarehouseId(options.data.warehouses, options.data.chosenWarehouseId)
    : "";
  useEffect(() => {
    if (preselected.current || !initial || value) return;
    preselected.current = true;
    onChange(initial);
  }, [initial, value, onChange]);
  if (options.isPending) return <p className="text-ink-secondary text-[0.8125rem]">{L.loading}</p>;
  if (options.isError) {
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        {L.failed}
      </p>
    );
  }
  if (options.data.warehouses.length === 0) {
    return <p className="text-ink-secondary text-[0.8125rem]">{L.empty}</p>;
  }
  return (
    <WarehouseOptionList
      warehouses={options.data.warehouses}
      value={value}
      chosenWarehouseId={options.data.chosenWarehouseId}
      onChange={onChange}
      error={error}
    />
  );
}

/**
 * Sale chọn kho xuất của đơn (docs 17 §4.2 bước 2-3, BR-22, BR-25): danh sách kho theo gợi ý của hệ thống kèm tồn và sức
 * chứa từng kho; chọn một kho rồi bấm "Chọn kho và giữ hàng" — hệ thống giữ ở kho đó phần đang có sẵn (nguyên thùng).
 * Hộp thoại chỉ mount khi mở nên mỗi lần mở là một lần thử mới (form sạch, số liệu kho tải lại).
 */
export function ChooseShippingWarehouseDialog({
  order,
  isPending,
  error,
  onSubmit,
  onClose,
}: ChooseShippingWarehouseDialogProps) {
  const form = useForm<ChooseShippingWarehouseValues>({
    resolver: zodResolver(chooseShippingWarehouseSchema),
    mode: "onChange",
    defaultValues: { warehouseId: "" },
  });
  const warehouseId = useWatch({ control: form.control, name: "warehouseId" });
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && !isPending && onClose()}
      className="sm:max-w-[600px]"
    >
      <FormDialogBody
        title={L.title}
        description={L.description(order.orderNumber)}
        submitLabel={L.submit}
        canSubmit={form.formState.isValid}
        isPending={isPending}
        error={error}
        onSubmit={() => void form.handleSubmit(onSubmit)()}
        onCancel={onClose}
      >
        <DialogScrollArea>
          <OptionsBody
            orderId={order.orderId}
            value={warehouseId}
            onChange={(value) => form.setValue("warehouseId", value, { shouldValidate: true })}
            error={form.formState.errors.warehouseId?.message}
          />
        </DialogScrollArea>
      </FormDialogBody>
    </FormDialog>
  );
}
