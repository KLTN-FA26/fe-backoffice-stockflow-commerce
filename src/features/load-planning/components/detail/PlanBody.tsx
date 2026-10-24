"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { UI_LABELS } from "@/constants";
import { summarizePlan } from "@/features/load-planning/plan-selectors";
import { PageTabs } from "@/components/shared/PageTabs";

import { LayoutMetrics } from "../report/LayoutMetrics";

import { LoadingTab } from "./LoadingTab";
import { ReconciliationTab } from "./ReconciliationTab";

import type { LoadPlanActions } from "@/features/load-planning/lifecycle";
import type { PlanDetail } from "@/features/load-planning/plan-types";
import type { Layout } from "@/features/load-planning/types";

const L = UI_LABELS.loadPlan.detail;
const TABS = ["loading", "reconciliation"] as const;

/** Phần thân khi không soạn: số liệu, hai tab (xếp xe / đối chiếu; tab ở URL `?tab=`). */
export function PlanBody({
  plan,
  layouts,
  layoutsFailed,
  actions,
  onNotice,
  onAcknowledge,
}: {
  plan: PlanDetail;
  layouts: readonly Layout[] | undefined;
  layoutsFailed: boolean;
  actions: LoadPlanActions;
  onNotice: (message: string | null) => void;
  onAcknowledge: () => void;
}) {
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("loading"));
  return (
    <>
      {layouts && plan.vehicles.length > 0 && (
        <LayoutMetrics summary={summarizePlan(layouts, plan)} />
      )}
      <PageTabs
        tabs={[
          { value: "loading", label: L.tabs.loading, count: plan.vehicles.length },
          { value: "reconciliation", label: L.tabs.reconciliation },
        ]}
        value={tab}
        onChange={(next) => void setTab(next)}
        idPrefix="load-plan"
        ariaLabel={L.tabsAria}
      />
      <div id={`load-plan-panel-${tab}`} role="tabpanel" aria-labelledby={`load-plan-tab-${tab}`}>
        {tab === "loading" ? (
          <LoadingTab
            plan={plan}
            layouts={layouts}
            layoutsFailed={layoutsFailed}
            actions={actions}
            onNotice={onNotice}
            onAcknowledge={onAcknowledge}
          />
        ) : (
          <ReconciliationTab loadPlanId={plan.loadPlanId} />
        )}
      </div>
    </>
  );
}
