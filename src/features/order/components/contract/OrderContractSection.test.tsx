import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ORDER_PERMISSIONS, SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  CONTRACT_LINE_ID,
  CONTRACT_ORDER_ID,
  contractDraft,
  contractDraftOverdue,
  contractOrderDto,
  contractSent,
} from "../../__fixtures__/contract";
import { mockOrderApiGet, renderOrderScreen } from "../../__fixtures__/render";
import { toOrder } from "../../api";
import { orderDtoSchema } from "../../schemas";

import { OrderContractSection } from "./OrderContractSection";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../../types";

const SALES: PermissionCode[] = [
  ORDER_PERMISSIONS.viewPage,
  ORDER_PERMISSIONS.read,
  SALES_CONTRACT_PERMISSIONS.read,
  SALES_CONTRACT_PERMISSIONS.create,
  SALES_CONTRACT_PERMISSIONS.update,
  SALES_CONTRACT_PERMISSIONS.approve,
];
const PATH = `/orders/${CONTRACT_ORDER_ID}/contract`;
const draftOrder = toOrder(orderDtoSchema.parse(contractOrderDto));

/** Giả lập đơn được tải lại sau khi ký (mutation invalidate `orderKeys.all`). */
function Harness({ can, next }: { can: (code: PermissionCode) => boolean; next: Order }) {
  const [order, setOrder] = useState<Order>(draftOrder);
  return (
    <>
      <button type="button" onClick={() => setOrder(next)}>
        tải lại đơn
      </button>
      <OrderContractSection order={order} can={can} />
    </>
  );
}

function renderSection(contract: () => unknown, order: Order = draftOrder, permissions = SALES) {
  const get = mockOrderApiGet(permissions, { [PATH]: contract });
  const can = (code: PermissionCode) => permissions.includes(code);
  renderOrderScreen(<OrderContractSection order={order} can={can} />);
  return { get };
}

afterEach(() => vi.restoreAllMocks());

describe("Hợp đồng — đọc (B1)", () => {
  it("404 SALES_CONTRACT_NOT_FOUND + đơn Nháp → 'Lập hợp đồng' gửi POST không body", async () => {
    renderSection(() => {
      throw new ApiError(404, "SALES_CONTRACT_NOT_FOUND", "Đơn chưa có hợp đồng.");
    });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: contractDraft });
    expect(await screen.findByText("Đơn chưa có hợp đồng.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lập hợp đồng" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(PATH, {}));
  });

  it("hiện số hợp đồng, lịch giao, lịch thanh toán của BE", async () => {
    renderSection(() => contractSent);
    expect(await screen.findByText("HD-20261120-900001-1")).toBeInTheDocument();
    expect(screen.getByText("Đã gửi")).toBeInTheDocument();
    expect(screen.getAllByText(/LY-GIAY-DEMO-12OZ-XANH × 30 = 30\.000 cái/)).toHaveLength(2);
    expect(screen.getByText("Đặt cọc khi ký")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ghi nhận đã ký/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gửi hợp đồng/ })).not.toBeInTheDocument();
  });

  it("DS-02b: cảnh báo OVERDUE trên bản nháp → banner + 'Vẫn gửi' mở hộp thoại nhắc lại", async () => {
    renderSection(() => contractDraftOverdue);
    expect(await screen.findByText(/Khách đang có khoản quá hạn/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Vẫn gửi" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/đơn sẽ bị treo chờ Kế toán duyệt tín dụng/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Vẫn gửi" })).toBeInTheDocument();
  });
});

describe("TC-F04-02 — editor lịch giao / lịch thanh toán", () => {
  it("lệch Σ thùng → 'còn thiếu 5 thùng'; fieldErrors BE gắn đúng ô và banner", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const cartons = screen.getByLabelText("Đợt 1 — LY-GIAY-DEMO-12OZ-XANH (thùng)");
    await userEvent.clear(cartons);
    await userEvent.type(cartons, "25");
    expect(screen.getByText(/còn thiếu 5 thùng/)).toBeInTheDocument();

    const message =
      "Dòng LY-GIAY-DEMO-12OZ-XANH: tổng số thùng qua các đợt giao là 55, khác số thùng của dòng đơn là 60.";
    const put = vi.spyOn(api, "put").mockRejectedValue(
      new ApiError(
        409,
        "DELIVERY_SCHEDULE_INVALID",
        "Lịch giao không hợp lệ.",
        undefined,
        undefined,
        undefined,
        [
          { field: "deliverySchedule", message },
          {
            field: "deliverySchedule[1].windowStart",
            message: "Cửa sổ giao không được ở quá khứ.",
          },
        ],
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const body = put.mock.calls[0]?.[1] as {
      version: number;
      deliverySchedule: { lines: unknown[] }[];
    };
    expect(body.version).toBe(0);
    expect(body.deliverySchedule[0]?.lines).toEqual([
      { orderLineId: CONTRACT_LINE_ID, cartons: 25 },
    ]);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText("Cửa sổ giao không được ở quá khứ.")).toBeInTheDocument();
    expect(screen.getByText("Lịch giao không hợp lệ.")).toBeInTheDocument();
  });

  it("đợt % → body percent; BEFORE_DELIVERY không gửi số ngày", async () => {
    renderSection(() => contractDraft);
    await userEvent.click(await screen.findByRole("button", { name: /Sửa/ }));
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: contractDraft });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hợp đồng" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const body = put.mock.calls[0]?.[1] as { paymentPlan: Record<string, unknown>[] };
    expect(body.paymentPlan[0]).toEqual({
      name: "Đặt cọc khi ký",
      milestone: "ON_SIGNING",
      percent: 30,
      dueDays: 3,
    });
    expect(body.paymentPlan[1]).toEqual({
      name: "Thanh toán trước giao đợt 1",
      milestone: "BEFORE_DELIVERY",
      amount: 27_142_500,
      deliveryBatchSeq: 1,
    });
  });
});

describe("TC-F04-03 — ghi nhận đã ký", () => {
  it("multipart file + version + signedOn; sau khi ký hiện đúng nhánh ON_HOLD tín dụng", async () => {
    mockOrderApiGet(SALES, { [PATH]: () => contractSent });
    const can = (code: PermissionCode) => SALES.includes(code);
    const held = { ...draftOrder, status: "On Hold" as const, holdReason: "CREDIT" as const };
    renderOrderScreen(<Harness can={can} next={held} />);
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...contractSent, status: "SIGNED", version: 2 } });
    await userEvent.click(await screen.findByRole("button", { name: /Ghi nhận đã ký/ }));
    const dialog = await screen.findByRole("dialog");
    const file = new File(["%PDF-1.4"], "hd-da-ky.pdf", { type: "application/pdf" });
    await userEvent.upload(within(dialog).getByLabelText(/File đã ký/), file);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi nhận đã ký" }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [url, form] = post.mock.calls[0] ?? [];
    expect(url).toBe(`${PATH}/signature`);
    expect((form as FormData).get("version")).toBe("1");
    expect((form as FormData).get("signedOn")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((form as FormData).get("file")).toBeInstanceOf(File);

    await userEvent.click(screen.getByRole("button", { name: "tải lại đơn" }));
    expect(
      await screen.findByText("Đã ký. Đơn đang chờ Kế toán duyệt tín dụng."),
    ).toBeInTheDocument();
  });
});
