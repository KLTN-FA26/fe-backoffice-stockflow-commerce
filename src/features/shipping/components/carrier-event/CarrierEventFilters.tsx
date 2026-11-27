"use client";

import {
  CARRIER_EVENT_ERRORS_FILTER,
  CARRIER_EVENT_RESULTS,
  SHIPMENT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { CARRIER_EVENT_ALL_FILTER } from "@/features/shipping/carrier-event-lifecycle";
import { useCan } from "@/lib/auth";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";

import { CarrierSelect } from "../CarrierSelect";

import type { CarrierEventListState } from "./useCarrierEventListState";

const F = UI_LABELS.shipping.carrierEvents.filter;
const E = UI_LABELS.shipping.carrierEvents;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-[13rem] rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Lọc sự kiện: kết quả (mặc định danh sách lỗi), đã / chưa xử lý (chỉ trong danh sách lỗi), hãng (BE `carrierId`) và, khi mở
 * từ một chuyến, chip bỏ lọc chuyến (BE `loadId`). Danh mục hãng là `fulfillment-shipments:READ` nên ô hãng chỉ hiện khi có quyền đó.
 */
export function CarrierEventFilters({ s }: { s: CarrierEventListState }) {
  const canPickCarrier = useCan(SHIPMENT_PERMISSIONS.read);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="event-result" className="text-ink-secondary text-[0.8125rem]">
          {F.result}
        </Label>
        <Select value={s.result} onValueChange={s.setResult}>
          <SelectTrigger id="event-result" className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={F.result}>
            <SelectItem value={CARRIER_EVENT_ERRORS_FILTER}>{F.errors}</SelectItem>
            <SelectItem value={CARRIER_EVENT_ALL_FILTER}>{F.all}</SelectItem>
            {CARRIER_EVENT_RESULTS.map((result) => (
              <SelectItem key={result} value={result}>
                {E.result[result]}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="event-handling" className="text-ink-secondary text-[0.8125rem]">
          {F.handling}
        </Label>
        <Select value={s.handling} onValueChange={s.setHandling} disabled={!s.errorView}>
          <SelectTrigger
            id="event-handling"
            className={TRIGGER}
            title={s.errorView ? undefined : F.handlingHint}
          >
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={F.handling}>
            <SelectItem value="all">{F.handlingAll}</SelectItem>
            <SelectItem value="open">{F.handlingOpen}</SelectItem>
            <SelectItem value="done">{F.handlingDone}</SelectItem>
          </TitledSelectContent>
        </Select>
      </div>
      {canPickCarrier && (
        <div className="flex items-center gap-2">
          <Label htmlFor="event-carrier" className="text-ink-secondary text-[0.8125rem]">
            {F.carrier}
          </Label>
          <div className="w-[14rem]">
            <CarrierSelect
              id="event-carrier"
              value={s.carrierId || null}
              onChange={(carrierId) => s.setCarrierId(carrierId ?? "")}
              allowNone
              noneLabel={F.allCarriers}
              currentName={F.carrierOther}
            />
          </div>
        </div>
      )}
    </div>
  );
}
