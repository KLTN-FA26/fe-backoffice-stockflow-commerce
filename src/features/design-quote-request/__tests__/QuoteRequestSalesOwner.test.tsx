import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";
import { SALES_OWNER_MANAGE as MANAGE, SALES_OWNER_READ as READ } from "@/test/sales-owner-screen";
import "@/test/jsdom-popover";

import { DesignQuoteRequestList, ProjectQuoteRequestList } from "..";
import { quoteRequestActions } from "../lifecycle";

import type { PermissionCode } from "@/lib/auth";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const REQUEST_ID = "0q000000-0000-7000-8000-000000000001";
const PROJECT_REQUEST_ID = "0q000000-0000-7000-8000-000000000002";
const CUSTOMER_ID = "0c000000-0000-7000-8000-000000000009";
const OWNER_URL = `/customers/${CUSTOMER_ID}/sales-owner`;
const OTHER_NAME = "Trần Văn Sales";
const BLOCKED = `Khách này do ${OTHER_NAME} phụ trách. Nhờ ${OTHER_NAME} hoặc Sales Manager.`;

const request = {
  id: REQUEST_ID,
  designId: "0d000000-0000-7000-8000-000000000001",
  designName: "Túi giấy kraft",
  designStatus: "APPROVED",
  customerId: CUSTOMER_ID,
  customerName: "Cửa hàng Trà Sen",
  sku: "BAG-KRAFT-M",
  customerSku: "TRASEN-BAG-01",
  cartons: 50,
  status: "OPEN",
  requestedBy: CUSTOMER_ID,
  requestedAt: "2026-11-19T03:00:00Z",
};
const projectRequest = {
  id: PROJECT_REQUEST_ID,
  projectId: "0p000000-0000-7000-8000-000000000001",
  projectName: "Bộ ly Tết",
  customerId: CUSTOMER_ID,
  customerName: "Cửa hàng Trà Sen",
  requestedBy: CUSTOMER_ID,
  requestedAt: "2026-11-19T03:00:00Z",
  status: "OPEN",
  lines: [
    {
      designId: "0d000000-0000-7000-8000-000000000001",
      designName: "Ly A",
      designStatus: "APPROVED",
      customerSku: "TRASEN-CUP-01",
      cartons: 10,
    },
  ],
};
const owned = (salesOwnerId: string, extra: Record<string, unknown> = {}) => ({
  customerId: CUSTOMER_ID,
  salesOwnerId,
  salesOwnerName: OTHER_NAME,
  active: true,
  state: "ASSIGNED",
  ...extra,
});

function renderDesignBox(
  ownerRoute: () => unknown,
  extra: readonly PermissionCode[] = [READ],
  post: Record<string, () => unknown> = {},
) {
  const api = mockApi(
    "SALES_STAFF",
    { get: { "/design-quote-requests": () => bePage([request]), [OWNER_URL]: ownerRoute }, post },
    { extra },
  );
  renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
  return api;
}

describe("Hộp yêu cầu báo giá — Sale phụ trách khách (KE-HOACH BR-S12, §10.2)", () => {
  it("§10.2: the row shows who owns the customer", async () => {
    renderDesignBox(() => owned("someone"));
    expect(await screen.findByText(`Sale phụ trách: ${OTHER_NAME}`)).toBeInTheDocument();
  });

  it("BR-S12: an owned customer of another Sales → no 'Lập báo giá' button on the row; the menu item is off with the reason", async () => {
    renderDesignBox(() => owned("someone"));
    await screen.findByText(`Sale phụ trách: ${OTHER_NAME}`);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Lập báo giá — Túi giấy kraft" }),
      ).not.toBeInTheDocument(),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Thao tác khác — Túi giấy kraft" }));
    const menu = await screen.findByRole("dialog");
    expect(within(menu).getByRole("button", { name: /^Lập báo giá/ })).toBeDisabled();
    expect(within(menu).getByText(BLOCKED)).toBeInTheDocument();
  });

  it("BR-S12: the owner creates the quote from the row", async () => {
    renderDesignBox(() => owned("u-test"));
    expect(
      await screen.findByRole("button", { name: "Lập báo giá — Túi giấy kraft" }),
    ).toBeEnabled();
  });

  it("BR-S07: the active cover creates the quote", async () => {
    renderDesignBox(() =>
      owned("someone", { cover: { userId: "u-test", name: "Test", until: "2099-12-05" } }),
    );
    await screen.findByText(/Sale phụ trách: /);
    expect(
      await screen.findByRole("button", { name: "Lập báo giá — Túi giấy kraft" }),
    ).toBeEnabled();
  });

  it("BR-S12: a Sales Manager creates the quote for any customer", async () => {
    renderDesignBox(() => owned("someone"), [READ, MANAGE]);
    await screen.findByText(`Sale phụ trách: ${OTHER_NAME}`);
    expect(
      await screen.findByRole("button", { name: "Lập báo giá — Túi giấy kraft" }),
    ).toBeEnabled();
  });

  it("BR-S12: an unowned customer → any Sales creates the quote", async () => {
    renderDesignBox(() => ({ customerId: CUSTOMER_ID, state: "UNASSIGNED" }));
    expect(await screen.findByText("Chưa có Sale phụ trách")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lập báo giá — Túi giấy kraft" })).toBeEnabled();
  });

  it("fallback: owner endpoint missing → the box works as before", async () => {
    renderDesignBox(() => {
      throw apiError(404, "NOT_FOUND");
    });
    expect(
      await screen.findByRole("button", { name: "Lập báo giá — Túi giấy kraft" }),
    ).toBeEnabled();
    expect(screen.queryByText(/Sale phụ trách/)).not.toBeInTheDocument();
  });

  it("BR-S12: BE 409 CUSTOMER_OWNED_BY_OTHER_SALES on 'Lập báo giá' → the Vietnamese sentence", async () => {
    const toastError = vi.spyOn(toast, "error");
    renderDesignBox(
      () => {
        throw apiError(404, "NOT_FOUND");
      },
      [READ],
      {
        [`/design-quote-requests/${REQUEST_ID}/quote`]: () => {
          throw apiError(409, "CUSTOMER_OWNED_BY_OTHER_SALES", undefined, "x", {
            salesOwnerName: OTHER_NAME,
          });
        },
      },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Lập báo giá — Túi giấy kraft" }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(BLOCKED));
    expect(push).not.toHaveBeenCalled();
  });

  it("§10.2: the project request inbox shows the owner too", async () => {
    mockApi(
      "SALES_STAFF",
      {
        get: {
          "/design-project-quote-requests": () => bePage([projectRequest]),
          [OWNER_URL]: () => owned("someone"),
        },
      },
      { extra: [READ] },
    );
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");
    expect(await screen.findByText(`Sale phụ trách: ${OTHER_NAME}`)).toBeInTheDocument();
  });

  it("BR-S12 (pure rule): the owner reason wins over the design reasons", () => {
    const can = () => true;
    const create = quoteRequestActions(
      { ...request, designStatus: "APPROVED" } as Parameters<typeof quoteRequestActions>[0],
      can,
      BLOCKED,
    ).find((action) => action.id === "create-quote");
    expect(create).toMatchObject({ enabled: false, hint: BLOCKED });
  });
});
