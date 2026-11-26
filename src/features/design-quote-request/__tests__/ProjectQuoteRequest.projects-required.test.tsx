import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";
import "@/test/jsdom-popover";

import { ProjectQuoteRequestList } from "..";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const REQUEST_ID = "0q000000-0000-7000-8000-000000000002";
const CUSTOMER_ID = "0c000000-0000-7000-8000-000000000009";
const LIST = "/design-project-quote-requests";
const CLOSURE = `${LIST}/${REQUEST_ID}/closure`;

/** BE #451: a project request over a design approved and one returned for changes. */
function projectRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    projectId: "0p000000-0000-7000-8000-000000000001",
    projectName: "Bộ ly Tết",
    customerId: CUSTOMER_ID,
    customerName: "Cửa hàng Trà Sen",
    requestedBy: CUSTOMER_ID,
    requestedAt: "2026-11-19T03:00:00Z",
    status: "OPEN",
    approvedCount: 1,
    lineCount: 2,
    lines: [
      {
        designId: "0d000000-0000-7000-8000-000000000001",
        designName: "Ly A",
        designStatus: "APPROVED",
        customerSku: "TRASEN-CUP-01",
        cartons: 10,
      },
      {
        designId: "0d000000-0000-7000-8000-000000000002",
        designName: "Ly B",
        designStatus: "DRAFT",
        cartons: 5,
        returnReason: "Logo sát mép",
      },
    ],
    ...overrides,
  };
}

async function openClose(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Thao tác khác — Bộ ly Tết" }));
  const menu = await screen.findByRole("dialog");
  await user.click(within(menu).getByRole("button", { name: "Đóng — Bộ ly Tết" }));
  return screen.findByRole("dialog", { name: "Đóng yêu cầu báo giá?" });
}

describe("Yêu cầu báo giá dự án (BE #451)", () => {
  it("shows each line's design status, its return reason and 'Đã duyệt x/y'", async () => {
    mockApi("SALES_STAFF", { get: { [LIST]: () => bePage([projectRequest()]) } });
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");

    expect(await screen.findByText("Đã duyệt 1/2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lý do trả lại — Ly B: Logo sát mép" }),
    ).toBeInTheDocument();
  });

  it("closing asks for a reason and sends it: nothing is sent without one", async () => {
    vi.spyOn(toast, "success").mockImplementation(() => undefined);
    const api = mockApi("SALES_STAFF", {
      get: { [LIST]: () => bePage([projectRequest()]) },
      post: { [CLOSURE]: () => null },
    });
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");
    const user = userEvent.setup();
    const dialog = await openClose(user);

    await user.click(within(dialog).getByRole("button", { name: "Đóng" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nhập lý do đóng");
    expect(api.post).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Lý do đóng"), "  Khách chưa sửa Ly B  ");
    await user.click(within(dialog).getByRole("button", { name: "Đóng" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(CLOSURE, { reason: "Khách chưa sửa Ly B" }),
    );
  });

  it("a request Sales closed shows the reason the customer reads", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [LIST]: () =>
          bePage([
            projectRequest({
              status: "CLOSED",
              closedOutcome: "CLOSED_BY_STAFF",
              closeReason: "Đã thống nhất qua điện thoại",
            }),
          ]),
      },
    });
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");
    expect(await screen.findByText("Lý do đóng: Đã thống nhất qua điện thoại")).toBeInTheDocument();
  });

  it("a quote refused for unapproved designs names them", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => undefined);
    const approvedRow = projectRequest({
      approvedCount: 2,
      lines: [
        {
          designId: "0d000000-0000-7000-8000-000000000001",
          designName: "Ly A",
          designStatus: "APPROVED",
          customerSku: "TRASEN-CUP-01",
          cartons: 10,
        },
        {
          designId: "0d000000-0000-7000-8000-000000000002",
          designName: "Ly B",
          designStatus: "APPROVED",
          customerSku: "TRASEN-CUP-02",
          cartons: 5,
        },
      ],
    });
    mockApi("SALES_STAFF", {
      get: { [LIST]: () => bePage([approvedRow]) },
      post: {
        [`${LIST}/${REQUEST_ID}/quote`]: () => {
          throw apiError(409, "DESIGN_NOT_APPROVED", undefined, "x", {
            designIds: ["0d000000-0000-7000-8000-000000000002"],
          });
        },
      },
    });
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: /^Lập báo giá — / }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("Chưa lập báo giá được: còn thiết kế chưa duyệt (Ly B)."),
    );
  });
});
