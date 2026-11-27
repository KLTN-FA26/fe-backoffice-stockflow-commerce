"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useDesignHistory, useDesignQuoteRequests } from "@/features/design-review/queries";

import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { DesignHistoryPanel } from "./DesignHistoryPanel";
import { QuoteRequestsPanel } from "./QuoteRequestsPanel";

const TABS = ["quotes", "history"] as const;
type TabKey = (typeof TABS)[number];

const withCount = (label: string, count: number | undefined) =>
  count === undefined ? label : `${label} (${count})`;

/**
 * Nhóm ít dùng của trang thiết kế, gom thành tab dưới phần đang duyệt (cùng mẫu `ProductDetailTabs`, backoffice-erp-ui
 * B12): yêu cầu báo giá đi kèm và lịch sử, đều là bảng. Tab đang chọn trên URL `?tab=`.
 */
export function DesignDetailTabs({ designId }: { designId: string }) {
  const quotes = useDesignQuoteRequests(designId);
  const history = useDesignHistory(designId);
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("quotes"));
  const label: Record<TabKey, string> = {
    quotes: withCount("Yêu cầu báo giá", quotes.data?.length),
    history: withCount("Lịch sử", history.data?.totalElements),
  };

  return (
    <div className="mt-6">
      <PageTabs
        tabs={TABS.map((value) => ({ value, label: label[value] }))}
        value={tab}
        onChange={(next) => void setTab(next === "quotes" ? null : next)}
        idPrefix="design-detail"
        ariaLabel="Thông tin thiết kế"
      />
      <PageTabPanel idPrefix="design-detail" value={tab}>
        {tab === "quotes" ? (
          <QuoteRequestsPanel designId={designId} />
        ) : (
          <DesignHistoryPanel designId={designId} />
        )}
      </PageTabPanel>
    </div>
  );
}
