import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_ITEM_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { ITEM_PERMISSION_SETS, mockApiGet, renderInventoryScreen } from "../__fixtures__/render";
import { InventoryItemDetail } from "./detail/InventoryItemDetail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const L = UI_LABELS.inventoryItem;
const R = L.stockRules;
const ITEM_URL = "/inventory/items/item-1";
const NEWER_BARCODE = "8930000000075";

/** BE `InventoryItemResponse` sau BE #396 — logistics chỉ còn đơn vị tính, mã vạch, cờ xoay (docs 01 BR-03). */
const item = (over: Record<string, unknown> = {}, logistics: Record<string, unknown> = {}) => ({
  id: "item-1",
  sku: "TSHIRT-RED-M",
  version: 3,
  logistics: {
    unitOfMeasure: "PCS",
    barcode: "8930000000011",
    rotatable: true,
    ...logistics,
  },
  ...over,
});

const mockGet = (permissions = ITEM_PERMISSION_SETS.editor, handler = () => item()) =>
  mockApiGet(permissions, { [ITEM_URL]: handler });
const itemGets = (get: ReturnType<typeof mockApiGet>) =>
  get.mock.calls.filter(([url]) => url === ITEM_URL);

async function openLogisticsForm() {
  await userEvent.click(await screen.findByRole("button", { name: L.editLogistics }));
}
const barcodeInput = () => screen.getByLabelText(L.field.barcode);
async function typeBarcode(value: string) {
  await userEvent.clear(barcodeInput());
  await userEvent.type(barcodeInput(), value);
}

describe("InventoryItemDetail", () => {
  it("hiện logistics và chính sách tồn cố định (lô, không serial, không hạn dùng, FIFO), không có nút sửa chính sách", async () => {
    mockGet();
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);

    expect(await screen.findByText("PCS")).toBeInTheDocument();
    expect(screen.getByText("8930000000011")).toBeInTheDocument();
    // BE #396: hồ sơ không còn khối lượng / kích thước / kiện — số đo ở quy cách thùng
    expect(screen.queryByText(/\d kg|\d cm/)).toBeNull();
    for (const value of [R.trackingValue, R.removalValue]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(screen.getAllByText(R.serialValue)).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Sửa/ })).toHaveLength(1);
  });

  it("readOnly (nhân viên kho) → không có nút Sửa", async () => {
    mockGet(ITEM_PERMISSION_SETS.readOnly);
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);

    expect(await screen.findByText("PCS")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.editLogistics })).toBeNull();
  });

  it("không có quyền → câu không có quyền, không GET item", async () => {
    const get = mockGet(ITEM_PERMISSION_SETS.none);
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);

    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
    expect(itemGets(get)).toHaveLength(0);
  });

  it("chỉ VIEW_PAGE (thiếu READ) → báo không có quyền xem dữ liệu, không GET item", async () => {
    const get = mockGet(ITEM_PERMISSION_SETS.viewOnly);
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);

    expect(await screen.findByText(UI_LABELS.loadError.noReadTitle)).toBeInTheDocument();
    expect(itemGets(get)).toHaveLength(0);
  });

  it("sửa logistics: form không còn số đo / điều kiện lưu kho / QC; đổi mã vạch → PUT đúng 4 trường, form đóng", async () => {
    mockGet();
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: item({ version: 4 }) });
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openLogisticsForm();
    expect(screen.queryByText("Điều kiện lưu kho")).toBeNull();
    expect(screen.queryByText("Nhập kho đi qua khu QC")).toBeNull();
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);

    await typeBarcode("8930000000099");
    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith(`${ITEM_URL}/logistics`, {
        version: 3,
        unitOfMeasure: "PCS",
        barcode: "8930000000099",
        rotatable: true,
      }),
    );
    await vi.waitFor(() => expect(screen.queryByLabelText(L.field.barcode)).toBeNull());
  });

  it("item không cho xoay kiện → xem hiện Không; lưu logistics gửi rotatable false", async () => {
    mockGet(ITEM_PERMISSION_SETS.editor, () => item({}, { rotatable: false }));
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: item({ version: 4 }) });
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    const term = await screen.findByText(L.field.rotatable);
    expect(term.nextElementSibling).toHaveTextContent(L.no);
    await openLogisticsForm();

    expect(screen.getByLabelText(L.field.rotatable)).not.toBeChecked();
    await typeBarcode("8930000000099");
    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `${ITEM_URL}/logistics`,
        expect.objectContaining({ version: 3, rotatable: false }),
      ),
    );
  });

  it("409 UOM_CONVERSION_DUPLICATE → lỗi ngay ô đơn vị tính, không alert", async () => {
    mockGet();
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "UOM_CONVERSION_DUPLICATE", "dup"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openLogisticsForm();
    const uom = screen.getByLabelText(`${L.field.unitOfMeasure} *`);
    await userEvent.clear(uom);
    await userEvent.type(uom, "BOX");

    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    expect(
      await screen.findByText(INVENTORY_ITEM_ERROR_MESSAGES.UOM_CONVERSION_DUPLICATE),
    ).toBeInTheDocument();
    expect(uom).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("409 CONFLICT (mã vạch trùng) → lỗi ngay ô mã vạch, form vẫn mở", async () => {
    mockGet();
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "CONFLICT", "dup"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openLogisticsForm();

    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    expect(await screen.findByText(INVENTORY_ITEM_ERROR_MESSAGES.CONFLICT)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(barcodeInput()).toBeInTheDocument();
  });

  it("409 VARIANT_OBSOLETE (SKU ngừng dùng) → alert chỉ còn xem", async () => {
    mockGet();
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "VARIANT_OBSOLETE", "obsolete"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openLogisticsForm();

    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      INVENTORY_ITEM_ERROR_MESSAGES.VARIANT_OBSOLETE,
    );
  });

  it("GET item ném 404 INVENTORY_ITEM_NOT_FOUND → câu notFound và link về danh sách", async () => {
    mockGet(ITEM_PERMISSION_SETS.editor, () => {
      throw new ApiError(404, "INVENTORY_ITEM_NOT_FOUND", "not found");
    });
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);

    expect(await screen.findByText(L.notFound)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: UI_LABELS.common.backToList })).toHaveAttribute(
      "href",
      "/admin/inventory-items",
    );
  });

  /** GET đầu trả version 3; mọi GET sau trả version 4 với mã vạch khác (người khác vừa sửa). */
  const newerAfterFirst = () => {
    let calls = 0;
    return mockGet(ITEM_PERMISSION_SETS.editor, () => {
      calls += 1;
      return calls === 1 ? item() : item({ version: 4 }, { barcode: NEWER_BARCODE });
    });
  };

  it("PUT trả 409 OPTIMISTIC_LOCK → tải lại item, form nạp giá trị mới, alert còn", async () => {
    const get = newerAfterFirst();
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "stale"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openLogisticsForm();
    await typeBarcode("8930000000050");

    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    await vi.waitFor(() => expect(itemGets(get).length).toBeGreaterThan(1));
    await vi.waitFor(() => expect(barcodeInput()).toHaveValue(NEWER_BARCODE));
    expect(screen.getByText(INVENTORY_ITEM_ERROR_MESSAGES.OPTIMISTIC_LOCK)).toBeInTheDocument();
  });

  it("form đang sửa dở + refetch nền ra version mới → giữ giá trị đang nhập, báo, vẫn gửi version cũ", async () => {
    const get = newerAfterFirst();
    const put = vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "x"));
    const { client } = renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openLogisticsForm();
    await typeBarcode("8930000000050");

    await act(() => client.invalidateQueries());
    await vi.waitFor(() => expect(itemGets(get)).toHaveLength(2));

    expect(await screen.findByText(L.outdatedNotice)).toBeInTheDocument();
    expect(barcodeInput()).toHaveValue("8930000000050");
    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));
    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `${ITEM_URL}/logistics`,
        expect.objectContaining({ version: 3, barcode: "8930000000050" }),
      ),
    );
    // 409 → nạp lại theo dữ liệu mới, bỏ thông báo
    await vi.waitFor(() => expect(barcodeInput()).toHaveValue(NEWER_BARCODE));
    expect(screen.queryByText(L.outdatedNotice)).toBeNull();
  });

  it("form chưa sửa + refetch nền ra version mới → form hiện giá trị mới, không báo", async () => {
    const get = newerAfterFirst();
    const { client } = renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openLogisticsForm();

    await act(() => client.invalidateQueries());
    await vi.waitFor(() => expect(itemGets(get)).toHaveLength(2));

    await vi.waitFor(() => expect(barcodeInput()).toHaveValue(NEWER_BARCODE));
    expect(screen.queryByText(L.outdatedNotice)).toBeNull();
  });
});
