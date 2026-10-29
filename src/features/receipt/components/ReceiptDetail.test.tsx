import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  PO_ID,
  RECEIPT_ID,
  SOFA_PO_LINE_ID,
  TABLE_PO_LINE_ID,
  apiLine,
  apiReceipt,
  receivablePo,
} from "../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../__fixtures__/render";
import { ReceiptDetail } from "./ReceiptDetail";

import type { PermissionCode } from "@/lib/auth";
import type { GoodsReceiptApiDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = `/goods-receipts/${RECEIPT_ID}`;

function renderDetail(permissions: readonly PermissionCode[], receipt: GoodsReceiptApiDto) {
  const spies = mockReceiptApi(
    permissions,
    {
      [PATH]: () => receipt,
      [`/purchase-orders/${PO_ID}`]: () => receivablePo,
    },
    {
      [`${PATH}/confirmation`]: () => ({ ...receipt, status: "IN_QC" }),
      [`${PATH}/lines/${apiLine().id}/inspection`]: () => receipt,
    },
    {
      [`${PATH}/lines`]: (_p, body) => ({
        ...receipt,
        lines: (body as { lines: unknown[] }).lines.map((l, i) => ({
          ...apiLine(),
          ...(l as object),
          id: `l${i}`,
        })),
      }),
    },
  );
  renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
  return spies;
}

describe("ReceiptDetail — action-gating theo trạng thái + quyền (docs 03 §5.1)", () => {
  it("Draft + quản lý kho: form kiểm đếm nạp dòng PO còn mở, Lưu gửi PUT đủ dòng", async () => {
    const user = userEvent.setup();
    const { put } = renderDetail(ROLES.warehouseManager, apiReceipt());
    expect(await screen.findByText("Kiểm đếm")).toBeInTheDocument();
    const location = screen.getByLabelText("Mã vị trí nhận dòng 1");
    await user.type(location, "hcm-rcv01");
    await user.type(screen.getByLabelText("Mã vị trí nhận dòng 2"), "HCM-RCV01");
    await user.type(screen.getByLabelText("Số lô dòng 2"), "LOT-1");
    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]?.[1]).toEqual({
      lines: [
        expect.objectContaining({
          purchaseOrderLineId: SOFA_PO_LINE_ID,
          quantity: 10,
          locationCode: "HCM-RCV01",
        }),
        expect.objectContaining({
          purchaseOrderLineId: TABLE_PO_LINE_ID,
          quantity: 6,
          lotNumber: "LOT-1",
        }),
      ],
    });
  });

  it("Draft + quản lý kho: thiếu mã vị trí → lỗi inline, không gọi API", async () => {
    const user = userEvent.setup();
    const { put } = renderDetail(ROLES.warehouseManager, apiReceipt());
    await screen.findByText("Kiểm đếm");
    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));
    expect((await screen.findAllByText("Nhập hoặc quét mã vị trí")).length).toBeGreaterThan(0);
    expect(put).not.toHaveBeenCalled();
  });

  it("Draft đã lưu kiểm đếm: hiện kết quả BE (luồng từng dòng + trạng thái sau xác nhận), Sửa mở lại form", async () => {
    const user = userEvent.setup();
    const saved = apiReceipt({
      lines: [
        apiLine({
          id: "l-sofa",
          purchaseOrderLineId: SOFA_PO_LINE_ID,
          purchaseOrderLineNo: 1,
          sku: "SOFA-3S-GREY",
          quantity: 10,
          lotNumber: null,
          expiryDate: null,
          qcRequired: false,
          qcProgress: "NOT_REQUIRED",
          quantityForPutaway: 10,
        }),
        apiLine({ id: "l-table" }),
      ],
    });
    renderDetail(ROLES.warehouseManager, saved);
    expect(await screen.findByText("Kết quả kiểm đếm đã lưu")).toBeInTheDocument();
    expect(screen.getByText("2 bước · cất thẳng")).toBeInTheDocument();
    expect(screen.getByText("3 bước · qua QC")).toBeInTheDocument();
    // Có dòng cần QC → BE GoodsReceipt#confirm chuyển phiếu sang In QC
    expect(screen.getByText(/“Đang kiểm QC”/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Mã vị trí nhận dòng 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xác nhận nhập kho/ })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /Sửa kiểm đếm/ }));
    expect(await screen.findByLabelText("Mã vị trí nhận dòng 1")).toHaveValue("HCM-RCV01");
    await user.click(screen.getByRole("button", { name: "Huỷ sửa" }));
    expect(await screen.findByText("Kết quả kiểm đếm đã lưu")).toBeInTheDocument();
  });

  it("Draft + NV kho (thiếu purchase-orders:READ): báo cần quyền xem PO, vẫn huỷ được phiếu", async () => {
    renderDetail(ROLES.warehouseStaff, apiReceipt());
    expect(await screen.findByText("Cần quyền xem đơn đặt hàng")).toBeInTheDocument();
    expect(screen.queryByText("Kiểm đếm")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Huỷ phiếu/ })).toBeEnabled();
    // Phiếu chưa có dòng → xác nhận bị khoá kèm lý do
    expect(screen.getByRole("button", { name: /Xác nhận nhập kho/ })).toBeDisabled();
  });

  it("In QC + NV kho: chỉ thấy 'Chuyển sang khu QC' cho dòng chờ chuyển", async () => {
    renderDetail(ROLES.warehouseStaff, apiReceipt({ status: "IN_QC", lines: [apiLine()] }));
    expect(await screen.findByRole("button", { name: "Chuyển sang khu QC" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kết luận QC" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Huỷ phiếu/ })).not.toBeInTheDocument();
  });

  it("Chuyển sang khu QC: bỏ trống → lỗi; gõ lại mã → lỗi tự mất", async () => {
    const user = userEvent.setup();
    renderDetail(ROLES.warehouseStaff, apiReceipt({ status: "IN_QC", lines: [apiLine()] }));
    await user.click(await screen.findByRole("button", { name: "Chuyển sang khu QC" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Chuyển sang khu QC" }));
    expect(await within(dialog).findByText("Nhập hoặc quét mã vị trí")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Mã khu QC"), "H");
    expect(within(dialog).queryByText("Nhập hoặc quét mã vị trí")).not.toBeInTheDocument();
  });

  it("đã xác nhận: hiện ghi chú dòng, người xác nhận, thời điểm + người kết luận QC", async () => {
    const user = userEvent.setup();
    const CONFIRMER = "c0ffee00-0000-4000-8000-000000000001";
    const QC_USER = "0dd0c0de-0000-4000-8000-000000000002";
    renderDetail(
      ROLES.warehouseManager,
      apiReceipt({
        status: "IN_PUTAWAY",
        confirmedAt: "2026-10-09T01:00:00Z",
        confirmedBy: CONFIRMER,
        lines: [
          apiLine({
            note: "Thùng móp góc",
            qcProgress: "INSPECTED",
            qcLocationCode: "HCM-QCA01",
            quantityForPutaway: 6,
            inspections: [
              {
                id: "i1",
                outcome: "ACCEPTED",
                quantity: 6,
                locationCode: null,
                reason: null,
                inspectedBy: QC_USER,
                inspectedAt: "2026-10-09T03:00:00Z",
              },
            ],
          }),
        ],
      }),
    );
    expect(await screen.findByRole("columnheader", { name: "Ghi chú" })).toBeInTheDocument();
    // Ghi chú dài cắt gọn nhưng focus được bằng bàn phím (tooltip), không chỉ dựa vào hover
    expect(screen.getByRole("button", { name: "Thùng móp góc" })).toBeInTheDocument();
    expect(screen.getByText(CONFIRMER)).toBeInTheDocument();
    // Hạn dùng format vi-VN, không hiện chuỗi ISO
    expect(screen.queryByText("2027-10-01")).not.toBeInTheDocument();
    expect(screen.getByText(/1 thg 10, 2027/)).toBeInTheDocument();
    // Ô Chất lượng chỉ tóm tắt; chi tiết QC mở panel bên phải
    expect(screen.getByText("Đạt 6")).toBeInTheDocument();
    expect(screen.queryByText(QC_USER)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Xem chi tiết QC dòng TABLE-OAK-160 lô LOT-2026-10" }),
    );
    const panel = await screen.findByRole("dialog");
    // 03:00 UTC = 10:00 giờ VN; người QC hiện một lần cho cả lần kết luận
    expect(within(panel).getAllByText(QC_USER)).toHaveLength(1);
    expect(within(panel).getByText(/10:00/)).toBeInTheDocument();
    expect(within(panel).getByText(/Nằm lại/)).toHaveTextContent("HCM-QCA01");
  });

  it("In QC + NV QC: dòng đã ở khu QC → 'Kết luận QC'; tổng lệch thì chặn gửi (BR-08)", async () => {
    const user = userEvent.setup();
    const line = apiLine({
      qcProgress: "IN_QC_AREA",
      qcLocationCode: "HCM-QCA01",
      movedToQcAt: "2026-10-09T02:15:00Z",
    });
    const { post } = renderDetail(ROLES.qcStaff, apiReceipt({ status: "IN_QC", lines: [line] }));
    await user.click(await screen.findByRole("button", { name: "Kết luận QC" }));
    // Người nhận (UUID từ BE) + thời điểm chuyển QC hiện trên chi tiết
    expect(screen.getByText(apiReceipt().receivedBy ?? "")).toBeInTheDocument();
    expect(screen.getByText(/Chuyển QC/)).toHaveTextContent(/09:15.*từ HCM-RCV01/);
    const dialog = await screen.findByRole("dialog");
    const accepted = within(dialog).getByLabelText("Đạt");
    await user.clear(accepted);
    await user.type(accepted, "4");
    await user.click(within(dialog).getByRole("button", { name: "Kết luận QC" }));
    expect(await within(dialog).findByText("Tổng: 4 / 6")).toBeInTheDocument();
    // Lỗi BR-08 gắn vào ô "Đạt" cho trình đọc màn hình
    expect(accepted).toHaveAccessibleDescription(/Tổng Đạt \+ Cách ly \+ Không đạt/);
    expect(post).not.toHaveBeenCalled();
  });

  it("Closed: không còn nút thao tác nào", async () => {
    renderDetail(
      ROLES.warehouseManager,
      apiReceipt({ status: "CLOSED", lines: [apiLine({ qcProgress: "INSPECTED" })] }),
    );
    expect(await screen.findByText(/không còn thao tác/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Xác nhận nhập kho|Huỷ phiếu|Chuyển sang khu QC|Kết luận QC/,
      }),
    ).not.toBeInTheDocument();
  });

  it("phiếu không tồn tại → màn không tìm thấy", async () => {
    mockReceiptApi(ROLES.warehouseManager, {
      [PATH]: () => {
        throw new ApiError(404, "GOODS_RECEIPT_NOT_FOUND", `No goods receipt ${RECEIPT_ID}`);
      },
    });
    renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
    expect(await screen.findByText("Không tìm thấy phiếu nhận")).toBeInTheDocument();
  });

  it("In Putaway: card thao tác báo chờ cất hàng (không nói QC theo dòng)", async () => {
    renderDetail(
      ROLES.warehouseManager,
      apiReceipt({ status: "IN_PUTAWAY", lines: [apiLine({ qcProgress: "INSPECTED" })] }),
    );
    expect(await screen.findByText(/Đang chờ cất hàng/)).toBeInTheDocument();
    expect(screen.queryByText(/QC thực hiện theo từng dòng ở bảng/)).not.toBeInTheDocument();
  });

  it("Tách lô chuyển 1 đơn vị sang dòng mới, giữ vị trí của dòng gốc — tổng không đổi", async () => {
    const user = userEvent.setup();
    renderDetail(ROLES.warehouseManager, apiReceipt());
    await user.type(await screen.findByLabelText("Mã vị trí nhận dòng 1"), "HCM-RCV01");
    await user.type(screen.getByLabelText("Mã vị trí nhận dòng 2"), "HCM-RCV02");
    await user.click(screen.getByRole("button", { name: "Tách lô dòng 2" }));
    expect(screen.getByLabelText("SL nhận dòng 2")).toHaveValue(5);
    expect(screen.getByLabelText("SL nhận dòng 3")).toHaveValue(1);
    expect(screen.getByLabelText("Mã vị trí nhận dòng 3")).toHaveValue("HCM-RCV02");
  });

  it("lỗi 409 khi lưu: câu tiếng Việt ở đầu form; trạng thái đổi ở nơi khác → tải lại phiếu", async () => {
    const user = userEvent.setup();
    const { get, put } = renderDetail(ROLES.warehouseManager, apiReceipt());
    put.mockImplementationOnce(async () => {
      throw new ApiError(
        409,
        "OVER_RECEIPT_TOLERANCE",
        "Line 2 of PO-HCM-DEMO-0002 would be received 6 of 6 ordered; at most 5 with the supplier's 0% tolerance (BR-02)",
      );
    });
    await user.type(await screen.findByLabelText("Mã vị trí nhận dòng 1"), "HCM-RCV01");
    await user.type(screen.getByLabelText("Mã vị trí nhận dòng 2"), "HCM-RCV01");
    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));
    expect(
      await screen.findByText("Số lượng nhận vượt quá SL đặt cộng dung sai của nhà cung cấp"),
    ).toBeInTheDocument();

    put.mockImplementationOnce(async () => {
      throw new ApiError(409, "INVALID_RECEIPT_TRANSITION", "Cannot change the lines of …");
    });
    const before = get.mock.calls.filter(([url]) => url === PATH).length;
    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));
    await waitFor(() =>
      expect(get.mock.calls.filter(([url]) => url === PATH).length).toBeGreaterThan(before),
    );
  });

  it("PO của phiếu trả 404 → báo không tìm thấy đơn đặt hàng, không báo nhầm 'phiếu nhận'", async () => {
    mockReceiptApi(ROLES.warehouseManager, {
      [PATH]: () => apiReceipt({ purchaseOrderNumber: null }),
      [`/purchase-orders/${PO_ID}`]: () => {
        throw new ApiError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order ${PO_ID}`);
      },
    });
    renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
    expect(await screen.findByText("Không tìm thấy đơn đặt hàng của phiếu")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy phiếu nhận")).not.toBeInTheDocument();
  });

  it("Cancelled có dòng: hiện như kết quả kiểm đếm, không có QC / chờ cất", async () => {
    renderDetail(ROLES.warehouseManager, apiReceipt({ status: "CANCELLED", lines: [apiLine()] }));
    expect(await screen.findByText(/Phiếu đã huỷ trước khi xác nhận/)).toBeInTheDocument();
    expect(screen.getByText("3 bước · qua QC")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Chờ cất" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Phiếu đã xác nhận chỉ còn xem/)).not.toBeInTheDocument();
  });

  it("phiếu không còn là nháp và không có dòng → báo chưa có dòng, không để bảng trống", async () => {
    renderDetail(ROLES.warehouseManager, apiReceipt({ status: "CANCELLED", lines: [] }));
    expect(await screen.findByText("Chưa có dòng kiểm đếm.")).toBeInTheDocument();
  });
});

/* ── BR-RCP-001 (SCRUM-477): nhận vượt dung sai chờ Quản lý kho duyệt ─────────────────────────── */

describe("ReceiptDetail — đếm vượt dung sai chờ Quản lý kho duyệt (BR-RCP-001)", () => {
  const OVER_LINE = apiLine({
    id: "l-over",
    quantity: 110,
    warnings: ["OVER_TOLERANCE"],
    // Phiếu chưa ghi nhận: dòng 3 bước vẫn báo AWAITING_MOVE_TO_QC (BE không tính theo trạng thái phiếu)
  });
  const REQUESTER = "c0ffee00-0000-4000-8000-0000000000aa";

  const pending = (overrides: Partial<GoodsReceiptApiDto> = {}) =>
    apiReceipt({
      status: "PENDING_APPROVAL",
      lines: [OVER_LINE],
      warnings: ["OVER_TOLERANCE"],
      approval: {
        requestedAt: "2026-10-09T03:00:00Z",
        requestedBy: REQUESTER,
        requestedByName: "Lan (kho)",
        decision: null,
      },
      ...overrides,
    });

  function renderPending(
    permissions: readonly PermissionCode[],
    receipt: GoodsReceiptApiDto = pending(),
  ) {
    const spies = mockReceiptApi(
      permissions,
      { [PATH]: () => receipt, [`/purchase-orders/${PO_ID}`]: () => receivablePo },
      {
        [`${PATH}/approval`]: () => ({ ...receipt, status: "IN_QC" }),
        [`${PATH}/excess-rejection`]: () => ({ ...receipt, status: "IN_QC" }),
        [`${PATH}/cancellation`]: () => ({ ...receipt, status: "CANCELLED" }),
        [`${PATH}/confirmation`]: () => ({ ...receipt, status: "PENDING_APPROVAL" }),
      },
    );
    renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
    return spies;
  }

  it("Draft đã lưu có dòng vượt dung sai: cảnh báo, phiếu sẽ sang 'Chờ duyệt'; xác nhận gửi duyệt", async () => {
    const user = userEvent.setup();
    const { post } = renderPending(
      ROLES.warehouseManager,
      apiReceipt({ lines: [OVER_LINE], warnings: ["OVER_TOLERANCE"] }),
    );
    expect(
      await screen.findByText(/vượt SL đặt cộng dung sai của nhà cung cấp/),
    ).toBeInTheDocument();
    expect(screen.getByText("Vượt dung sai NCC — cần Quản lý kho duyệt")).toBeInTheDocument();
    expect(screen.getByText(/chuyển sang “Chờ duyệt”/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Gửi Quản lý kho duyệt/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/chưa ghi nhận tồn/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Gửi Quản lý kho duyệt" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/confirmation`, undefined));
  });

  it("Pending Approval: banner chờ duyệt + dòng đánh dấu vượt dung sai; không còn form đếm / xác nhận", async () => {
    renderPending(ROLES.warehouseManager);
    expect(await screen.findByText("Chờ Quản lý kho duyệt")).toBeInTheDocument();
    expect(screen.getByText("Vượt dung sai NCC — cần Quản lý kho duyệt")).toBeInTheDocument();
    expect(screen.queryByText("Kiểm đếm")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác nhận nhập kho/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sửa kiểm đếm/ })).not.toBeInTheDocument();
    // Ai gửi duyệt (tên BE trả kèm) và đang chờ quyết định
    expect(screen.getByText("Lan (kho)")).toBeInTheDocument();
    expect(screen.getByText("Đang chờ")).toBeInTheDocument();
  });

  it("có quyền goods-receipts:APPROVE → Duyệt / Từ chối phần vượt / Huỷ phiếu", async () => {
    renderPending(ROLES.warehouseManager);
    expect(await screen.findByRole("button", { name: /Duyệt nhận vượt dung sai/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Từ chối phần vượt/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Huỷ phiếu/ })).toBeEnabled();
  });

  it("thiếu quyền APPROVE (NV kho) → không thấy nút duyệt, vẫn huỷ được phiếu chờ duyệt", async () => {
    renderPending(ROLES.warehouseStaff);
    expect(await screen.findByRole("button", { name: /Huỷ phiếu/ })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /Duyệt nhận vượt dung sai/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Từ chối phần vượt/ })).not.toBeInTheDocument();
  });

  it("chỉ xem → báo đang chờ Quản lý kho duyệt, không có nút nào", async () => {
    renderPending(ROLES.qcStaff);
    expect(await screen.findByText(/Đang chờ Quản lý kho duyệt/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Duyệt|Từ chối|Huỷ phiếu/ }),
    ).not.toBeInTheDocument();
  });

  it("Duyệt: bắt buộc lý do; gửi POST /approval { reason }", async () => {
    const user = userEvent.setup();
    const { post } = renderPending(ROLES.warehouseManager);
    await user.click(await screen.findByRole("button", { name: /Duyệt nhận vượt dung sai/ }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Duyệt nhận vượt dung sai" });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "  NCC giao thêm hàng tặng ");
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/approval`, { reason: "NCC giao thêm hàng tặng" }),
    );
  });

  it("Từ chối phần vượt: bắt buộc lý do; gửi POST /excess-rejection { reason }", async () => {
    const user = userEvent.setup();
    const { post } = renderPending(ROLES.warehouseManager);
    await user.click(await screen.findByRole("button", { name: /Từ chối phần vượt/ }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Từ chối phần vượt" });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Trả phần vượt cho NCC");
    await user.click(submit);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/excess-rejection`, {
        reason: "Trả phần vượt cho NCC",
      }),
    );
  });

  it("4 mắt: BE từ chối người tự duyệt → câu tiếng Việt TRONG dialog, lý do đã gõ được giữ", async () => {
    const user = userEvent.setup();
    const { post } = renderPending(ROLES.warehouseManager);
    post.mockImplementation(async (url: string) => {
      if (url === `${PATH}/approval`)
        throw new ApiError(409, "RECEIPT_SELF_APPROVAL", "A goods receipt cannot be decided by …");
      return { data: pending() };
    });
    await user.click(await screen.findByRole("button", { name: /Duyệt nhận vượt dung sai/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "tôi duyệt");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt nhận vượt dung sai" }));
    expect(
      await within(dialog).findByText(/không được tự quyết định phiếu đó/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox")).toHaveValue("tôi duyệt");
  });

  it("đã duyệt: phiếu hiện người duyệt, thời điểm và lý do; tồn đã ghi nhận nên có QC / chờ cất như thường", async () => {
    renderPending(
      ROLES.warehouseManager,
      apiReceipt({
        status: "IN_QC",
        confirmedAt: "2026-10-09T04:00:00Z",
        lines: [OVER_LINE],
        approval: {
          requestedAt: "2026-10-09T03:00:00Z",
          requestedBy: REQUESTER,
          requestedByName: "Lan (kho)",
          decision: "APPROVED",
          decidedAt: "2026-10-09T04:00:00Z",
          decidedBy: "0dd0c0de-0000-4000-8000-0000000000bb",
          decidedByName: "Minh (quản lý kho)",
          reason: "NCC giao thêm hàng tặng",
        },
      }),
    );
    expect(await screen.findByText("Đã duyệt — ghi nhận đủ SL đã đếm")).toBeInTheDocument();
    expect(screen.getByText("Minh (quản lý kho)")).toBeInTheDocument();
    expect(screen.getByText("NCC giao thêm hàng tặng")).toBeInTheDocument();
    expect(screen.queryByText("Chờ Quản lý kho duyệt")).not.toBeInTheDocument();
  });

  it("đã từ chối phần vượt: hiện quyết định EXCESS_REJECTED bằng tiếng Việt", async () => {
    renderPending(
      ROLES.warehouseManager,
      apiReceipt({
        status: "IN_PUTAWAY",
        confirmedAt: "2026-10-09T04:00:00Z",
        lines: [apiLine({ quantity: 105, qcProgress: "INSPECTED" })],
        approval: {
          requestedAt: "2026-10-09T03:00:00Z",
          requestedBy: REQUESTER,
          decision: "EXCESS_REJECTED",
          decidedAt: "2026-10-09T04:00:00Z",
          decidedBy: "0dd0c0de-0000-4000-8000-0000000000bb",
          reason: "Trả 5 thùng",
        },
      }),
    );
    expect(
      await screen.findByText("Đã từ chối phần vượt — chỉ ghi nhận tới dung sai"),
    ).toBeInTheDocument();
    // BE chưa trả tên: hiện id người duyệt
    expect(screen.getByText("0dd0c0de-0000-4000-8000-0000000000bb")).toBeInTheDocument();
  });
});
