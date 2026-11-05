"use client";

import { UI_LABELS } from "@/constants";
import { useActiveCarriers } from "@/features/shipping/queries";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { FormSelect } from "@/components/shared/FormSelect";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";
const L = UI_LABELS.shipping;

interface CarrierSelectProps {
  id: string;
  value: string | null;
  onChange: (carrierId: string | null) => void;
  /** Cho phép chọn "không hãng" (bỏ hãng của lô / bỏ lọc theo hãng). */
  allowNone?: boolean;
  /** Nhãn của lựa chọn "không hãng"; mặc định "Chưa chọn hãng". */
  noneLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Tên hãng hiện tại khi hãng không còn trong danh sách đang dùng (đã ngừng / chưa tải xong). */
  currentName?: string | null;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}

/** Chọn hãng vận chuyển trong danh mục đang dùng (BE `GET /fulfillment/carriers?status=ACTIVE`). */
export function CarrierSelect({
  id,
  value,
  onChange,
  allowNone = false,
  noneLabel = L.field.carrierNone,
  disabled = false,
  placeholder = L.openDialog.carrierPlaceholder,
  currentName,
  className,
  ...aria
}: CarrierSelectProps) {
  const { data } = useActiveCarriers({});
  const carriers = data?.items ?? [];
  const known = !value || carriers.some((carrier) => carrier.carrierId === value);
  return (
    <FormSelect
      value={value ?? (allowNone ? NONE : "")}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={
          className ??
          "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
        }
        {...aria}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <TitledSelectContent title={L.field.carrier}>
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {!known && value && <SelectItem value={value}>{currentName ?? value}</SelectItem>}
        {carriers.map((carrier) => (
          <SelectItem key={carrier.carrierId} value={carrier.carrierId}>
            {carrier.code} · {carrier.name}
          </SelectItem>
        ))}
      </TitledSelectContent>
    </FormSelect>
  );
}
