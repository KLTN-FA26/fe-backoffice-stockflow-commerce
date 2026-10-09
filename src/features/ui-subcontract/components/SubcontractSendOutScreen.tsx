"use client";

import { useState } from "react";
import { 
  ArrowLeft, 
  Printer, 
  Truck, 
  CheckCircle2, 
  FileText, 
  Barcode, 
  Building2,
  Calendar,
  Share2
} from "lucide-react";
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-[var(--ink-primary)]">
                {subOrder.code}
              </h1>
              <span className="rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 text-xs font-bold">
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
              className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)] shadow-xs flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>In Phiếu Xuất Kho Gia Công</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Form on Left, Printable Dispatch Note on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Dispatch Actions Form */}
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-4 text-xs">
          <h3 className="text-sm font-bold text-[var(--ink-primary)] flex items-center gap-2">
            <Truck className="h-4 w-4 text-[var(--accent)]" />
            <span>Thông tin giao nhận & Vận chuyển</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-[var(--ink-secondary)] mb-1">Mã LSX gốc (Parent):</label>
              <div className="font-mono font-bold text-[var(--ink-primary)] p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)]">
                {subOrder.parentLsxCode}
              </div>
            </div>

            <div>
              <label className="block text-[var(--ink-secondary)] mb-1">Số lượng phôi xuất giao:</label>
              <div className="font-mono font-bold text-base text-purple-700 dark:text-purple-400 p-2 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)]">
                {subOrder.quantity.toLocaleString()} phôi ({subOrder.blankSku})
              </div>
            </div>

            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Họ tên tài xế vận chuyển:</label>
              <input
                type="text"
                disabled={isDispatched}
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Biển số xe tải / phương tiện:</label>
              <input
                type="text"
                disabled={isDispatched}
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[var(--ink-secondary)] mb-1 font-medium">Thủ kho phụ trách xuất hàng:</label>
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
                className="w-full rounded-md bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Xác nhận xuất phôi & Tạo phiếu</span>
              </button>
            ) : (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-3 text-emerald-800 dark:text-emerald-300 border border-emerald-200 text-center font-medium">
                Đã xuất phôi và tạo phiếu gửi thành công!
              </div>
            )}
          </div>
        </div>

        {/* Right: Printable Dispatch Note Preview */}
        <div className="lg:col-span-2 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-md text-slate-800 dark:text-slate-100 font-sans space-y-6">
          {/* Note Header */}
          <div className="flex justify-between items-start border-b pb-4 border-slate-200 dark:border-slate-700">
            <div>
              <div className="font-bold text-sm tracking-wider uppercase text-slate-900 dark:text-white">
                CÔNG TY CỔ PHẦN THƯƠNG MẠI STOCKFLOW
              </div>
              <div className="text-[11px] text-slate-500">
                Kho Trung tâm: Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Thủ Đức, TP. HCM
              </div>
              <div className="text-[11px] text-slate-500">Hotline: 1900 6868 · MST: 0316889900</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-xs text-purple-700 dark:text-purple-400">
                {subOrder.dispatchNoteCode || "PXK-GC-2026-DRAFT"}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Ngày: {subOrder.dispatchedAt || "2026-10-09"}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center py-2">
            <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
              PHIẾU XUẤT KHO GIA CÔNG NGOÀI & BIÊN BẢN GIAO NHẬN
            </h2>
            <div className="text-xs text-slate-500 italic mt-0.5">
              (Kiêm lệnh ủy thác gia công in ấn phụ trợ)
            </div>
          </div>

          {/* Partners info */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-slate-900 dark:text-white mb-1">ĐƠN VỊ GIAO (BÊN A):</div>
              <div>Kho Vận StockFlow Commerce</div>
              <div>Người giao: <strong>{actor}</strong></div>
              <div>Số xe: <strong className="font-mono">{vehicleNumber}</strong></div>
            </div>

            <div className="rounded bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-slate-900 dark:text-white mb-1">ĐƠN VỊ NHẬN GIA CÔNG (BÊN B):</div>
              <div><strong>{subOrder.partnerName}</strong></div>
              <div>Lệnh gia công: <strong className="font-mono">{subOrder.code}</strong></div>
              <div>Hạn hoàn thành: <strong className="font-mono">{subOrder.dueDate}</strong></div>
            </div>
          </div>

          {/* Goods table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300 dark:border-slate-700">
              <thead className="bg-slate-100 dark:bg-slate-800 font-semibold">
                <tr className="border-b border-slate-300 dark:border-slate-700">
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-center w-10">STT</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700">Mã phôi SKU / Tên hàng</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-center">ĐVT</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right">Số lượng</th>
                  <th className="p-2 border-r border-slate-300 dark:border-slate-700 text-right">Đơn giá gia công</th>
                  <th className="p-2 text-right">Thành tiền dự toán</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">1</td>
                  <td className="p-2 border-r border-slate-200 dark:border-slate-700">
                    <div className="font-mono font-bold">{subOrder.blankSku}</div>
                    <div className="text-[11px] text-slate-500">{subOrder.blankName}</div>
                  </td>
                  <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">Cái</td>
                  <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right font-mono font-bold">
                    {subOrder.quantity.toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-right font-mono">
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
              <div className="font-semibold text-[11px]">{actor}</div>
            </div>

            <div>
              <div className="font-bold">Thủ Kho Xuất</div>
              <div className="text-[10px] text-slate-400 italic">(Ký, họ tên)</div>
              <div className="h-14" />
              <div className="font-semibold text-[11px]">{actor}</div>
            </div>

            <div>
              <div className="font-bold">Người Vận Chuyển</div>
              <div className="text-[10px] text-slate-400 italic">(Ký, họ tên)</div>
              <div className="h-14" />
              <div className="font-semibold text-[11px]">{driverName}</div>
            </div>

            <div>
              <div className="font-bold">Đại Diện Nhận Hàng</div>
              <div className="text-[10px] text-slate-400 italic">(Ký, đóng dấu)</div>
              <div className="h-14" />
              <div className="font-semibold text-[11px]">Xưởng gia công</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
