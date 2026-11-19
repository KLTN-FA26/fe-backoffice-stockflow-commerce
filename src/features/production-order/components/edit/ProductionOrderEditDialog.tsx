"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PRODUCTION_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { productionOrderEditInput } from "@/features/production-order/input-schemas";
import { useEditProductionOrder } from "@/features/production-order/mutations";
import {
  editBodyOf,
  editValuesOf,
  shortageFromMessage,
} from "@/features/production-order/selectors";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { EditHeaderFields } from "./EditHeaderFields";
import { EditLineFields } from "./EditLineFields";

import type { ProductionOrder, ProductionOrderEditValues } from "@/features/production-order/types";

const E = PRODUCTION_LABELS.edit;

/**
 * Sửa Đơn sản xuất nháp (docs 17 §4.3, BR-24, BR-26): đơn vị sản xuất (chỉ ACTIVE), ngày cần hàng, ghi chú, cờ duyệt
 * mẫu (+ lý do khi tắt), số thùng và yêu cầu đóng gói từng dòng. 409 PRODUCTION_ORDER_EXCEEDS_SHORTAGE → báo tại dòng.
 */
export function ProductionOrderEditDialog({
  order,
  onClose,
}: {
  order: ProductionOrder;
  onClose: () => void;
}) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()} className="sm:max-w-[760px]">
      <EditForm order={order} onClose={onClose} />
    </FormDialog>
  );
}

function EditForm({ order: latest, onClose }: { order: ProductionOrder; onClose: () => void }) {
  // Giữ bản đã đọc lúc mở form: 409 OPTIMISTIC_LOCK làm mới `latest` nhưng form vẫn là giá trị cũ — gửi lại với
  // version mới sẽ ghi đè thay đổi của người khác. Version cũ → BE tiếp tục 409, người dùng phải đóng và mở lại.
  const [order] = useState(latest);
  const edit = useEditProductionOrder();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ProductionOrderEditValues>({
    resolver: zodResolver(productionOrderEditInput),
    mode: "onChange",
    defaultValues: editValuesOf(order),
  });

  const submit = form.handleSubmit((values) => {
    setError(null);
    edit.mutate(
      { id: order.id, version: order.version, body: editBodyOf(order, values) },
      {
        onSuccess: onClose,
        onError: (failure) => {
          setError(productionOrderErrorMessage(failure));
          if (
            !(failure instanceof ApiError) ||
            failure.code !== "PRODUCTION_ORDER_EXCEEDS_SHORTAGE"
          )
            return;
          // BE chỉ nói "lacks N carton(s)" của đợt: gắn lỗi vào các dòng vừa tăng số thùng
          const lacks = shortageFromMessage(failure.message);
          const message =
            lacks === null
              ? E.validation.exceedsShortage
              : `${E.validation.exceedsShortage} (${lacks})`;
          values.lines.forEach((line, index) => {
            const before = order.lines.find((l) => l.orderLineId === line.orderLineId);
            if (before && Number(line.cartons) > before.cartons)
              form.setError(`lines.${index}.cartons`, { type: "server", message });
          });
        },
      },
    );
  });

  return (
    <FormDialogBody
      title={`${E.title} ${order.code}`}
      description={E.description}
      submitLabel={E.submit}
      canSubmit={form.formState.isValid}
      isPending={edit.isPending}
      error={error}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <EditHeaderFields form={form} />
      <EditLineFields form={form} />
    </FormDialogBody>
  );
}
