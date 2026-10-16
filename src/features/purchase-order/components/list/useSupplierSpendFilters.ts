"use client";

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

import { PAGE_SIZE, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { PO_INPUT_CURRENCIES } from "@/features/purchase-order";

import { PAGE_SIZE_OPTIONS } from "./config";

/** BE `CreatePurchaseOrderRequest.currency` @Pattern("[A-Z]{3}") — mã ISO 4217. */
export const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;

const DEFAULT_CURRENCY = PO_INPUT_CURRENCIES[0];

/** Filter tab Chi tiêu NCC → URL (F5 / gửi link giữ nguyên). Khoá riêng, không đụng tab Đơn. */
const SPEND_PARSERS = {
  currency: parseAsString.withDefault(DEFAULT_CURRENCY),
  from: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
};
const SPEND_URL_KEYS = {
  currency: "spendCurrency",
  from: "spendFrom",
  to: "spendTo",
  page: "spendPage",
};

interface SpendPageConfig {
  pageSize: number;
}
const DEFAULT_SPEND_CONFIG: SpendPageConfig = { pageSize: PAGE_SIZE.md };

/**
 * State tab Chi tiêu NCC: tiền tệ / khoảng ngày / trang trên URL; số dòng mỗi trang là sở thích
 * cá nhân → `usePageConfig` (state-persistence.md). URL trang từ 1, BE trang từ 0.
 */
export function useSupplierSpendFilters() {
  const [q, setQ] = useQueryStates(SPEND_PARSERS, { urlKeys: SPEND_URL_KEYS });
  const { config, updateConfig } = usePageConfig<SpendPageConfig>(
    STORAGE_KEYS.adminPurchaseOrdersSpendConfig,
    DEFAULT_SPEND_CONFIG,
    (stored, fallback) => ({
      pageSize: PAGE_SIZE_OPTIONS.find((s) => s === stored.pageSize) ?? fallback.pageSize,
    }),
  );
  // URL bị sửa tay thành mã sai → về mặc định thay vì gửi mã rác lên BE.
  const currency = ISO_CURRENCY_PATTERN.test(q.currency) ? q.currency : DEFAULT_CURRENCY;

  return {
    currency,
    range: { from: q.from, to: q.to },
    page: Math.max(0, q.page - 1),
    size: config.pageSize,
    setCurrency: (c: string) => void setQ({ currency: c, page: null }),
    setRange: (r: { from: string; to: string }) =>
      void setQ({ from: r.from || null, to: r.to || null, page: null }),
    setPage: (p: number) => void setQ({ page: p + 1 }),
    // data-table-mode-a §5: đổi số dòng → về trang đầu
    setSize: (pageSize: number) => {
      updateConfig((c) => ({ ...c, pageSize }));
      void setQ({ page: null });
    },
  };
}
