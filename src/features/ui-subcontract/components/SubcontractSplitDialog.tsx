"use client";

import { useState } from "react";
import { X, Scissors, Building2, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { ParentProductionOrder, SubcontractMode } from "../types";
import { subcontractRepo } from "../mock-repo";

interface Props {
  parentOrder: ParentProductionOrder;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubcontractSplitDialog({ parentOrder, isOpen, onClose, onSuccess }: Props) {
  const partners = subcontractRepo.getPartners();

  const [quantityToOutsource, setQuantityToOutsource] = useState<number>(
    Math.min(5000, parentOrder.inHouseQuantity)
  );
  const [partnerId, setPartnerId] = useState<string>(partners[0]?.id || "");
  const [mode, setMode] = useState<SubcontractMode>("PRINT_PROCESSING_ONLY");
  const [unitPrice, setUnitPrice] = useState<number>(450);
  const [dueDate, setDueDate] = useState<string>(parentOrder.dueDate);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (quantityToOutsource <= 0) {
      setErrorMsg("Số lượng gia công phải lớn hơn 0");
      return;
    }

    if (quantityToOutsource > parentOrder.inHouseQuantity) {
      setErrorMsg(
        `Số lượng gia công không được vượt quá số lượng nội bộ hiện có (${parentOrder.inHouseQuantity.toLocaleString()} cái)`
      );
      return;
    }

    if (new Date(dueDate) > new Date(parentOrder.dueDate)) {
      setErrorMsg("Hạn giao của nhà gia công không được trễ hơn hạn giao của đơn hàng cha");
      return;
    }

    try {
      subcontractRepo.splitOrder({
        parentLsxId: parentOrder.id,
        quantityToOutsource: Number(quantityToOutsource),
        partnerId,
        mode,
        unitPrice: Number(unitPrice),
        dueDate,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    }
  };

  const remainingInHouse = parentOrder.inHouseQuantity - quantityToOutsource;
  const estimatedCost = quantityToOutsource * unitPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-purple-600" />
            <h3 className="text-base font-bold text-[var(--ink-primary)]">
              Tách Lệnh Sản Xuất Để Gia Công Ngoài (Split for Subcontracting)
            </h3>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Parent Summary Card */}
        <div className="rounded-md bg-[var(--bg-subtle)] p-3 border border-[var(--border-default)] text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--ink-secondary)]">Lệnh sản xuất cha:</span>
            <span className="font-mono font-bold text-[var(--ink-primary)]">{parentOrder.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-secondary)]">Khách hàng:</span>
            <span className="font-medium text-[var(--ink-primary)]">{parentOrder.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-secondary)]">Phôi SKU:</span>
            <span className="font-mono font-semibold">{parentOrder.blankSku}</span>
          </div>
          <div className="flex justify-between border-t border-[var(--border-default)] pt-1 mt-1">
            <span className="text-[var(--ink-secondary)]">Số lượng nội bộ khả dụng:</span>
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
              {parentOrder.inHouseQuantity.toLocaleString()} cái
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-md bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Quantity split input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-primary)] font-semibold mb-1">
                Số lượng ủy thác gia công (*):
              </label>
              <input
                type="number"
                min="1"
                max={parentOrder.inHouseQuantity}
                required
                value={quantityToOutsource}
                onChange={(e) => setQuantityToOutsource(Number(e.target.value))}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-bold text-purple-700 dark:text-purple-400"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-secondary)] font-medium mb-1">
                Số lượng giữ lại sản xuất nội bộ:
              </label>
              <div className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-muted)] p-2 text-xs font-mono font-bold text-[var(--ink-primary)]">
                {remainingInHouse.toLocaleString()} cái
              </div>
            </div>
          </div>

          {/* Subcontractor selection */}
          <div>
            <label className="block text-[var(--ink-primary)] font-semibold mb-1 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-[var(--ink-tertiary)]" />
              <span>Nhà cung cấp / Đối tác gia công (*):</span>
            </label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-medium"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.phone} (Đánh giá: ⭐ {p.rating})
                </option>
              ))}
            </select>
          </div>

          {/* Subcontract mode & pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-secondary)] font-medium mb-1">Chế độ gia công:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as SubcontractMode)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
              >
                <option value="PRINT_PROCESSING_ONLY">Chỉ in gia công (Kho StockFlow cấp phôi)</option>
                <option value="FULL_SERVICE">Gia công trọn gói (Đối tác tự lo phôi)</option>
              </select>
            </div>
            <div>
              <label className="block text-[var(--ink-secondary)] font-medium mb-1 flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-[var(--ink-tertiary)]" />
                <span>Đơn giá gia công (VNĐ/cái):</span>
              </label>
              <input
                type="number"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-secondary)] font-medium mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-[var(--ink-tertiary)]" />
                <span>Hạn giao hàng gia công (*):</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-secondary)] font-medium mb-1">
                Dự toán chi phí gia công:
              </label>
              <div className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-muted)] p-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {estimatedCost.toLocaleString()} VNĐ
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-default)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded bg-purple-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-700 shadow-xs"
            >
              Tách lệnh & Khởi tạo đơn gia công
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
