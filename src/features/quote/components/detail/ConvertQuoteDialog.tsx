"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatAddress, useCustomerAddressOptions } from "@/lib/references/customer-lookup";
import { quoteErrorMessage } from "@/features/quote/errors";
import { useConvertQuote } from "@/features/quote/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Notice } from "@/components/shared/Notice";

import type { Quote } from "@/features/quote/types";

/** Đại diện cho "" (địa chỉ mặc định) — SelectItem không nhận value rỗng. */
const DEFAULT_ADDRESS = "__default__";

function AddressSelect({
  id,
  label,
  value,
  onChange,
  defaultLabel,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Địa chỉ mặc định viết đủ (BO-UX-21), hoặc null khi chưa tải được sổ địa chỉ. */
  defaultLabel: string | null;
  options: { id: string; label: string }[];
}) {
  const chosen = value
    ? options.find((option) => option.id === value)?.label
    : (defaultLabel ?? undefined);
  return (
    <FormField id={id} label={label} hint={chosen}>
      <Select
        value={value === "" ? DEFAULT_ADDRESS : value}
        onValueChange={(next) => onChange(next === DEFAULT_ADDRESS ? "" : next)}
      >
        <SelectTrigger
          id={id}
          aria-describedby={chosen ? `${id}-hint` : undefined}
          className={FORM_SELECT_CLASS}
        >
          <SelectValue />
        </SelectTrigger>
        <TitledSelectContent title={label}>
          <SelectItem value={DEFAULT_ADDRESS}>
            {defaultLabel ? `Mặc định — ${defaultLabel}` : "Địa chỉ mặc định của khách"}
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
    </FormField>
  );
}

function ConvertForm({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const canReadAddresses = useCan(CUSTOMER_PERMISSIONS.read);
  const addresses = useCustomerAddressOptions(quote.customerId, canReadAddresses);
  const [shipping, setShipping] = useState("");
  const [billing, setBilling] = useState("");
  const [error, setError] = useState<string | null>(null);
  const convert = useConvertQuote();
  const router = useRouter();
  // "" = địa chỉ mặc định (BE tự lấy): viết nó ra đủ ở lựa chọn đầu, không lặp lại trong danh sách, không dùng ★.
  const ofType = (type: "SHIPPING" | "BILLING") =>
    (addresses.data ?? []).filter((address) => address.type === type);
  const defaultLabel = (type: "SHIPPING" | "BILLING") => {
    const fallback = ofType(type).find((address) => address.defaultAddress);
    return fallback ? formatAddress(fallback) : null;
  };
  const options = (type: "SHIPPING" | "BILLING") =>
    ofType(type)
      .filter((address) => !address.defaultAddress)
      .map((address) => ({ id: address.addressId, label: formatAddress(address) }));

  return (
    <FormDialogBody
      title={`Tạo đơn từ ${quote.quoteNumber}`}
      description="Tạo đơn Nháp từ báo giá đã chấp nhận. Đơn chưa giữ hàng; bước tiếp theo là lập hợp đồng."
      submitLabel="Tạo đơn"
      canSubmit
      isPending={convert.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => {
        setError(null);
        convert.mutate(
          {
            id: quote.id,
            version: quote.version,
            shippingAddressId: shipping || undefined,
            billingAddressId: billing || undefined,
          },
          {
            onSuccess: (saved) => {
              onClose();
              // Bấm lại trả cùng đơn (BE idempotent) → luôn sang khối Hợp đồng của đơn đó.
              if (saved.convertedOrder)
                router.push(ADMIN_ROUTES.orders.contract(saved.convertedOrder.orderId));
            },
            onError: (failure) => setError(quoteErrorMessage(failure)),
          },
        );
      }}
    >
      {addresses.isError && (
        <Notice tone="warning">
          Không tải được sổ địa chỉ — đơn sẽ dùng địa chỉ mặc định của khách.
        </Notice>
      )}
      <AddressSelect
        id="convert-shipping"
        label="Địa chỉ giao hàng"
        value={shipping}
        onChange={setShipping}
        defaultLabel={defaultLabel("SHIPPING")}
        options={options("SHIPPING")}
      />
      <AddressSelect
        id="convert-billing"
        label="Địa chỉ xuất hoá đơn"
        value={billing}
        onChange={setBilling}
        defaultLabel={defaultLabel("BILLING")}
        options={options("BILLING")}
      />
    </FormDialogBody>
  );
}

export function ConvertQuoteDialog({
  quote,
  open,
  onOpenChange,
}: {
  quote: Quote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <ConvertForm quote={quote} onClose={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
