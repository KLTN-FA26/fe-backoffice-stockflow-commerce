import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNTANT_GRANTS,
  MANAGER_GRANTS,
  PAGE_ONLY_GRANTS,
  bePage,
  listItemJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "../__fixtures__/screen";
import { EInvoiceList } from "../components/EInvoiceList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/invoicing/einvoices",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const draft = listItemJson();
const overdue = listItemJson({ id: "einv-2", code: "HDDT-0002", overdue: true });
const issued = listItemJson({
  id: "einv-3",
  code: "HDDT-0003",
  status: "ISSUED",
  templateCode: "1",
  symbol: "C26TAA",
  invoiceNumber: 42,
  issuedAt: "2026-11-11T03:00:00Z",
});
const routes = (items: unknown[] = [draft, overdue, issued]) => ({
  get: { "/einvoices": () => bePage(items) },
});

describe("EInvoiceList (docs 21 §4.1–4.2)", () => {
  it("shows each invoice with its reference, buyer, totals and status; issued ones by their number", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, routes());
    renderEInvoiceScreen(<EInvoiceList />);
    const row = (await screen.findByText("1C26TAA-0000042")).closest("tr")!;
    expect(within(row).getByText("Đã phát hành")).toBeInTheDocument();
    expect(screen.getAllByText("Nháp")).toHaveLength(2);
    expect(screen.getAllByText("CÔNG TY TNHH CÀ PHÊ SÀI GÒN XƯA").length).toBeGreaterThan(0);
  });

  it("flags drafts and overdue invoices for the accountant and marks the overdue deadline", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, routes());
    renderEInvoiceScreen(<EInvoiceList />);
    const late = (await screen.findByText("HDDT-0002")).closest("tr")!;
    expect(late).toHaveAttribute("data-flagged", "true");
    expect(within(late).getByLabelText("Quá hạn phát hành")).toBeInTheDocument();
    const done = screen.getByText("1C26TAA-0000042").closest("tr")!;
    expect(done).not.toHaveAttribute("data-flagged");
  });

  it("sends the URL filters to the BE; the overdue box sends dueBefore", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, routes([overdue]));
    renderEInvoiceScreen(
      <EInvoiceList />,
      "?status=DRAFT&type=ORIGINAL&issuedFrom=2026-11-01&overdue=true&orderId=ord-13",
    );
    await screen.findByText("HDDT-0002");
    const params = api.get.mock.calls.find(([url]) => url === "/einvoices")?.[1] as {
      params: URLSearchParams;
    };
    expect(Object.fromEntries(params.params)).toMatchObject({
      status: "DRAFT",
      type: "ORIGINAL",
      issuedFrom: "2026-11-01",
      orderId: "ord-13",
      page: "0",
    });
    expect(params.params.get("dueBefore")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
    expect(screen.getByRole("button", { name: "Chờ phát hành" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("offers drawing a draft up only for an order, and only to who may create", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, routes());
    const { unmount } = renderEInvoiceScreen(<EInvoiceList />, "?orderId=ord-13");
    expect(await screen.findByRole("button", { name: /Lập nháp/ })).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();
    mockEInvoiceApi(MANAGER_GRANTS, routes());
    renderEInvoiceScreen(<EInvoiceList />, "?orderId=ord-13");
    await screen.findByText("HDDT-0002");
    expect(screen.queryByRole("button", { name: /Lập nháp/ })).not.toBeInTheDocument();
  });

  it("a user who may open the page but not read is told so, and nothing is requested", async () => {
    const api = mockEInvoiceApi(PAGE_ONLY_GRANTS, routes());
    renderEInvoiceScreen(<EInvoiceList />);
    expect(await screen.findByText(/chưa có quyền xem hoá đơn điện tử/)).toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === "/einvoices")).toBe(false);
  });

  it("empty list vs filtered-out list are two different messages", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, routes([]));
    const { unmount } = renderEInvoiceScreen(<EInvoiceList />);
    expect(await screen.findByText("Chưa có hoá đơn điện tử")).toBeInTheDocument();
    unmount();
    renderEInvoiceScreen(<EInvoiceList />, "?status=ISSUED");
    expect(await screen.findByRole("button", { name: /Bỏ bộ lọc/ })).toBeInTheDocument();
  });
});
