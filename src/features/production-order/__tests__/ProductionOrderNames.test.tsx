/**
 * Đơn sản xuất hiện tên thay UUID / mã (FE#286), gửi lỗi nói rõ việc tiếp theo, ngày nhanh khi nhận đơn, lối lập phiếu
 * nhập — nhóm sửa giao diện sản xuất / kho (S11-1, S11-2, S11-3, S11-7, S12-1).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GOODS_RECEIPT_PERMISSIONS, PRODUCTION_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { addDays, todayIso } from "@/lib/date-range";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";

import { ProductionOrderDetail } from "../components/ProductionOrderDetail";
import { ProductionOrderList } from "../components/ProductionOrderList";
import {
  bePage,
  COORDINATOR_ID,
  PRODUCTION_ACTORS,
  producerDto,
  productionOrder,
} from "../__fixtures__/production-order";

import type { PermissionCode } from "@/lib/auth";
import type { ProductionOrder } from "../types";

const A = PRODUCTION_LABELS.actions;
const D = PRODUCTION_LABELS.dialogs;
const ID = productionOrder().id;
const URL = `/production-orders/${ID}`;

const NAMED = {
  salesOrderNumber: "SO-20261126-000012",
  customerName: "Công ty TNHH Trà Sữa Mây",
  customerCode: "0312345678",
  producerName: "In Minh Phát",
  receivingWarehouseCode: "HNI",
  receivingWarehouseName: "Kho Hà Nội",
  drawnUpByName: "Võ Thị Điều Phối",
  sentByName: "Võ Thị Điều Phối",
} satisfies Partial<ProductionOrder>;

function setup(
  order: ProductionOrder,
  options: {
    permissions?: readonly PermissionCode[];
    dispatch?: unknown;
    sending?: () => unknown;
  } = {},
) {
  const apiSpies = mockProductionApi(options.permissions ?? PRODUCTION_ACTORS.coordinator, {
    get: {
      [URL]: () => order,
      "/delay-alerts": () => bePage([]),
      "/producers": () => bePage([producerDto]),
      [`/orders/${order.salesOrderId}/delivery-batches`]: () => ({
        orderId: order.salesOrderId,
        orderNumber: "SO-FALLBACK",
        batches: [],
      }),
      [`${URL}/dispatch`]: () => options.dispatch ?? { channel: "EMAIL", messages: bePage([]) },
    },
    post: {
      [`${URL}/sending`]: options.sending ?? (() => ({ ...order, status: "SENT" })),
    },
  });
  renderProductionScreen(<ProductionOrderDetail id={ID} />, COORDINATOR_ID);
  return apiSpies;
}

afterEach(() => vi.restoreAllMocks());

describe("Chi tiết Đơn sản xuất — tên thay mã / UUID (S11-1, FE#286)", () => {
  it("hiện số đơn bán, tên khách, tên kho, tên người lập; mã Đơn sản xuất một dòng", async () => {
    setup(
      productionOrder({
        ...NAMED,
        history: [
          {
            to: "DRAFT",
            by: COORDINATOR_ID,
            byName: "Võ Thị Điều Phối",
            at: "2026-11-20T02:00:00Z",
          },
        ],
      }),
    );
    expect(await screen.findByText("SO-20261126-000012")).toBeInTheDocument();
    expect(screen.getByText("Công ty TNHH Trà Sữa Mây")).toBeInTheDocument();
    expect(screen.getByText("Kho Hà Nội")).toBeInTheDocument();
    // Người đang đăng nhập là người lập: tên + (bạn), không còn chữ "Bạn" trơ trọi
    expect(screen.getAllByText("Võ Thị Điều Phối (bạn)").length).toBeGreaterThan(0);
    expect(screen.queryByText(PRODUCTION_LABELS.detail.you)).toBeNull();
    // Không còn mã nhân viên rút gọn kiểu "NV 2c112e51"
    expect(screen.queryByText(/^NV [0-9a-f]{8}/)).toBeNull();
    expect(screen.getByText(productionOrder().code)).toHaveClass("whitespace-nowrap");
  });

  it("thiếu tên (đơn cũ): người khác là 'Nhân viên', không UUID; kho '—'", async () => {
    setup(
      productionOrder({
        drawnUpBy: "99999999-9999-4999-8999-999999999999",
        capacity: null,
        customerId: null,
      }),
    );
    await screen.findByText(productionOrder().code);
    expect(screen.getAllByText(PRODUCTION_LABELS.detail.unknownUser).length).toBeGreaterThan(0);
    expect(screen.queryByText(/99999999/)).toBeNull();
  });

  it("đơn vị sản xuất: danh mục (mã · tên) khi đọc được, thiếu quyền thì dùng tên BE kèm sẵn", async () => {
    setup(productionOrder({ ...NAMED }), {
      permissions: PRODUCTION_ACTORS.warehouseManager.filter(
        (code) => !code.startsWith("sales-producers"),
      ),
    });
    expect(await screen.findByText("In Minh Phát")).toBeInTheDocument();
  });
});

describe("Danh sách Đơn sản xuất — tên kho, trạng thái không bị cắt (S11-7)", () => {
  it("cột Kho nhận hiện tên kho (mã nhỏ dưới); cột Trạng thái ghim phải, không xuống dòng", async () => {
    mockProductionApi(PRODUCTION_ACTORS.coordinator, {
      get: {
        "/production-orders": () =>
          bePage([productionOrder({ ...NAMED, status: "IN_PRODUCTION" })]),
        "/producers": () => bePage([producerDto]),
        "/warehouses": () => bePage([]),
      },
    });
    renderProductionScreen(<ProductionOrderList />, COORDINATOR_ID);
    expect(await screen.findByText("Kho Hà Nội")).toBeInTheDocument();
    expect(screen.getByText("HNI")).toBeInTheDocument();
    const status = screen.getByRole("columnheader", { name: "Trạng thái" });
    expect(status).toHaveClass("sticky");
  });
});

describe("Gửi Đơn sản xuất — câu có bước tiếp (S11-2)", () => {
  it("hộp xác nhận có ba ý ngắn, không thuật ngữ 'Sales Manager'", async () => {
    const user = userEvent.setup();
    setup(productionOrder());
    await user.click(await screen.findByRole("button", { name: A.send }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    expect(dialog).not.toHaveTextContent(/Sales Manager/);
  });

  it("lỗi kho tệp (STORAGE_ERROR): nói đơn còn Nháp + việc tiếp theo, nút đổi thành Thử lại, bấm lại gửi lại", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const { post } = setup(productionOrder(), {
      sending: () => {
        calls += 1;
        if (calls === 1) throw new ApiError(500, "STORAGE_ERROR", "x");
        return productionOrder({ status: "SENT" });
      },
    });
    await user.click(await screen.findByRole("button", { name: A.send }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: A.send }));
    expect(await within(dialog).findByText(D.sendStorageError)).toBeInTheDocument();
    expect(D.sendStorageError).toMatch(/Nháp/);
    expect(D.sendStorageError).toMatch(/Quản trị hệ thống/);
    await user.click(within(dialog).getByRole("button", { name: D.retry }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });

  it("đã gửi mà thư lỗi → cảnh báo ngay cạnh trạng thái; gửi lại thành công thì hết cảnh báo", async () => {
    const failed = {
      channel: "EMAIL",
      messages: bePage([
        { message: "production_order_sent", status: "FAILED", attemptNumber: 1, generation: 0 },
      ]),
    };
    setup(
      productionOrder({ status: "SENT", sentAt: "2026-11-20T03:00:00Z", sentBy: COORDINATOR_ID }),
      {
        dispatch: failed,
      },
    );
    expect(await screen.findByText(PRODUCTION_LABELS.dispatch.mailFailed)).toBeInTheDocument();
  });
});

describe("Ghi nhận nhận đơn — ngày nhanh (S11-3)", () => {
  it("chưa có ngày: dòng nói vì sao chưa Xác nhận được; bấm 'Sau 7 ngày' → có ngày, nút Xác nhận mở", async () => {
    const user = userEvent.setup();
    setup(
      productionOrder({
        status: "SENT",
        sentAt: "2026-11-20T03:00:00Z",
        sentBy: COORDINATOR_ID,
        needByDate: addDays(todayIso(), 30),
      }),
    );
    await user.click(await screen.findByRole("button", { name: A.accept }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(D.expectedMissing)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: D.confirm })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: D.quickDays(7) }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: D.confirm })).toBeEnabled(),
    );
    expect(within(dialog).queryByText(D.expectedMissing)).toBeNull();
  });

  it("nút 'Bằng ngày cần hàng' điền đúng ngày cần hàng của đơn", async () => {
    const user = userEvent.setup();
    const needBy = addDays(todayIso(), 20);
    const { post } = setup(
      productionOrder({
        status: "SENT",
        sentAt: "2026-11-20T03:00:00Z",
        sentBy: COORDINATOR_ID,
        needByDate: needBy,
      }),
    );
    post.mockImplementation(async () => ({ data: productionOrder({ status: "ACCEPTED" }) }));
    await user.click(await screen.findByRole("button", { name: A.accept }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: D.quickNeedBy }));
    await user.click(within(dialog).getByRole("button", { name: D.confirm }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `${URL}/acceptance`,
        expect.objectContaining({ expectedCompletionDate: needBy }),
      ),
    );
  });
});

describe("Lập phiếu nhập từ Đơn sản xuất (S12-1)", () => {
  it("đơn nhận được hàng + có quyền lập phiếu → link mở hộp Lập phiếu đã chọn sẵn đơn này", async () => {
    setup(productionOrder({ status: "IN_PRODUCTION", sampleApprovalRequired: false }), {
      permissions: [...PRODUCTION_ACTORS.coordinator, GOODS_RECEIPT_PERMISSIONS.create],
    });
    const link = await screen.findByRole("link", { name: A.createReceipt });
    expect(link).toHaveAttribute("href", `/admin/receipts?productionOrder=${ID}`);
  });

  it("thiếu quyền lập phiếu, hoặc đơn chưa nhận được hàng → không có link", async () => {
    setup(productionOrder({ status: "IN_PRODUCTION", sampleApprovalRequired: false }));
    await screen.findByText(productionOrder().code);
    expect(screen.queryByRole("link", { name: A.createReceipt })).toBeNull();
  });
});
