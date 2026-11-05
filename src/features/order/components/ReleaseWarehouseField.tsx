"use client";

import { useId } from "react";

import { ORDER_RELEASE_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReleaseWarehouseFieldProps {
  value: string;
  onChange: (warehouseId: string) => void;
  /** Lỗi của ô (zod hoặc 400 `warehouseId` của BE). */
  error: string | undefined;
}

/**
 * Ô "Kho xuất hàng" của hộp thoại release: chỉ chọn được khi danh sách kho đã tải xong. 403 (điều phối chưa có
 * `warehouse-warehouses:READ`) nói rõ mã quyền; lỗi khác "Không tải được"; danh sách rỗng báo riêng. Hộp thoại vẫn dùng
 * được (huỷ, xem ước tính). UI-only — Backend phải re-check.
 */
export function ReleaseWarehouseField({ value, onChange, error }: ReleaseWarehouseFieldProps) {
  const L = ORDER_RELEASE_LABELS;
  const id = useId();
  const warehouses = useWarehouseOptions();
  const forbidden = warehouses.error instanceof ApiError && warehouses.error.status === 403;
  return (
    <div>
      <Label htmlFor={id} className="text-[0.8125rem]">
        {L.warehouseLabel} <span className="text-danger">*</span>
      </Label>
      <Select value={value} onValueChange={onChange} disabled={!warehouses.data}>
        <SelectTrigger
          id={id}
          autoFocus
          aria-required="true"
          aria-invalid={error ? true : undefined}
          className="border-border-default bg-bg-surface text-ink-primary mt-1 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
        >
          <SelectValue
            placeholder={warehouses.isPending ? L.warehousesLoading : L.warehousePlaceholder}
          />
        </SelectTrigger>
        <SelectContent>
          {warehouses.data?.map((warehouse) => (
            <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
              {warehouse.code ? `${warehouse.code} — ${warehouse.name}` : warehouse.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {warehouses.isError && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {forbidden ? L.warehousesForbidden : L.warehousesFailed}
        </p>
      )}
      {warehouses.data?.length === 0 && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {L.warehousesEmpty}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
