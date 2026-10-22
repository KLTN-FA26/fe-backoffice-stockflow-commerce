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

function qcOrder(rest: Partial<ProductionDetail> = {}, status = "QC"): ProductionDetail {
  return {
    summary: {
      id: "po-1",
      orderNumber: "LSX-20261014-0007",
      type: "ORDER",
      mode: "IN_HOUSE",
      status: status as ProductionDetail["summary"]["status"],
      warehouseId: "wh-1",
      blankSku: "CUP-PAPER-12OZ",
      designSnapshotId: "snap-1",
      plannedQuantity: 100,
      goodQuantity: 100,
      createdAt: "2026-10-14T02:00:00Z",
    },
    approvedSampleId: "sr-1",
    designChecksum: "abc123",
    issuedQuantity: 100,
    printedQuantity: 100,
    scrapQuantity: 0,
    version: 1,
    history: [{ toStatus: status, changedAt: "2026-10-14T02:00:00Z" }],
    ...rest,
  };
}

const PRINT_FILE = {
  artifactId: "a",
  originalName: "print.pdf",
  contentType: "application/pdf",
  sizeBytes: 4096,
  checksum: "abc123",
  url: "https://files.example.com/print.pdf",
  expiresAt: "2026-10-14T05:00:00Z",
};
const APPROVED = {
  productionOrderId: "po-1",
  productionOrderNumber: "LSX-20261014-0007",
  sampleRequestId: "sr-1",
  sampleRequestNumber: "SR-20261014-0002",
  round: 2,
  approvedAt: "2026-10-14T03:00:00Z",
  designSnapshotId: "snap-1",
  designChecksum: "abc123",
  sampleProductionOrderId: "po-s",
  sampleProductionOrderNumber: "LSX-20261014-0006",
  preview: {
    artifactId: "p",
    originalName: "logo-preview.png",
    contentType: "image/png",
    sizeBytes: 2048,
    checksum: "def456",
    url: "https://files.example.com/preview.png",
    expiresAt: "2026-10-14T05:00:00Z",
  },
};

function routes(
  o: ProductionDetail,
  approved: () => unknown,
  packing: () => unknown = () => ["HCM-PACK01"],
) {
  return {
    "/production/orders/po-1": () => o,
    "/production/orders/po-1/print-file": () => PRINT_FILE,
    "/production/orders/po-1/approved-sample": approved,
    "/production/orders/po-1/packing-locations": packing,
    "/production/orders/po-1/scrap": () => [],
    "/production/orders/po-1/material-issues": () => [],
    "/production/orders/po-1/qc-results": () => [],
  };
}

describe("SCRUM-418/419 approved sample beside the QC form", () => {
  it("QC_STAFF sees the picture the customer approved, the exact round and the sample LSX", async () => {
    mockApi("QC_STAFF", { get: routes(qcOrder(), () => APPROVED) });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    const img = await screen.findByRole("img", {
      name: "Mẫu khách đã duyệt SR-20261014-0002 lần 2",
    });
    expect(img).toHaveAttribute("src", APPROVED.preview.url);
    expect(screen.getByRole("link", { name: "SR-20261014-0002" })).toHaveAttribute(
      "href",
      "/admin/sample-requests/sr-1",
    );
    expect(screen.getByRole("link", { name: "LSX-20261014-0006" })).toHaveAttribute(
      "href",
      "/admin/production-orders/po-s",
    );
    expect(screen.getByText(/lần 2/)).toBeInTheDocument();
  });

  it("no CUSTOMER_PREVIEW in the bundle (preview null) → falls back to the locked print file, says so", async () => {
    mockApi("QC_STAFF", {
      get: routes(qcOrder(), () => ({ ...APPROVED, preview: null })),
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    expect(
      await screen.findByText(/Bộ thiết kế đã duyệt không có ảnh xem trước/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Mẫu khách đã duyệt/ })).not.toBeInTheDocument();
  });

  it("409 (round no longer approved) blocks with a danger notice — never shown as approved", async () => {
    mockApi("QC_STAFF", {
      get: routes(qcOrder(), () => {
        throw apiError(409, "CONFLICT");
      }),
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    expect(
      await screen.findByText(/Lần mẫu của lệnh không còn ở trạng thái đã duyệt/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Mẫu khách đã duyệt/ })).not.toBeInTheDocument();
  });

  it("a non-http preview link from the API is not rendered", async () => {
    mockApi("QC_STAFF", {
      get: routes(qcOrder(), () => ({
        ...APPROVED,
        preview: { ...APPROVED.preview, url: "javascript:alert(1)" },
      })),
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    expect(await screen.findByText("Link file không hợp lệ — không mở.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Mẫu khách đã duyệt/ })).not.toBeInTheDocument();
  });

  it("SALES_STAFF (no QC create) never loads the approved-sample link", async () => {
    const api = mockApi("SALES_STAFF", { get: routes(qcOrder(), () => APPROVED) });
    renderScreen(<ProductionDetailView id="po-1" />, "SALES_STAFF");
    expect(await screen.findByText(/hiện khi lệnh tới bước QC/)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith(
      "/production/orders/po-1/approved-sample",
      expect.anything(),
    );
  });
});

describe("SCRUM-412 automatic hand-over to PACKING", () => {
  it("one usable PACKING area → default, QC posts without a location (BE picks it)", async () => {
    const api = mockApi("QC_STAFF", {
      get: routes(qcOrder(), () => APPROVED),
      post: { "/production/orders/po-1/qc-results": () => ({}) },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    expect(await screen.findByRole("option", { name: "Mặc định: HCM-PACK01" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Đạt/), "100");
    await userEvent.click(screen.getByRole("button", { name: "Ghi kết quả QC" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/production/orders/po-1/qc-results", {
        passed: 100,
        failed: 0,
      }),
    );
  });

  it("several PACKING areas → only those are offered and one must be chosen", async () => {
    const api = mockApi("QC_STAFF", {
      get: routes(
        qcOrder(),
        () => APPROVED,
        () => ["HCM-PACK01", "HCM-PACK02"],
      ),
      post: { "/production/orders/po-1/qc-results": () => ({}) },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    const select = await screen.findByLabelText(/Khu đóng gói nhận hàng/);
    await screen.findByRole("option", { name: "HCM-PACK02" });
    expect(screen.queryByRole("option", { name: /PRD/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Đạt/), "100");
    await userEvent.click(screen.getByRole("button", { name: "Ghi kết quả QC" }));
    expect(await screen.findByText("Chọn khu đóng gói nhận hàng")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.selectOptions(select, "HCM-PACK02");
    await userEvent.click(screen.getByRole("button", { name: "Ghi kết quả QC" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/production/orders/po-1/qc-results", {
        passed: 100,
        failed: 0,
        packingLocation: "HCM-PACK02",
      }),
    );
  });

  it("no PACKING area: a short round is still recorded (back to READY), the completing one is blocked", async () => {
    const api = mockApi("QC_STAFF", {
      get: routes(
        qcOrder(),
        () => APPROVED,
        () => [],
      ),
      post: { "/production/orders/po-1/qc-results": () => ({}) },
    });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    expect(await screen.findByText(/chưa có khu đóng gói dùng được/)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Ghi kết quả QC" });
    await userEvent.type(screen.getByLabelText(/^Đạt/), "100");
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/^Đạt/));
    await userEvent.type(screen.getByLabelText(/^Đạt/), "99");
    await userEvent.clear(screen.getByLabelText(/^Lỗi/));
    await userEvent.type(screen.getByLabelText(/^Lỗi/), "1");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/production/orders/po-1/qc-results", {
        passed: 99,
        failed: 1,
      }),
    );
  });

  it("completed ORDER shows where the goods were handed over; no confirm button exists", async () => {
    const done = qcOrder({ completedAt: "2026-10-14T04:00:00Z" }, "COMPLETED");
    done.summary.packingLocation = "HCM-PACK01";
    mockApi("QC_STAFF", { get: routes(done, () => APPROVED) });
    renderScreen(<ProductionDetailView id="po-1" />, "QC_STAFF");
    expect(await screen.findByText(/tự động bàn giao sang khu đóng gói/)).toBeInTheDocument();
    expect(screen.getByText("HCM-PACK01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bàn giao/i })).not.toBeInTheDocument();
  });
});
