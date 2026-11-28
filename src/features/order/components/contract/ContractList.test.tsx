import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { CONTRACT_ESIGN_PATHS as P } from "@/constants/contract-esign";
import { SALES_OWNER_PERMISSIONS } from "@/constants/sales-owner";

import { ApiError } from "@/lib/api/error";

import { contractDraft } from "../../__fixtures__/contract";
import { mockOrderApiGet, renderOrderScreen } from "../../__fixtures__/render";

import { ContractList } from "./ContractList";

const ROW = {
  orderId: contractDraft.orderId,
  contractId: contractDraft.id,
  contractNumber: contractDraft.contractNumber,
  orderNumber: contractDraft.orderNumber,
  customerName: contractDraft.buyer.name,
  status: "CUSTOMER_SIGNED",
  totalAmount: contractDraft.totals.totalAmount,
  overdueToSign: true,
  termsReview: "PENDING",
};
const PAGE = {
  items: [ROW],
  page: 0,
  size: 15,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("contracts list", () => {
  it("reads filters from URL, keeps headers on empty results, and resets server filters", async () => {
    const params: URLSearchParams[] = [];
    mockOrderApiGet([SALES_CONTRACT_PERMISSIONS.read], {
      [P.list]: (query) => {
        if (query) params.push(query);
        return query?.get("q") ? { ...PAGE, items: [], totalElements: 0 } : PAGE;
      },
    });
    renderOrderScreen(
      <ContractList />,
      "?q=missing&mine=true&status=CUSTOMER_SIGNED&termsReview=PENDING",
    );
    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Hợp đồng / Đơn hàng" })).toBeInTheDocument();
    expect(params[0]?.get("mine")).toBe("true");
    expect(params[0]?.getAll("status")).toEqual(["CUSTOMER_SIGNED"]);
    await userEvent.click(screen.getByRole("button", { name: "Bỏ bộ lọc" }));
    const link = await screen.findByRole("link", { name: contractDraft.contractNumber });
    expect(link).toHaveAttribute("href", expect.stringContaining(contractDraft.orderId));
    expect(screen.getByText("Khách đã ký")).toBeInTheDocument();
    await waitFor(() => expect(params.at(-1)?.has("mine")).toBe(false));
  });
  it("sends search, owner, pending review and deadline filters and loads summary on demand", async () => {
    const params: URLSearchParams[] = [];
    const get = mockOrderApiGet([SALES_CONTRACT_PERMISSIONS.read, SALES_OWNER_PERMISSIONS.read], {
      [P.list]: (query) => {
        if (query) params.push(query);
        return PAGE;
      },
      "/customers/sales-agents": () => [{ userId: "sales-one", name: "Người phụ trách" }],
      [P.summary]: () => ({ byStatus: { CUSTOMER_SIGNED: 1 }, awaitingCompanySignature: 1 }),
    });
    renderOrderScreen(<ContractList />);
    await screen.findByRole("link", { name: contractDraft.contractNumber });
    expect(get.mock.calls.some(([path]) => path === P.summary)).toBe(false);
    await userEvent.type(
      screen.getByPlaceholderText("Tìm mã hợp đồng, đơn hàng, khách hàng…"),
      "HD",
    );
    await waitFor(() => expect(params.at(-1)?.get("q")).toBe("HD"));
    await userEvent.click(screen.getByRole("checkbox", { name: "Chờ duyệt điều khoản" }));
    await waitFor(() => expect(params.at(-1)?.get("termsReview")).toBe("PENDING"));
    await userEvent.click(screen.getByRole("checkbox", { name: "Sắp hết hạn ký (7 ngày)" }));
    await waitFor(() => expect(params.at(-1)?.get("signByBefore")).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    await userEvent.click(screen.getByRole("button", { name: "Hiện thống kê" }));
    expect(await screen.findByText("Chờ công ty ký")).toBeInTheDocument();
    const owner = screen.getByRole("combobox", { name: "Sale phụ trách" });
    await userEvent.type(owner, "Người");
    await userEvent.click(await screen.findByRole("option", { name: "Người phụ trách" }));
    await waitFor(() => expect(params.at(-1)?.get("salesOwnerId")).toBe("sales-one"));
  });
  it.each([400, 403, 404, 405])("keeps unsupported lists contained (%s)", async (status) => {
    mockOrderApiGet([SALES_CONTRACT_PERMISSIONS.read], {
      [P.list]: () => {
        throw new ApiError(status, "HTTP", "English backend error");
      },
    });
    renderOrderScreen(<ContractList />);
    expect(await screen.findByText("Chức năng này chưa khả dụng.")).toBeInTheDocument();
    expect(screen.queryByText("English backend error")).not.toBeInTheDocument();
  });
});
