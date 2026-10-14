import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { ProductionDetailView } from "..";

import type { ProductionDetail } from "../types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

function order(status: string, rest: Partial<ProductionDetail> = {}): ProductionDetail {
  return {
    summary: {
      id: "po-1",
      orderNumber: "LSX-20261014-0003",
      type: "ORDER",
      mode: "IN_HOUSE",
      status: status as ProductionDetail["summary"]["status"],
      warehouseId: "wh-1",
      blankSku: "CUP-PAPER-12OZ",
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
    history: [{ toStatus: status, changedAt: "2026-10-14T02:00:00Z" }],
    ...rest,
  };
}

const PNG_FILE = {
  artifactId: "a",
  originalName: "logo-print.png",
  contentType: "image/png",
  sizeBytes: 4096,
  checksum: "abc123",
  url: "https://files.example.com/print.png",
  expiresAt: "2026-10-14T05:00:00Z",
};

const subRoutes = {
  "/production/orders/po-1/scrap": () => [],
  "/production/orders/po-1/material-issues": () => [],
  "/production/orders/po-1/qc-results": () => [],
};

describe("SCRUM-408 print file preview", () => {
  it("PRODUCTION_STAFF sees an inline preview, the content type and an open/download link", async () => {
    mockApi("PRODUCTION_STAFF", {
      get: {
        "/production/orders/po-1": () => order("PENDING_PREPRESS"),
        "/production/orders/po-1/print-file": () => PNG_FILE,
        ...subRoutes,
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "PRODUCTION_STAFF");
    const preview = await screen.findByRole("img", { name: "File in của LSX-20261014-0003" });
    expect(preview).toHaveAttribute("src", PNG_FILE.url);
    expect(screen.getByText("image/png")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mở \/ tải file in/ })).toHaveAttribute(
      "href",
      PNG_FILE.url,
    );
  });

  it("checksum mismatch (409 CONFLICT) → no link, Vietnamese integrity message", async () => {
    mockApi("PRODUCTION_STAFF", {
      get: {
        "/production/orders/po-1": () => order("PENDING_PREPRESS"),
        "/production/orders/po-1/print-file": () => {
          throw apiError(409, "CONFLICT");
        },
        ...subRoutes,
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "PRODUCTION_STAFF");
    expect(
      await screen.findByText(/File in không khớp checksum của thiết kế đã khoá/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mở \/ tải file in/ })).not.toBeInTheDocument();
  });

  it("a non-http link from the API is never rendered", async () => {
    mockApi("PRODUCTION_STAFF", {
      get: {
        "/production/orders/po-1": () => order("PENDING_PREPRESS"),
        "/production/orders/po-1/print-file": () => ({ ...PNG_FILE, url: "javascript:alert(1)" }),
        ...subRoutes,
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "PRODUCTION_STAFF");
    expect(await screen.findByText("Link file không hợp lệ — không mở.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("SCRUM-419 QC reference", () => {
  it("QC_STAFF on an ORDER LSX sees the locked design next to the form and the approved sample link", async () => {
    const o = order("QC", {
      approvedSampleId: "sr-1",
      issuedQuantity: 100,
      printedQuantity: 100,
    });
    o.summary.goodQuantity = 100;
    mockApi("QC_STAFF", {
      get: {
        "/production/orders/po-1": () => o,
        "/production/orders/po-1/print-file": () => PNG_FILE,
        ...subRoutes,
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    expect(
      await screen.findByRole("img", { name: "Thiết kế đã khoá của LSX-20261014-0003" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mở phiếu mẫu" })).toHaveAttribute(
      "href",
      "/admin/sample-requests/sr-1",
    );
    expect(screen.getByText(/Hệ thống chưa lưu ảnh của mẫu đã duyệt/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Đạt/)).toBeInTheDocument();
  });

  it("SCRUM-412: a non-PACKING hand-off location (BE 400) lands on the packing field, not a generic error", async () => {
    const o = order("QC", { issuedQuantity: 100, printedQuantity: 100 });
    o.summary.goodQuantity = 100;
    const api = mockApi("QC_STAFF", {
      get: {
        "/production/orders/po-1": () => o,
        "/production/orders/po-1/print-file": () => PNG_FILE,
        ...subRoutes,
      },
      post: {
        "/production/orders/po-1/qc-results": () => {
          throw apiError(400, "VALIDATION_FAILED");
        },
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    await userEvent.type(await screen.findByLabelText(/^Đạt/), "100");
    await userEvent.type(screen.getByLabelText(/Khu đóng gói nhận hàng/), "HCM-PRD01");
    await userEvent.click(screen.getByRole("button", { name: "Ghi kết quả QC" }));
    expect(
      await screen.findByText("Vị trí này không phải khu đóng gói (PACKING) đang dùng được."),
    ).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/production/orders/po-1/qc-results", {
      passed: 100,
      failed: 0,
      packingLocation: "HCM-PRD01",
    });
    expect(screen.queryByText(/Dữ liệu chưa hợp lệ/)).not.toBeInTheDocument();
  });
});

describe("SCRUM-410 blank issue scan", () => {
  const layout = {
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
  };

  it("a scan reports what moved and returns focus to the scan field", async () => {
    mockApi("WAREHOUSE_STAFF", {
      get: {
        "/production/orders/po-1": () => order("READY"),
        "/production/orders/po-1/print-file": () => PNG_FILE,
        ...subRoutes,
        ...layout,
      },
      post: {
        "/production/orders/po-1/material-issues": () => ({
          issue: {
            id: "i",
            requestId: "r",
            sku: "CUP-PAPER-12OZ",
            lotNumber: "LOT-7",
            fromLocation: "HCM-B01-1-B",
            toLocation: "HCM-PRD01",
            quantity: 400,
            issuedAt: "2026-10-14T03:00:00Z",
          },
          order: order("READY", { issuedQuantity: 400 }),
        }),
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    await screen.findByRole("option", { name: /HCM-PRD01/ });
    await userEvent.selectOptions(screen.getByLabelText(/Khu sản xuất nhận phôi/), "HCM-PRD01");
    await userEvent.click(screen.getByRole("button", { name: /Xuất phôi/ }));
    expect(await screen.findByText(/Đã xuất 400 phôi/)).toBeInTheDocument();
    expect(screen.getByText(/CUP-PAPER-12OZ · LOT-7/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Phiếu giữ phôi/)).toHaveFocus());
  });

  it("BR-PRD-03: over-issue (409 ISSUE_EXCEEDS_REQUIREMENT) is refused with a Vietnamese reason", async () => {
    mockApi("WAREHOUSE_STAFF", {
      get: {
        "/production/orders/po-1": () => order("READY"),
        "/production/orders/po-1/print-file": () => PNG_FILE,
        ...subRoutes,
        ...layout,
      },
      post: {
        "/production/orders/po-1/material-issues": () => {
          throw apiError(409, "ISSUE_EXCEEDS_REQUIREMENT");
        },
      },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "WAREHOUSE_STAFF");
    await screen.findByRole("option", { name: /HCM-PRD01/ });
    await userEvent.selectOptions(screen.getByLabelText(/Khu sản xuất nhận phôi/), "HCM-PRD01");
    await userEvent.click(screen.getByRole("button", { name: /Xuất phôi/ }));
    expect(
      await screen.findByText("Số phôi vượt quá số lệnh sản xuất còn cần (BR-PRD-03)."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Đã xuất .* phôi/)).not.toBeInTheDocument();
  });
});
