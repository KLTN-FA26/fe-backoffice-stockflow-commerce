import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ORDER_PERMISSIONS, SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { CONTRACT_ORDER_ID, contractDraft, contractOrderDto } from "../../__fixtures__/contract";
import { mockOrderApiGet, renderOrderScreen } from "../../__fixtures__/render";
import { toOrder } from "../../api";
import { orderDtoSchema } from "../../schemas";

import { OrderContractSection } from "./OrderContractSection";

import type { PermissionCode } from "@/lib/auth";

const READ: PermissionCode = "customer-sales-owners:READ";
const MANAGE: PermissionCode = "customer-sales-owners:UPDATE";
const SALES: PermissionCode[] = [
  ORDER_PERMISSIONS.viewPage,
  ORDER_PERMISSIONS.read,
  SALES_CONTRACT_PERMISSIONS.read,
  SALES_CONTRACT_PERMISSIONS.create,
  SALES_CONTRACT_PERMISSIONS.update,
  SALES_CONTRACT_PERMISSIONS.approve,
  READ,
];
const PATH = `/orders/${CONTRACT_ORDER_ID}/contract`;
const order = toOrder(orderDtoSchema.parse(contractOrderDto));
const OWNER_URL = `/customers/${order.customerId}/sales-owner`;
const OTHER_NAME = "Trần Văn Sales";
const BLOCKED = `Khách này do ${OTHER_NAME} phụ trách. Nhờ ${OTHER_NAME} hoặc Sales Manager.`;

const owner = (salesOwnerId: string, extra: Record<string, unknown> = {}) => ({
  customerId: order.customerId,
  salesOwnerId,
  salesOwnerName: OTHER_NAME,
  active: true,
  state: "ASSIGNED",
  version: 1,
  ...extra,
});
const noContract = () => {
  throw new ApiError(404, "SALES_CONTRACT_NOT_FOUND", "Đơn chưa có hợp đồng.");
};

function renderSection(
  contract: () => unknown,
  ownerRoute: () => unknown,
  permissions: PermissionCode[] = SALES,
) {
  mockOrderApiGet(permissions, { [PATH]: contract, [OWNER_URL]: ownerRoute });
  const can = (code: PermissionCode) => permissions.includes(code);
  renderOrderScreen(<OrderContractSection order={order} can={can} />);
}

afterEach(() => vi.restoreAllMocks());

describe("Hợp đồng — Sale phụ trách khách, chế độ chặt (KE-HOACH BR-S12)", () => {
  it("BR-S12: khách của Sale khác → 'Lập hợp đồng' tắt, lý do ở chú thích và dòng dưới", async () => {
    renderSection(noContract, () => owner("someone-else"));
    const create = await screen.findByRole("button", { name: "Lập hợp đồng" });
    await waitFor(() => expect(create).toBeDisabled());
    expect(create).toHaveAttribute("title", BLOCKED);
    expect(screen.getByText(BLOCKED)).toBeInTheDocument();
  });

  it("BR-S12: hợp đồng nháp của khách Sale khác → Gửi / Sửa / Huỷ tắt; xem trước PDF vẫn được", async () => {
    renderSection(
      () => contractDraft,
      () => owner("someone-else"),
    );
    const send = await screen.findByRole("button", { name: /Gửi hợp đồng/ });
    await waitFor(() => expect(send).toBeDisabled());
    expect(send).toHaveAttribute("title", BLOCKED);
    expect(screen.getByRole("button", { name: /^Sửa$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Huỷ hợp đồng/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Xem trước PDF/ })).toBeEnabled();
  });

  it("BR-S12: người phụ trách làm như cũ", async () => {
    renderSection(noContract, () => owner("u-test"));
    const create = await screen.findByRole("button", { name: "Lập hợp đồng" });
    await waitFor(() => expect(screen.queryByText(BLOCKED)).not.toBeInTheDocument());
    expect(create).toBeEnabled();
  });

  it("BR-S07: người lo thay làm được và thấy 'Bạn đang lo thay cho …'", async () => {
    renderSection(noContract, () =>
      owner("someone-else", { cover: { userId: "u-test", name: "Test", until: "2099-12-05" } }),
    );
    expect(
      await screen.findByText(`Bạn đang lo thay cho ${OTHER_NAME} tới 05/12/2099`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lập hợp đồng" })).toBeEnabled();
  });

  it("BR-S12: Sales Manager làm được trên khách của bất kỳ ai", async () => {
    renderSection(
      () => contractDraft,
      () => owner("someone-else"),
      [...SALES, MANAGE],
    );
    const send = await screen.findByRole("button", { name: /Gửi hợp đồng/ });
    await waitFor(() => expect(screen.queryByText(BLOCKED)).not.toBeInTheDocument());
    expect(send).toBeEnabled();
  });

  it("fallback: endpoint người phụ trách chưa có (404) → không chặn gì", async () => {
    renderSection(noContract, () => {
      throw new ApiError(404, "NOT_FOUND", "Not found");
    });
    expect(await screen.findByRole("button", { name: "Lập hợp đồng" })).toBeEnabled();
  });

  it("BR-S12: BE 409 CUSTOMER_OWNED_BY_OTHER_SALES khi lập → câu tiếng Việt nêu người phụ trách", async () => {
    renderSection(noContract, () => {
      throw new ApiError(404, "NOT_FOUND", "Not found");
    });
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(
        409,
        "CUSTOMER_OWNED_BY_OTHER_SALES",
        "owned",
        undefined,
        undefined,
        undefined,
        undefined,
        {
          salesOwnerName: OTHER_NAME,
        },
      ),
    );
    const toastError = vi.spyOn(toast, "error");
    await userEvent.click(await screen.findByRole("button", { name: "Lập hợp đồng" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lập hợp đồng" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(BLOCKED));
  });
});
