import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_LATE_WARNING } from "@/constants/einvoice";
import { api } from "@/lib/api/client";

import { listEInvoices } from "../api";

const row = (id: string, warnings: string[]) => ({
  id,
  code: id,
  type: "ORIGINAL",
  status: "ISSUED",
  adjusted: false,
  orderId: "o-1",
  customerId: "c-1",
  overdue: false,
  subtotal: 100,
  taxTotal: 8,
  grandTotal: 108,
  warnings,
});

const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 15,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

afterEach(() => vi.restoreAllMocks());

describe("listEInvoices — “Hoá đơn lập trễ” filter (WF-05 Q-10)", () => {
  it("asks the BE for the warning and never shows a row without it, even when the BE ignores the parameter", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: page([row("late", [EINVOICE_LATE_WARNING]), row("on-time", [])]),
    });
    const result = await listEInvoices({ warning: EINVOICE_LATE_WARNING });
    const query = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(query.get("warning")).toBe(EINVOICE_LATE_WARNING);
    expect(result.items.map((item) => item.id)).toEqual(["late"]);
  });

  it("without the filter every row is kept", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: page([row("late", [EINVOICE_LATE_WARNING]), row("on-time", [])]),
    });
    const result = await listEInvoices({});
    expect(result.items).toHaveLength(2);
  });
});
