import { X } from "lucide-react";

import { MOVE_LABELS } from "@/constants/move";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ScannedCarton } from "../types";

const dash = (value: string | number | null) => (value === null ? MOVE_LABELS.missing : value);

/**
 * Danh sách thùng sẽ chuyển: LPN, SKU, lô, số cái và vị trí hiện tại của từng thùng (docs 11 §4.1 bước 1). Thùng BE vừa
 * từ chối (`details.lpn`) hoặc đã ở sẵn vị trí đích được đánh dấu `aria-invalid` + chữ đỏ ở ô LPN.
 */
export function ScannedCartons({
  cartons,
  flagged,
  disabled,
  onRemove,
}: {
  cartons: readonly ScannedCarton[];
  flagged: ReadonlySet<string>;
  disabled: boolean;
  onRemove: (lpn: string) => void;
}) {
  return (
    <section aria-label={MOVE_LABELS.cartonsTitle} className="space-y-2">
      <h3 className="text-ink-secondary text-[0.8125rem] font-medium">
        {MOVE_LABELS.cartonsTitle}
        {cartons.length > 0 && ` · ${MOVE_LABELS.cartonsCount(cartons.length)}`}
      </h3>
      {cartons.length === 0 ? (
        <p className="text-ink-secondary text-[0.8125rem]">{MOVE_LABELS.cartonsEmpty}</p>
      ) : (
        <div className="border-border-default max-h-[260px] overflow-auto rounded-[var(--r-sm)] border">
          <Table>
            <TableCaption className="sr-only">{MOVE_LABELS.cartonsTitle}</TableCaption>
            <TableHeader className="bg-bg-subtle">
              <TableRow>
                <TableHead scope="col">{MOVE_LABELS.lpn}</TableHead>
                <TableHead scope="col">{MOVE_LABELS.sku}</TableHead>
                <TableHead scope="col">{MOVE_LABELS.lot}</TableHead>
                <TableHead scope="col" className="text-right">
                  {MOVE_LABELS.onHand}
                </TableHead>
                <TableHead scope="col">{MOVE_LABELS.currentLocation}</TableHead>
                <TableHead scope="col" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cartons.map((carton) => {
                const bad = flagged.has(carton.lpn);
                return (
                  <TableRow key={carton.lpn} aria-invalid={bad || undefined}>
                    <TableCell className={bad ? "text-danger font-mono" : "font-mono"}>
                      {carton.lpn}
                    </TableCell>
                    {carton.sku === null ? (
                      <TableCell colSpan={4} className="text-ink-tertiary">
                        {MOVE_LABELS.unverified}
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="font-mono">{carton.sku}</TableCell>
                        <TableCell className="font-mono">{dash(carton.lotNumber)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {dash(carton.onHand)}
                        </TableCell>
                        <TableCell className="font-mono">{dash(carton.locationCode)}</TableCell>
                      </>
                    )}
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        disabled={disabled}
                        aria-label={MOVE_LABELS.remove(carton.lpn)}
                        onClick={() => onRemove(carton.lpn)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
