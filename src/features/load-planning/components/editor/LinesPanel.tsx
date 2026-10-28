"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { formatNominalCm } from "../../lib/dims";

import type { ColorMap } from "../../lib/palette";
import type { ProductRow } from "../../editor/selectors";

const L = UI_LABELS.loadPlan.editor.lines;

/**
 * Mặt hàng trên xe đang xem với "→ Khay" để đưa nguyên một loại (hoặc một số lượng nhập) ra khay (gốc `linesPanel`,
 * `moveOutType`). Cũng là cách thao tác không cần bấm trong khung 3D.
 */
export function LinesPanel({
  rows,
  colorMap,
  onMoveOut,
}: {
  rows: readonly ProductRow[];
  colorMap: ColorMap;
  onMoveOut: (refs: readonly string[]) => void;
}) {
  const [qty, setQty] = useState<Record<string, string>>({});
  return (
    <section aria-label={L.title} className="border-border-default space-y-2 rounded border p-3">
      <h3 className="text-ink-primary text-sm font-medium">{L.title}</h3>
      {rows.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const typed = Math.floor(Number(qty[row.key]));
            const take = typed > 0 ? Math.min(typed, row.refs.length) : row.refs.length;
            return (
              <li key={row.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: colorMap.get(row.partName) }}
                />
                <span className="min-w-0 flex-1 text-xs">
                  <span className="block truncate font-medium">{row.partName}</span>
                  <span className="text-ink-tertiary block tabular-nums">
                    {formatNominalCm(row.dims)} · {L.onVehicle}: {row.refs.length}
                  </span>
                </span>
                <Input
                  type="number"
                  min={1}
                  max={row.refs.length}
                  value={qty[row.key] ?? ""}
                  placeholder={String(row.refs.length)}
                  aria-label={`${L.qty}: ${row.partName}`}
                  onChange={(event) => setQty((q) => ({ ...q, [row.key]: event.target.value }))}
                  className="h-7 w-14 px-1 text-center text-xs tabular-nums"
                />
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-label={`${L.moveOut} ${row.partName}`}
                  onClick={() => {
                    onMoveOut(row.refs.slice(0, take));
                    setQty((q) => ({ ...q, [row.key]: "" }));
                  }}
                >
                  {L.moveOut}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
