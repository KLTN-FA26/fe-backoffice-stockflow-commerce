"use client";

import { LOAD_STATUS } from "@/constants";
import { isLoadOpen } from "@/features/shipping/lifecycle";

import { BookingDialog } from "../ftl/BookingDialog";
import { CancelBookingDialog, StartLoadingDialog } from "../ftl/BookingConfirmDialogs";
import { HandoverDialog } from "../handover/HandoverDialog";
import { AddShipmentsDialog } from "./AddShipmentsDialog";
import { CancelLoadDialog } from "./CancelLoadDialog";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type { Load } from "@/features/shipping/types";

export type LoadDialogKind =
  "handover" | "cancel" | "add" | "book" | "cancelBooking" | "startLoading" | null;

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
}: {
  load: Load;
  dialog: LoadDialogKind;
  onClose: () => void;
  onRefused: (refusal: HandoverRefusal) => void;
  onDone: (load: Load) => void;
}) {
  if (dialog === "handover" && load.status === LOAD_STATUS.LOADING) {
    return <HandoverDialog load={load} onClose={onClose} onRefused={onRefused} onDone={onDone} />;
  }
  if (dialog === "cancel" && isLoadOpen(load.status)) {
    return <CancelLoadDialog load={load} onClose={onClose} />;
  }
  if (dialog === "add" && isLoadOpen(load.status)) {
    return <AddShipmentsDialog load={load} onClose={onClose} />;
  }
  // Đặt xe / huỷ đặt xe / bắt đầu xếp hàng (chuyến nguyên xe, BE PR #162) — chỉ ở đúng trạng thái của bước
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
    return <StartLoadingDialog load={load} onClose={onClose} />;
  }
  return null;
}
