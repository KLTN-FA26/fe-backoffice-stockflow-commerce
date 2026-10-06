import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  PO_PERMISSION_SETS,
  SUPPLIER_REF,
  bePage,
  bePo,
  mockApi,
  pickSelectOption,
  renderPoScreen,
} from "../__fixtures__/render";
import { PurchaseOrderDetail } from "./PurchaseOrderDetail";

import type { PermissionCode } from "@/lib/auth";

const PO_ID = "11111111-1111-4111-8111-111111111111";
const routesFor = (po: Record<string, unknown>) => ({
  [`/purchase-orders/${PO_ID}`]: () => po,
  [`/suppliers/${SUPPLIER_REF.supplierId}`]: () => SUPPLIER_REF,
  [`/purchase-orders/${PO_ID}/delivery-decisions`]: () =>
    bePage([
      {
        id: "dec-1",
        generation: 0,
        previousExpectedAt: "2026-10-05",
        expectedAt: "2026-10-09",
        reason: "NCC dời lịch giao",
        reconciled: false,
        acknowledgePastDue: false,
        channel: "EMAIL",
        recipient: "po@gohoaphat.vn",
        actor: "procurement.staff",
        requestedAt: "2026-10-01T02:59:00Z",
      },
    ]),
  [`/purchase-orders/${PO_ID}/deliveries`]: () =>
    bePage([
      {
        id: "d-1",
        channel: "EMAIL",
        status: "FAILED",
        attemptedAt: "2026-10-01T03:00:00Z",
        sentAt: null,
        failure: `purchase-order:${PO_ID}: MailSendException`,
        generation: 0,
        recipient: "po@gohoaphat.vn",
        templateCode: "purchase-order.sent",
      },
    ]),
});

function renderDetail(permissions: readonly PermissionCode[], po = bePo()) {
  const spies = mockApi(permissions, routesFor(po), {
    [`/purchase-orders/${PO_ID}/approval`]: () => ({ ...po, status: "APPROVED" }),
  });
  renderPoScreen(<PurchaseOrderDetail id={PO_ID} />);
  return spies;
}

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe("PurchaseOrderDetail — gate theo mã quyền", () => {
  it("thiếu VIEW_PAGE → màn không có quyền, không gọi API PO", async () => {
    const { get } = renderDetail(PO_PERMISSION_SETS.none);
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(`/purchase-orders/${PO_ID}`, expect.anything());
  });

  it("có VIEW_PAGE nhưng thiếu READ → 'không có quyền xem dữ liệu'", async () => {
    renderDetail(PO_PERMISSION_SETS.viewOnly);
    expect(await screen.findByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
  });

  it("procurement (không APPROVE): DRAFT không có nút Phê duyệt; hiện mã + tên NCC", async () => {
    renderDetail(PO_PERMISSION_SETS.procurement);
    expect(await screen.findByRole("button", { name: "Huỷ PO" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phê duyệt" })).not.toBeInTheDocument();
    expect(await screen.findByText("GOHOAPHAT")).toBeInTheDocument();
  });

  it("approver: Phê duyệt phải qua dialog xác nhận rồi mới gọi API", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(PO_PERMISSION_SETS.approver);
    await user.click(await screen.findByRole("button", { name: "Phê duyệt" }));
    expect(post).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Đã duyệt");
    await user.click(screen.getAllByRole("button", { name: "Phê duyệt" }).at(-1) ?? dialog);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/purchase-orders/${PO_ID}/approval`, undefined),
    );
  });
});

describe("PurchaseOrderDetail — giao NCC (BE #36)", () => {
  it("deliveryStatus FAILED → cảnh báo + lịch sử gửi có lỗi; không hiện mã enum thô", async () => {
    renderDetail(
      PO_PERMISSION_SETS.procurement,
      bePo({ status: "SENT", supplierConfirmationStatus: "PENDING", deliveryStatus: "FAILED" }),
    );
    expect(await screen.findByText(/Lần gửi gần nhất chưa tới được NCC/)).toBeInTheDocument();
    // Bảng lần gửi không có cột lỗi kỹ thuật (đã có cột Kết quả)
    expect(await screen.findByRole("columnheader", { name: "Kết quả" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Lỗi/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/MailSendException/)).not.toBeInTheDocument();
    expect(screen.queryByText("FAILED")).not.toBeInTheDocument();
  });

  it("lịch sử gửi: 2 tab bảng — lần gửi (/deliveries) và quyết định gửi (/delivery-decisions)", async () => {
    const user = userEvent.setup();
    renderDetail(
      PO_PERMISSION_SETS.procurement,
      bePo({ status: "SENT", supplierConfirmationStatus: "PENDING", deliveryStatus: "FAILED" }),
    );
    const decisionsTab = await screen.findByRole("tab", { name: /Quyết định gửi\s*1/ });
    expect(screen.getByRole("tab", { name: /Lần gửi\s*1/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(decisionsTab);
    // ai cho gửi, ngày giao cũ → mới (lý do xem trong panel chi tiết)
    expect(await screen.findByText("Gửi lần đầu")).toBeInTheDocument();
    expect(screen.getByText("procurement.staff")).toBeInTheDocument();
    expect(screen.getByText(/→/)).toBeInTheDocument();
    expect(screen.queryByText("Khôi phục gửi")).not.toBeInTheDocument();
  });

  it("bấm một dòng lịch sử → panel chi tiết hiện đủ field (trừ id), Esc để đóng", async () => {
    const user = userEvent.setup();
    renderDetail(
      PO_PERMISSION_SETS.procurement,
      bePo({ status: "SENT", supplierConfirmationStatus: "PENDING", deliveryStatus: "FAILED" }),
    );
    // BE #36: bảng phân biệt thư gửi đơn với thư báo huỷ ngay trên dòng (templateCode)
    expect(await screen.findByRole("columnheader", { name: "Loại thư" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Gửi đơn đặt hàng" })).toBeInTheDocument();
    await user.click(await screen.findByText("po@gohoaphat.vn"));
    const panel = await screen.findByRole("dialog", { name: "Lần gửi · lượt 1" });
    // failure BE "purchase-order:<uuid>: X" → chỉ hiện tên lỗi, không lộ UUID
    expect(within(panel).getByText("MailSendException")).toBeInTheDocument();
    expect(within(panel).queryByText(new RegExp(PO_ID))).not.toBeInTheDocument();
    expect(within(panel).getByText("po@gohoaphat.vn")).toBeInTheDocument();
    expect(within(panel).getByText("Gửi đơn đặt hàng")).toBeInTheDocument();
    expect(within(panel).queryByText("d-1")).not.toBeInTheDocument();
    // Khớp OrderDetailPanel/SkuDetailPanel: rộng max-w-md, lớp drawer 1100 (design-tokens)
    expect(panel).toHaveClass("max-w-md", "z-[1100]");
    // Radix Dialog: focus chuyển vào panel, không lọt ra nội dung phía sau
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /Quyết định gửi/ }));
    await user.click(await screen.findByText("procurement.staff"));
    const decision = await screen.findByRole("dialog", { name: "Quyết định gửi · lượt 1" });
    expect(within(decision).getByText("NCC dời lịch giao")).toBeInTheDocument();
    expect(within(decision).getByText("Đã đối chiếu với NCC")).toBeInTheDocument();
    expect(within(decision).getByText("procurement.staff")).toBeInTheDocument();
  });

  it("không tra được NCC (vd thiếu quyền xem NCC) → nhãn tiếng Việt, không lộ UUID NCC", async () => {
    const po = bePo();
    mockApi(PO_PERMISSION_SETS.procurement, {
      ...routesFor(po),
      [`/suppliers/${SUPPLIER_REF.supplierId}`]: () => {
        throw new ApiError(403, "FORBIDDEN", "Forbidden");
      },
    });
    renderPoScreen(<PurchaseOrderDetail id={PO_ID} />);
    expect(await screen.findByRole("link", { name: "Không tải được tên NCC" })).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(SUPPLIER_REF.supplierId))).not.toBeInTheDocument();
  });

  it("lịch sử gửi lỗi 5xx → báo lỗi + nút Thử lại (không im lặng)", async () => {
    const po = bePo({
      status: "SENT",
      supplierConfirmationStatus: "PENDING",
      deliveryStatus: "FAILED",
    });
    mockApi(PO_PERMISSION_SETS.procurement, {
      ...routesFor(po),
      [`/purchase-orders/${PO_ID}/deliveries`]: () => {
        throw new ApiError(500, "INTERNAL_ERROR", "boom");
      },
    });
    renderPoScreen(<PurchaseOrderDetail id={PO_ID} />);
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("?duplicate=1 → hiện cảnh báo trùng (BR-PO-003) cho lần xem này", async () => {
    mockApi(PO_PERMISSION_SETS.readOnly, routesFor(bePo()));
    renderPoScreen(<PurchaseOrderDetail id={PO_ID} />, "?duplicate=1");
    expect(await screen.findByText(/Cảnh báo trùng lặp/)).toBeInTheDocument();
    // URL đã xoá cờ nhưng cảnh báo vẫn giữ trong lần xem hiện tại
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText(/Cảnh báo trùng lặp/)).toBeInTheDocument();
  });

  it("ghi nhận NCC phản hồi: chọn 'NCC từ chối' trong Select → bắt buộc ghi chú, khoá nút", async () => {
    const user = userEvent.setup();
    renderDetail(
      PO_PERMISSION_SETS.procurement,
      bePo({ status: "SENT", supplierConfirmationStatus: "PENDING", deliveryStatus: "DELIVERED" }),
    );
    await user.click(await screen.findByRole("button", { name: /Ghi nhận NCC phản hồi/ }));
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, /Phản hồi/, "NCC từ chối");
    expect(within(dialog).getByRole("button", { name: "Ghi nhận" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "Hết hàng");
    expect(within(dialog).getByRole("button", { name: "Ghi nhận" })).toBeEnabled();
  });

  it("dialog Gửi NCC: PO cũ thiếu mô tả + ngày đã qua → cảnh báo, vẫn cho gửi (BR-06)", async () => {
    const user = userEvent.setup();
    const base = bePo({ status: "APPROVED", expectedAt: "2020-01-01" });
    const po = { ...base, lines: base.lines.map((l) => ({ ...l, description: "" })) };
    renderDetail(PO_PERMISSION_SETS.procurement, po);
    await user.click(await screen.findByRole("button", { name: /Gửi NCC/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/1 dòng chưa có mô tả sản phẩm/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Ngày giao dự kiến đã qua/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gửi NCC" })).toBeEnabled();
  });

  it("đang gửi NCC (QUEUED) → tự tải lại, chuyển sang 'Đã gửi tới NCC' không cần F5", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let calls = 0;
      const sent = {
        status: "SENT",
        supplierConfirmationStatus: "PENDING",
        sentAt: "2026-10-01T03:00:00Z",
      };
      mockApi(PO_PERMISSION_SETS.procurement, {
        ...routesFor(bePo()),
        [`/purchase-orders/${PO_ID}`]: () =>
          bePo({ ...sent, deliveryStatus: ++calls === 1 ? "QUEUED" : "DELIVERED" }),
      });
      renderPoScreen(<PurchaseOrderDetail id={PO_ID} />);
      expect(await screen.findByText("Đang chờ gửi")).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(3500);
      expect(await screen.findByText("Đã gửi tới NCC")).toBeInTheDocument();
      // Đã có kết quả cuối → dừng tải lại
      const after = calls;
      await vi.advanceTimersByTimeAsync(7000);
      expect(calls).toBe(after);
    } finally {
      vi.useRealTimers();
    }
  });

  it("đang gửi → tự tải lại; có kết quả → lịch sử có dòng vừa gửi, rồi dừng tải lại", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let poCalls = 0;
      let attemptCalls = 0;
      let servedSentRow = false;
      const sent = {
        status: "SENT",
        supplierConfirmationStatus: "PENDING",
        sentAt: "2026-10-01T03:00:00Z",
      };
      mockApi(PO_PERMISSION_SETS.procurement, {
        ...routesFor(bePo()),
        [`/purchase-orders/${PO_ID}`]: () =>
          bePo({ ...sent, deliveryStatus: ++poCalls === 1 ? "QUEUED" : "DELIVERED" }),
        // BE chỉ ghi dòng lần gửi sau khi gửi xong: lúc PO còn QUEUED thì lịch sử trống.
        [`/purchase-orders/${PO_ID}/deliveries`]: () => {
          attemptCalls += 1;
          if (poCalls < 2) return bePage([]);
          servedSentRow = true;
          return bePage([
            {
              id: "d-1",
              channel: "EMAIL",
              status: "SENT",
              attemptedAt: "2026-10-01T03:00:01Z",
              sentAt: "2026-10-01T03:00:01Z",
              failure: null,
              generation: 0,
              recipient: "po@gohoaphat.vn",
              templateCode: "purchase-order.sent",
            },
          ]);
        },
      });
      renderPoScreen(<PurchaseOrderDetail id={PO_ID} />);
      expect(await screen.findByText("Đang chờ gửi")).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(servedSentRow).toBe(true);
      // Thẻ (deliveryStatus DELIVERED) + dòng lần gửi SENT dùng cùng một nhãn
      await waitFor(() => expect(screen.getAllByText("Đã gửi tới NCC")).toHaveLength(2));
      // Đã có kết quả cuối → dừng tải lại
      const after = attemptCalls;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(attemptCalls).toBe(after);
    } finally {
      vi.useRealTimers();
    }
  });

  it("BE đang tự gửi lại (RETRYING) → báo đang gửi lại, không khuyên khôi phục gửi", async () => {
    renderDetail(
      PO_PERMISSION_SETS.procurement,
      bePo({ status: "SENT", supplierConfirmationStatus: "PENDING", deliveryStatus: "RETRYING" }),
    );
    expect(await screen.findByText(/hệ thống đang tự gửi lại/)).toBeInTheDocument();
    expect(screen.queryByText(/có thể khôi phục gửi/)).not.toBeInTheDocument();
  });

  it("PO đã huỷ dù lần gửi từng FAILED → không còn cảnh báo khôi phục gửi", async () => {
    renderDetail(
      PO_PERMISSION_SETS.procurement,
      bePo({
        status: "CANCELLED",
        supplierConfirmationStatus: "PENDING",
        deliveryStatus: "FAILED",
      }),
    );
    expect(await screen.findByText("Gửi nhà cung cấp")).toBeInTheDocument();
    expect(screen.queryByText(/chưa tới được NCC/)).not.toBeInTheDocument();
  });

  it("BE #36: cảnh báo ngày giao đã qua (warnings) + trạng thái thông báo huỷ tới NCC", async () => {
    renderDetail(
      PO_PERMISSION_SETS.readOnly,
      bePo({
        status: "CANCELLED",
        sentAt: "2026-10-01T03:00:00Z",
        supplierConfirmationStatus: "PENDING",
        deliveryStatus: "DELIVERED",
        cancellationDeliveryStatus: "QUEUED",
        warnings: ["DELIVERY_DATE_IN_PAST"],
      }),
    );
    expect(
      await screen.findByText(/Ngày giao dự kiến đã qua — vẫn tạo và gửi được/),
    ).toBeInTheDocument();
    expect(screen.getByText("Thông báo huỷ tới NCC")).toBeInTheDocument();
  });

  it("409 khi duyệt → câu tiếng Việt, không lộ message tiếng Anh của BE", async () => {
    const user = userEvent.setup();
    const po = bePo();
    mockApi(PO_PERMISSION_SETS.approver, routesFor(po), {
      [`/purchase-orders/${PO_ID}/approval`]: () => {
        throw new ApiError(
          409,
          "INVALID_PURCHASE_ORDER_TRANSITION",
          `Purchase order ${PO_ID} cannot move from CANCELLED to APPROVED`,
        );
      },
    });
    renderPoScreen(<PurchaseOrderDetail id={PO_ID} />);
    await user.click(await screen.findByRole("button", { name: "Phê duyệt" }));
    await user.click(screen.getAllByRole("button", { name: "Phê duyệt" }).at(-1) ?? document.body);
    expect(await screen.findByRole("alert")).toHaveTextContent("đã đổi trạng thái");
    expect(screen.queryByText(/cannot move/)).not.toBeInTheDocument();
  });
});
