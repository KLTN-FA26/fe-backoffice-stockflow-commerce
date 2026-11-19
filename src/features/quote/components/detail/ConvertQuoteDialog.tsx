"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatAddress, useCustomerAddressOptions } from "@/lib/references/customer-lookup";
import { isQuoteErrorCode, quoteErrorMessage } from "@/features/quote/errors";
import { useConvertQuote } from "@/features/quote/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";

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
  const router = useRouter();
  const options = (type: "SHIPPING" | "BILLING") =>
    (addresses.data ?? [])
      .filter((address) => address.type === type)
      .map((address) => ({
        id: address.addressId,
        label: `${address.defaultAddress ? "★ " : ""}${formatAddress(address)}`,
      }));

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
            onError: (failure) =>
              setError(
                isQuoteErrorCode(failure, ["SKU_NOT_SELLABLE"])
                  ? `${quoteErrorMessage(failure)} Huỷ báo giá (ghi lý do) rồi lập báo giá mới.`
                  : quoteErrorMessage(failure),
              ),
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
