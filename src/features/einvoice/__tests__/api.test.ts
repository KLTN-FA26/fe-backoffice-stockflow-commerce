import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_LATE_WARNING } from "@/constants/einvoice";
import { api } from "@/lib/api/client";

import { listEInvoices, recordExternalReduction } from "../api";

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

describe("listEInvoices — “Hoá đơn lập trễ” filter (WF-05 Q-10, BE G3 `?warning=`)", () => {
  it("asks the BE for the warning and keeps its page as it is (totals stay the BE's)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: { ...page([row("late", [EINVOICE_LATE_WARNING])]), totalElements: 31, totalPages: 3 },
    });
    const result = await listEInvoices({ warning: EINVOICE_LATE_WARNING });
    const query = get.mock.calls[0]?.[1]?.params as URLSearchParams;
    expect(query.get("warning")).toBe(EINVOICE_LATE_WARNING);
    expect(result.items.map((item) => item.id)).toEqual(["late"]);
    expect(result.totalElements).toBe(31);
  });

  it("without the filter the parameter is not sent", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: page([row("late", [EINVOICE_LATE_WARNING]), row("on-time", [])]),
    });
    const result = await listEInvoices({});
    expect((get.mock.calls[0]?.[1]?.params as URLSearchParams).has("warning")).toBe(false);
    expect(result.items).toHaveLength(2);
  });
});

describe("recordExternalReduction — BE G3 `external-reductions` multipart", () => {
  const base = {
    id: "EINV-9",
    symbol: "C26TAA",
    templateCode: "1",
    invoiceNumber: 12,
    issueDate: "2026-11-20",
    pdf: new File(["%PDF"], "giam.pdf", { type: "application/pdf" }),
    xml: new File(["<x/>"], "giam.xml", { type: "text/xml" }),
    note: "Giảm trên cổng",
  };

  it("always sends the XML and the basis; DELIVERY_FAILED carries no return request", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await recordExternalReduction({
      ...base,
      basis: "DELIVERY_FAILED",
      returnRequestId: "rr-1",
    }).catch(() => undefined);
    const form = post.mock.calls[0]?.[1] as FormData;
    expect(post.mock.calls[0]?.[0]).toBe("/einvoices/EINV-9/external-reductions");
    expect(form.get("xml")).toBe(base.xml);
    expect(form.get("basis")).toBe("DELIVERY_FAILED");
    expect(form.has("returnRequestId")).toBe(false);
  });

  it("RETURN names the return request", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await recordExternalReduction({ ...base, basis: "RETURN", returnRequestId: "rr-1" }).catch(
      () => undefined,
    );
    const form = post.mock.calls[0]?.[1] as FormData;
    expect(form.get("basis")).toBe("RETURN");
    expect(form.get("returnRequestId")).toBe("rr-1");
  });
});
