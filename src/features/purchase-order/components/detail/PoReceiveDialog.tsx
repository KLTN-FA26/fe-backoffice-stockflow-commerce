"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import type { PurchaseOrder } from "@/features/purchase-order";

export function PoReceiveDialog({
  open,
  onOpenChange,
  po,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrder | null;
  isPending: boolean;
  onConfirm: (lines: { lineId: string; quantity: number }[]) => void;
}) {
  const [qtys, setQtys] = useState<Record<string, string>>({});

  const handleConfirm = () => {
    if (!po) return;
    const lines = po.lines
      .map((l) => {
        const q = Number(qtys[l.lineId] ?? "");
        return Number.isFinite(q) && q > 0 ? { lineId: l.lineId, quantity: q } : null;
      })
      .filter((x): x is { lineId: string; quantity: number } => x !== null);
    if (lines.length === 0) return;
    onConfirm(lines);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhận hàng</DialogTitle>
          <DialogDescription>
            Nhập số lượng nhận cho từng dòng. Gửi tới BE POST /receipts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {po?.lines.map((l) => (
            <div key={l.lineId} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-ink-primary text-sm font-medium">{l.skuId}</div>
                <div className="text-ink-tertiary text-xs">
                  Đặt: {l.orderedQty} — Đã nhận: {l.receivedQty}
                </div>
              </div>
              <Input
                type="number"
                min={1}
                placeholder="SL nhận"
                value={qtys[l.lineId] ?? ""}
                onChange={(e) => setQtys((p) => ({ ...p, [l.lineId]: e.target.value }))}
                className="w-24 text-right"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            Xác nhận nhận hàng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
