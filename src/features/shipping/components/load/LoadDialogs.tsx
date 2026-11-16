"use client";

import { LOAD_STATUS } from "@/constants";

import { BookingDialog } from "../ftl/BookingDialog";
import { CancelBookingDialog, StartLoadingDialog } from "../ftl/BookingConfirmDialogs";
import { ControlledCancelLoadDialog } from "../ftl/ControlledCancelLoadDialog";
import { HandoverDialog } from "../handover/HandoverDialog";
import { WaybillDialog } from "../waybill/WaybillDialog";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type { Load } from "@/features/shipping/types";

export type LoadDialogKind =
  "handover" | "book" | "cancelBooking" | "startLoading" | "waybill" | "controlledCancel" | null;

/**
 * Hộp thoại của màn chuyến. Gắn với TRẠNG THÁI chuyến, không với quyền: ghi cache sau khi bàn giao /
 * huỷ đổi trạng thái chuyến và hộp thoại tự gỡ — kết quả do callback mức hook của mutation báo.
 */
export function LoadDialogs({
  load,
  dialog,
  onClose,
  onRefused,
  onDone,
  onStarted,
  onOpen,
  canEnterWaybill,
}: {
  load: Load;
  dialog: LoadDialogKind;
  onClose: () => void;
  onRefused: (refusal: HandoverRefusal) => void;
  onDone: (load: Load) => void;
  /** Câu trả lời của "bắt đầu xếp": mang cảnh báo đơn chưa được phép đi (BE chỉ trả lúc này). */
  onStarted: (load: Load) => void;
  /** Mở hộp thoại khác (vd từ lỗi thiếu mã vận đơn của hộp thoại bàn giao sang nhập mã vận đơn). */
  onOpen: (dialog: LoadDialogKind) => void;
  /** Người dùng nhập được mã vận đơn của chuyến này (quyền + hãng không đặt qua API) → hộp thoại bàn giao mời nhập. */
  canEnterWaybill: boolean;
}) {
  if (dialog === "handover" && load.status === LOAD_STATUS.LOADING) {
    return (
      <HandoverDialog
        load={load}
        onClose={onClose}
        onRefused={onRefused}
        onDone={onDone}
        onEnterWaybill={canEnterWaybill ? () => onOpen("waybill") : undefined}
      />
    );
  }
  // SCRUM-474: chỉ xe đang xếp hàng huỷ có kiểm soát được; sau khi huỷ chuyến sang CANCELLED nên hộp thoại tự gỡ
  if (dialog === "controlledCancel" && load.status === LOAD_STATUS.LOADING) {
    return <ControlledCancelLoadDialog load={load} onClose={onClose} />;
  }
  // Đặt xe / huỷ đặt xe / bắt đầu xếp hàng — chỉ ở đúng trạng thái của bước
  if (
    dialog === "book" &&
    (load.status === LOAD_STATUS.PLANNED || load.status === LOAD_STATUS.VEHICLE_BOOKED)
  ) {
    return <BookingDialog load={load} onClose={onClose} />;
  }
  if (dialog === "cancelBooking" && load.status === LOAD_STATUS.VEHICLE_BOOKED) {
    return <CancelBookingDialog load={load} onClose={onClose} />;
  }
  if (dialog === "startLoading" && load.status === LOAD_STATUS.VEHICLE_BOOKED) {
    return <StartLoadingDialog load={load} onClose={onClose} onStarted={onStarted} />;
  }
  // Mã vận đơn: trước khi rời kho là nhập / đổi; sau khi rời kho là sửa kèm lý do (quản lý kho, BR-24)
  if (
    dialog === "waybill" &&
    (load.status === LOAD_STATUS.VEHICLE_BOOKED ||
      load.status === LOAD_STATUS.LOADING ||
      load.status === LOAD_STATUS.DISPATCHED)
  ) {
    return <WaybillDialog load={load} onClose={onClose} />;
  }
  return null;
}
