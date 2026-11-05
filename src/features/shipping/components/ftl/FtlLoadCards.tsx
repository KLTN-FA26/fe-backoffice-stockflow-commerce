"use client";

import { CarrierBookingNotice } from "./CarrierBookingNotice";
import { ControlledCancelNotice } from "./ControlledCancelNotice";
import { BookingCard } from "./BookingCard";
import { PlanVehicleCard } from "./PlanVehicleCard";

import type { AllowedLoadAction } from "@/features/shipping/lifecycle";
import type { Load } from "@/features/shipping/types";
import type { BookingDialogKind } from "./BookingCard";

/** Thẻ riêng của chuyến nguyên xe: kế hoạch / xe, đặt xe, nhắc huỷ xe đã đặt ngoài hệ thống. */
export function FtlLoadCards({
  load,
  actions,
  onOpen,
}: {
  load: Load;
  actions: readonly AllowedLoadAction[];
  onOpen: (dialog: BookingDialogKind) => void;
}) {
  return (
    <>
      <ControlledCancelNotice load={load} />
      <CarrierBookingNotice load={load} />
      <PlanVehicleCard load={load} />
      <BookingCard load={load} actions={actions} onOpen={onOpen} />
    </>
  );
}
