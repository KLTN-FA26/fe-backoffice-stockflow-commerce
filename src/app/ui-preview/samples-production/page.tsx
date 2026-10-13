"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { SampleRequestList } from "@/features/ui-samples-production/components/SampleRequestList";
import { SampleRequestDetail } from "@/features/ui-samples-production/components/SampleRequestDetail";
import { CustomerSamplePortalView } from "@/features/ui-samples-production/components/CustomerSamplePortalView";
import { ProductionOrderList } from "@/features/ui-samples-production/components/ProductionOrderList";
import { ProductionOrderDetail } from "@/features/ui-samples-production/components/ProductionOrderDetail";
import { SampleCreateDialog } from "@/features/ui-samples-production/components/SampleCreateDialog";

type ActiveTab =
  "samples" | "sample-detail" | "customer-portal" | "production-orders" | "production-detail";

export default function SamplesProductionPreviewPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab") as ActiveTab | null;
      if (tabParam) return tabParam;
    }
    return "samples";
  });
  const [selectedSampleId, setSelectedSampleId] = useState<string>("smp-001");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("lsx-001");
  const [showCreateSample, setShowCreateSample] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);

  return (
    <div className="space-y-6">
      {/* Group Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-default)] pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 font-mono text-xs font-bold text-white">
              A
            </span>
            <h1 className="text-xl font-bold text-[var(--ink-primary)]">
              Nhóm A: Yêu cầu Làm mẫu & Nền tảng Sản xuất
            </h1>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-secondary)]">
            Phạm vi: <strong>SCRUM-404</strong> (Yêu cầu mẫu & Khách duyệt),{" "}
            <strong>SCRUM-406</strong> (DS Lệnh sản xuất LSX), <strong>SCRUM-408</strong> (Chi tiết
            LSX & Prepress), <strong>SCRUM-414</strong> (Hủy & Tạm dừng LSX).
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 text-xs">
          <button
            onClick={() => setActiveTab("samples")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "samples" || activeTab === "sample-detail"
                ? "bg-[var(--brand)] font-semibold text-[var(--ink-inverse)] shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            1. Quản lý Mẫu (Sales)
          </button>
          <button
            onClick={() => setActiveTab("customer-portal")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "customer-portal"
                ? "bg-sky-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <span>2. Portal Khách Duyệt Mẫu</span>
            <ExternalLink className="h-3 w-3" />
          </button>
          <button
            onClick={() => setActiveTab("production-orders")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "production-orders" || activeTab === "production-detail"
                ? "bg-[var(--brand)] font-semibold text-[var(--ink-inverse)] shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            3. Danh sách LSX & Prepress
          </button>
        </div>
      </div>

      {/* Main tab content */}
      <div key={refreshKey}>
        {activeTab === "samples" && (
          <SampleRequestList
            onSelectSample={(s) => {
              setSelectedSampleId(s.id);
              setActiveTab("sample-detail");
            }}
            onOpenCreate={() => setShowCreateSample(true)}
            onOpenPortal={(s) => {
              setSelectedSampleId(s.id);
              setActiveTab("customer-portal");
            }}
          />
        )}

        {activeTab === "sample-detail" && (
          <SampleRequestDetail
            sampleId={selectedSampleId}
            onBack={() => setActiveTab("samples")}
            onOpenPortal={(s) => {
              setSelectedSampleId(s.id);
              setActiveTab("customer-portal");
            }}
            onRefresh={triggerRefresh}
          />
        )}

        {activeTab === "customer-portal" && (
          <CustomerSamplePortalView
            sampleId={selectedSampleId}
            onBack={() => setActiveTab("samples")}
            onRefresh={triggerRefresh}
          />
        )}

        {activeTab === "production-orders" && (
          <ProductionOrderList
            onSelectOrder={(o) => {
              setSelectedOrderId(o.id);
              setActiveTab("production-detail");
            }}
          />
        )}

        {activeTab === "production-detail" && (
          <ProductionOrderDetail
            orderId={selectedOrderId}
            onBack={() => setActiveTab("production-orders")}
            onRefresh={triggerRefresh}
          />
        )}
      </div>

      {/* Create Sample Dialog */}
      <SampleCreateDialog
        isOpen={showCreateSample}
        onClose={() => setShowCreateSample(false)}
        onCreated={() => {
          triggerRefresh();
          setActiveTab("samples");
        }}
      />
    </div>
  );
}
