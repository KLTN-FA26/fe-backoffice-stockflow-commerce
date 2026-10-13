"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES, MATERIAL_ISSUE_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { productionErrorMessage } from "@/features/production-order/errors";
import {
  quantityReasonInputSchema,
  recallInputSchema,
} from "@/features/production-order/input-schemas";
import { allowedSubcontractRecovery } from "@/features/production-order/lifecycle";
import {
  useRecallBlanks,
  useSupplementSubcontract,
  useTakeInHouse,
} from "@/features/production-order/mutations";
import { useSubcontractRecalls } from "@/features/production-order/queries";
import { LocationField } from "@/components/backoffice/LocationField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MONO } from "../copy";

import type { z } from "zod";
import type { SubcontractRecoveryAction } from "@/features/production-order/lifecycle";
import type { ProductionDetail } from "@/features/production-order/types";

const NUM = `${FORM_INPUT_CLASS} text-right tabular-nums`;
const LABEL: Record<SubcontractRecoveryAction, string> = {
  recall: "Thu hồi phôi",
  inHouse: "Chuyển về xưởng",
  supplement: "Đặt thêm gia công",
};

function RecallForm({ order, onClose }: { order: ProductionDetail; onClose: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const recall = useRecallBlanks();
  const form = useForm<z.input<typeof recallInputSchema>>({
    resolver: zodResolver(recallInputSchema),
    defaultValues: { returned: "0", spoilt: "0", returnLocation: "", note: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    recall.mutate(
      {
        id: order.summary.id,
        requestId,
        returned: Number(v.returned),
        spoilt: Number(v.spoilt),
        ...(v.returnLocation ? { returnLocation: v.returnLocation } : {}),
        ...(v.note ? { note: v.note } : {}),
      },
      { onSuccess: onClose, onError: (e) => setError(productionErrorMessage(e)) },
    ),
  );
  return (
    <FormDialogBody
      title="Thu hồi phôi từ nhà gia công"
      description="Ghi số phôi nhận lại và số đã hỏng ở nhà gia công. Không vượt số phôi đang nằm ở nhà gia công."
      submitLabel="Ghi thu hồi"
      canSubmit
      isPending={recall.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="recall-returned" label="Phôi trả lại" error={errors.returned?.message}>
        <Input
          {...form.register("returned")}
          {...fieldA11y("recall-returned", errors.returned?.message)}
          inputMode="numeric"
          className={NUM}
          autoFocus
        />
      </FormField>
      <FormField id="recall-spoilt" label="Phôi hỏng" error={errors.spoilt?.message}>
        <Input
          {...form.register("spoilt")}
          {...fieldA11y("recall-spoilt", errors.spoilt?.message)}
          inputMode="numeric"
          className={NUM}
        />
      </FormField>
      <Controller
        control={form.control}
        name="returnLocation"
        render={({ field }) => (
          <LocationField
            id="recall-location"
            label="Vị trí nhận phôi"
            warehouseId={order.summary.warehouseId}
            value={field.value}
            onChange={field.onChange}
            emptyHint="Để trống = về đúng nơi đã gửi đi."
          />
        )}
      />
      <FormField id="recall-note" label="Ghi chú" error={errors.note?.message}>
        <Input
          {...form.register("note")}
          {...fieldA11y("recall-note", errors.note?.message)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
    </FormDialogBody>
  );
}

function QuantityReasonForm({
  order,
  kind,
  onClose,
}: {
  order: ProductionDetail;
  kind: "inHouse" | "supplement";
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const inHouse = useTakeInHouse();
  const supplement = useSupplementSubcontract();
  const pending = inHouse.isPending || supplement.isPending;
  const owed = Math.max(0, order.summary.plannedQuantity - order.summary.goodQuantity);
  const form = useForm<z.input<typeof quantityReasonInputSchema>>({
    resolver: zodResolver(quantityReasonInputSchema),
    defaultValues: {
      quantity: kind === "inHouse" ? String(owed) : "",
      reason: "",
      packingLocation: "",
    },
  });
  const { errors } = form.formState;
  const onError = (e: unknown) => setError(productionErrorMessage(e));
  const submit = form.handleSubmit((v) => {
    if (kind === "inHouse")
      inHouse.mutate(
        {
          id: order.summary.id,
          quantity: Number(v.quantity),
          reason: v.reason,
          ...(v.packingLocation ? { packingLocation: v.packingLocation } : {}),
        },
        {
          onSuccess: (created) => {
            onClose();
            router.push(ADMIN_ROUTES.productionOrders.detail(created.summary.id));
          },
          onError,
        },
      );
    else
      supplement.mutate(
        { id: order.summary.id, quantity: Number(v.quantity), reason: v.reason },
        { onSuccess: onClose, onError },
      );
  });
  return (
    <FormDialogBody
      title={kind === "inHouse" ? "Chuyển phần còn lại về xưởng" : "Đặt thêm cho nhà gia công"}
      description={
        kind === "inHouse"
          ? `Còn nợ ${formatNumber(owed)} cái. Tạo LSX mới tại xưởng cho phần này; hàng đã QC đạt vẫn giữ cho đơn (QA2).`
          : "Đơn đặt gia công nháp được tăng số lượng; đơn đã duyệt tạo yêu cầu điều chỉnh chờ người khác duyệt."
      }
      submitLabel={kind === "inHouse" ? "Tạo LSX tại xưởng" : "Đặt thêm"}
      canSubmit
      isPending={pending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="qr-qty" label="Số lượng (cái)" required error={errors.quantity?.message}>
        <Input
          {...form.register("quantity")}
          {...fieldA11y("qr-qty", errors.quantity?.message)}
          inputMode="numeric"
          className={NUM}
          autoFocus
        />
      </FormField>
      <FormField id="qr-reason" label="Lý do" required error={errors.reason?.message}>
        <Input
          {...form.register("reason")}
          {...fieldA11y("qr-reason", errors.reason?.message)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      {kind === "inHouse" && (
        <Controller
          control={form.control}
          name="packingLocation"
          render={({ field }) => (
            <LocationField
              id="qr-packing"
              label="Khu đóng gói (nếu hoàn tất luôn)"
              warehouseId={order.summary.warehouseId}
              areaType="PACKING"
              value={field.value}
              onChange={field.onChange}
              emptyHint="Để trống nếu kho chỉ có một khu đóng gói."
            />
          )}
        />
      )}
    </FormDialogBody>
  );
}

/** Xử lý sự cố gia công: thu hồi phôi, chuyển về xưởng, đặt thêm (gated bởi lifecycle). */
export function SubcontractRecovery({ order }: { order: ProductionDetail }) {
  const can = usePermissionChecker();
  const [open, setOpen] = useState<SubcontractRecoveryAction | null>(null);
  const recalls = useSubcontractRecalls(order.summary.id, can(MATERIAL_ISSUE_PERMISSIONS.read));
  const actions = allowedSubcontractRecovery(order, can);
  const close = () => setOpen(null);
  return (
    <section aria-labelledby="sub-recovery" className="space-y-2">
      <h3 id="sub-recovery" className="text-ink-primary text-[0.8125rem] font-semibold">
        Xử lý sự cố gia công
      </h3>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action} size="sm" variant="outline" onClick={() => setOpen(action)}>
              {LABEL[action]}
            </Button>
          ))}
        </div>
      )}
      {recalls.data?.map((recall) => (
        <p key={recall.id} className={`text-ink-secondary ${MONO}`}>
          {formatDateTime(recall.recordedAt)}: trả {formatNumber(recall.returned)} · hỏng{" "}
          {formatNumber(recall.spoilt)}
          {recall.returnLocation ? ` → ${recall.returnLocation}` : ""}
        </p>
      ))}
      <FormDialog open={open !== null} onOpenChange={(value) => !value && close()}>
        {open === "recall" && <RecallForm order={order} onClose={close} />}
        {(open === "inHouse" || open === "supplement") && (
          <QuantityReasonForm order={order} kind={open} onClose={close} />
        )}
      </FormDialog>
    </section>
  );
}
