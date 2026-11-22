import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RECEIPT_COUNT_LABELS,
  RECEIPT_ERROR_MESSAGES,
  UI_LABELS,
  WAREHOUSE_LOCATION_PERMISSIONS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  HCM_ID,
  PRODUCTION_ORDER_ID,
  PRODUCTION_ORDER_LINE_ID,
  RECEIPT_ID,
  apiLine,
  apiReceipt,
  cartonPackage,
  productionProgress,
} from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { ReceiptDetail } from "../ReceiptDetail";

import type { PermissionCode } from "@/lib/auth";
import type { GoodsReceiptApiDto } from "../../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/components/shared/Toast", () => ({ toast: { error: toastError, success: vi.fn() } }));

afterEach(() => vi.restoreAllMocks());

const C = RECEIPT_COUNT_LABELS.count;
const PATH = `/goods-receipts/${RECEIPT_ID}`;
const LID_LINE_ID = "6c2f3a4b-8d5e-4f9a-8c1d-000000000002";
const MANAGER: PermissionCode[] = [...ROLES.warehouseManager, WAREHOUSE_LOCATION_PERMISSIONS.read];

/** Đơn sản xuất PO-HCM-0007: ly 10 thùng × 50 (đã nhận 4), nắp 6 thùng × 24 (chưa nhận). */
const PRODUCTION_ORDER = {
  id: PRODUCTION_ORDER_ID,
  code: "PO-HCM-0007",
  status: "PARTIALLY_RECEIVED",
  receivingWarehouseId: HCM_ID,
  sampleApprovalRequired: false,
  needByDate: "2026-11-30",
  lines: [
    {
      id: PRODUCTION_ORDER_LINE_ID,
      sku: "CUP-PRINT-ACME-12OZ",
      cartons: 10,
      unitsPerCarton: 50,
      receivedCartons: 4,
    },
    {
      id: LID_LINE_ID,
      sku: "LID-PRINT-ACME-90",
      cartons: 6,
      unitsPerCarton: 24,
      receivedCartons: 0,
    },
  ],
};
const LAYOUT = {
  areas: [
    { code: "RCV01", type: "RECEIVING", name: "Khu nhận", usable: true, locationCode: "HCM-RCV01" },
  ],
};

/** Phiếu sau khi BE lưu `n` thùng của dòng ly — LPN do BE cấp. */
function savedWith(lpns: string[]): GoodsReceiptApiDto {
  return apiReceipt({
    lines: [
      apiLine({
        quantity: lpns.length * 50,
        packages: lpns.map((lpn, i) =>
          cartonPackage({ id: `c-${i}`, lpn, quantity: 50, receivedQty: 50, nominalQty: 50 }),
        ),
        production: productionProgress({
          thisReceiptCartons: lpns.length,
          remainingCartons: 6 - lpns.length,
        }),
      }),
    ],
  });
}

function renderCount(
  permissions: readonly PermissionCode[],
  onPut: (body: unknown) => GoodsReceiptApiDto,
  initial: GoodsReceiptApiDto = apiReceipt(),
) {
  let current = initial;
  const spies = mockReceiptApi(
    permissions,
    {
      [PATH]: () => current,
      [`/production-orders/${PRODUCTION_ORDER_ID}`]: () => PRODUCTION_ORDER,
      [`/warehouses/${HCM_ID}/layout`]: () => LAYOUT,
    },
    {},
    {
      [`${PATH}/lines`]: (_params, body) => {
        current = onPut(body);
        return current;
      },
    },
  );
  renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
  return spies;
}

const newCartons = (sku: string) =>
  screen.findByRole("spinbutton", { name: C.newCartonsAria(sku) });

describe("Kiểm đếm theo thùng — phiếu nháp theo Đơn sản xuất (docs 03 §4.1 bước 2–5)", () => {
  it("lưu → gửi thùng mới không LPN; lưu lần sau gửi lại LPN BE đã cấp, không tạo thùng trùng", async () => {
    const user = userEvent.setup();
    const { put } = renderCount(MANAGER, (body) => {
      const lines = (body as { lines: { packages: unknown[] }[] }).lines;
      const count = lines[0]?.packages.length ?? 0;
      return savedWith(Array.from({ length: count }, (_, i) => `LPN-20261120-00000${i + 1}`));
    });

    const cups = await newCartons("CUP-PRINT-ACME-12OZ");
    await user.clear(cups);
    await user.type(cups, "2");
    await user.click(screen.getByRole("button", { name: C.save }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[1]).toEqual({
      lines: [
        {
          productionOrderLineId: PRODUCTION_ORDER_LINE_ID,
          locationCode: "HCM-RCV01",
          packages: [{}, {}],
        },
      ],
    });

    // Form nhận lại thùng có LPN; thêm 1 thùng rồi lưu tiếp
    expect(
      await screen.findByRole("button", { name: C.removeCarton("LPN-20261120-000002") }),
    ).toBeInTheDocument();
    const again = await newCartons("CUP-PRINT-ACME-12OZ");
    expect(again).toHaveValue(0);
    await user.clear(again);
    await user.type(again, "1");
    await user.click(screen.getByRole("button", { name: C.save }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1]?.[1]).toEqual({
      lines: [
        {
          productionOrderLineId: PRODUCTION_ORDER_LINE_ID,
          locationCode: "HCM-RCV01",
          packages: [{ lpn: "LPN-20261120-000001" }, { lpn: "LPN-20261120-000002" }, {}],
        },
      ],
    });
  });

  it("bỏ một thùng đã dán nhãn → thùng không gửi (BE Void), Xác nhận khoá tới khi lưu", async () => {
    const user = userEvent.setup();
    const { put } = renderCount(MANAGER, () => savedWith(["LPN-A"]), savedWith(["LPN-A", "LPN-B"]));

    await user.click(await screen.findByRole("button", { name: C.removeCarton("LPN-B") }));
    expect(screen.getByRole("button", { name: UI_LABELS.receipt.action.confirm })).toBeDisabled();
    expect(screen.getByText(C.dirtyBlocksConfirm)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: C.save }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]?.[1]).toEqual({
      lines: [
        {
          productionOrderLineId: PRODUCTION_ORDER_LINE_ID,
          locationCode: "HCM-RCV01",
          packages: [{ lpn: "LPN-A" }],
        },
      ],
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: UI_LABELS.receipt.action.confirm })).toBeEnabled(),
    );
  });

  it("BR-02 phía client: nhập vượt số thùng còn nhận được → báo ngay ở ô, không gọi BE", async () => {
    const user = userEvent.setup();
    const { put } = renderCount(MANAGER, () => apiReceipt());
    const lids = await newCartons("LID-PRINT-ACME-90");
    await user.clear(lids);
    await user.type(lids, "7");
    await user.click(screen.getByRole("button", { name: C.save }));
    expect(await screen.findByText(/Vượt số thùng còn nhận được \(6\)/)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it("lỗi BE lines[0] khi dòng form đầu không được gửi → báo đúng ô của dòng nắp", async () => {
    const user = userEvent.setup();
    renderCount(MANAGER, () => {
      throw new ApiError(
        409,
        "RECEIPT_EXCEEDS_PRODUCTION_ORDER",
        "Receipt line: 7 cartons",
        { "lines[0].packages": "7 cartons" },
        undefined,
        { "lines[0].packages": "RECEIPT_EXCEEDS_PRODUCTION_ORDER" },
      );
    });
    const lids = await newCartons("LID-PRINT-ACME-90");
    await user.clear(lids);
    await user.type(lids, "3");
    await user.click(screen.getByRole("button", { name: C.save }));

    const row = (await screen.findByRole("rowheader", { name: /LID-PRINT-ACME-90/ })).closest("tr");
    expect(row).not.toBeNull();
    expect(
      await within(row as HTMLElement).findByText(
        RECEIPT_ERROR_MESSAGES.RECEIPT_EXCEEDS_PRODUCTION_ORDER,
      ),
    ).toBeInTheDocument();
  });

  it("lỗi dữ liệu cũ (thùng đã đổi ở nơi khác) → báo toast, tải lại phiếu", async () => {
    const user = userEvent.setup();
    const { get } = renderCount(
      MANAGER,
      () => {
        throw new ApiError(404, "STOCK_PACKAGE_NOT_FOUND", "LPN-A is not a RECEIVING carton");
      },
      savedWith(["LPN-A"]),
    );
    const receiptCalls = () => get.mock.calls.filter(([url]) => url === PATH).length;
    const cups = await newCartons("CUP-PRINT-ACME-12OZ");
    const before = receiptCalls();
    await user.clear(cups);
    await user.type(cups, "1");
    await user.click(screen.getByRole("button", { name: C.save }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(RECEIPT_ERROR_MESSAGES.STOCK_PACKAGE_NOT_FOUND),
    );
    await waitFor(() => expect(receiptCalls()).toBeGreaterThan(before));
  });

  it("NV kho thiếu production-orders:READ → báo lý do, không có form, không gọi Đơn sản xuất", async () => {
    const { get } = renderCount(ROLES.warehouseStaff, () => apiReceipt());
    expect(await screen.findByText(RECEIPT_COUNT_LABELS.noProductionRead)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: C.save })).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/production-orders"))).toBe(
      false,
    );
  });

  it("phiếu đã xác nhận (In Putaway) → không có khối kiểm đếm, không gọi Đơn sản xuất", async () => {
    const { get } = renderCount(
      MANAGER,
      () => apiReceipt(),
      apiReceipt({ status: "IN_PUTAWAY", lines: [apiLine()] }),
    );
    await screen.findAllByText("PO-HCM-0007");
    expect(screen.queryByRole("heading", { name: C.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: C.save })).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/production-orders"))).toBe(
      false,
    );
  });
});
