"use client";

import { useState } from "react";
import { WorkshopLSX } from "@/features/ui-workshop/types";
import { WorkshopDashboard } from "@/features/ui-workshop/components/WorkshopDashboard";
import { BlankIssueScanScreen } from "@/features/ui-workshop/components/BlankIssueScanScreen";
import { WorkshopKanbanBoard } from "@/features/ui-workshop/components/WorkshopKanbanBoard";
import { ProductionQCScreen } from "@/features/ui-workshop/components/ProductionQCScreen";
import { CompletedHandoffList } from "@/features/ui-workshop/components/CompletedHandoffList";

type Tab = "dashboard" | "kanban" | "scan" | "qc" | "handoff";

export default function WorkshopPreviewPage() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (tabParam) return tabParam;
    }
    return "dashboard";
  });
  const [selectedQcOrder, setSelectedQcOrder] = useState<WorkshopLSX | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-default)] pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 font-mono text-xs font-bold text-white">
              B
            </span>
            <h1 className="text-xl font-bold text-[var(--ink-primary)]">
              Nhóm B: Vận Hành Xưởng & In Ấn & Bàn Giao
            </h1>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-secondary)]">
            Phạm vi: <strong>SCRUM-410</strong> (Quét xuất phôi), <strong>SCRUM-417</strong> (Kanban
            in & phế phẩm), <strong>SCRUM-419</strong> (QC đối chiếu mẫu duyệt),{" "}
            <strong>SCRUM-412</strong> (Bàn giao đóng gói), <strong>SCRUM-416</strong> (Dashboard &
            Phân quyền xưởng).
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 text-xs">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "dashboard"
                ? "bg-[var(--brand)] font-semibold text-[var(--ink-inverse)] shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            Tổng quan & Quyền (416)
          </button>
          <button
            onClick={() => setActiveTab("kanban")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "kanban"
                ? "bg-indigo-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            Kanban Xưởng (417)
          </button>
          <button
            onClick={() => setActiveTab("scan")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "scan"
                ? "bg-emerald-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            Quét Xuất Phôi (410)
          </button>
          <button
            onClick={() => setActiveTab("qc")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "qc"
                ? "bg-purple-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            Trạm QC Đối Chiếu (419)
          </button>
          <button
            onClick={() => setActiveTab("handoff")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "handoff"
                ? "bg-teal-600 font-semibold text-white shadow-xs"
                : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            Bàn Giao Đóng Gói (412)
          </button>
        </div>
      </div>

      {/* Tab contents */}
      <div key={refreshKey}>
        {activeTab === "dashboard" && (
          <WorkshopDashboard onSelectTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === "kanban" && (
          <WorkshopKanbanBoard
            onRefresh={triggerRefresh}
            onNavigateToQc={(order) => {
              setSelectedQcOrder(order);
              setActiveTab("qc");
            }}
          />
        )}

        {activeTab === "scan" && (
          <BlankIssueScanScreen
            onRefresh={triggerRefresh}
            onNavigateToKanban={() => setActiveTab("kanban")}
          />
        )}

        {activeTab === "qc" && (
          <ProductionQCScreen
            initialOrder={selectedQcOrder}
            onRefresh={triggerRefresh}
            onNavigateToCompleted={() => setActiveTab("handoff")}
          />
        )}

        {activeTab === "handoff" && <CompletedHandoffList onRefresh={triggerRefresh} />}
      </div>
    </div>
  );
}
