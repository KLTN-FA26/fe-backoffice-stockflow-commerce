import { screen } from "@testing-library/react";
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
