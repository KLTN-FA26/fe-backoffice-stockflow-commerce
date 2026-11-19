"use client";

import { Search } from "lucide-react";

import { CARRIER_CONFIG_LIMITS, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { TextCellBody } from "./RowCells";

const S = UI_LABELS.shipping.waybill.carriers.config.serviceCodes;

/**
 * Ô mã dịch vụ của một dòng kèm nút "Tra dịch vụ của hãng" (BE hỏi API của hãng — chỉ chạy khi bấm, chỉ cho hãng đã lưu ở kiểu
 * API đặt xe và đã nhập mã thành phố).
 */
export function ServiceCodeCell({
  index,
  value,
  error,
  onChange,
  lookup,
}: {
  index: number;
  value: string;
  error?: string;
  onChange: (next: string) => void;
  lookup: { enabled: boolean; needsSaved: boolean; needsCity: boolean; onOpen: () => void };
}) {
  return (
    <td className="px-1.5 py-1 align-top">
      <TextCellBody
        label={`${S.serviceCode} ${index + 1}`}
        value={value}
        placeholder={S.serviceCodePlaceholder}
        maxLength={CARRIER_CONFIG_LIMITS.serviceCodeMax}
        error={error}
        onChange={onChange}
      />
      <Button
        type="button"
        variant="link"
        size="sm"
        className="mt-0.5 h-auto p-0 text-left text-xs whitespace-normal"
        disabled={!lookup.enabled}
        title={
          lookup.needsSaved ? S.lookupNeedsSaved : lookup.needsCity ? S.lookupNeedsCity : undefined
        }
        aria-label={S.lookupAria(index + 1)}
        onClick={lookup.onOpen}
      >
        <Search aria-hidden />
        {S.lookup}
      </Button>
    </td>
  );
}
