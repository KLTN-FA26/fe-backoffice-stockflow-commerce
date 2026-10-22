import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { QuoteEdit } from "..";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const SNAPSHOT = "5f1a2b3c-0000-4000-8000-000000000001";
const CUSTOMER = "5f1a2b3c-0000-4000-8000-0000000000c1";
const DRAFT = {
  id: "q-1",
  quoteNumber: "QT-20261014-0001",
  customerId: CUSTOMER,
  status: "DRAFT",
  revision: 1,
  paymentTerm: "PREPAID",
  validUntil: "2099-12-31T16:59:59Z",
  lines: [
    {
      id: "l-1",
      lineNo: 1,
      blankSku: "CUP-PAPER-12OZ",
      designSnapshotId: SNAPSHOT,
      quantity: 1200,
      priced: true,
      moq: 1000,
      tiers: [{ minQuantity: 1000, unitPrice: 2500 }],
      proposedUnitPrice: 2500,
      proposedLineTotal: 3000000,
      sample: { satisfied: true, approvedSampleId: "s-1", reorder: false },
    },
  ],
  priced: true,
  proposedTotal: 3000000,
  history: [{ revision: 1, toStatus: "DRAFT", changedAt: "2026-10-14T02:00:00Z" }],
  createdAt: "2026-10-14T02:00:00Z",
  version: 3,
};

describe("QuoteEdit — PR #70 review: hidden price tiers never block saving", () => {
  it("a blank tier added, then 'Theo bảng giá' ticked → saves without tiers (BE prices from the list)", async () => {
    const api = mockApi("SALES_STAFF", {
      get: {
        "/quotes/q-1": () => DRAFT,
        [`/customers/${CUSTOMER}`]: () => ({
          customerId: CUSTOMER,
          fullName: "Công ty Bao Bì Xanh",
          email: "a@example.com",
          status: "ACTIVE",
        }),
        "/design-snapshots": () => bePage([]),
        [`/design-snapshots/${SNAPSHOT}/preview`]: () => {
          throw apiError(404, "NOT_FOUND");
        },
        [`/catalog/customer-prices/${CUSTOMER}/CUP-PAPER-12OZ/schedule`]: () => {
          throw apiError(404, "PRICE_NOT_AVAILABLE");
        },
      },
      put: { "/quotes/q-1": () => DRAFT },
    });
    renderScreen(<QuoteEdit id="q-1" />, "SALES_STAFF");

    await userEvent.click(await screen.findByRole("button", { name: /Thêm bậc giá/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Theo bảng giá/ }));
    expect(screen.queryByRole("button", { name: /Thêm bậc giá/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Lưu báo giá" }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = api.put.mock.calls[0];
    expect(url).toBe("/quotes/q-1");
    expect(body).toMatchObject({ version: 3, paymentTerm: "PREPAID" });
    expect((body as { lines: Record<string, unknown>[] }).lines[0]).not.toHaveProperty("tiers");
  });
});
