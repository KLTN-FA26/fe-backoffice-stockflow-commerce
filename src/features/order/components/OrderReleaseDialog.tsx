"use client";

import { useId, useState } from "react";

import { ORDER_DELIVERY_MODE_UI, ORDER_RELEASE_LABELS } from "@/constants";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ftlConflictsWithCod } from "../delivery-mode";
import { releaseDeliveryMode } from "../delivery-mode-api";

import { DeliveryModeField } from "./DeliveryModeField";

import type { OrderEstimateSlot } from "../estimate-slot";
import type { ReleaseOrderInput } from "../delivery-mode-api";
import type { Order, OrderDeliveryMode } from "../types";

interface OrderReleaseDialogProps {
  order: Pick<Order, "orderId" | "orderNumber" | "deliveryMode" | "balancePolicy">;
  /** Có mã quyền `sales-order-delivery-modes:UPDATE` — không có thì hình thức giao chỉ đọc. */
  canChangeMode: boolean;
  /** Khe "Ước tính xếp xe": nhận kho đang chọn (đơn CONFIRMED chưa có kho). */
  estimateSlot?: OrderEstimateSlot;
  isPending: boolean;
  error: string | null;
  onSubmit: (input: ReleaseOrderInput) => void;
  onClose: () => void;
}

/**
 * Release đơn cho kho (`POST /orders/{id}/release`): chọn kho + hình thức giao (LP-1). Hình thức gửi đi CHỈ khi
 * khác hình thức hiện tại của đơn (`releaseDeliveryMode`); thiếu mã quyền thì chỉ đọc nên không bao giờ gửi.
 * Đơn thu COD mà chọn nguyên xe: báo trước (LP-2), BE vẫn là bên quyết (409 DELIVERY_MODE_FTL_NO_COD, chưa release gì).
 */
export function OrderReleaseDialog({
  order,
  canChangeMode,
  estimateSlot,
  isPending,
  error,
  onSubmit,
  onClose,
}: OrderReleaseDialogProps) {
  const L = ORDER_RELEASE_LABELS;
  const warehouseFieldId = useId();
  const warehouses = useWarehouseOptions();
  const [warehouseId, setWarehouseId] = useState("");
  const current: OrderDeliveryMode =
    order.deliveryMode === "FULL_TRUCKLOAD" ? "FULL_TRUCKLOAD" : "PARCEL";
  const [mode, setMode] = useState<OrderDeliveryMode>(current);

  const submit = () =>
    onSubmit({
      id: order.orderId,
      warehouseId,
      deliveryMode: canChangeMode ? releaseDeliveryMode(mode, order.deliveryMode) : undefined,
    });

  return (
    <FormDialog open onOpenChange={(open) => !open && !isPending && onClose()}>
      <FormDialogBody
        title={L.title}
        description={`${L.description} (${order.orderNumber})`}
        submitLabel={L.submit}
        canSubmit={warehouseId !== ""}
        isPending={isPending}
        error={error}
        onSubmit={submit}
        onCancel={onClose}
      >
        <div>
          <Label htmlFor={warehouseFieldId} className="text-[0.8125rem]">
            {L.warehouseLabel} <span className="text-danger">*</span>
          </Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger
              id={warehouseFieldId}
              autoFocus
              className="border-border-default bg-bg-surface text-ink-primary mt-1 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
            >
              <SelectValue placeholder={L.warehousePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {(warehouses.data ?? []).map((warehouse) => (
                <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
                  {warehouse.code ? `${warehouse.code} — ${warehouse.name}` : warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {warehouses.isPending && (
            <p className="text-ink-tertiary mt-1 text-xs">{L.warehousesLoading}</p>
          )}
          {warehouses.isError && (
            <p role="alert" className="text-danger mt-1 text-xs">
              {L.warehousesFailed}
            </p>
          )}
        </div>
        <DeliveryModeField
          value={mode}
          onChange={setMode}
          readOnly={!canChangeMode}
          name="release-delivery-mode"
        />
        {ftlConflictsWithCod(order, mode) && (
          <p role="status" className="text-warning text-xs">
            {ORDER_DELIVERY_MODE_UI.ftlNoCod}
          </p>
        )}
        {estimateSlot?.({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          warehouseId: warehouseId || null,
          released: false,
        })}
      </FormDialogBody>
    </FormDialog>
  );
}
