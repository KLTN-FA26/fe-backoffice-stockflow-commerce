import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RECEIPT_CARTON_LABELS as L } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  CARTON_UNITS,
  PO_ID,
  apiBlindReceipt,
  RECEIPT_ID,
  apiLine,
  apiReceipt,
  cartonLine,
  cartonPackage,
  receivablePo,
} from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { ReceiptDetail } from "../ReceiptDetail";

import type { GoodsReceiptApiDto } from "../../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = `/goods-receipts/${RECEIPT_ID}`;

function renderDraft(receipt: GoodsReceiptApiDto, onPut: (body: unknown) => unknown) {
  const spies = mockReceiptApi(
    ROLES.warehouseManager,
    { [PATH]: () => receipt, [`/purchase-orders/${PO_ID}`]: () => receivablePo },
    {},
    { [`${PATH}/lines`]: (_p, body) => onPut(body) },
  );
  renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
  return spies;
}

describe("Lưu lại kiểm đếm giữ nguyên thùng (BE spec SCRUM-473 §3 rule 6: thùng không gửi lên = VOID)", () => {
  it("chỉ sửa ghi chú rồi lưu → body vẫn gửi đủ LPN + SL + đơn vị của dòng", async () => {
    const user = userEvent.setup();
    const receipt = apiReceipt({ lines: [cartonLine({ lotNumber: "L01" })] });
    const { put } = renderDraft(receipt, () => receipt);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.type(await screen.findByLabelText("Ghi chú dòng 1"), "móp góc");
    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]?.[1]).toEqual({
      lines: [
        expect.objectContaining({
          quantity: 4990,
          lotNumber: "L01",
          note: "móp góc",
          unitOfMeasure: "CARTON",
          packages: [
            { lpn: "LPN-20261024-000001", quantity: 1000 },
            { lpn: "LPN-20261024-000002", quantity: 980 },
          ],
        }),
      ],
    });
  });

  it("lưu lỗi mạng rồi bấm lưu lại cùng nội dung → cùng Idempotency-Key (không cấp LPN hai lần)", async () => {
    const user = userEvent.setup();
    const receipt = apiReceipt({ lines: [cartonLine({ lotNumber: "L01" })] });
    let calls = 0;
    const { put } = renderDraft(receipt, () => {
      calls += 1;
      if (calls === 1) throw new ApiError(0, "NETWORK_ERROR", "offline");
      return receipt;
    });

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.type(await screen.findByLabelText("Ghi chú dòng 1"), "x");
    const save = screen.getByRole("button", { name: /Lưu kiểm đếm/ });
    await user.click(save);
    expect(await screen.findByText(/Không kết nối được máy chủ/)).toBeInTheDocument();
    await user.click(save);

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    const keyOf = (call: number) =>
      (put.mock.calls[call]?.[2] as { headers?: Record<string, string> } | undefined)?.headers?.[
        "Idempotency-Key"
      ];
    expect(keyOf(0)).toEqual(expect.any(String));
    expect(keyOf(1)).toBe(keyOf(0));
  });
});

describe("Chia thùng trên form kiểm đếm (issue #104, BE spec SCRUM-473 §3)", () => {
  it("dòng đã lưu: chọn sẵn đơn vị đặt trên PO, thêm 2 thùng × 1000, sửa thùng 2 = 980 → hàng lẻ 3010; lưu gửi thùng mới không LPN", async () => {
    const user = userEvent.setup();
    const saved = apiLine({
      quantity: 4990,
      lotNumber: "L01",
      units: CARTON_UNITS,
      orderedUnitOfMeasure: "CARTON",
    });
    const receipt = apiReceipt({ lines: [saved] });
    const { put } = renderDraft(receipt, () => receipt);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.click(await screen.findByRole("button", { name: "Chia thùng dòng 1" }));
    expect(screen.getByRole("radio", { name: "CARTON (1000)" })).toBeChecked();
    expect(screen.getByText(L.lockedHint)).toBeInTheDocument();

    const count = screen.getByLabelText(L.addCount(1));
    await user.clear(count);
    await user.type(count, "2");
    await user.click(screen.getByRole("button", { name: `${L.addCartons} ${L.cartonsOf(1000)}` }));
    expect(screen.getByText(L.summary(2, 2000, 2990))).toBeInTheDocument();

    const second = screen.getByLabelText(L.cartonQuantity(L.newCartonLabel(2)));
    await user.clear(second);
    await user.type(second, "980");
    expect(screen.getByText(L.summary(2, 1980, 3010))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]?.[1]).toEqual({
      lines: [
        expect.objectContaining({
          unitOfMeasure: "CARTON",
          packages: [{ quantity: 1000 }, { quantity: 980 }],
        }),
      ],
    });
  });

  it("dòng có thùng: số lô chỉ đọc, không bỏ dòng được, đơn vị khoá", async () => {
    const user = userEvent.setup();
    const receipt = apiReceipt({ lines: [cartonLine({ lotNumber: "L01" })] });
    renderDraft(receipt, () => receipt);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    expect(await screen.findByLabelText("Số lô dòng 1")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Xoá dòng 1" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Chia thùng dòng 1" }));
    expect(screen.getByRole("radio", { name: "CARTON (1000)" })).toBeDisabled();
    expect(screen.getByText("LPN-20261024-000001")).toBeInTheDocument();
  });

  it("tách lô dòng có thùng (lô trống) → dòng mới gõ được lô, bỏ được; dòng gốc vẫn khoá", async () => {
    const user = userEvent.setup();
    const receipt = apiReceipt({ lines: [cartonLine({ lotNumber: null })] });
    renderDraft(receipt, () => receipt);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.click(await screen.findByRole("button", { name: "Tách lô dòng 1" }));
    expect(screen.getByLabelText("Số lô dòng 1")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Số lô dòng 2")).not.toHaveAttribute("readonly");
    await user.type(screen.getByLabelText("Số lô dòng 2"), "L02");
    expect(screen.getByLabelText("Số lô dòng 2")).toHaveValue("L02");
    expect(screen.getByRole("button", { name: "Xoá dòng 2" })).toBeEnabled();
  });

  it("xoá thùng đã có LPN phải xác nhận; lưu thì thùng đó không còn trong danh sách (BE VOID)", async () => {
    const user = userEvent.setup();
    const receipt = apiReceipt({ lines: [cartonLine({ lotNumber: "L01" })] });
    const { put } = renderDraft(receipt, () => receipt);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.click(await screen.findByRole("button", { name: "Chia thùng dòng 1" }));
    await user.click(screen.getByRole("button", { name: L.removeCarton("LPN-20261024-000001") }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(L.confirmRemoveTitle)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: L.confirmRemoveAction }));
    expect(screen.queryByText("LPN-20261024-000001")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Lưu kiểm đếm/ }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]?.[1]).toEqual({
      lines: [
        expect.objectContaining({
          packages: [{ lpn: "LPN-20261024-000002", quantity: 980 }],
        }),
      ],
    });
  });

  it("phiếu chưa lưu dòng nào: chưa chia thùng được, nhắc lưu trước", async () => {
    renderDraft(apiReceipt(), () => apiReceipt());
    expect(await screen.findAllByText(L.saveFirst)).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Chia thùng dòng 1" })).not.toBeInTheDocument();
  });
});

describe("Thùng đã đổi ở nơi khác (BE STOCK_PACKAGE_NOT_FOUND) → form nạp lại thùng mới", () => {
  it("lưu lỗi vì LPN đã bị huỷ ở máy khác → form bỏ LPN đó, lần lưu sau không gửi lại", async () => {
    const user = userEvent.setup();
    let current = apiReceipt({ lines: [cartonLine({ lotNumber: "L01" })] });
    const { put } = mockReceiptApi(
      ROLES.warehouseManager,
      { [PATH]: () => current, [`/purchase-orders/${PO_ID}`]: () => receivablePo },
      {},
      {
        [`${PATH}/lines`]: () => {
          if (put.mock.calls.length === 1) {
            // Máy khác đã bỏ thùng …002 trước khi lần lưu này tới BE
            current = apiReceipt({
              lines: [cartonLine({ lotNumber: "L01", packages: [cartonPackage()] })],
            });
            throw new ApiError(404, "STOCK_PACKAGE_NOT_FOUND", "No carton LPN-20261024-000002");
          }
          return current;
        },
      },
    );
    renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.type(await screen.findByLabelText("Ghi chú dòng 1"), "x");
    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));
    expect(await screen.findByText(/Không tìm thấy thùng này/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Chia thùng dòng 1" }));
    await waitFor(() => expect(screen.queryByText("LPN-20261024-000002")).not.toBeInTheDocument());
    expect(screen.getByText("LPN-20261024-000001")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Ghi chú dòng 1"), "y");
    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1]?.[1]).toEqual({
      lines: [
        expect.objectContaining({
          packages: [{ lpn: "LPN-20261024-000001", quantity: 1000 }],
        }),
      ],
    });
  });
});

describe("Phiếu không có PO: dòng có thùng bị khoá (BE RECEIPT_LINE_HAS_PACKAGES)", () => {
  it("dòng có thùng: SKU và số lô chỉ đọc, không xoá được; dòng không thùng vẫn sửa / xoá được", async () => {
    const user = userEvent.setup();
    const receipt = apiBlindReceipt({
      lines: [
        cartonLine({ purchaseOrderLineId: null, sku: "SOFA-3S-GREY", lotNumber: null }),
        apiLine({
          id: "a1b2c3d4-0000-4000-8000-000000000002",
          purchaseOrderLineId: null,
          sku: "TABLE-OAK-160",
        }),
      ],
    });
    mockReceiptApi(ROLES.warehouseManager, { [PATH]: () => receipt });
    renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    expect(await screen.findByLabelText("SKU dòng 1")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Số lô dòng 1")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Xoá dòng 1" })).toBeDisabled();
    expect(screen.getByLabelText("SKU dòng 2")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Xoá dòng 2" })).toBeEnabled();
    // Dòng có thùng hiện ô SKU chỉ đọc thay cho ô chọn hồ sơ hàng tồn (SCRUM-492)
    expect(screen.queryByRole("combobox", { name: "SKU dòng 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "SKU dòng 2" })).toBeInTheDocument();
  });

  it("thêm dòng cùng SKU với dòng có thùng (lô trống) → dòng mới gõ được lô", async () => {
    const user = userEvent.setup();
    const receipt = apiBlindReceipt({
      lines: [cartonLine({ purchaseOrderLineId: null, sku: "SOFA-3S-GREY", lotNumber: null })],
    });
    mockReceiptApi(ROLES.warehouseStaffNoInventory, { [PATH]: () => receipt });
    renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.click(await screen.findByRole("button", { name: /Thêm dòng/ }));
    await user.type(screen.getByLabelText("SKU dòng 2"), "SOFA-3S-GREY");
    expect(screen.getByLabelText("SKU dòng 2")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("Số lô dòng 2")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Xoá dòng 2" })).toBeEnabled();
  });
});
