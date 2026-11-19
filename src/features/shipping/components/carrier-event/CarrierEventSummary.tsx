"use client";

import { UI_LABELS } from "@/constants";
import { ListConfigSummary } from "@/components/shared/ListConfigSummary";

import type { ListSummaryItem } from "@/components/shared/ListConfigSummary";
import type { CarrierEventListState } from "./useCarrierEventListState";

const F = UI_LABELS.shipping.carrierEvents.filter;
const E = UI_LABELS.shipping.carrierEvents;

/** Thanh `Cấu hình` dưới bộ lọc (data-table-mode-a §3): mỗi bộ lọc đang bật là một badge có nút X, "Đặt lại" gỡ tất cả. */
export function CarrierEventSummary({ s }: { s: CarrierEventListState }) {
  const handlingLabel = { all: F.handlingAll, open: F.handlingOpen, done: F.handlingDone }[
    s.handling
  ];
  const items: ListSummaryItem[] = [
    {
      label: F.result,
      value: s.result === "ERRORS" ? F.errors : s.result === "ALL" ? F.all : E.result[s.result],
      active: !s.resultIsDefault,
      onClear: s.clearResult,
      clearLabel: F.clearResult,
    },
    {
      label: F.handling,
      value: handlingLabel,
      active: s.handling !== "all",
      onClear: s.clearHandling,
      clearLabel: F.clearHandling,
    },
    {
      label: F.carrier,
      value: s.carrierId ? F.carrierValue : F.allCarriers,
      active: !!s.carrierId,
      onClear: s.clearCarrier,
      clearLabel: F.clearCarrier,
    },
    {
      label: F.load,
      value: s.loadId ? F.loadValue : F.all,
      active: !!s.loadId,
      onClear: s.clearLoad,
      clearLabel: F.clearLoad,
    },
  ];
  return (
    <ListConfigSummary items={items} onResetAll={s.clearFilters} resetDisabled={!s.hasFilters} />
  );
}
