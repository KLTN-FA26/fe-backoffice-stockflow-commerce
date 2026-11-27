"use client";

import { useRouter } from "next/navigation";
import { ADMIN_ROUTES, DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { PageTabs } from "@/components/shared/PageTabs";

import type { PageTabItem } from "@/components/shared/PageTabs";

type RequestTab = "single" | "project";

const TABS: readonly PageTabItem<RequestTab>[] = [
  { value: "single", label: COPY.tabSingle },
  { value: "project", label: COPY.tabProject },
];

/** Hai route chia một mục menu: đổi tab là đổi trang. Tab gạch chân, chỉ chữ (backoffice-erp-ui §21). */
export function QuoteRequestTabs({ value }: { value: RequestTab }) {
  const router = useRouter();
  return (
    <PageTabs
      tabs={TABS}
      value={value}
      idPrefix="design-quote-requests"
      ariaLabel="Loại yêu cầu báo giá"
      onChange={(next) =>
        router.push(
          next === "project"
            ? ADMIN_ROUTES.designProjectQuoteRequests.list
            : ADMIN_ROUTES.designQuoteRequests.list,
        )
      }
    />
  );
}
