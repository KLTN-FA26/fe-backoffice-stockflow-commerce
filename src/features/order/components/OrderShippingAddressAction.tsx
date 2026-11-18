"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

import { CUSTOMER_ADDRESS_PERMISSIONS, ORDER_SHIPPING_ADDRESS_LABELS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatAddress, useCustomerAddressOptions } from "@/lib/references/customer-lookup";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";

import { useChangeShippingAddress } from "../mutations";

import { useOrderActionDialog } from "./useOrderActionDialog";

import type { Order } from "../types";

const L = ORDER_SHIPPING_ADDRESS_LABELS;
const FIELD_ID = "order-shipping-address";

type ActionOrder = Pick<Order, "orderId" | "orderNumber" | "customerId">;

/** Ô chọn địa chỉ giao trong sổ địa chỉ của khách (docs 14 §4.2 bước 9) — chỉ địa chỉ loại SHIPPING. */
function AddressChoice({
  customerId,
  value,
  onChange,
}: {
  customerId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // UI-only — Backend phải re-check (@RequiresPermission customer-addresses:READ, CustomerAddressController)
  const canRead = useCan(CUSTOMER_ADDRESS_PERMISSIONS.read);
  const addresses = useCustomerAddressOptions(customerId, canRead);
  if (!canRead) return <p className="text-ink-secondary text-[0.8125rem]">{L.noAddressAccess}</p>;
  if (addresses.isPending)
    return <p className="text-ink-secondary text-[0.8125rem]">{L.loading}</p>;
  if (addresses.isError) return <p className="text-danger text-[0.8125rem]">{L.loadFailed}</p>;
  const shipping = addresses.data.filter((address) => address.type === "SHIPPING");
  if (shipping.length === 0) {
    return <p className="text-ink-secondary text-[0.8125rem]">{L.noAddress}</p>;
  }
  return (
    <FormField id={FIELD_ID} label={L.addressLabel}>
      <select
        id={FIELD_ID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FORM_INPUT_CLASS} border px-2`}
      >
        <option value="">{L.addressPlaceholder}</option>
        {shipping.map((address) => (
          <option key={address.addressId} value={address.addressId}>
            {`${formatAddress(address)} · ${address.phone}${address.defaultAddress ? ` (${L.defaultMark})` : ""}`}
          </option>
        ))}
      </select>
    </FormField>
  );
}

/**
 * Sale đổi địa chỉ giao của đơn (docs 17 §4.7 bước 23-24, BR-16; 08 BR-04): chọn địa chỉ giao khác trong sổ địa chỉ của
 * khách. Hiện hay không do `canChangeShippingAddress` quyết (mã quyền + chưa dán nhãn + bước cho đổi). 409
 * ORDER_ADDRESS_LOCKED (vừa có thùng dán nhãn) → đóng, tải lại đơn, báo.
 */
export function OrderShippingAddressAction({ order }: { order: ActionOrder }) {
  const dialog = useOrderActionDialog("shippingAddress");
  const { mutate, isPending } = useChangeShippingAddress(dialog.hookOptions);
  const [addressId, setAddressId] = useState("");
  if (!order.customerId) return null;
  const customerId = order.customerId;
  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => {
          setAddressId("");
          dialog.show();
        }}
      >
        <MapPin className="size-3" /> {L.button}
      </Button>
      <FormDialog open={dialog.open} onOpenChange={(open) => !open && !isPending && dialog.close()}>
        <FormDialogBody
          title={L.title}
          description={`${L.description} (${order.orderNumber})`}
          submitLabel={L.submit}
          canSubmit={addressId !== ""}
          isPending={isPending}
          error={dialog.error}
          onCancel={dialog.close}
          onSubmit={() =>
            dialog.submit(mutate, { id: order.orderId, shippingAddressId: addressId })
          }
        >
          <AddressChoice customerId={customerId} value={addressId} onChange={setAddressId} />
        </FormDialogBody>
      </FormDialog>
    </>
  );
}
