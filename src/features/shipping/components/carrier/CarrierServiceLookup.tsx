"use client";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { useCarrierServices } from "@/features/shipping/carrier-config-queries";

import { MONO } from "../primitives";

const S = UI_LABELS.shipping.waybill.carriers.config.serviceCodes;

/**
 * Dịch vụ xe tải mà hãng bán ở một thành phố, để chọn mã dịch vụ. BE HỎI API CỦA HÃNG (gọi ra ngoài) nên chỉ chạy khi người
 * dùng bấm "Tra dịch vụ của hãng" ở dòng đó, và chỉ cho hãng đã lưu ở kiểu API đặt xe. Lỗi hãng (422 / không phản hồi) nói
 * bằng câu tiếng Việt, không in lý do thô của hãng.
 */
export function CarrierServiceLookup({
  carrierId,
  cityId,
  onPick,
  onClose,
}: {
  carrierId: string;
  cityId: string;
  onPick: (serviceCode: string) => void;
  onClose: () => void;
}) {
  const query = useCarrierServices(carrierId, cityId, true);
  return (
    <div
      role="region"
      aria-label={S.lookupTitle}
      className="border-border-default bg-bg-subtle mt-2 rounded-[var(--r-sm)] border p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-ink-primary text-xs font-semibold">
          {S.lookupTitle} · <span className={MONO}>{cityId}</span>
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {S.lookupClose}
        </Button>
      </div>
      {query.isPending && (
        <p role="status" className="text-ink-tertiary text-xs">
          {S.lookupLoading}
        </p>
      )}
      {query.isError && (
        <Alert tone="warning">
          {query.error instanceof ApiError && query.error.status === 422
            ? S.lookupRefused
            : S.lookupUnreachable}
        </Alert>
      )}
      {query.data && query.data.length === 0 && (
        <p className="text-ink-tertiary text-xs">{S.lookupEmpty}</p>
      )}
      {query.data && query.data.length > 0 && (
        <ul className="divide-border-default divide-y">
          {query.data.map((option) => (
            <li key={option.serviceCode} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 text-[0.8125rem]">
                {option.name ? `${option.name} · ` : ""}
                <span className={MONO}>{option.serviceCode}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPick(option.serviceCode)}
              >
                {S.lookupPick}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
