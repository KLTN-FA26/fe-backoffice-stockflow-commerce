/** Rà UI WF-02 2026-11-27 (bo-01 … bo-05): "Đã chờ", nút "Lập báo giá" trên dòng, link tên dự án, header không UUID. */
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";
import "@/test/jsdom-popover";

import { DesignQuoteRequestList, ProjectQuoteRequestDetail, ProjectQuoteRequestList } from "..";
import { waitingOf } from "../selectors";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/design-quote-requests",
}));

const NOW = new Date("2026-11-22T03:00:00Z");
const REQUEST_ID = "0q000000-0000-7000-8000-000000000003";
const CUSTOMER_ID = "0c000000-0000-7000-8000-000000000009";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

const designRequest = (overrides: Record<string, unknown> = {}) => ({
  id: REQUEST_ID,
  designId: "0d000000-0000-7000-8000-000000000003",
  designName: "Túi giấy kraft in logo — bản dài để thử cắt chữ",
  designStatus: "APPROVED",
  customerId: CUSTOMER_ID,
  customerName: "Cửa hàng Trà Sen",
  sku: "BAG-KRAFT",
  customerSku: "TRASEN-BAG-01",
  cartons: 50,
  status: "OPEN",
  requestedBy: CUSTOMER_ID,
  requestedAt: "2026-11-19T03:00:00Z",
  ...overrides,
});

const projectRequest = (overrides: Record<string, unknown> = {}) => ({
  id: REQUEST_ID,
  projectId: "0p000000-0000-7000-8000-000000000003",
  projectName: "Bộ ly Tết",
  customerId: CUSTOMER_ID,
  customerName: "Cửa hàng Trà Sen",
  requestedBy: CUSTOMER_ID,
  requestedAt: "2026-11-21T22:00:00Z",
  status: "OPEN",
  approvedCount: 1,
  lineCount: 1,
  lines: [
    {
      designId: "0d000000-0000-7000-8000-000000000004",
      designName: "Ly A",
      designStatus: "APPROVED",
      customerSku: "TRASEN-CUP-01",
      cartons: 10,
    },
  ],
  ...overrides,
});

describe("waitingOf", () => {
  it("counts from the request time and grows amber after a day, red after three", () => {
    const at = (iso: string) => waitingOf({ status: "OPEN", requestedAt: iso }, NOW);
    expect(at("2026-11-22T02:59:30Z")).toEqual({ label: "Vừa gửi", level: "normal" });
    expect(at("2026-11-22T00:00:00Z")).toEqual({ label: "Đã chờ 3 giờ", level: "normal" });
    expect(at("2026-11-20T03:00:00Z")).toEqual({ label: "Đã chờ 2 ngày", level: "warn" });
    expect(at("2026-11-19T03:00:00Z")).toEqual({ label: "Đã chờ 3 ngày", level: "long" });
  });

  it("a closed request is not waiting", () => {
    expect(waitingOf({ status: "CLOSED", requestedAt: "2026-11-01T00:00:00Z" }, NOW)).toBeNull();
  });
});

describe("Hộp yêu cầu báo giá — bố cục 1440px", () => {
  it("shows how long an open request has waited, and 'Lập báo giá' on the row", async () => {
    mockApi("SALES_STAFF", { get: { "/design-quote-requests": () => bePage([designRequest()]) } });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    const waited = await screen.findByText("Đã chờ 3 ngày");
    expect(waited.className).toContain("text-danger");
    expect(
      screen.getByRole("button", {
        name: "Lập báo giá — Túi giấy kraft in logo — bản dài để thử cắt chữ",
      }),
    ).toBeEnabled();
    // SKU riêng ở dòng phụ dưới tên thiết kế, không chiếm một cột.
    expect(screen.getByText("TRASEN-BAG-01")).toBeInTheDocument();
  });

  it("project tab: the project name links to the request page", async () => {
    mockApi("SALES_STAFF", {
      get: { "/design-project-quote-requests": () => bePage([projectRequest()]) },
    });
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");
    const link = await screen.findByRole("link", { name: "Bộ ly Tết" });
    expect(link.getAttribute("href")).toContain(REQUEST_ID);
    expect(screen.getByText("Đã chờ 5 giờ")).toBeInTheDocument();
  });

  it("project request page: no raw id in the header, 'Lập báo giá' is the main button", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/design-project-quote-requests": () => bePage([projectRequest()]),
        "/designs/0d000000-0000-7000-8000-000000000004": () => ({
          id: "0d000000-0000-7000-8000-000000000004",
          name: "Ly A",
        }),
      },
    });
    renderScreen(
      <ProjectQuoteRequestDetail requestId={REQUEST_ID} />,
      "SALES_STAFF",
      `?customer=${CUSTOMER_ID}`,
    );
    expect(await screen.findByRole("heading", { name: "Bộ ly Tết" })).toBeInTheDocument();
    expect(screen.queryByText(/0q000000/)).toBeNull();
    expect(screen.getByLabelText("Yêu cầu gửi ngày 22/11/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lập báo giá — Bộ ly Tết" })).toBeEnabled();
    expect(await screen.findByText("Chưa có ảnh xem trước")).toBeInTheDocument();
  });
});
