"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { RECEIPT_CARTON_LABELS as L } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** "Thêm [N] thùng × factor": thêm nhanh nhiều thùng, mỗi thùng điền sẵn sức chứa của đơn vị (issue #104). */
export function CartonAddControl({
  lineNo,
  factor,
  room,
  onAdd,
}: {
  lineNo: number;
  /** Sức chứa của đơn vị đang chọn; null = chưa chọn được đơn vị, khoá nút. */
  factor: number | null;
  /** Còn thêm được bao nhiêu thùng (tối đa 500 thùng mỗi dòng). */
  room: number;
  onAdd: (count: number, factor: number) => void;
}) {
  const [count, setCount] = useState(1);
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={Math.max(room, 1)}
        aria-label={L.addCount(lineNo)}
        value={Number.isFinite(count) ? count : ""}
        onChange={(event) => setCount(event.target.valueAsNumber)}
        className="border-border-default bg-bg-surface h-7 w-16 rounded-[var(--r-sm)] text-right text-xs tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!factor || !(count >= 1) || count > room}
        onClick={() => factor && onAdd(count, factor)}
      >
        <Plus className="size-3.5" /> {L.addCartons} {factor ? L.cartonsOf(factor) : ""}
      </Button>
    </div>
  );
}
