"use client";

import { PRODUCTION_ORDER_PERMISSIONS } from "@/constants";
import { useUrlTab } from "@/hooks/use-url-filters";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageHeader } from "@/components/shared/PageHeader";

import { PRODUCTION_COPY } from "../copy";
import { WorkshopBoard } from "./WorkshopBoard";
import { WorkshopDashboard } from "./WorkshopDashboard";

const TABS = ["dashboard", "board"] as const;
const TAB_LABEL = { dashboard: "Tổng quan xưởng", board: "Bảng công đoạn" } as const;

function WorkshopContent() {
  const canRead = useCan(PRODUCTION_ORDER_PERMISSIONS.read);
  const [tab, setTab] = useUrlTab("tab", TABS, "dashboard");
  return (
    <>
      <PageHeader
        title="Xưởng in"
        subtitle="Theo dõi LSX theo công đoạn; số liệu đọc trực tiếp từ hệ thống, phạm vi theo kho được phân công."
      />
      <div
        role="tablist"
        aria-label="Xưởng in"
        className="border-border-default mb-4 flex gap-1 border-b"
        onKeyDown={(event) => {
          // WAI-ARIA tabs: mũi tên trái / phải chuyển tab, focus đi theo tab được chọn.
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          const step = event.key === "ArrowRight" ? 1 : -1;
          const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length];
          void setTab(next);
          document.getElementById(`workshop-tab-${next}`)?.focus();
        }}
      >
        {TABS.map((value) => (
          <button
            key={value}
            id={`workshop-tab-${value}`}
            role="tab"
            type="button"
            aria-selected={tab === value}
            aria-controls={`workshop-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => void setTab(value)}
            className={`focus-visible:ring-brand -mb-px border-b-2 px-3 py-2 text-[0.8125rem] font-medium focus-visible:ring-2 focus-visible:outline-none ${tab === value ? "border-brand text-ink-primary" : "text-ink-secondary hover:text-ink-primary border-transparent"}`}
          >
            {TAB_LABEL[value]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`workshop-panel-${tab}`} aria-labelledby={`workshop-tab-${tab}`}>
        {!canRead ? (
          <LoadErrorState inline error={null} kind="no-read" copy={PRODUCTION_COPY} />
        ) : tab === "board" ? (
          <WorkshopBoard />
        ) : (
          <WorkshopDashboard />
        )}
      </div>
    </>
  );
}

export function WorkshopPage() {
  return (
    <PermissionBoundary permissions={[PRODUCTION_ORDER_PERMISSIONS.viewPage]}>
      <WorkshopContent />
    </PermissionBoundary>
  );
}
