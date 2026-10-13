"use client";

import { useState } from "react";

import { CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatAddress, useCustomerAddressOptions } from "@/lib/references/customer-lookup";
import { quoteErrorMessage } from "@/features/quote/errors";
import { useConvertQuote } from "@/features/quote/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";

import type { Quote } from "@/features/quote/types";

function AddressSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <FormField id={id} label={label}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FORM_INPUT_CLASS} border px-2`}
      >
        <option value="">Địa chỉ mặc định của khách</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
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
  const options = (type: "SHIPPING" | "BILLING") =>
    (addresses.data ?? [])
      .filter((address) => address.type === type)
      .map((address) => ({
        id: address.addressId,
        label: `${address.defaultAddress ? "★ " : ""}${formatAddress(address)}`,
      }));

  return (
    <FormDialogBody
      title={`Tạo đơn bán từ ${quote.quoteNumber}`}
      description="Đơn được tạo theo số lượng và đơn giá khách đã chấp nhận, cùng điều khoản thanh toán của báo giá. Hệ thống giữ hàng ngay khi tạo đơn; thao tác lặp lại không tạo đơn thứ hai."
      submitLabel="Tạo đơn bán"
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
          { onSuccess: onClose, onError: (failure) => setError(quoteErrorMessage(failure)) },
        );
      }}
    >
      {addresses.isError && (
        <p className="text-warning text-[0.8125rem]">
          Không tải được sổ địa chỉ — đơn sẽ dùng địa chỉ mặc định của khách.
        </p>
      )}
      <AddressSelect
        id="convert-shipping"
        label="Địa chỉ giao hàng"
        value={shipping}
        onChange={setShipping}
        options={options("SHIPPING")}
      />
      <AddressSelect
        id="convert-billing"
        label="Địa chỉ xuất hoá đơn"
        value={billing}
        onChange={setBilling}
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
