"use client";

import { UI_LABELS } from "@/constants";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useWarehouseLabel } from "../primitives";

import type { TransferListState } from "./useTransferListState";

const ALL = "__all__";
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-[13rem] rounded-[var(--r-sm)] text-[0.8125rem]";

function WarehouseFilter({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Chỉ kho đang hoạt động. Lệnh cũ thuộc kho đã ngừng không lọc theo kho đó được — đã note BE
  // (lọc theo kho ngừng hoạt động chưa được chốt nghiệp vụ)
  const { data: warehouses = [], isError, refetch } = useWarehouseOptions();
  const warehouseLabel = useWarehouseLabel();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-ink-secondary text-[0.8125rem]">
        {label}
      </Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger id={id} className={TRIGGER}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL}>{UI_LABELS.transfer.field.all}</SelectItem>
            {/* Lọc qua URL theo kho không còn hoạt động → vẫn hiện tên, không để ô trống */}
            {value && warehouses.length > 0 && !warehouses.some((w) => w.warehouseId === value) && (
              <SelectItem value={value}>
                {warehouseLabel(value)} ({UI_LABELS.transfer.warehouseSelect.inactive})
              </SelectItem>
            )}
            {warehouses.map((w) => (
              <SelectItem key={w.warehouseId} value={w.warehouseId}>
                {w.code ? `${w.code} · ${w.name}` : w.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {/* Không tải được danh sách kho → nói rõ, đừng để bộ lọc chỉ còn "Tất cả" mà không lý do */}
      {isError && (
        <span className="text-danger text-xs">
          {UI_LABELS.transfer.warehouseSelect.loadFailed}{" "}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void refetch()}>
            {UI_LABELS.common.retry}
          </Button>
        </span>
      )}
    </div>
  );
}

/** Lọc kho nguồn / kho đích — BE `GET /inventory/transfer-orders?fromWarehouseId&toWarehouseId`. */
export function TransferListFilters({ s }: { s: TransferListState }) {
  return (
    <div className="border-border-default bg-bg-subtle mb-3 flex flex-wrap items-center gap-3 rounded-[var(--r-sm)] border px-3 py-2">
      <WarehouseFilter
        id="transfer-from"
        label={UI_LABELS.transfer.field.fromWarehouse}
        value={s.from}
        onChange={s.setFrom}
      />
      <WarehouseFilter
        id="transfer-to"
        label={UI_LABELS.transfer.field.toWarehouse}
        value={s.to}
        onChange={s.setTo}
      />
    </div>
  );
}
