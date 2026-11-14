"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { handoverRefusalOf, shippingErrorMessage } from "@/features/shipping/errors";
import { hasWaybill, isApiBookedLoad } from "@/features/shipping/ftl-selectors";
import { handoverBlockedOrders, isWaybillMissingError } from "@/features/shipping/handover-blocks";
import { handoverInputSchema } from "@/features/shipping/input-schemas";
import { useHandoverLoad } from "@/features/shipping/mutations";
import { useRecordWaybill } from "@/features/shipping/waybill-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { RejectedScansNotice } from "../load/RejectedScans";
import { HandoverBlockedNotice } from "./HandoverBlockedNotice";
import { HANDOVER_SERVER_FIELDS, HandoverFields } from "./HandoverFields";
import { MissingWaybillNotice } from "./MissingWaybillNotice";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type {
  HandoverFormInput,
  HandoverValues,
  HandoverWarning,
  Load,
} from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover;
const FTL = UI_LABELS.shipping.ftl.handover;

interface HandoverDialogProps {
  load: Load;
  onClose: () => void;
  /** Chuyến đã sang DISPATCHED — màn hiện kết quả. */
  onDone: (load: Load) => void;
  /** BE từ chối vì một lô cụ thể → màn đánh dấu lô đó (kể cả sau khi đóng hộp). */
  onRefused: (refusal: HandoverRefusal) => void;
  /** Mở nhập mã vận đơn; `undefined` khi người dùng không nhập được (thiếu quyền, hãng đặt xe qua API). */
  onEnterWaybill?: () => void;
}

/**
 * Xác nhận bàn giao (docs 09 §4.1 bước 3): biên bản giấy đã in, hai bên ký → ghi người ký bên hãng,
 * biển số, SĐT tài xế, mã biên bản đã ký. `version` là phiên bản chuyến lúc MỞ hộp thoại (BE 409
 * OPTIMISTIC_LOCK nếu có người quét / bỏ lô trong lúc hai bên ký). Bắt buộc có mã vận đơn (BR-23): chưa có thì báo ngay và
 * mời nhập; BE từ chối cả xe (LOAD_HANDOVER_BLOCKED) thì liệt kê từng đơn chặn (BR-18).
 */
export function HandoverDialog({
  load,
  onClose,
  onDone,
  onRefused,
  onEnterWaybill,
}: HandoverDialogProps) {
  // `onSuccess` ở mức hook (không ở `mutate`): ghi cache đưa chuyến sang DISPATCHED có thể gỡ hộp thoại
  // này trước khi callback của `mutate` chạy — callback mức hook vẫn chạy.
  const handover = useHandoverLoad({ onSuccess: onDone });
  // null sau OPTIMISTIC_LOCK: lần ký kế tiếp lấy phiên bản đã tải lại (sau khi người ký xem lại)
  const [version, setVersion] = useState<number | null>(load.version);
  const [serverError, setServerError] = useState<string | null>(null);
  const [blockedOrders, setBlockedOrders] = useState<readonly HandoverWarning[] | null>(null);
  // Chuyến chưa có mã vận đơn (biết trước) hoặc BE vừa báo 409 LOAD_WAYBILL_MISSING (mã vừa bị xoá ở nơi khác)
  const [waybillMissing, setWaybillMissing] = useState(false);
  const noWaybill = !hasWaybill(load) || waybillMissing;
  // WF4-DRIVER: chưa có tên tài xế thì phải nhập trước khi ký. Hãng đặt xe qua API không nhập tay được (tên về qua webhook) →
  // chưa ký được tới khi có tên.
  const api = isApiBookedLoad(load);
  const driverMissing = !load.driverName;
  const record = useRecordWaybill();
  const schema = handoverInputSchema(!load.vehiclePlate, driverMissing && !api);
  const form = useForm<HandoverFormInput, unknown, HandoverValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      carrierRepresentative: load.driverName ?? "",
      driverName: "",
      vehiclePlate: load.vehiclePlate ?? "",
      driverPhone: load.driverPhone ?? "",
      signatureRef: "",
      note: "",
    },
  });
  // Sửa bất kỳ ô nào → lỗi máy chủ của lần gửi trước không còn đúng
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ type }) => {
          if (type === "change") setServerError(null);
        },
      }),
    [form],
  );

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    setBlockedOrders(null);
    const { driverName, ...body } = values;
    const sign = (currentVersion: number) =>
      handover.mutate(
        { loadId: load.loadId, version: currentVersion, values: body },
        { onError: onSignError },
      );
    // BE `HandoverRequest` không có tên tài xế: lưu trước qua `PUT loads/{id}/waybill` (chuyến đang xếp, hãng không phải API),
    // rồi ký với `version` mới. Chưa có mã vận đơn thì bỏ qua — BE sẽ báo LOAD_WAYBILL_MISSING và mời nhập mã vận đơn.
    if (driverMissing && !api && driverName && load.waybillNo) {
      record.mutate(
        {
          loadId: load.loadId,
          values: {
            waybillNo: load.waybillNo,
            driverName,
            vehiclePlate: undefined,
            driverPhone: undefined,
            reason: undefined,
          },
        },
        {
          onSuccess: (updated) => sign(updated.version),
          onError: (error) => {
            setServerError(shippingErrorMessage(error));
            if (error instanceof ApiError && error.fieldErrors?.driverName) {
              form.setError("driverName", {
                type: "server",
                message: error.fieldErrors.driverName,
              });
            }
          },
        },
      );
      return;
    }
    sign(version ?? load.version);
  });

  const onSignError = (error: unknown) => {
    const orders = handoverBlockedOrders(error);
    setBlockedOrders(orders ?? null);
    setWaybillMissing(isWaybillMissingError(error));
    // Danh sách đơn chặn / thiếu mã vận đơn đã có khối riêng ở trên — không lặp câu lỗi chung
    setServerError(orders || isWaybillMissingError(error) ? null : shippingErrorMessage(error));
    // Chuyến đã đổi trong lúc ký → GIỮ các ô đã nhập (tên người ký, mã biên bản, ghi chú), bỏ tick
    // "đã ký": hai bên xem lại biên bản (đã tải lại phía sau) rồi tick lại mới ký tiếp được
    if (error instanceof ApiError && error.code === "OPTIMISTIC_LOCK") {
      setVersion(null);
      form.resetField("signed");
      return;
    }
    const named = handoverRefusalOf(error);
    if (named) onRefused(named);
    // @Valid của BE → gắn lỗi vào đúng ô (api-conventions §4.4)
    if (error instanceof ApiError) {
      for (const name of HANDOVER_SERVER_FIELDS) {
        const message = error.fieldErrors?.[name];
        if (message) form.setError(name, { type: "server", message });
      }
    }
  };

  return (
    // Đang gửi thì không cho đóng: đóng giữa chừng sẽ mất thông báo lỗi
    <FormDialog
      open
      onOpenChange={(next) => !next && !handover.isPending && !record.isPending && onClose()}
    >
      <FormDialogBody
        title={`${H.title} · ${load.code}`}
        description={FTL.description}
        submitLabel={H.title}
        canSubmit={form.formState.isValid && !(driverMissing && api)}
        isPending={handover.isPending || record.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !handover.isPending && !record.isPending && onClose()}
      >
        <RejectedScansNotice load={load} />
        {noWaybill && (
          <MissingWaybillNotice apiManaged={isApiBookedLoad(load)} onEnter={onEnterWaybill} />
        )}
        {blockedOrders && <HandoverBlockedNotice orders={blockedOrders} />}
        <HandoverFields form={form} load={load} />
      </FormDialogBody>
    </FormDialog>
  );
}
