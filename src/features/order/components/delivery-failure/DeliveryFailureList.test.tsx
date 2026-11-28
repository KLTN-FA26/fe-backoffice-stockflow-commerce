/**
 * "Lô hàng hoàn về" (`/admin/orders/delivery-failures`, WF-05 BO-01): toolbar kiểu Vercel — trạng thái gửi BE, ô tìm +
 * lọc cột chạy ở FE trên mọi hồ sơ đã tải (BE trả cả danh sách, không phân trang).
 */
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeliveryFailureList } from "./DeliveryFailureList";

import { WF4_PERMISSION_SETS, callsTo } from "../../__fixtures__/wf4";
import { mockOrderApiGet, renderOrderScreen } from "../../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const LIST_PATH = "/orders/delivery-failures";

const apiCase = (patch: Record<string, unknown> = {}) => ({
  caseId: "c-1",
  orderId: "o-1",
  orderNumber: "SO-20261101-000001",
  shipmentId: "s-1",
  receiptNumber: "RR-20261120-0001",
  failureReason: "REFUSED",
  failureNote: "Khách không nhận",
  customerPaysFailedTrip: true,
  status: "CANCELLED",
  closure: "RECORDED_ON_RETURN",
  openedAt: "2026-11-20T03:00:00Z",
  ...patch,
});

async function renderList(searchParams = "") {
  const spy = mockOrderApiGet(WF4_PERMISSION_SETS.sales, {
    [LIST_PATH]: () => [
      apiCase(),
      apiCase({
        caseId: "c-2",
        orderId: "o-2",
        orderNumber: "SO-20261101-000002",
        receiptNumber: "RR-20261121-0002",
        failureReason: "WRONG_ADDRESS",
        failureNote: null,
      }),
    ],
  });
  await act(async () => {
    renderOrderScreen(<DeliveryFailureList />, searchParams);
  });
  return spy;
}

const lastParams = (spy: Awaited<ReturnType<typeof renderList>>) =>
  (spy.mock.calls.findLast((c) => c[0] === LIST_PATH)?.[1] as { params: Record<string, unknown> })
    .params;

describe("Lô hàng hoàn về — toolbar + lọc", () => {
  it("không tiêu đề hiển thị, có ô tìm; mặc định không gửi status", async () => {
    const spy = await renderList();
    await screen.findByRole("link", { name: "SO-20261101-000002" });
    expect(screen.getByRole("heading", { level: 1, name: "Lô hàng hoàn về" })).toHaveClass(
      "sr-only",
    );
    expect(screen.getByRole("textbox", { name: /Tìm mã đơn/ })).toBeInTheDocument();
    expect(lastParams(spy).status).toBeUndefined();
  });

  it("trạng thái trên URL → gửi BE, chip Trạng thái có nút xoá", async () => {
    const spy = await renderList("?status=REDELIVERED");
    await screen.findByRole("link", { name: "SO-20261101-000001" });
    expect(lastParams(spy).status).toBe("REDELIVERED");
    expect(screen.getByRole("button", { name: "Xoá Trạng thái" })).toBeInTheDocument();
  });

  it("ô tìm + lọc cột Phiếu nhận thu hẹp dòng, KHÔNG gọi lại API", async () => {
    const spy = await renderList();
    await screen.findByRole("link", { name: "SO-20261101-000002" });
    const before = callsTo(spy, LIST_PATH);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: /Tìm mã đơn/ }), "khong nhan");
    expect(screen.getByRole("link", { name: "SO-20261101-000001" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SO-20261101-000002" })).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: /Tìm mã đơn/ }));
    await user.click(screen.getByRole("button", { name: "Lọc phiếu nhận hàng hoàn" }));
    await user.type(screen.getByPlaceholderText("Tìm theo phiếu nhận hàng hoàn…"), "0002");
    expect(screen.queryByRole("link", { name: "SO-20261101-000001" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SO-20261101-000002" })).toBeInTheDocument();
    expect(screen.getByText("Phiếu nhận hàng hoàn “0002”")).toBeInTheDocument();
    expect(callsTo(spy, LIST_PATH)).toBe(before);
  });
});
