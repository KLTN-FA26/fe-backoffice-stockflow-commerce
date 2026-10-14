import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ROLE_PERMISSIONS, mockApi, renderScreen } from "@/test/api-screen";

import { ProductionDetailView } from "..";
import { allowedProductionActions, allowedSubcontractRecovery } from "../lifecycle";
import { awaitingQc, blanksStillNeeded, effectiveStatus } from "../selectors";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ProductionDetail } from "../types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function order(
  status: string,
  extra: Partial<ProductionDetail["summary"]> = {},
  rest: Partial<ProductionDetail> = {},
): ProductionDetail {
  return {
    summary: {
      id: "po-1",
      orderNumber: "LSX-20261014-0001",
      type: "ORDER",
      mode: "IN_HOUSE",
      status: status as ProductionDetail["summary"]["status"],
      warehouseId: "wh-1",
      blankSku: "CUP-PAPER-12OZ",
      designSnapshotId: "snap-1",
      plannedQuantity: 1000,
      goodQuantity: 0,
      createdAt: "2026-10-14T02:00:00Z",
      ...extra,
    },
    designChecksum: "abc123",
    issuedQuantity: 0,
    printedQuantity: 0,
    scrapQuantity: 0,
    version: 1,
    history: [{ toStatus: "PENDING_PREPRESS", changedAt: "2026-10-14T02:00:00Z" }],
    ...rest,
  };
}
const can = (role: keyof typeof ROLE_PERMISSIONS) => (code: PermissionCode) =>
  (ROLE_PERMISSIONS[role] as readonly string[]).includes(code);

afterEach(() => vi.restoreAllMocks());

describe("production lifecycle (BE ProductionOrder transitions)", () => {
  it("COMPLETED and CANCELLED are terminal for every role", () => {
    expect(allowedProductionActions(order("COMPLETED"), can("WAREHOUSE_MANAGER"))).toEqual([]);
    expect(allowedProductionActions(order("CANCELLED"), can("WAREHOUSE_MANAGER"))).toEqual([]);
  });
  it("PRODUCTION_STAFF: prepress + hold on PENDING_PREPRESS, but no cancel / split (APPROVE)", () => {
    expect(allowedProductionActions(order("PENDING_PREPRESS"), can("PRODUCTION_STAFF"))).toEqual([
      "prepress",
      "hold",
    ]);
  });
  it("WAREHOUSE_MANAGER on ON_HOLD after PRINTING: resume + stop (+ split on raw ON_HOLD), not cancel (eff = PRINTING)", () => {
    const held = order(
      "ON_HOLD",
      { holdReason: "MACHINE_DOWN" },
      {
        history: [
          { toStatus: "PRINTING", changedAt: "2026-10-14T03:00:00Z" },
          { fromStatus: "PRINTING", toStatus: "ON_HOLD", changedAt: "2026-10-14T04:00:00Z" },
        ],
      },
    );
    expect(effectiveStatus(held)).toBe("PRINTING");
    expect(allowedProductionActions(held, can("WAREHOUSE_MANAGER"))).toEqual([
      "resume",
      "stop",
      "split",
    ]);
  });
  it("BR-PRD-11/12: only a root in-house ORDER can be split; a SAMPLE or a child cannot", () => {
    expect(allowedProductionActions(order("READY"), can("WAREHOUSE_MANAGER"))).toContain("split");
    expect(
      allowedProductionActions(order("READY", { type: "SAMPLE" }), can("WAREHOUSE_MANAGER")),
    ).not.toContain("split");
    expect(
      allowedProductionActions(order("READY", { parentId: "p" }), can("WAREHOUSE_MANAGER")),
    ).not.toContain("split");
  });
  it("derived quantities follow the BE formulas", () => {
    const o = order("QC", { goodQuantity: 600 }, { issuedQuantity: 800, printedQuantity: 700 });
    expect(blanksStillNeeded(o)).toBe(300); // 1000 − 600 − (800 − 700)
    expect(awaitingQc(o, [{ id: "r", round: 1, passed: 450, failed: 10, inspectedAt: "x" }])).toBe(
      150,
    );
  });
});

describe("subcontract recovery (QA2)", () => {
  const sub = (status: string) =>
    order(
      status,
      { mode: "SUBCONTRACTED", parentId: "p-1" },
      {
        subcontract: {
          method: "SUPPLIED_BLANKS",
          subcontractorId: "s-1",
          unitPrice: 800,
          currency: "VND",
        },
      },
    );
  it("WAREHOUSE_MANAGER on SUBCONTRACTED: recall + take in-house + supplement", () => {
    expect(allowedSubcontractRecovery(sub("SUBCONTRACTED"), can("WAREHOUSE_MANAGER"))).toEqual([
      "recall",
      "inHouse",
      "supplement",
    ]);
  });
  it("WAREHOUSE_STAFF may only recall blanks; in-house LSX gets nothing; terminal gets nothing", () => {
    expect(allowedSubcontractRecovery(sub("SUBCONTRACTED"), can("WAREHOUSE_STAFF"))).toEqual([
      "recall",
    ]);
    expect(allowedSubcontractRecovery(order("READY"), can("WAREHOUSE_MANAGER"))).toEqual([]);
    expect(allowedSubcontractRecovery(sub("COMPLETED"), can("WAREHOUSE_MANAGER"))).toEqual([]);
  });
});

describe("production detail — real role gating", () => {
  const routes = (o: ProductionDetail) => ({
    get: {
      "/production/orders/po-1": () => o,
      "/production/orders/po-1/print-file": () => ({
        artifactId: "a",
        originalName: "logo.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048,
        checksum: "abc123",
        url: "https://files.example.com/x",
        expiresAt: "2026-10-14T05:00:00Z",
      }),
      "/production/orders/po-1/scrap": () => [],
      "/production/orders/po-1/material-issues": () => [],
      "/production/orders/po-1/qc-results": () => [],
    },
  });

  it("QC_STAFF on QC: QC form with exact-sum validation, no other action", async () => {
    const o = order("QC", { goodQuantity: 100 }, { issuedQuantity: 100, printedQuantity: 100 });
    const api = mockApi("QC_STAFF", {
      ...routes(o),
      post: { "/production/orders/po-1/qc-results": () => ({}) },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    const passed = await screen.findByLabelText(/^Đạt/);
    expect(screen.queryByRole("button", { name: "Tạm dừng" })).not.toBeInTheDocument();
    await userEvent.type(passed, "90");
    await userEvent.click(screen.getByRole("button", { name: "Ghi kết quả QC" }));
    expect(await screen.findByText("Đạt + lỗi phải bằng 100 cái đang chờ QC")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^Lỗi/));
    await userEvent.type(screen.getByLabelText(/^Lỗi/), "10");
    await userEvent.click(screen.getByRole("button", { name: "Ghi kết quả QC" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/production/orders/po-1/qc-results", {
        passed: 90,
        failed: 10,
      }),
    );
  });

  it("WAREHOUSE_STAFF on READY: scan issue with an idempotent requestId, no prepress", async () => {
    const api = mockApi("WAREHOUSE_STAFF", {
      ...routes(order("READY")),
      get: {
        ...routes(order("READY")).get,
        // Chưa giữ phôi nào → lần xuất tới để BE giữ + chuyển, không có vị trí nguồn để quét.
        "/production/orders/po-1/material-issues/pending": () => ({
          productionOrderId: "po-1",
          orderNumber: "LSX-20261014-0001",
          status: "READY",
          blankSku: "CUP-PAPER-12OZ",
          required: 1000,
          issued: 0,
          outstanding: 1000,
          holds: [],
        }),
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
      post: {
        "/production/orders/po-1/material-issues": () => ({
          issue: {
            id: "i",
            requestId: "r",
            sku: "CUP-PAPER-12OZ",
            fromLocation: "A",
            toLocation: "HCM-PRD01",
            quantity: 1000,
            issuedAt: "2026-10-14T03:00:00Z",
          },
          order: order("MATERIAL_ISSUED"),
        }),
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    await screen.findByRole("option", { name: /HCM-PRD01/ });
    const location = screen.getByLabelText(/Khu sản xuất nhận phôi/);
    expect(screen.queryByRole("button", { name: "Kiểm tra prepress" })).not.toBeInTheDocument();
    await userEvent.selectOptions(location, "HCM-PRD01");
    await userEvent.click(screen.getByRole("button", { name: /Xuất phôi/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/production/orders/po-1/material-issues",
        expect.objectContaining({
          toLocation: "HCM-PRD01",
          requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      ),
    );
  });

  it("PRODUCTION_STAFF on PENDING_PREPRESS: FAIL prepress requires a note before posting", async () => {
    const api = mockApi("PRODUCTION_STAFF", {
      ...routes(order("PENDING_PREPRESS")),
      post: { "/production/orders/po-1/prepress": () => order("ON_HOLD") },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "PRODUCTION_STAFF");
    expect(await screen.findByRole("link", { name: /Mở \/ tải file in/ })).toHaveAttribute(
      "href",
      "https://files.example.com/x",
    );
    await userEvent.click(await screen.findByRole("button", { name: "Kiểm tra prepress" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Không đạt" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Xác nhận không đạt" }));
    expect(await within(dialog).findByText("Ghi rõ lý do không đạt")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("SALES_STAFF (read only): sees the order, no workshop action", async () => {
    mockApi("SALES_STAFF", routes(order("PRINTING")));
    renderScreen(<ProductionDetailView id="po-1" />, "SALES_STAFF");
    expect(
      await screen.findByRole("heading", { name: "LSX LSX-20261014-0001" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ghi sản lượng" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạm dừng" })).not.toBeInTheDocument();
  });
});
