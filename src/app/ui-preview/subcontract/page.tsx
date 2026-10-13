"use client";

import { useState } from "react";
import { Truck, PackageCheck } from "lucide-react";
import { SubcontractOrder } from "@/features/ui-subcontract/types";
import { subcontractRepo } from "@/features/ui-subcontract/mock-repo";
import { SubcontractParentChildView } from "@/features/ui-subcontract/components/SubcontractParentChildView";
import { SubcontractSendOutScreen } from "@/features/ui-subcontract/components/SubcontractSendOutScreen";
import { SubcontractReturnTracking } from "@/features/ui-subcontract/components/SubcontractReturnTracking";

type Tab = "hierarchy" | "send-out" | "return";

export default function SubcontractPreviewPage() {
  const [activeTab, setActiveTab] = useState<Tab>("hierarchy");
  const [selectedSubOrder, setSelectedSubOrder] = useState<SubcontractOrder | undefined>(
    subcontractRepo.getAllSubcontractOrders()[0],
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-default)] pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-purple-600 font-mono text-xs font-bold text-white">
              C
            </span>
            <h1 className="text-xl font-bold text-[var(--ink-primary)]">
              Nhóm C: Quản Lý Gia Công Ngoài (Subcontracting)
            </h1>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-secondary)]">
            Phạm vi: <strong>SCRUM-442</strong> (Tách LSX số lượng cha-con, chọn đối tác gia công,
            xuất phôi & in phiếu xuất kho Dispatch Note, theo dõi nhận lại & QC).
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 text-xs">
          <button
            onClick={() => setActiveTab("hierarchy")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "hierarchy"
                ? "bg-[var(--brand)] font-semibold text-[var(--ink-inverse)] shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            1. Cây Cha — Con & Tách Lệnh
          </button>
          <button
            onClick={() => setActiveTab("send-out")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "send-out"
                ? "bg-sky-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>2. Xuất Phôi & Phiếu Giao Hàng</span>
          </button>
          <button
            onClick={() => setActiveTab("return")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "return"
                ? "bg-purple-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <PackageCheck className="h-3.5 w-3.5" />
            <span>3. Theo Dõi Nhận Lại & QC</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div key={refreshKey}>
        {activeTab === "hierarchy" && (
          <SubcontractParentChildView
            onSelectSendOut={(sub) => {
              setSelectedSubOrder(sub);
              setActiveTab("send-out");
            }}
            onSelectReturn={(sub) => {
              setSelectedSubOrder(sub);
              setActiveTab("return");
            }}
            onRefresh={triggerRefresh}
          />
        )}

        {activeTab === "send-out" && selectedSubOrder && (
          <SubcontractSendOutScreen
            subOrder={selectedSubOrder}
            onBack={() => setActiveTab("hierarchy")}
            onRefresh={triggerRefresh}
          />
        )}

        {activeTab === "return" && selectedSubOrder && (
          <SubcontractReturnTracking
            subOrder={selectedSubOrder}
            onBack={() => setActiveTab("hierarchy")}
            onRefresh={triggerRefresh}
          />
        )}
      </div>
    </div>
  );
}
