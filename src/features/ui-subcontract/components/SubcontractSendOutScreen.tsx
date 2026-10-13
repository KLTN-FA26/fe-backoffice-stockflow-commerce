"use client";

import { useState } from "react";
import { ArrowLeft, Printer, Truck, CheckCircle2 } from "lucide-react";
import { SubcontractOrder } from "../types";
import { subcontractRepo } from "../mock-repo";

interface Props {
  subOrder: SubcontractOrder;
  onBack: () => void;
  onRefresh: () => void;
}

export function SubcontractSendOutScreen({ subOrder, onBack, onRefresh }: Props) {
  const [driverName, setDriverName] = useState("Nguyễn Văn Toàn (Tài xế giao hàng)");
  const [vehicleNumber, setVehicleNumber] = useState("51C-889.21");
  const [actor, setActor] = useState("Hoàng Minh (Thủ kho StockFlow)");
  const [isDispatched, setIsDispatched] = useState(subOrder.status !== "DRAFT");

  const handleDispatchConfirm = () => {
    subcontractRepo.dispatchSendOut({
      subcontractOrderId: subOrder.id,
      driverName,
      vehicleNumber,
      actor,
    });
    setIsDispatched(true);
    onRefresh();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-[var(--ink-secondary)] shadow-xs hover:text-[var(--ink-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-[var(--ink-primary)]">
                {subOrder.code}
              </h1>
              <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                XUẤT PHÔI GIA CÔNG
              </span>
            </div>
            <p className="text-xs text-[var(--ink-secondary)]">
              Đơn vị gia công: <strong>{subOrder.partnerName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDispatched && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--ink-inverse)] shadow-xs hover:bg-[var(--brand-hover)]"
            >
              <Printer className="h-4 w-4" />
              <span>In Phiếu Xuất Kho Gia Công</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Form on Left, Printable Dispatch Note on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Dispatch Actions Form */}
        <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 text-xs shadow-xs">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ink-primary)]">
            <Truck className="h-4 w-4 text-[var(--accent)]" />
            <span>Thông tin giao nhận & Vận chuyển</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[var(--ink-secondary)]">Mã LSX gốc (Parent):</label>
              <div className="rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono font-bold text-[var(--ink-primary)]">
                {subOrder.parentLsxCode}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[var(--ink-secondary)]">
                Số lượng phôi xuất giao:
              </label>
              <div className="rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-base font-bold text-purple-700 dark:text-purple-400">
                {subOrder.quantity.toLocaleString()} phôi ({subOrder.blankSku})
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Họ tên tài xế vận chuyển:
              </label>
              <input
                type="text"
                disabled={isDispatched}
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Biển số xe tải / phương tiện:
              </label>
              <input
                type="text"
                disabled={isDispatched}
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-[var(--ink-secondary)]">
                Thủ kho phụ trách xuất hàng:
              </label>
              <input
                type="text"
                disabled={isDispatched}
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
              />
            </div>

            {!isDispatched ? (
              <button
                onClick={handleDispatchConfirm}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 py-2.5 font-medium text-white shadow-xs transition-colors hover:bg-sky-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Xác nhận xuất phôi & Tạo phiếu</span>
              </button>
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-center font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Đã xuất phôi và tạo phiếu gửi thành công!
              </div>
            )}
          </div>
        </div>

        {/* Right: Printable Dispatch Note Preview */}
        <div className="space-y-6 rounded-lg border-2 border-slate-300 bg-white p-8 font-sans text-slate-800 shadow-md lg:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {/* Note Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-700">
            <div>
              <div className="text-sm font-bold tracking-wider text-slate-900 uppercase dark:text-white">
                CÔNG TY CỔ PHẦN THƯƠNG MẠI STOCKFLOW
              </div>
              <div className="text-[11px] text-slate-500">
                Kho Trung tâm: Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Thủ Đức, TP. HCM
              </div>
              <div className="text-[11px] text-slate-500">Hotline: 1900 6868 · MST: 0316889900</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs font-bold text-purple-700 dark:text-purple-400">
                {subOrder.dispatchNoteCode || "PXK-GC-2026-DRAFT"}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Ngày: {subOrder.dispatchedAt || "2026-10-09"}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="py-2 text-center">
            <h2 className="text-base font-extrabold tracking-wide text-slate-900 uppercase dark:text-white">
              PHIẾU XUẤT KHO GIA CÔNG NGOÀI & BIÊN BẢN GIAO NHẬN
            </h2>
            <div className="mt-0.5 text-xs text-slate-500 italic">
              (Kiêm lệnh ủy thác gia công in ấn phụ trợ)
            </div>
          </div>

          {/* Partners info */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-1 font-semibold text-slate-900 dark:text-white">
                ĐƠN VỊ GIAO (BÊN A):
              </div>
              <div>Kho Vận StockFlow Commerce</div>
              <div>
                Người giao: <strong>{actor}</strong>
              </div>
              <div>
                Số xe: <strong className="font-mono">{vehicleNumber}</strong>
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-1 font-semibold text-slate-900 dark:text-white">
                ĐƠN VỊ NHẬN GIA CÔNG (BÊN B):
              </div>
              <div>
                <strong>{subOrder.partnerName}</strong>
              </div>
              <div>
                Lệnh gia công: <strong className="font-mono">{subOrder.code}</strong>
              </div>
              <div>
                Hạn hoàn thành: <strong className="font-mono">{subOrder.dueDate}</strong>
              </div>
            </div>
          </div>

          {/* Goods table */}
          <div className="overflow-x-auto">
            <table className="w-full border border-slate-300 text-left text-xs dark:border-slate-700">
              <thead className="bg-slate-100 font-semibold dark:bg-slate-800">
                <tr className="border-b border-slate-300 dark:border-slate-700">
                  <th className="w-10 border-r border-slate-300 p-2 text-center dark:border-slate-700">
                    STT
                  </th>
                  <th className="border-r border-slate-300 p-2 dark:border-slate-700">
                    Mã phôi SKU / Tên hàng
                  </th>
                  <th className="border-r border-slate-300 p-2 text-center dark:border-slate-700">
                    ĐVT
                  </th>
                  <th className="border-r border-slate-300 p-2 text-right dark:border-slate-700">
                    Số lượng
                  </th>
                  <th className="border-r border-slate-300 p-2 text-right dark:border-slate-700">
                    Đơn giá gia công
                  </th>
                  <th className="p-2 text-right">Thành tiền dự toán</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="border-r border-slate-200 p-2 text-center font-mono dark:border-slate-700">
                    1
                  </td>
                  <td className="border-r border-slate-200 p-2 dark:border-slate-700">
                    <div className="font-mono font-bold">{subOrder.blankSku}</div>
                    <div className="text-[11px] text-slate-500">{subOrder.blankName}</div>
                  </td>
                  <td className="border-r border-slate-200 p-2 text-center dark:border-slate-700">
                    Cái
                  </td>
                  <td className="border-r border-slate-200 p-2 text-right font-mono font-bold dark:border-slate-700">
                    {subOrder.quantity.toLocaleString()}
                  </td>
                  <td className="border-r border-slate-200 p-2 text-right font-mono dark:border-slate-700">
                    {subOrder.unitPrice.toLocaleString()} đ
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {subOrder.totalCost.toLocaleString()} đ
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-4 gap-2 pt-6 text-center text-xs">
            <div>
              <div className="font-bold">Người Lập Phiếu</div>
              <div className="text-[10px] text-slate-400 italic">(Ký, họ tên)</div>
              <div className="h-14" />
              <div className="text-[11px] font-semibold">{actor}</div>
            </div>

            <div>
              <div className="font-bold">Thủ Kho Xuất</div>
              <div className="text-[10px] text-slate-400 italic">(Ký, họ tên)</div>
              <div className="h-14" />
              <div className="text-[11px] font-semibold">{actor}</div>
            </div>

            <div>
              <div className="font-bold">Người Vận Chuyển</div>
              <div className="text-[10px] text-slate-400 italic">(Ký, họ tên)</div>
              <div className="h-14" />
              <div className="text-[11px] font-semibold">{driverName}</div>
            </div>

            <div>
              <div className="font-bold">Đại Diện Nhận Hàng</div>
              <div className="text-[10px] text-slate-400 italic">(Ký, đóng dấu)</div>
              <div className="h-14" />
              <div className="text-[11px] font-semibold">Xưởng gia công</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
