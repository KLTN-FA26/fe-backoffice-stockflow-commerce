import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { ProductionDetailView } from "..";

import type { RouteHandler } from "@/test/api-screen";
import type { ProductionDetail } from "../types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const order: ProductionDetail = {
  summary: {
    id: "po-1",
    orderNumber: "LSX-20261014-0003",
    type: "ORDER",
    mode: "IN_HOUSE",
    status: "PENDING_PREPRESS",
    warehouseId: "wh-1",
    blankSku: "CUP-PAPER-12OZ-WHT",
    designSnapshotId: "snap-1",
    plannedQuantity: 1000,
    goodQuantity: 0,
    createdAt: "2026-10-14T02:00:00Z",
  },
  designChecksum: "abc123",
  issuedQuantity: 0,
  printedQuantity: 0,
  scrapQuantity: 0,
  version: 1,
  history: [{ toStatus: "PENDING_PREPRESS", changedAt: "2026-10-14T02:00:00Z" }],
};

const supplier = (code: string, printSubcontractor: boolean) => ({
  supplierId: `sup-${code}`,
  code,
  name: `NCC ${code}`,
  paymentTermDays: 30,
  leadTimeDays: 7,
  printSubcontractor,
});

function open(suppliers: RouteHandler) {
  const api = mockApi("WAREHOUSE_MANAGER", {
    get: {
      "/production/orders/po-1": () => order,
      "/production/orders/po-1/print-file": () => {
        throw apiError(404, "NOT_FOUND");
      },
      "/production/orders/po-1/scrap": () => [],
      "/production/orders/po-1/material-issues": () => [],
      "/production/orders/po-1/qc-results": () => [],
      "/suppliers": suppliers,
    },
  });
  renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_MANAGER");
  return api;
}

describe("SCRUM-441 split: subcontractor chosen from the real list", () => {
  it("asks BE for print subcontractors only and never offers a plain supplier", async () => {
    // A BE that ignores printSubcontractor (develop) returns every supplier: the flag still filters.
    const api = open(() => ({ items: [supplier("INSAIGON", true), supplier("GIAYXANH", false)] }));
    await userEvent.click(await screen.findByRole("button", { name: "Tách gia công" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByRole("option", { name: "INSAIGON — NCC INSAIGON" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: /GIAYXANH/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox", { name: /Nhà gia công/ })).not.toBeInTheDocument();
    const call = api.get.mock.calls.find(([url]) => url === "/suppliers");
    const params = (call?.[1] as { params: URLSearchParams }).params;
    expect(params.get("printSubcontractor")).toBe("true");
    expect(params.get("status")).toBe("ACTIVE");
  });

  it("no print subcontractor yet → explains, select disabled", async () => {
    open(() => ({ items: [supplier("GIAYXANH", false)] }));
    await userEvent.click(await screen.findByRole("button", { name: "Tách gia công" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Chưa có NCC nào được đánh dấu là nhà gia công in."),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText(/Nhà gia công/)).toBeDisabled());
  });
});
