import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { PortalQuoteDetail, QuoteDetail, QuoteList } from "..";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const line = {
  id: "l-1",
  lineNo: 1,
  blankSku: "CUP-PAPER-12OZ",
  designSnapshotId: "5f1a2b3c-0000-4000-8000-000000000001",
  quantity: 1200,
  priced: true,
  moq: 1000,
  tiers: [{ minQuantity: 1000, unitPrice: 2500 }],
  proposedUnitPrice: 2500,
  proposedLineTotal: 3000000,
  sample: { satisfied: true, approvedSampleId: "s-1", reorder: false },
};
const quote = (status: string, extra: Record<string, unknown> = {}) => ({
  id: "q-1",
  quoteNumber: "QT-20261014-0001",
  customerId: "c-1",
  status,
  revision: 1,
  paymentTerm: "DEPOSIT",
  depositPercent: 30,
  validUntil: "2099-12-31T16:59:59Z",
  lines: [line],
  priced: true,
  proposedTotal: 3000000,
  history: [{ revision: 1, toStatus: "DRAFT", changedAt: "2026-10-14T02:00:00Z" }],
  createdAt: "2026-10-14T02:00:00Z",
  version: 3,
  ...extra,
});
const customer = {
  customerId: "c-1",
  fullName: "Công ty Bao Bì Xanh",
  email: "a@example.com",
  status: "ACTIVE",
};

afterEach(() => vi.restoreAllMocks());

describe("Quote back office", () => {
  it("list: real rows, customer name lookup, status filter sent as repeated params", async () => {
    const api = mockApi("SALES_STAFF", {
      get: {
        "/quotes": () =>
          bePage([
            {
              id: "q-1",
              quoteNumber: "QT-20261014-0001",
              customerId: "c-1",
              status: "SENT",
              revision: 2,
              paymentTerm: "PREPAID",
              validUntil: "2099-12-31T16:59:59Z",
              createdAt: "2026-10-14T02:00:00Z",
              version: 1,
            },
          ]),
        "/customers/c-1": () => customer,
      },
    });
    renderScreen(<QuoteList />, "SALES_STAFF", "?status=SENT&customerId=c-1");
    expect(await screen.findByRole("link", { name: "QT-20261014-0001" })).toHaveAttribute(
      "href",
      "/admin/quotes/q-1",
    );
    expect(await screen.findAllByText("Công ty Bao Bì Xanh")).not.toHaveLength(0);
    const params = api.get.mock.calls.find((call) => call[0] === "/quotes")?.[1] as {
      params: URLSearchParams;
    };
    expect(params.params.getAll("status")).toEqual(["SENT"]);
    expect(params.params.get("customerId")).toBe("c-1");
  });

  it("SALES_STAFF on DRAFT: send posts {version}; cancel requires a reason", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/quotes/q-1": () => quote("DRAFT"), "/customers/c-1": () => customer },
      post: { "/quotes/q-1/sending": () => quote("SENT", { version: 4 }) },
    });
    renderScreen(<QuoteDetail id="q-1" />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi khách" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/quotes/q-1/sending", { version: 3 }),
    );
    expect(screen.getByRole("button", { name: "Huỷ báo giá" })).toBeInTheDocument();
  });

  it("ORDER_COORDINATOR (READ+UPDATE, no CREATE): may convert an accepted quote, sees no create button", async () => {
    mockApi("ORDER_COORDINATOR", {
      get: { "/quotes/q-1": () => quote("ACCEPTED", { acceptedTotal: 3000000 }) },
    });
    renderScreen(<QuoteDetail id="q-1" />, "ORDER_COORDINATOR");
    expect(await screen.findByRole("button", { name: "Tạo đơn bán" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gửi khách/ })).not.toBeInTheDocument();
  });

  it("stale version (409 OPTIMISTIC_LOCK) shows the Vietnamese message and refetches", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/quotes/q-1": () => quote("DRAFT"), "/customers/c-1": () => customer },
      post: {
        "/quotes/q-1/sending": () => {
          throw apiError(409, "OPTIMISTIC_LOCK");
        },
      },
    });
    const toastError = vi.spyOn(toast, "error");
    renderScreen(<QuoteDetail id="q-1" />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Gửi khách" }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Người khác vừa thay đổi bản ghi này/),
      ),
    );
    await waitFor(() =>
      expect(api.get.mock.calls.filter((call) => call[0] === "/quotes/q-1").length).toBeGreaterThan(
        1,
      ),
    );
  });
});

describe("Quote customer portal", () => {
  it("CUSTOMER on SENT: accept is blocked with a reason while a design still needs sample approval", async () => {
    mockApi("CUSTOMER", {
      get: {
        "/quotes/q-1": () =>
          quote("SENT", { lines: [{ ...line, sample: { satisfied: false, reorder: false } }] }),
      },
    });
    renderScreen(<PortalQuoteDetail id="q-1" />, "CUSTOMER");
    expect(await screen.findByText("Cần duyệt mẫu in trước khi chấp nhận")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chấp nhận báo giá" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Yêu cầu chỉnh sửa" })).toBeEnabled();
  });

  it("CUSTOMER accepts with a changed quantity → only the changed line is sent", async () => {
    const api = mockApi("CUSTOMER", {
      get: { "/quotes/q-1": () => quote("SENT") },
      post: { "/quotes/q-1/acceptance": () => quote("ACCEPTED", { version: 4 }) },
    });
    renderScreen(<PortalQuoteDetail id="q-1" />, "CUSTOMER");
    const qty = await screen.findByLabelText(/Dòng 1/);
    await userEvent.clear(qty);
    await userEvent.type(qty, "1500");
    await userEvent.click(screen.getByRole("button", { name: "Chấp nhận báo giá" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Chấp nhận" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/quotes/q-1/acceptance", {
        version: 3,
        lines: [{ lineId: "l-1", quantity: 1500 }],
      }),
    );
  });

  it("CUSTOMER on a non-visible quote (BE 404) gets not-found, not a fake quote", async () => {
    mockApi("CUSTOMER", {
      get: {
        "/quotes/q-1": () => {
          throw apiError(404, "NOT_FOUND");
        },
      },
    });
    renderScreen(<PortalQuoteDetail id="q-1" />, "CUSTOMER");
    expect(await screen.findByText("Không tìm thấy báo giá")).toBeInTheDocument();
  });
});
