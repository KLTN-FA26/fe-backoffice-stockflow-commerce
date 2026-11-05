import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  SUPPLIER_ITEM_ERROR_MESSAGES,
  SUPPLIER_ITEM_FIELD_MESSAGES,
  SUPPLIER_ITEM_UI_LABELS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { PERMISSION_SETS, mockApiGet, renderSupplierScreen } from "../../../__fixtures__/render";
import { apiSupplier, supplier } from "../../../__fixtures__/supplier";
import {
  apiItemPage,
  apiSupplierItem,
  apiSupplierItemOther,
} from "../../../__fixtures__/supplier-item";
import { SupplierItemsTab } from "./SupplierItemsTab";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler } from "../../../__fixtures__/render";
import type { SupplierDto } from "../../../types";

// Luồng mở dialog + gõ nhiều ô — chậm khi cả bộ test chạy song song
const SLOW = 20_000;

const ITEMS_PATH = `/suppliers/${apiSupplier.supplierId}/items`;
const PREFERRED_SKU = apiSupplierItem.sku;

function renderTab(
  permissions: readonly PermissionCode[],
  target: SupplierDto = supplier,
  { searchParams = "", items }: { searchParams?: string; items?: RouteHandler } = {},
) {
  const get = mockApiGet(permissions, { [ITEMS_PATH]: items ?? (() => apiItemPage()) });
  renderSupplierScreen(<SupplierItemsTab supplier={target} />, searchParams);
  return get;
}

afterEach(() => vi.restoreAllMocks());

describe("SupplierItemsTab — action-gating (procurement-supplier-items)", () => {
  it("chỉ có READ → thấy bảng, không có Thêm / Sửa / Xoá", async () => {
    renderTab(PERMISSION_SETS.itemsReadOnly);

    expect(await screen.findByText(PREFERRED_SKU)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm SKU" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sửa / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Xoá / })).not.toBeInTheDocument();
  });

  it("NCC Inactive → không có Thêm / Sửa, vẫn có Xoá, có dòng giải thích", async () => {
    renderTab(PERMISSION_SETS.procurementStaff, { ...supplier, status: "Inactive" });

    expect(await screen.findByText(PREFERRED_SKU)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm SKU" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Sửa ${PREFERRED_SKU}` })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Xoá ${PREFERRED_SKU}` })).toBeInTheDocument();
    expect(screen.getByText(/Nhà cung cấp không còn hoạt động/)).toBeInTheDocument();
  });

  it("lead time trống → 'Theo NCC (n ngày)', giá theo tiền tệ của dòng", async () => {
    renderTab(PERMISSION_SETS.itemsReadOnly);

    expect(await screen.findByText("Theo NCC (7 ngày)")).toBeInTheDocument();
    expect(screen.getByText("10 ngày")).toBeInTheDocument();
    expect(screen.getByText(/85\.000/)).toBeInTheDocument();
  });

  it("có quyền đọc hồ sơ hàng tồn → SKU là link tới hồ sơ; không có quyền → chữ thường", async () => {
    renderTab(PERMISSION_SETS.procurementStaff);
    const link = await screen.findByRole("link", { name: PREFERRED_SKU });
    expect(link).toHaveAttribute(
      "href",
      ADMIN_ROUTES.inventoryItems.detail(apiSupplierItem.inventoryItemId),
    );
  });

  it("thiếu inventory-inventory-items:READ → SKU không phải link", async () => {
    renderTab(PERMISSION_SETS.itemsReadOnly);
    expect(await screen.findByText(PREFERRED_SKU)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: PREFERRED_SKU })).not.toBeInTheDocument();
  });

  it("403 khi tải danh mục → câu nói về danh mục hàng, không về hồ sơ NCC", async () => {
    renderTab(PERMISSION_SETS.itemsReadOnly, supplier, {
      items: () => {
        throw new ApiError(403, "FORBIDDEN", "forbidden");
      },
    });

    expect(
      await screen.findByText(SUPPLIER_ITEM_UI_LABELS.forbiddenDescription),
    ).toBeInTheDocument();
  });

  it("refetch nền lỗi khi đã có dữ liệu → vẫn giữ bảng, không thay bằng màn lỗi", async () => {
    let calls = 0;
    mockApiGet(PERMISSION_SETS.itemsReadOnly, {
      [ITEMS_PATH]: () => {
        calls += 1;
        if (calls > 1) throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
        return apiItemPage();
      },
    });
    const { client } = renderSupplierScreen(<SupplierItemsTab supplier={supplier} />);
    expect(await screen.findByText(PREFERRED_SKU)).toBeInTheDocument();

    await client.refetchQueries();
    await waitFor(() => expect(calls).toBeGreaterThan(1));

    expect(screen.getByText(PREFERRED_SKU)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });
});

describe("SupplierItemsTab — thêm / sửa / xoá", () => {
  it(
    "thêm SKU: moq 5 pack 2 → lỗi inline, không gọi API",
    async () => {
      const user = userEvent.setup();
      const post = vi.spyOn(api, "post");
      renderTab(PERMISSION_SETS.procurementNoInventory);

      await user.click(await screen.findByRole("button", { name: "Thêm SKU" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByRole("textbox", { name: /^SKU/ }), "TEE-NEW-1");
      await user.type(within(dialog).getByRole("textbox", { name: /^Giá/ }), "1000");
      await user.type(within(dialog).getByRole("textbox", { name: /Quy cách đóng gói/ }), "2");
      await user.type(within(dialog).getByRole("textbox", { name: /MOQ/ }), "5");

      expect(await within(dialog).findByText(SUPPLIER_ITEM_FIELD_MESSAGES.moq)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
      expect(post).not.toHaveBeenCalled();
    },
    SLOW,
  );

  it(
    "sửa dòng đang ưu tiên, không đổi gì → PUT có preferred: true và version",
    async () => {
      const user = userEvent.setup();
      const put = vi
        .spyOn(api, "put")
        .mockResolvedValue({ data: { ...apiSupplierItem, version: apiSupplierItem.version + 1 } });
      renderTab(PERMISSION_SETS.procurementStaff);

      await user.click(await screen.findByRole("button", { name: `Sửa ${PREFERRED_SKU}` }));
      const dialog = await screen.findByRole("dialog");
      const save = within(dialog).getByRole("button", { name: "Lưu" });
      await waitFor(() => expect(save).toBeEnabled());
      await user.click(save);

      await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
      expect(put.mock.calls[0]?.[0]).toBe(`${ITEMS_PATH}/${apiSupplierItem.supplierItemId}`);
      expect(put.mock.calls[0]?.[1]).toMatchObject({
        preferred: true,
        version: apiSupplierItem.version,
      });
    },
    SLOW,
  );

  it(
    "bỏ tick ưu tiên trên dòng đang ưu tiên → cảnh báo xoá NCC mặc định, PUT preferred: false",
    async () => {
      const user = userEvent.setup();
      const put = vi.spyOn(api, "put").mockResolvedValue({ data: apiSupplierItem });
      renderTab(PERMISSION_SETS.procurementStaff);

      await user.click(await screen.findByRole("button", { name: `Sửa ${PREFERRED_SKU}` }));
      const dialog = await screen.findByRole("dialog");
      const preferred = within(dialog).getByRole("checkbox", { name: /NCC ưu tiên/ });
      expect(preferred).toBeChecked();
      expect(within(dialog).queryByText(SUPPLIER_ITEM_UI_LABELS.hint.preferredClears)).toBeNull();

      await user.click(preferred);
      expect(within(dialog).getByText(SUPPLIER_ITEM_UI_LABELS.hint.preferredClears)).toBeVisible();
      await user.click(within(dialog).getByRole("button", { name: "Lưu" }));

      await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
      expect(put.mock.calls[0]?.[1]).toMatchObject({ preferred: false });
    },
    SLOW,
  );

  it(
    "xoá dòng ưu tiên → cảnh báo NCC mặc định của SKU không bị gỡ; dòng thường không cảnh báo",
    async () => {
      const user = userEvent.setup();
      renderTab(PERMISSION_SETS.procurementStaff);

      await user.click(await screen.findByRole("button", { name: `Xoá ${PREFERRED_SKU}` }));
      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText(SUPPLIER_ITEM_UI_LABELS.deletePreferredWarning, { exact: false }),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Quay lại" }));

      await user.click(screen.getByRole("button", { name: `Xoá ${apiSupplierItemOther.sku}` }));
      const other = await screen.findByRole("dialog");
      expect(
        within(other).queryByText(SUPPLIER_ITEM_UI_LABELS.deletePreferredWarning, {
          exact: false,
        }),
      ).not.toBeInTheDocument();
    },
    SLOW,
  );

  it(
    "xoá bị 409 SUPPLIER_ITEM_IN_USE → hiện câu tiếng Việt, dòng vẫn còn",
    async () => {
      const user = userEvent.setup();
      const toastError = vi.spyOn(toast, "error");
      const del = vi
        .spyOn(api, "delete")
        .mockRejectedValue(new ApiError(409, "SUPPLIER_ITEM_IN_USE", "Supplier item in use"));
      renderTab(PERMISSION_SETS.procurementStaff);

      await user.click(await screen.findByRole("button", { name: `Xoá ${PREFERRED_SKU}` }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Xoá" }));

      expect(
        await within(dialog).findByText(SUPPLIER_ITEM_ERROR_MESSAGES.SUPPLIER_ITEM_IN_USE),
      ).toBeInTheDocument();
      // Một lần duy nhất: trong dialog, không kèm toast
      expect(screen.getAllByText(SUPPLIER_ITEM_ERROR_MESSAGES.SUPPLIER_ITEM_IN_USE)).toHaveLength(
        1,
      );
      expect(toastError).not.toHaveBeenCalled();
      expect(del).toHaveBeenCalledTimes(1);
      expect(screen.getByText(PREFERRED_SKU)).toBeInTheDocument();
    },
    SLOW,
  );
});

describe("SupplierItemsTab — lỗi hiện một lần, trang vượt phạm vi", () => {
  it(
    "thêm SKU trùng (409 SUPPLIER_ITEM_DUPLICATE) → lỗi ở ô SKU, không toast",
    async () => {
      const user = userEvent.setup();
      const toastError = vi.spyOn(toast, "error");
      const post = vi
        .spyOn(api, "post")
        .mockRejectedValue(new ApiError(409, "SUPPLIER_ITEM_DUPLICATE", "Duplicate"));
      renderTab(PERMISSION_SETS.procurementNoInventory);

      await user.click(await screen.findByRole("button", { name: "Thêm SKU" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByRole("textbox", { name: /^SKU/ }), "TEE-NEW-1");
      await user.type(within(dialog).getByRole("textbox", { name: /^Giá/ }), "1000");
      await user.type(within(dialog).getByRole("textbox", { name: /Quy cách đóng gói/ }), "5");
      await user.type(within(dialog).getByRole("textbox", { name: /MOQ/ }), "10");
      const save = within(dialog).getByRole("button", { name: "Lưu" });
      await waitFor(() => expect(save).toBeEnabled());
      await user.click(save);

      const message = SUPPLIER_ITEM_ERROR_MESSAGES.SUPPLIER_ITEM_DUPLICATE;
      expect(await within(dialog).findByText(message)).toBeInTheDocument();
      expect(screen.getAllByText(message)).toHaveLength(1);
      expect(post).toHaveBeenCalledTimes(1);
      expect(toastError).not.toHaveBeenCalled();
    },
    SLOW,
  );

  it(
    "?itemPage=99 khi danh mục có dữ liệu → báo trang vượt phạm vi, về trang đầu được",
    async () => {
      const user = userEvent.setup();
      renderTab(PERMISSION_SETS.procurementStaff, supplier, {
        searchParams: "?itemPage=99",
        items: (params) =>
          params?.get("page") === "0" ? apiItemPage() : { ...apiItemPage(), items: [], page: 98 },
      });

      expect(await screen.findByText("Trang không còn dữ liệu")).toBeInTheDocument();
      expect(screen.queryByText("NCC chưa có SKU nào")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Thêm SKU" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Về trang đầu" }));
      expect(await screen.findByText(PREFERRED_SKU)).toBeInTheDocument();
    },
    SLOW,
  );
});
