"use client";

import { useEffect, useId } from "react";

import { ORDER_RELEASE_LABELS } from "@/constants";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { nextBatchToRelease } from "../delivery-batch-api";
import { useDeliverySchedule } from "../queries";

const L = ORDER_RELEASE_LABELS.batch;

interface ReleaseBatchFieldProps {
  orderId: string;
  value: string;
  onChange: (batchId: string) => void;
}

/**
 * Ô "Đợt giao" của hộp thoại release (docs 17 §4.5, BR-29): hiện lịch giao của đơn để chọn đợt cần release. Chỉ mount
 * khi người dùng đọc được lịch giao (`sales-contracts:READ`). Đơn không có lịch giao (một lần giao) → không có ô. Đợt đã
 * release không chọn được; BE vẫn là bên quyết (409 DELIVERY_BATCH_NOT_NEXT nếu không phải đợt kế tiếp).
 */
export function ReleaseBatchField({ orderId, value, onChange }: ReleaseBatchFieldProps) {
  const id = useId();
  const schedule = useDeliverySchedule(orderId);
  const batches = schedule.data?.batches;
  // Mặc định theo lịch giao: đợt kế tiếp (xem `nextBatchToRelease`), điền một lần khi lịch tải xong
  useEffect(() => {
    const next = !value && batches ? nextBatchToRelease(batches) : undefined;
    if (next) onChange(next.batchId);
  }, [batches, value, onChange]);
  if (schedule.isError) return <p className="text-ink-tertiary text-xs">{L.failed}</p>;
  if (schedule.isPending) return <p className="text-ink-tertiary text-xs">{L.loading}</p>;
  if (!batches || batches.length === 0) return null;
  return (
    <div>
      <Label htmlFor={id} className="text-[0.8125rem]">
        {L.label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="border-border-default bg-bg-surface text-ink-primary mt-1 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
        >
          <SelectValue placeholder={L.label} />
        </SelectTrigger>
        <SelectContent>
          {batches.map((batch) => (
            <SelectItem key={batch.batchId} value={batch.batchId} disabled={!!batch.releasedAt}>
              {L.option(batch.seq, batch.windowStart, batch.windowEnd)} · {L.states[batch.state]}
              {batch.releasedAt ? ` · ${L.released}` : ""}
              {batch.lines.length > 0 &&
                ` · ${L.held(
                  batch.lines.reduce((sum, line) => sum + line.heldCartons, 0),
                  batch.lines.reduce((sum, line) => sum + line.cartons, 0),
                )}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-ink-tertiary mt-1 text-xs">{L.hint}</p>
    </div>
  );
}
