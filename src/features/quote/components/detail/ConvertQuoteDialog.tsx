"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatAddress, useCustomerAddressOptions } from "@/lib/references/customer-lookup";
import { quoteErrorMessage } from "@/features/quote/errors";
import { useConvertQuote } from "@/features/quote/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";

import type { CustomerAddressRef } from "@/lib/references/customer-lookup";
import type { Quote } from "@/features/quote/types";

/** Nhãn ngắn trong ô chọn: người nhận và nơi giao; địa chỉ đầy đủ viết ở dòng dưới ô (không bị cắt chữ). */
function shortAddress(address: CustomerAddressRef): string {
  return [
    address.recipientName,
    [address.wardName, address.provinceName].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" — ");
}

/**
 * Địa chỉ của đơn: "" = địa chỉ mặc định (BE tự lấy). Chỉ có một địa chỉ (hoặc chưa tải được sổ địa chỉ) thì không có gì
 * để chọn → hiện chữ, không hiện ô chọn (R6, S03-2).
 */
function AddressField({
  id,
  label,
  value,
  onChange,
  addresses,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  addresses: readonly CustomerAddressRef[];
}) {
  const fallback = addresses.find((address) => address.defaultAddress);
  const chosen = value ? addresses.find((address) => address.addressId === value) : fallback;
  if (addresses.length <= 1)
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-ink-secondary text-xs font-medium">{label}</span>
        <p className="text-ink-primary text-[0.8125rem]">
          {chosen ? formatAddress(chosen) : "Địa chỉ mặc định của khách"}
        </p>
      </div>
    );
  return (
    <FormField id={id} label={label} hint={chosen ? formatAddress(chosen) : undefined}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={chosen ? `${id}-hint` : undefined}
        className={`${FORM_INPUT_CLASS} border px-2`}
      >
        <option value="">
          {fallback ? `Mặc định — ${shortAddress(fallback)}` : "Địa chỉ mặc định của khách"}
        </option>
        {addresses
          .filter((address) => !address.defaultAddress)
          .map((address) => (
            <option key={address.addressId} value={address.addressId}>
              {shortAddress(address)}
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
  const ofType = (type: "SHIPPING" | "BILLING") =>
    (addresses.data ?? []).filter((address) => address.type === type);

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
      <AddressField
        id="convert-shipping"
        label="Địa chỉ giao hàng"
        value={shipping}
        onChange={setShipping}
        addresses={ofType("SHIPPING")}
      />
      <AddressField
        id="convert-billing"
        label="Địa chỉ xuất hoá đơn"
        value={billing}
        onChange={setBilling}
        addresses={ofType("BILLING")}
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
