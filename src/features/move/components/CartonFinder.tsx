"use client";

import { useState } from "react";

import { MOVE_LABELS, MOVE_LIMITS } from "@/constants/move";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useCartonSearch } from "../queries";
import { cartonSearchParams, cartonsInWarehouse, normalizeLpn } from "../selectors";

import type { Carton } from "../types";

/**
 * Tìm thùng trước khi quét (docs 11 §4.1 bước 1): SKU → thùng của SKU nằm ở đâu; mã vị trí của kho → vị trí đang chứa
 * thùng nào. Chỉ thùng IN_STOCK của kho đang làm việc. Thùng giữ cho đơn (BR-05) không thêm được, nói rõ lý do.
 */
export function CartonFinder({
  prefix,
  added,
  disabled,
  onAdd,
}: {
  prefix: string;
  added: ReadonlySet<string>;
  disabled: boolean;
  onAdd: (carton: Carton) => void;
}) {
  const [term, setTerm] = useState("");
  const query = cartonSearchParams(useDebouncedValue(term, MOVE_LIMITS.searchDebounceMs), prefix);
  const cartons = useCartonSearch(query, true);
  const rows = cartons.data ? cartonsInWarehouse(cartons.data.items, prefix) : [];
  return (
    <section aria-label={MOVE_LABELS.finderTitle} className="space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor="move-finder">{MOVE_LABELS.finderSearch}</Label>
        <Input
          id="move-finder"
          className={FORM_INPUT_CLASS}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          autoComplete="off"
          aria-describedby="move-finder-help"
        />
        <p id="move-finder-help" className="text-ink-secondary text-sm">
          {MOVE_LABELS.finderHelp}
        </p>
      </div>
      {cartons.isFetching && (
        <p className="text-ink-tertiary text-[0.8125rem]">{MOVE_LABELS.finderLoading}</p>
      )}
      {cartons.isError && (
        <p className="text-ink-secondary text-[0.8125rem]">{MOVE_LABELS.finderUnavailable}</p>
      )}
      {cartons.isSuccess && rows.length === 0 && (
        <p className="text-ink-secondary text-[0.8125rem]">{MOVE_LABELS.finderEmpty}</p>
      )}
      {rows.length > 0 && (
        <div className="border-border-default max-h-[260px] overflow-auto rounded-[var(--r-sm)] border">
          <Table>
            <TableCaption className="sr-only">{MOVE_LABELS.finderTitle}</TableCaption>
            <TableHeader className="bg-bg-subtle">
              <TableRow>
                <TableHead scope="col">{MOVE_LABELS.lpn}</TableHead>
                <TableHead scope="col">{MOVE_LABELS.sku}</TableHead>
                <TableHead scope="col">{MOVE_LABELS.lot}</TableHead>
                <TableHead scope="col" className="text-right">
                  {MOVE_LABELS.onHand}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {MOVE_LABELS.finderReserved}
                </TableHead>
                <TableHead scope="col">{MOVE_LABELS.currentLocation}</TableHead>
                <TableHead scope="col" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((carton) => {
                const isAdded = added.has(normalizeLpn(carton.lpn));
                const held = carton.reserved > 0;
                return (
                  <TableRow key={carton.lpn} data-state={isAdded ? "selected" : undefined}>
                    <TableCell className="font-mono">{carton.lpn}</TableCell>
                    <TableCell className="font-mono">{carton.sku}</TableCell>
                    <TableCell className="font-mono">
                      {carton.lotNumber ?? MOVE_LABELS.missing}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {carton.onHand}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {carton.reserved}
                    </TableCell>
                    <TableCell className="font-mono">{carton.locationCode}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        className="rounded-[var(--r-sm)]"
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={disabled || isAdded || held}
                        // Thùng giữ cho đơn: nói lý do thay vì nút xám câm (BR-05).
                        title={held ? MOVE_LABELS.finderHeld : undefined}
                        aria-label={`${isAdded ? MOVE_LABELS.finderAdded : MOVE_LABELS.finderAdd} ${carton.lpn}`}
                        onClick={() => onAdd(carton)}
                      >
                        {isAdded ? MOVE_LABELS.finderAdded : MOVE_LABELS.finderAdd}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {cartons.data?.hasNext && (
        <p className="text-ink-tertiary text-[0.8125rem]">{MOVE_LABELS.finderTruncated}</p>
      )}
    </section>
  );
}
