"use client";

import { useState } from "react";
import { Scissors, Share2, ChevronDown, ChevronRight, Truck, PackageCheck } from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { ParentProductionOrder, SubcontractOrder } from "../types";
import { subcontractRepo } from "../mock-repo";
import { SubcontractSplitDialog } from "./SubcontractSplitDialog";

interface Props {
  onSelectSendOut: (subOrder: SubcontractOrder) => void;
  onSelectReturn: (subOrder: SubcontractOrder) => void;
  onRefresh: () => void;
}

export function SubcontractParentChildView({ onSelectSendOut, onSelectReturn, onRefresh }: Props) {
  const parentOrders = subcontractRepo.getParentOrders();
  const [selectedParentForSplit, setSelectedParentForSplit] =
    useState<ParentProductionOrder | null>(null);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({
    "lsx-parent-01": true,
    "lsx-parent-03": true,
  });

  const toggleExpand = (id: string) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink-primary)]">
            <Share2 className="h-5 w-5 text-purple-600" />
            <span>
              Quan Hệ Cha — Con & Tách Lệnh Gia Công (Subcontracting Hierarchy — SCRUM-442)
            </span>
          </h2>
          <p className="text-xs text-[var(--ink-secondary)]">
            Quản lý ủy thác sản xuất một phần sản lượng cho nhà cung cấp phụ trợ; phân bổ số lượng
            nội bộ vs gia công ngoài.
          </p>
        </div>
      </div>

      {/* Parent Orders List */}
      <div className="space-y-3">
        {parentOrders.map((parent) => {
          const isExpanded = !!expandedParents[parent.id];
          const hasChildren = parent.children.length > 0;

          return (
            <div
              key={parent.id}
              className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs"
            >
              {/* Parent Header Row */}
              <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 md:flex-row md:items-center">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleExpand(parent.id)}
                    className="mt-0.5 p-1 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[var(--ink-primary)]">
                        {parent.code}
                      </span>
                      {hasChildren ? (
                        <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          GIA CÔNG NGOÀI ({parent.children.length} lệnh con)
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          100% NỘI BỘ
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--ink-secondary)]">
                      Khách hàng: <strong>{parent.customerName}</strong> · Phôi:{" "}
                      <span className="font-mono">{parent.blankSku}</span>
                    </div>
                  </div>
                </div>

                {/* Parent Quantity Stats & Split Action */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1 text-right">
                    <span className="block text-[10px] text-[var(--ink-secondary)]">
                      Tổng kế hoạch
                    </span>
                    <strong className="font-mono">{parent.totalQuantity.toLocaleString()}</strong>
                  </div>
                  <div className="rounded border border-sky-200 bg-sky-50 px-2.5 py-1 text-right text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                    <span className="block text-[10px]">Nội bộ làm</span>
                    <strong className="font-mono">{parent.inHouseQuantity.toLocaleString()}</strong>
                  </div>
                  <div className="rounded border border-purple-200 bg-purple-50 px-2.5 py-1 text-right text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                    <span className="block text-[10px]">Ủy thác gia công</span>
                    <strong className="font-mono">
                      {parent.subcontractedQuantity.toLocaleString()}
                    </strong>
                  </div>

                  {parent.inHouseQuantity > 0 && (
                    <button
                      onClick={() => setSelectedParentForSplit(parent)}
                      className="flex shrink-0 items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 font-medium text-white shadow-xs hover:bg-purple-700"
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      <span>Tách gia công</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Children Subcontract Orders Accordion Body */}
              {isExpanded && (
                <div className="space-y-3 bg-[var(--bg-surface)] p-4">
                  {!hasChildren ? (
                    <div className="py-4 text-center text-xs text-[var(--ink-tertiary)] italic">
                      Lệnh sản xuất này chưa tách đơn gia công ngoài nào. Bấm nút &ldquo;Tách gia
                      công&rdquo; ở trên nếu muốn ủy thác cho xưởng ngoài.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--ink-secondary)]">
                          <tr>
                            <th className="px-3 py-2">Mã đơn gia công (Con)</th>
                            <th className="px-3 py-2">Nhà cung cấp phụ trợ</th>
                            <th className="px-3 py-2">Chế độ gia công</th>
                            <th className="px-3 py-2 text-right">Số lượng</th>
                            <th className="px-3 py-2 text-right">Đơn giá / Thành tiền</th>
                            <th className="px-3 py-2">Hạn giao</th>
                            <th className="px-3 py-2">Trạng thái</th>
                            <th className="px-3 py-2 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-default)]">
                          {parent.children.map((sub) => (
                            <tr key={sub.id} className="hover:bg-[var(--bg-subtle)]">
                              <td className="px-3 py-2 font-mono font-bold text-purple-700 dark:text-purple-400">
                                {sub.code}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-[var(--ink-primary)]">
                                  {sub.partnerName}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {sub.mode === "FULL_SERVICE" ? (
                                  <span className="text-[11px] font-medium text-indigo-600">
                                    Trọn gói (Cả phôi)
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-teal-600">
                                    Chỉ in (StockFlow cấp phôi)
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold">
                                {sub.quantity.toLocaleString()} cái
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                <div>{sub.unitPrice.toLocaleString()} đ/cái</div>
                                <div className="text-[10px] font-bold text-[var(--ink-tertiary)]">
                                  {sub.totalCost.toLocaleString()} đ
                                </div>
                              </td>
                              <td className="px-3 py-2 font-mono whitespace-nowrap text-[var(--ink-secondary)]">
                                {sub.dueDate}
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={sub.status} />
                              </td>
                              <td className="space-x-1 px-3 py-2 text-right whitespace-nowrap">
                                {sub.status === "DRAFT" && (
                                  <button
                                    onClick={() => onSelectSendOut(sub)}
                                    className="inline-flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white shadow-xs hover:bg-sky-700"
                                  >
                                    <Truck className="h-3 w-3" />
                                    <span>Xuất phôi & In phiếu</span>
                                  </button>
                                )}
                                {sub.status !== "DRAFT" && (
                                  <button
                                    onClick={() => onSelectReturn(sub)}
                                    className="inline-flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-[11px] font-medium text-white shadow-xs hover:bg-purple-700"
                                  >
                                    <PackageCheck className="h-3 w-3" />
                                    <span>Theo dõi nhận hàng</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Split Dialog */}
      {selectedParentForSplit && (
        <SubcontractSplitDialog
          parentOrder={selectedParentForSplit}
          isOpen={true}
          onClose={() => setSelectedParentForSplit(null)}
          onSuccess={() => {
            onRefresh();
            setSelectedParentForSplit(null);
          }}
        />
      )}
    </div>
  );
}
