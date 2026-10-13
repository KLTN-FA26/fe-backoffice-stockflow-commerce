"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Lock,
  RotateCcw,
  ShieldCheck,
  Calculator,
  Maximize2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import {
  SalesOrderTimelineView,
  ReserveStockCheckoutView,
  RmaRequestPortalView,
  RmaApprovalBackofficeView,
  CustomizationPriceCalculator,
  PackagingDesignCanvas,
  StorefrontChatWidget,
} from "@/features/ui-batch2";

type Batch2Tab =
  "timeline" | "checkout" | "rma-customer" | "rma-admin" | "pricing" | "designer" | "chat";

export default function Batch2PreviewPage() {
  const [activeTab, setActiveTab] = useState<Batch2Tab>("timeline");

  useEffect(() => {
    const timer = setTimeout(() => {
      const p = new URLSearchParams(window.location.search).get("tab") as Batch2Tab | null;
      if (
        p &&
        [
          "timeline",
          "checkout",
          "rma-customer",
          "rma-admin",
          "pricing",
          "designer",
          "chat",
        ].includes(p)
      ) {
        setActiveTab(p);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const tabs: { id: Batch2Tab; label: string; jira: string; icon: React.ElementType }[] = [
    {
      id: "timeline",
      label: "Timeline Đơn hàng",
      jira: "SCRUM-248",
      icon: Clock,
    },
    {
      id: "checkout",
      label: "Giữ hàng Checkout (15m)",
      jira: "SCRUM-212",
      icon: Lock,
    },
    {
      id: "rma-customer",
      label: "Khách gửi RMA",
      jira: "SCRUM-257",
      icon: RotateCcw,
    },
    {
      id: "rma-admin",
      label: "Duyệt RMA Backoffice",
      jira: "SCRUM-258",
      icon: ShieldCheck,
    },
    {
      id: "pricing",
      label: "Tính giá Tùy biến",
      jira: "SCRUM-304",
      icon: Calculator,
    },
    {
      id: "designer",
      label: "Bản vẽ Bế 2D",
      jira: "SCRUM-299/300",
      icon: Maximize2,
    },
    {
      id: "chat",
      label: "Widget Chat Tư vấn",
      jira: "SCRUM-320",
      icon: MessageSquare,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-sky-50 p-6 shadow-xs dark:from-indigo-950/40 dark:to-sky-950/30">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Batch 2 Deliverables — Đầy đủ giao diện tương tác</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--ink-primary)]">
              Gói Mở Rộng UI Batch 2 (WBS 3.12, 3.14, 3.16, 3.17)
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-[var(--ink-secondary)]">
              Triển khai đầy đủ mã nguồn UI tương tác bằng dữ liệu giả lập chuẩn (Synthetic Fixtures
              In-Memory), giải quyết triệt để 100% yêu cầu tồn đọng trong Completion Gate mà không
              phụ thuộc backend.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border-default)] pb-2 text-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[var(--brand)] text-[var(--ink-inverse)] shadow-xs"
                  : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--ink-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={`py-0.2 rounded px-1.5 font-mono text-[10px] ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--bg-muted)] text-[var(--ink-tertiary)]"
                }`}
              >
                {tab.jira}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="min-h-[500px]">
        {activeTab === "timeline" && <SalesOrderTimelineView />}
        {activeTab === "checkout" && <ReserveStockCheckoutView />}
        {activeTab === "rma-customer" && <RmaRequestPortalView />}
        {activeTab === "rma-admin" && <RmaApprovalBackofficeView />}
        {activeTab === "pricing" && <CustomizationPriceCalculator />}
        {activeTab === "designer" && <PackagingDesignCanvas />}
        {activeTab === "chat" && <StorefrontChatWidget />}
      </div>
    </div>
  );
}
