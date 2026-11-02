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
const ITEM_URL = "/inventory/items/item-1";

const item = (over: Record<string, unknown> = {}) => ({
  id: "item-1",
  sku: "TSHIRT-RED-M",
  version: 3,
  logistics: {
    unitOfMeasure: "PCS",
    barcode: "8930000000011",
    weightKg: 0.25,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    packageWeightKg: null,
    packageLengthCm: null,
    packageWidthCm: null,
    packageHeightCm: null,
    packageCount: 1,
    packSize: 1,
    storageClass: "NORMAL",
    requiresAdultSignature: false,
    shippingRestrictionNote: null,
    qcRequired: false,
    rotatable: true,
  },
  policy: {
    reorderPoint: 10,
    safetyStock: 5,
    maxQty: 100,
    removalStrategy: "FIFO",
    trackingMode: "NONE",
    expiryTracked: false,
    maxShelfLifeDays: null,
  },
  evaluation: {
    usableOnHand: 8,
    reorderPoint: 10,
    safetyStock: 5,
    reorderRequired: true,
    belowSafetyStock: false,
  },
  ...over,
});

const mockGet = (permissions = ITEM_PERMISSION_SETS.editor, handler = () => item()) =>
  mockApiGet(permissions, { [ITEM_URL]: handler });
const itemGets = (get: ReturnType<typeof mockApiGet>) =>
  get.mock.calls.filter(([url]) => url === ITEM_URL);

async function openPolicyForm() {
  await userEvent.click(await screen.findByRole("button", { name: L.editPolicy }));
}

describe("InventoryItemDetail", () => {
  it("editor thấy cả hai nút Sửa; mở sửa chính sách thì nút Sửa logistics biến mất", async () => {
    mockGet();
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);

    expect(await screen.findByRole("button", { name: L.editLogistics })).toBeInTheDocument();
    await openPolicyForm();

    expect(screen.queryByRole("button", { name: L.editLogistics })).toBeNull();
    expect(screen.getByLabelText(L.field.reorderPoint)).toBeInTheDocument();
  });

  it("lưu chính sách → PUT kèm version của item; thẻ đánh giá hiện giá trị mới từ response", async () => {
    mockGet();
    const saved = item({
      version: 4,
      policy: { ...item().policy, reorderPoint: 20 },
      evaluation: { ...item().evaluation, usableOnHand: 77, reorderRequired: false },
    });
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: saved });
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();

    const reorder = screen.getByLabelText(L.field.reorderPoint);
    await userEvent.clear(reorder);
    await userEvent.type(reorder, "20");
    await userEvent.click(screen.getByRole("button", { name: L.savePolicy }));

    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `${ITEM_URL}/policy`,
        expect.objectContaining({ version: 3, reorderPoint: 20 }),
      ),
    );
    expect(await screen.findByText("77")).toBeInTheDocument();
    expect(screen.queryByLabelText(L.field.reorderPoint)).toBeNull();
  });

  it("readOnly (nhân viên kho) → không có nút Sửa nào", async () => {
    mockGet(ITEM_PERMISSION_SETS.readOnly);
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);

    expect((await screen.findAllByText("TSHIRT-RED-M")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: L.editLogistics })).toBeNull();
    expect(screen.queryByRole("button", { name: L.editPolicy })).toBeNull();
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

  it("PUT trả 409 OPTIMISTIC_LOCK → tải lại item và hiện câu OPTIMISTIC_LOCK", async () => {
    const get = mockGet();
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "stale"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();
    await vi.waitFor(() => expect(itemGets(get)).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: L.savePolicy }));

    expect(
      await screen.findByText(INVENTORY_ITEM_ERROR_MESSAGES.OPTIMISTIC_LOCK),
    ).toBeInTheDocument();
    await vi.waitFor(() => expect(itemGets(get).length).toBeGreaterThan(1));
  });

  it("tồn tối đa < điểm đặt lại → lỗi inline ở ô tồn tối đa và nút Lưu bị khoá", async () => {
    mockGet();
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();

    const max = screen.getByLabelText(L.field.maxQty);
    await userEvent.clear(max);
    await userEvent.type(max, "3");

    expect(
      await screen.findByText(INVENTORY_ITEM_ERROR_MESSAGES.INVENTORY_MAX_QTY_BELOW_THRESHOLD),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.savePolicy })).toBeDisabled();
  });

  it("tắt theo dõi hạn dùng khi đang có số ngày → Lưu bật, PUT gửi maxShelfLifeDays null", async () => {
    mockGet(ITEM_PERMISSION_SETS.editor, () =>
      item({
        policy: {
          ...item().policy,
          trackingMode: "LOT",
          removalStrategy: "FEFO",
          expiryTracked: true,
          maxShelfLifeDays: 365,
        },
      }),
    );
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: item() });
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();
    expect(screen.getByLabelText(L.field.maxShelfLifeDays)).toHaveValue("365");

    await userEvent.click(screen.getByLabelText(L.field.expiryTracked));

    expect(screen.queryByLabelText(L.field.maxShelfLifeDays)).toBeNull();
    const save = screen.getByRole("button", { name: L.savePolicy });
    await vi.waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `${ITEM_URL}/policy`,
        expect.objectContaining({ expiryTracked: false, maxShelfLifeDays: null }),
      ),
    );
  });

  it("đổi điểm đặt lại làm lỗi tồn tối đa hiện / mất theo, Lưu khoá / mở lại", async () => {
    mockGet();
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();
    const max = screen.getByLabelText(L.field.maxQty);
    const reorder = screen.getByLabelText(L.field.reorderPoint);
    const msg = INVENTORY_ITEM_ERROR_MESSAGES.INVENTORY_MAX_QTY_BELOW_THRESHOLD;
    await userEvent.clear(max);
    await userEvent.type(max, "50");
    await userEvent.clear(reorder);
    await userEvent.type(reorder, "60");

    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.savePolicy })).toBeDisabled();

    await userEvent.clear(reorder);
    await userEvent.type(reorder, "40");

    await vi.waitFor(() => expect(screen.queryByText(msg)).toBeNull());
    expect(screen.getByRole("button", { name: L.savePolicy })).toBeEnabled();
  });

  it("sửa logistics: đổi khối lượng → PUT kèm version + weightKg, form đóng", async () => {
    mockGet();
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: item({ version: 4 }) });
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await userEvent.click(await screen.findByRole("button", { name: L.editLogistics }));

    const weight = screen.getByLabelText(L.field.weightKg);
    await userEvent.clear(weight);
    await userEvent.type(weight, "0.5");
    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `${ITEM_URL}/logistics`,
        expect.objectContaining({ version: 3, weightKg: 0.5 }),
      ),
    );
    await vi.waitFor(() => expect(screen.queryByLabelText(L.field.weightKg)).toBeNull());
  });

  it("BE #121: item không cho xoay kiện → xem hiện Không; lưu logistics gửi rotatable false", async () => {
    mockGet(ITEM_PERMISSION_SETS.editor, () =>
      item({ logistics: { ...item().logistics, rotatable: false } }),
    );
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: item({ version: 4 }) });
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    expect(await screen.findByText(L.field.rotatable)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: L.editLogistics }));

    expect(screen.getByLabelText(L.field.rotatable)).not.toBeChecked();
    const weight = screen.getByLabelText(L.field.weightKg);
    await userEvent.clear(weight);
    await userEvent.type(weight, "0.5");
    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `${ITEM_URL}/logistics`,
        expect.objectContaining({ version: 3, rotatable: false }),
      ),
    );
  });

  it("sửa logistics: 409 UOM_CONVERSION_DUPLICATE → lỗi ngay ô đơn vị tính, không alert", async () => {
    mockGet();
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "UOM_CONVERSION_DUPLICATE", "dup"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await userEvent.click(await screen.findByRole("button", { name: L.editLogistics }));
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

  it("sửa logistics: 409 CONFLICT → alert mã vạch đã dùng, form vẫn mở", async () => {
    mockGet();
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "CONFLICT", "dup"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await userEvent.click(await screen.findByRole("button", { name: L.editLogistics }));

    await userEvent.click(screen.getByRole("button", { name: L.saveLogistics }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      INVENTORY_ITEM_ERROR_MESSAGES.CONFLICT,
    );
    expect(screen.getByLabelText(L.field.weightKg)).toBeInTheDocument();
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

  it("409 → sau khi tải lại item, form hiện giá trị mới và alert vẫn còn", async () => {
    let calls = 0;
    mockGet(ITEM_PERMISSION_SETS.editor, () => {
      calls += 1;
      return calls === 1
        ? item()
        : item({ version: 4, policy: { ...item().policy, reorderPoint: 55 } });
    });
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "stale"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();

    await userEvent.click(screen.getByRole("button", { name: L.savePolicy }));

    await vi.waitFor(() => expect(screen.getByLabelText(L.field.reorderPoint)).toHaveValue("55"));
    expect(screen.getByText(INVENTORY_ITEM_ERROR_MESSAGES.OPTIMISTIC_LOCK)).toBeInTheDocument();
  });

  /** GET đầu trả version 3; mọi GET sau trả version 4 với điểm đặt lại 55 (người khác vừa sửa). */
  const newerAfterFirst = () => {
    let calls = 0;
    return mockGet(ITEM_PERMISSION_SETS.editor, () => {
      calls += 1;
      return calls === 1
        ? item()
        : item({ version: 4, policy: { ...item().policy, reorderPoint: 55 } });
    });
  };

  it("form đang sửa dở + refetch nền ra version mới → giữ giá trị đang nhập, báo, vẫn gửi version cũ", async () => {
    const get = newerAfterFirst();
    const put = vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "x"));
    const { client } = renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();
    const reorder = screen.getByLabelText(L.field.reorderPoint);
    await userEvent.clear(reorder);
    await userEvent.type(reorder, "20");

    await act(() => client.invalidateQueries());
    await vi.waitFor(() => expect(itemGets(get)).toHaveLength(2));

    expect(await screen.findByText(L.outdatedNotice)).toBeInTheDocument();
    expect(screen.getByLabelText(L.field.reorderPoint)).toHaveValue("20");
    await userEvent.click(screen.getByRole("button", { name: L.savePolicy }));
    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        `${ITEM_URL}/policy`,
        expect.objectContaining({ version: 3, reorderPoint: 20 }),
      ),
    );
    // 409 → nạp lại theo dữ liệu mới, bỏ thông báo
    await vi.waitFor(() => expect(screen.getByLabelText(L.field.reorderPoint)).toHaveValue("55"));
    expect(screen.queryByText(L.outdatedNotice)).toBeNull();
  });

  it("form chưa sửa + refetch nền ra version mới → form hiện giá trị mới, không báo", async () => {
    const get = newerAfterFirst();
    const { client } = renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();

    await act(() => client.invalidateQueries());
    await vi.waitFor(() => expect(itemGets(get)).toHaveLength(2));

    await vi.waitFor(() => expect(screen.getByLabelText(L.field.reorderPoint)).toHaveValue("55"));
    expect(screen.queryByText(L.outdatedNotice)).toBeNull();
  });

  it("form sửa dở + 409 → tải lại và nạp giá trị mới dù form đang dirty", async () => {
    newerAfterFirst();
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(409, "OPTIMISTIC_LOCK", "stale"));
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    await openPolicyForm();
    const reorder = screen.getByLabelText(L.field.reorderPoint);
    await userEvent.clear(reorder);
    await userEvent.type(reorder, "20");

    await userEvent.click(screen.getByRole("button", { name: L.savePolicy }));

    await vi.waitFor(() => expect(screen.getByLabelText(L.field.reorderPoint)).toHaveValue("55"));
    expect(screen.getByText(INVENTORY_ITEM_ERROR_MESSAGES.OPTIMISTIC_LOCK)).toBeInTheDocument();
  });

  it("phiên bản bản ghi là một dòng của thẻ đánh giá (trang không còn phụ đề)", async () => {
    mockGet();
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    const term = await screen.findByText(L.field.version);
    expect(term.nextElementSibling).toHaveTextContent("3");
  });

  it("đánh giá: cần đặt lại = amber, dưới tồn an toàn = đỏ, null = chưa đặt ngưỡng", async () => {
    mockGet(ITEM_PERMISSION_SETS.readOnly, () =>
      item({
        evaluation: {
          usableOnHand: 1,
          reorderPoint: 10,
          safetyStock: 5,
          reorderRequired: true,
          belowSafetyStock: true,
        },
      }),
    );
    const { unmount } = renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    const rows = await screen.findAllByText(L.evaluation.yes);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass("text-warning");
    expect(rows[1]).toHaveClass("text-danger");
    unmount();

    mockGet(ITEM_PERMISSION_SETS.readOnly, () =>
      item({
        evaluation: {
          usableOnHand: 1,
          reorderPoint: null,
          safetyStock: null,
          reorderRequired: null,
          belowSafetyStock: null,
        },
      }),
    );
    renderInventoryScreen(<InventoryItemDetail id="item-1" />);
    expect(await screen.findAllByText(L.evaluation.unset)).toHaveLength(2);
  });
});
