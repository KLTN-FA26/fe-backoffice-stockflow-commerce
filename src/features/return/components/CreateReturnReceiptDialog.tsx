"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import {
  SHIPMENT_PERMISSIONS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants/permissions";
import { RETURN_LIMITS, RETURN_ROUTES } from "@/constants/returns";
import { useCan } from "@/lib/auth/components/Can";
import { useWarehouseAreas } from "@/lib/references/warehouse-layout";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Textarea } from "@/components/ui/textarea";

import { openDraftReceiptOf, returnErrorMessage } from "../errors";
import { createReceiptInputSchema } from "../input-schemas";
import { useCreateReturnReceipt } from "../mutations";
import { receiptCreatableNow } from "../lifecycle";
import { useSingleChoiceDefault } from "../use-single-choice-default";
import { useReceiptSourceReturns, useReturn, useReturnedShipments } from "../queries";

import { PickField } from "./PickField";
import { ReceiptSourceTypeField } from "./ReceiptSourceTypeField";

import type { CreateReceiptFormValues, ReturnRequest, ReturnRow } from "../types";

const L = RETURN_RECEIPT_LABELS.createDialog;

function CreateForm({
  returnRequestId,
  onClose,
}: {
  returnRequestId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // 409 RETURN_RECEIPT_ALREADY_OPEN: nguồn có `receiptDraftOpen` đã bị loại khỏi danh sách chọn; còn lọt (phiếu nháp
  // vừa mở ở nơi khác) thì BE từ chối và nêu phiếu nháp (`details.receiptId`) — màn đưa người dùng tới phiếu đó.
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);
  const canReadShipments = useCan(SHIPMENT_PERMISSIONS.read);
  const sources = useReceiptSourceReturns();
  // Mở từ màn yêu cầu (`?returnRequestId=`): yêu cầu đó luôn có trong danh sách chọn, kể cả khi nằm ngoài trang đầu
  const preselected = useReturn(returnRequestId);
  const rmaOptions = rmaSourceOptions(sources.data?.items ?? [], preselected.data ?? null);
  const shipments = useReturnedShipments(canReadShipments);
  const warehouses = useWarehouseOptions(useCan(WAREHOUSE_PERMISSIONS.read));
  const create = useCreateReturnReceipt();
  const form = useForm<CreateReceiptFormValues>({
    resolver: zodResolver(createReceiptInputSchema),
    defaultValues: {
      sourceType: "RMA",
      returnRequestId: returnRequestId ?? "",
      shipmentId: "",
      warehouseId: "",
      quarantineLocationCode: "",
      note: "",
    },
  });
  const { errors } = form.formState;
  const [sourceType, warehouseId, areaCode] = useWatch({
    control: form.control,
    name: ["sourceType", "warehouseId", "quarantineLocationCode"],
  });
  const areas = useWarehouseAreas(
    warehouseId || undefined,
    useCan(WAREHOUSE_LOCATION_PERMISSIONS.read),
  );
  const quarantine = (areas.data ?? []).filter((area) => area.type === "QUARANTINE");
  const warehouseList = warehouses.data ?? [];
  const onlyWarehouseId = warehouseList.length === 1 ? warehouseList[0]?.warehouseId : undefined;
  const onlyAreaCode = quarantine.length === 1 ? quarantine[0]?.locationCode : undefined;
  // Chỉ có một kho / một khu cách ly để chọn thì chọn sẵn (UX audit S21-2)
  useSingleChoiceDefault(onlyWarehouseId, warehouseId, (id) => form.setValue("warehouseId", id));
  useSingleChoiceDefault(onlyAreaCode, areaCode, (code) =>
    form.setValue("quarantineLocationCode", code),
  );

  const submit = form.handleSubmit((values) =>
    create.mutate(
      {
        returnRequestId: values.sourceType === "RMA" ? values.returnRequestId : undefined,
        shipmentId: values.sourceType === "SHIPMENT" ? values.shipmentId : undefined,
        quarantineLocationCode: values.quarantineLocationCode,
        note: values.note,
      },
      {
        onSuccess: (receipt) => {
          onClose();
          router.push(RETURN_ROUTES.receipts.detail(receipt.id));
        },
        onError: (failure) => {
          setError(returnErrorMessage(failure));
          setOpenDraftId(openDraftReceiptOf(failure));
        },
      },
    ),
  );

  return (
    <FormDialogBody
      title={L.title}
      description={L.description}
      submitLabel={L.submit}
      canSubmit
      isPending={create.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <ReceiptSourceTypeField control={form.control} canReadShipments={canReadShipments} />
      {sourceType === "RMA" ? (
        <Controller
          control={form.control}
          name="returnRequestId"
          render={({ field }) => (
            <PickField
              id="rr-rma"
              label={L.rma}
              placeholder={L.rmaPlaceholder}
              required
              error={errors.returnRequestId?.message}
              value={field.value}
              onChange={field.onChange}
              empty={L.noSource}
              options={rmaOptions}
            />
          )}
        />
      ) : (
        <Controller
          control={form.control}
          name="shipmentId"
          render={({ field }) => (
            <PickField
              id="rr-shipment"
              label={L.shipment}
              placeholder={L.shipmentPlaceholder}
              required
              error={errors.returnRequestId?.message}
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                // Chuyến biết kho xuất của nó — chọn sẵn kho nhận
                const picked = shipments.data?.find((s) => s.shipmentId === value);
                if (picked) form.setValue("warehouseId", picked.warehouseId);
              }}
              empty={L.noSource}
              options={(shipments.data ?? []).map((s) => ({
                value: s.shipmentId,
                label: `${s.code ?? s.shipmentId} · ${s.orderNumber ?? ""}`,
              }))}
            />
          )}
        />
      )}
      <Controller
        control={form.control}
        name="warehouseId"
        render={({ field }) => (
          <PickField
            id="rr-warehouse"
            label={L.warehouse}
            placeholder={L.warehousePlaceholder}
            required
            error={errors.warehouseId?.message}
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              form.setValue("quarantineLocationCode", "");
            }}
            options={(warehouses.data ?? []).map((w) => ({ value: w.warehouseId, label: w.name }))}
          />
        )}
      />
      <Controller
        control={form.control}
        name="quarantineLocationCode"
        render={({ field }) => (
          <PickField
            id="rr-area"
            label={L.area}
            placeholder={L.areaPlaceholder}
            required
            error={errors.quarantineLocationCode?.message}
            value={field.value}
            onChange={field.onChange}
            empty={warehouseId && !areas.isPending ? L.noArea : undefined}
            options={quarantine.map((area) => ({ value: area.locationCode, label: area.label }))}
          />
        )}
      />
      {openDraftId && (
        <p className="text-[0.8125rem]">
          <Link
            href={RETURN_ROUTES.receipts.detail(openDraftId)}
            className="text-accent-text font-medium hover:underline"
            onClick={onClose}
          >
            {L.openDraft}
          </Link>
        </p>
      )}
      <FormField id="rr-note" label={L.note} error={errors.note?.message}>
        <Textarea
          rows={2}
          maxLength={RETURN_LIMITS.receiptNoteMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("rr-note", errors.note?.message)}
          {...form.register("note")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/**
 * Yêu cầu chọn được làm nguồn: BE nói mở phiếu được (`receiptOpenable`, WF-05 Q-11 — kể cả hàng về muộn, nhiều phiếu một
 * yêu cầu) và chưa có phiếu nháp đang đếm (`receiptDraftOpen`, BE-23 — không mở phiếu thứ hai); BE cũ thì chỉ yêu cầu
 * chờ hàng về. Yêu cầu đang mở từ màn chi tiết đứng đầu nếu mở được.
 */
function rmaSourceOptions(
  rows: readonly ReturnRow[],
  preselected: ReturnRequest | null,
): { value: string; label: string }[] {
  const option = (ret: Pick<ReturnRow, "id" | "rmaNumber" | "orderNumber">) => ({
    value: ret.id,
    label: `${ret.rmaNumber} · ${ret.orderNumber}`,
  });
  const options = rows.filter((row) => receiptCreatableNow(row)).map(option);
  if (
    preselected &&
    receiptCreatableNow(preselected) &&
    !options.some((o) => o.value === preselected.id)
  )
    options.unshift(option(preselected));
  return options;
}

/**
 * Lập phiếu nhập hàng hoàn (docs 03 §4.2 bước 9; BE `POST /goods-receipts/returns`): nguồn là yêu cầu trả hàng đã
 * duyệt mà kho còn nhận được hàng (WF-05 Q-11: chờ hàng về, hoặc kiện về muộn — một yêu cầu có thể có nhiều phiếu, chỉ một
 * phiếu nháp mỗi lúc) hoặc chuyến hãng hoàn về (RETURNED), vào một khu QUARANTINE của kho xuất đơn (BR-14).
 */
export function CreateReturnReceiptDialog({
  open,
  returnRequestId,
  onClose,
}: {
  open: boolean;
  returnRequestId?: string;
  onClose: () => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={(next) => !next && onClose()}>
      {open && <CreateForm returnRequestId={returnRequestId} onClose={onClose} />}
    </FormDialog>
  );
}
