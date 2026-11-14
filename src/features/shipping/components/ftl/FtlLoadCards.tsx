"use client";

import { CarrierBookingNotice } from "./CarrierBookingNotice";
import { CarrierOrderNotice } from "./CarrierOrderNotice";
import { ControlledCancelNotice } from "./ControlledCancelNotice";
import { BookingCard } from "./BookingCard";
import { HandoverWarningsNotice } from "./HandoverWarningsNotice";
import { PlanVehicleCard } from "./PlanVehicleCard";
import { WaybillCard } from "../waybill/WaybillCard";

import type { AllowedLoadAction } from "@/features/shipping/lifecycle";
import type { HandoverWarning, Load } from "@/features/shipping/types";
import type { BookingDialogKind } from "./BookingCard";

/** Thẻ của chuyến: xe của kế hoạch, đặt xe, mã vận đơn, cảnh báo bàn giao, nhắc huỷ xe đã đặt ngoài hệ thống. */
export function FtlLoadCards({
  load,
  actions,
  warnings,
  onDismissWarnings,
  onOpen,
}: {
  load: Load;
  actions: readonly AllowedLoadAction[];
  /** Đơn chưa được phép đi, trả khi bắt đầu xếp (BE chỉ trả lúc đó). */
  warnings: readonly HandoverWarning[];
  onDismissWarnings: () => void;
  onOpen: (dialog: BookingDialogKind | "waybill") => void;
}) {
  return (
    <>
      <ControlledCancelNotice load={load} />
      <CarrierBookingNotice load={load} />
      <HandoverWarningsNotice warnings={warnings} onDismiss={onDismissWarnings} />
      <PlanVehicleCard load={load} />
      <BookingCard load={load} actions={actions} onOpen={onOpen} />
      <CarrierOrderNotice load={load} />
      <WaybillCard load={load} actions={actions} onOpen={() => onOpen("waybill")} />
    </>
  );
}
