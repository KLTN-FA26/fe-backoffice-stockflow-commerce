import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { ProductionDetailView } from "..";
import { scanMismatch } from "../selectors";

import type { RouteHandler } from "@/test/api-screen";
import type { ProductionDetail } from "../types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const order = (issued = 0): ProductionDetail => ({
  summary: {
    id: "po-1",
    orderNumber: "LSX-20261014-0007",
    type: "ORDER",
    mode: "IN_HOUSE",
    status: issued >= 1000 ? "MATERIAL_ISSUED" : "READY",
    warehouseId: "wh-1",
    blankSku: "CUP-PAPER-12OZ-WHT",
    designSnapshotId: "snap-1",
    plannedQuantity: 1000,
    goodQuantity: 0,
    createdAt: "2026-10-14T02:00:00Z",
  },
  designChecksum: "abc123",
  issuedQuantity: issued,
  printedQuantity: 0,
  scrapQuantity: 0,
  version: 1,
  history: [{ toStatus: "READY", changedAt: "2026-10-14T02:00:00Z" }],
});

const HOLD_A = {
  reservationId: "res-a",
  sku: "CUP-PAPER-12OZ-WHT",
  lotNumber: "LOT-7",
  locationCode: "HCM-B01-1-B",
  quantity: 600,
  barcode: "8930000000017",
};
const HOLD_B = { ...HOLD_A, reservationId: "res-b", locationCode: "HCM-A01-2-A", quantity: 400 };

const pending = (holds: unknown[], issued = 0) => ({
  productionOrderId: "po-1",
  orderNumber: "LSX-20261014-0007",
  status: "READY",
  blankSku: "CUP-PAPER-12OZ-WHT",
  required: 1000,
  issued,
  outstanding: 1000 - issued,
  holds,
});

function screenWith(holds: unknown[], post: RouteHandler) {
  return mockApi("WAREHOUSE_STAFF", {
    get: {
      "/production/orders/po-1": () => order(),
      "/production/orders/po-1/print-file": () => {
        throw apiError(404, "NOT_FOUND");
      },
      "/production/orders/po-1/material-issues": () => [],
      "/production/orders/po-1/material-issues/pending": () => pending(holds),
      "/production/orders/po-1/scrap": () => [],
      "/production/orders/po-1/qc-results": () => [],
      "/warehouses/wh-1/layout": () => ({
        areas: [
          {
            code: "PRD01",
            type: "PRODUCTION",
            usable: true,
            locationCode: "HCM-PRD01",
            name: "Xưởng in",
          },
        ],
      }),
    },
    post: { "/production/orders/po-1/material-issues": post },
  });
}

async function chooseArea() {
  await screen.findByRole("option", { name: /HCM-PRD01/ });
  await userEvent.selectOptions(screen.getByLabelText(/Khu sản xuất nhận phôi/), "HCM-PRD01");
}

describe("scanMismatch (same rule as BE requireScanned, SCRUM-409)", () => {
  it("location any case; item = SKU any case or the exact barcode", () => {
    expect(scanMismatch(HOLD_A, "hcm-b01-1-b", "cup-paper-12oz-wht")).toBeNull();
    expect(scanMismatch(HOLD_A, "HCM-B01-1-B", "8930000000017")).toBeNull();
    expect(scanMismatch(HOLD_A, "HCM-A01-2-A", "")).toBe("location");
    expect(scanMismatch(HOLD_A, "HCM-B01-1-B", "CUP-PAPER-16OZ")).toBe("item");
    expect(scanMismatch({ ...HOLD_A, barcode: null }, "", "8930000000017")).toBe("item");
  });
});

describe("SCRUM-410 scan screen", () => {
  it("lists every hold still to scan with required / issued / outstanding", async () => {
    screenWith([HOLD_A, HOLD_B], () => ({}));
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    expect(await screen.findByText("Phiếu giữ còn phải quét (2)")).toBeInTheDocument();
    expect(screen.getByText("HCM-B01-1-B")).toBeInTheDocument();
    expect(screen.getByText("HCM-A01-2-A")).toBeInTheDocument();
    expect(screen.getByText(/Cần 1\.000 · đã xuất 0 · còn thiếu 1\.000/)).toBeInTheDocument();
  });

  it("wrong source location is caught at the scan, nothing is posted", async () => {
    const post = vi.fn();
    screenWith([HOLD_A], post);
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    await chooseArea();
    await userEvent.type(screen.getByLabelText(/Quét vị trí nguồn/), "HCM-A01-2-A{Enter}");
    await userEvent.type(screen.getByLabelText(/Quét SKU \/ mã vạch/), "CUP-PAPER-12OZ-WHT");
    expect(
      screen.getByText("Sai vị trí: phôi của phiếu giữ này không nằm ở vị trí vừa quét."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất phôi/ })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("happy scan sends the chosen hold + both scans; Enter from the scanner submits", async () => {
    const api = screenWith([HOLD_A, HOLD_B], () => ({
      issue: {
        id: "i",
        requestId: "r",
        reservationId: "res-b",
        sku: HOLD_B.sku,
        lotNumber: "LOT-7",
        fromLocation: HOLD_B.locationCode,
        toLocation: "HCM-PRD01",
        quantity: 400,
        issuedAt: "2026-10-14T03:00:00Z",
      },
      order: order(400),
    }));
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    await chooseArea();
    await userEvent.click(screen.getByRole("radio", { name: /HCM-A01-2-A/ }));
    await userEvent.type(screen.getByLabelText(/Quét vị trí nguồn/), "hcm-a01-2-a{Enter}");
    expect(screen.getByLabelText(/Quét SKU \/ mã vạch/)).toHaveFocus();
    await userEvent.type(screen.getByLabelText(/Quét SKU \/ mã vạch/), "8930000000017{Enter}");
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/production/orders/po-1/material-issues", {
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        toLocation: "HCM-PRD01",
        reservationId: "res-b",
        scannedLocation: "hcm-a01-2-a",
        scannedCode: "8930000000017",
      }),
    );
    expect(await screen.findByText(/Đã xuất 400 phôi/)).toBeInTheDocument();
  });

  it("BE ISSUE_ITEM_MISMATCH lands on the SKU field (stock never adjusted on the client)", async () => {
    screenWith([HOLD_A], () => {
      throw apiError(409, "ISSUE_ITEM_MISMATCH");
    });
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    await chooseArea();
    await userEvent.type(screen.getByLabelText(/Quét vị trí nguồn/), "HCM-B01-1-B{Enter}");
    await userEvent.type(screen.getByLabelText(/Quét SKU \/ mã vạch/), "CUP-PAPER-12OZ-WHT{Enter}");
    expect(
      await screen.findByText("Sai mã hàng: mã vừa quét không phải phôi của phiếu giữ này."),
    ).toBeInTheDocument();
    expect(screen.getByText(/đã xuất 0 · còn thiếu 1\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/Đã xuất .* phôi/)).not.toBeInTheDocument();
  });

  it("BR-PRD-03 over-issue (409) is shown in Vietnamese", async () => {
    screenWith([HOLD_A], () => {
      throw apiError(409, "ISSUE_EXCEEDS_REQUIREMENT");
    });
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    await chooseArea();
    await userEvent.type(screen.getByLabelText(/Quét vị trí nguồn/), "HCM-B01-1-B{Enter}");
    await userEvent.type(screen.getByLabelText(/Quét SKU \/ mã vạch/), "CUP-PAPER-12OZ-WHT{Enter}");
    expect(
      await screen.findByText("Số phôi vượt quá số lệnh sản xuất còn cần (BR-PRD-03)."),
    ).toBeInTheDocument();
  });

  it("no hold yet (reprint) → issue without source scans; BE holds and moves the next blanks", async () => {
    const api = screenWith([], () => {
      throw apiError(409, "INSUFFICIENT_STOCK");
    });
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    await chooseArea();
    expect(screen.getByText(/Chưa có phiếu giữ phôi nào/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Xuất phôi/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/production/orders/po-1/material-issues", {
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        toLocation: "HCM-PRD01",
      }),
    );
    expect(await screen.findByText("Không đủ phôi trong kho.")).toBeInTheDocument();
  });

  it("PRODUCTION_STAFF (read only) sees what is pending but cannot scan", async () => {
    mockApi("PRODUCTION_STAFF", {
      get: {
        "/production/orders/po-1": () => order(),
        "/production/orders/po-1/print-file": () => {
          throw apiError(404, "NOT_FOUND");
        },
        "/production/orders/po-1/material-issues": () => [],
        "/production/orders/po-1/material-issues/pending": () => pending([HOLD_A]),
        "/production/orders/po-1/scrap": () => [],
        "/production/orders/po-1/qc-results": () => [],
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "PRODUCTION_STAFF");
    expect(await screen.findByText("Phiếu giữ còn phải quét (1)")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Quét vị trí nguồn/)).not.toBeInTheDocument();
  });
});
