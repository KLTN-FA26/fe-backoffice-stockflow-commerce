"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { CUSTOMER_ADDRESS_PERMISSIONS, ORDER_SHIPPING_ADDRESS_LABELS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatAddress, useCustomerAddressOptions } from "@/lib/references/customer-lookup";
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
import { Button } from "@/components/ui/button";

import { shippingAddressChangeSchema } from "../input-schemas";
import { useChangeShippingAddress } from "../mutations";

import { useOrderActionDialog } from "./useOrderActionDialog";

import type { Control } from "react-hook-form";
import type { ShippingAddressChangeValues } from "../input-schemas";
import type { Order } from "../types";

const L = ORDER_SHIPPING_ADDRESS_LABELS;
const FIELD_ID = "order-shipping-address";

type ActionOrder = Pick<Order, "orderId" | "orderNumber" | "customerId">;

/** Ô chọn địa chỉ giao trong sổ địa chỉ của khách (docs 14 §4.2 bước 9) — chỉ địa chỉ loại SHIPPING. */
function AddressChoice({
  customerId,
  control,
  error,
}: {
  customerId: string;
  control: Control<ShippingAddressChangeValues>;
  error: string | undefined;
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
    <FormField id={FIELD_ID} label={L.addressLabel} error={error}>
      <Controller
        control={control}
        name="shippingAddressId"
        render={({ field }) => (
          <Select name={field.name} value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={FIELD_ID} onBlur={field.onBlur} className={FORM_SELECT_CLASS}>
              <SelectValue placeholder={L.addressPlaceholder} />
            </SelectTrigger>
            <TitledSelectContent title={L.addressLabel}>
              {shipping.map((address) => (
                <SelectItem key={address.addressId} value={address.addressId}>
                  {`${formatAddress(address)} · ${address.phone}${address.defaultAddress ? ` (${L.defaultMark})` : ""}`}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
        )}
      />
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
  const form = useForm<ShippingAddressChangeValues>({
    resolver: zodResolver(shippingAddressChangeSchema),
    defaultValues: { shippingAddressId: "" },
  });
  const chosen = useWatch({ control: form.control, name: "shippingAddressId" });
  if (!order.customerId) return null;
  const customerId = order.customerId;
  const submit = form.handleSubmit((values) =>
    dialog.submit(mutate, { id: order.orderId, ...values }),
  );
  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => {
          form.reset({ shippingAddressId: "" });
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
          canSubmit={chosen !== ""}
          isPending={isPending}
          error={dialog.error}
          onCancel={dialog.close}
          onSubmit={() => void submit()}
        >
          <AddressChoice
            customerId={customerId}
            control={form.control}
            error={form.formState.errors.shippingAddressId?.message}
          />
        </FormDialogBody>
      </FormDialog>
    </>
  );
}
