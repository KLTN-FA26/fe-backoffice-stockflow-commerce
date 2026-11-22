/**
 * Sale chọn kho xuất và giữ hàng (docs 17 §4.2 bước 2-3, BR-22, BR-25; BE `ShippingWarehouseController`): thẻ "Kho xuất" ở
 * chi tiết đơn gate theo trạng thái + mã quyền `sales-order-shipping-warehouses:READ/UPDATE`, hộp thoại liệt kê kho với tồn
 * và sức chứa, chọn → PUT, báo kết quả giữ hàng (đủ / một phần / chưa có), lỗi BE hiện tiếng Việt.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { OrderDetail } from "./OrderDetail";

import { DETAIL_PATH, HISTORY_PATH } from "../__fixtures__/detail";
import { apiOrder, apiOrderAt } from "../__fixtures__/order";
import { mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import {
  apiCoverage,
  apiOptions,
  CHOOSE_PATH,
  COVERAGE_PATH,
  OPTIONS_PATH,
  SHIPPING_PERMISSION_SETS,
  WH_HCM,
  WH_HN,
} from "../__fixtures__/shipping-warehouse";

import type { PermissionCode } from "@/lib/auth";
import type { OrderDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const KEY = { headers: { "Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/) } };
const NOT_HELD = apiCoverage(
  [
    [0, 8],
    [0, 4],
  ],
  null,
);

async function renderOrder(
  permissions: readonly PermissionCode[],
  options: { order?: OrderDto; coverage?: unknown } = {},
) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => options.order ?? apiOrderAt("CONFIRMED"),
    [HISTORY_PATH]: () => [],
    [COVERAGE_PATH]: () => options.coverage ?? NOT_HELD,
    [OPTIONS_PATH]: () => apiOptions(),
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  await screen.findByRole("heading", { name: apiOrder.orderNumber });
}

const card = () => screen.findByRole("region", { name: "Kho xuất" });
const coverageCalls = () => vi.mocked(api.get).mock.calls.filter(([url]) => url === COVERAGE_PATH);

async function openDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Chọn kho xuất" }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByRole("radiogroup", { name: "Kho xuất hàng" });
  return { user, dialog };
}

describe("thẻ Kho xuất — gate theo trạng thái và mã quyền", () => {
  it("Sale (READ + UPDATE), đơn Đã xác nhận chưa chọn kho → thẻ nói chưa chọn + nút Chọn kho xuất", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale);
    const region = await card();
    expect(await within(region).findByText("Chưa chọn kho xuất")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Chọn kho xuất" })).toBeEnabled();
    // Không lộ mã / tiếng Anh cho người dùng
    expect(region).not.toHaveTextContent(/[0-9a-f]{8}-[0-9a-f]{4}/);
    expect(region).not.toHaveTextContent(/Confirmed|Awaiting|undefined|null/);
  });

  it("đơn Đang chờ hàng cũng chọn được (BE Order#chooseShippingWarehouse: CONFIRMED hoặc AWAITING_STOCK)", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale, { order: apiOrderAt("AWAITING_STOCK") });
    expect(await screen.findByRole("button", { name: "Chọn kho xuất" })).toBeEnabled();
  });

  it("quản lý kho (chỉ READ): thấy kho đã chọn và đã giữ bao nhiêu thùng, KHÔNG có nút chọn / đổi", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.warehouseManager, {
      coverage: apiCoverage([
        [8, 8],
        [4, 4],
      ]),
    });
    const region = await card();
    expect(await within(region).findByText("Kho xuất: HCM01")).toBeInTheDocument();
    expect(within(region).getByText(/Đã giữ đủ hàng/)).toBeInTheDocument();
    expect(within(region).queryByRole("button")).not.toBeInTheDocument();
  });

  it("không có mã kho xuất nào → không có thẻ và không gọi API kho xuất", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.noShippingCodes);
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("region", { name: "Kho xuất" })).not.toBeInTheDocument();
    expect(coverageCalls()).toHaveLength(0);
  });

  it("đơn đã Sẵn sàng thực hiện (đã release) → không có thẻ, không gọi API", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale, { order: apiOrderAt("READY_TO_FULFILL") });
    expect(screen.queryByRole("region", { name: "Kho xuất" })).not.toBeInTheDocument();
    expect(coverageCalls()).toHaveLength(0);
  });

  it("đã giữ hàng ở kho hiện tại → ẩn nút đổi kho, nói lý do (BR-22)", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale, {
      coverage: apiCoverage([
        [8, 8],
        [1, 4],
      ]),
    });
    const region = await card();
    expect(
      await within(region).findByText("Đã giữ hàng ở kho này nên không đổi sang kho khác được."),
    ).toBeInTheDocument();
    expect(within(region).queryByRole("button")).not.toBeInTheDocument();
    expect(within(region).getByText("9/12 thùng", { exact: false })).toBeInTheDocument();
  });

  it("đã chọn kho nhưng chưa giữ được thùng nào → nút đổi thành Đổi kho xuất", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale, {
      coverage: apiCoverage([
        [0, 8],
        [0, 4],
      ]),
    });
    const region = await card();
    expect(await within(region).findByRole("button", { name: "Đổi kho xuất" })).toBeEnabled();
    expect(within(region).getByText(/Chưa giữ được thùng nào/)).toBeInTheDocument();
  });

  it("không tải được tình trạng giữ hàng → báo bằng tiếng Việt, Sale vẫn chọn kho được", async () => {
    mockOrderApiGet(SHIPPING_PERMISSION_SETS.sale, {
      [DETAIL_PATH]: () => apiOrderAt("CONFIRMED"),
      [HISTORY_PATH]: () => [],
      [COVERAGE_PATH]: () => {
        throw new ApiError(500, "INTERNAL_ERROR", "boom");
      },
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    expect(
      await screen.findByText("Không tải được tình trạng giữ hàng của đơn."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chọn kho xuất" })).toBeEnabled();
  });
});

describe("hộp thoại chọn kho — tồn và sức chứa từng kho (17 §4.2 bước 2, BR-25)", () => {
  it("liệt kê các kho theo thứ tự gợi ý: kho đầu có nhãn Gợi ý + Đủ hàng; kho thiếu chỗ có cảnh báo không chặn", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale);
    const { dialog } = await openDialog();
    const radios = within(dialog).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    const [hcm, hn] = radios.map((radio) => radio.closest("label") as HTMLElement) as [
      HTMLElement,
      HTMLElement,
    ];
    expect(hcm).toHaveTextContent("HCM01 — Kho TP.HCM");
    expect(hcm).toHaveTextContent("Gợi ý");
    expect(hcm).toHaveTextContent("Đủ hàng");
    expect(hcm).toHaveTextContent("Có sẵn 12/12 thùng");
    expect(hcm).toHaveTextContent("CUP-12OZ-ACME: 8/8 thùng");
    expect(hcm).toHaveTextContent("Còn trống dự kiến120,5 m³");
    expect(hcm).not.toHaveTextContent("Không đủ chỗ");

    expect(hn).toHaveTextContent("HN01 — Kho Hà Nội");
    expect(hn).not.toHaveTextContent("Gợi ý");
    expect(hn).toHaveTextContent("Có sẵn 5/12 thùng");
    expect(hn).toHaveTextContent("CUP-12OZ-ACME: 3/8 thùng");
    expect(hn).toHaveTextContent("Cần cho phần phải sản xuất1,25 m³");
    expect(hn).toHaveTextContent(
      /Không đủ chỗ cho phần phải sản xuất.*chỉ là cảnh báo, vẫn chọn được/,
    );
    // Cảnh báo không chặn: vẫn chọn được kho thiếu chỗ
    expect(within(hn).getByRole("radio")).toBeEnabled();
  });

  it("chưa chọn kho → nút Chọn kho và giữ hàng bị khoá; chọn rồi mới bấm được", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale);
    const { user, dialog } = await openDialog();
    const submit = within(dialog).getByRole("button", { name: "Chọn kho và giữ hàng" });
    expect(submit).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: /HCM01/ }));
    expect(submit).toBeEnabled();
  });

  it("danh sách kho nằm trong vùng cuộn của hộp thoại (DialogScrollArea)", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale);
    const { dialog } = await openDialog();
    const scroll = within(dialog).getByRole("radiogroup").parentElement as HTMLElement;
    expect(scroll.className).toContain("overflow-y-auto");
  });

  it("kho đang là kho xuất của đơn có nhãn Đang chọn", async () => {
    mockOrderApiGet(SHIPPING_PERMISSION_SETS.sale, {
      [DETAIL_PATH]: () => apiOrderAt("CONFIRMED"),
      [HISTORY_PATH]: () => [],
      [COVERAGE_PATH]: () =>
        apiCoverage([
          [0, 8],
          [0, 4],
        ]),
      [OPTIONS_PATH]: () => apiOptions(WH_HN),
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Đổi kho xuất" }));
    const dialog = await screen.findByRole("dialog");
    const hn = (await within(dialog).findByRole("radio", { name: /HN01/ })).closest("label");
    expect(hn).toHaveTextContent("Đang chọn");
  });
});

describe("chọn kho → PUT /orders/{id}/shipping-warehouse, báo kết quả giữ hàng", () => {
  async function choose(response: unknown, label: RegExp = /HCM01/) {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale);
    const { user, dialog } = await openDialog();
    const put = vi.spyOn(api, "put");
    if (response instanceof ApiError) put.mockRejectedValue(response);
    else put.mockResolvedValue({ data: response });
    await user.click(within(dialog).getByRole("radio", { name: label }));
    const coverageBefore = coverageCalls().length;
    await user.click(within(dialog).getByRole("button", { name: "Chọn kho và giữ hàng" }));
    return { put, dialog, coverageBefore };
  }

  it.each([
    [
      "giữ đủ hàng",
      apiCoverage([
        [8, 8],
        [4, 4],
      ]),
      "Đã chọn kho xuất và giữ đủ hàng cho đơn",
    ],
    [
      "giữ một phần (11/12 thùng)",
      apiCoverage([
        [8, 8],
        [3, 4],
      ]),
      "Đã chọn kho xuất và giữ 11/12 thùng — phần thiếu sẽ được giữ tiếp khi hàng nhập kho",
    ],
    [
      "chưa có thùng nào để giữ",
      apiCoverage([
        [0, 8],
        [0, 4],
      ]),
      "Đã chọn kho xuất — chưa có thùng nào để giữ, hàng sẽ được giữ khi nhập kho",
    ],
  ])(
    "%s → body chỉ có warehouseId + Idempotency-Key, toast đúng, đóng hộp thoại",
    async (_name, coverage, message) => {
      const toastSuccess = vi.spyOn(toast, "success");
      const { put } = await choose(coverage);
      await waitFor(() =>
        expect(put).toHaveBeenCalledWith(CHOOSE_PATH, { warehouseId: WH_HCM }, KEY),
      );
      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(message));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    },
  );

  it("sau khi chọn, đơn và tình trạng giữ hàng được tải lại (invalidate orderKeys.all)", async () => {
    const { coverageBefore } = await choose(
      apiCoverage([
        [8, 8],
        [4, 4],
      ]),
    );
    await waitFor(() => expect(coverageCalls().length).toBeGreaterThan(coverageBefore));
  });

  it("chọn kho khác → gửi đúng id kho đó", async () => {
    const { put } = await choose(
      apiCoverage([
        [3, 8],
        [2, 4],
      ]),
      /HN01/,
    );
    await waitFor(() => expect(put).toHaveBeenCalledWith(CHOOSE_PATH, { warehouseId: WH_HN }, KEY));
  });

  it("409 ORDER_SHIPPING_WAREHOUSE_LOCKED (đã giữ hàng / đã gửi Đơn sản xuất) → đóng hộp thoại, toast tiếng Việt, tải lại đơn", async () => {
    const toastError = vi.spyOn(toast, "error");
    await choose(new ApiError(409, "ORDER_SHIPPING_WAREHOUSE_LOCKED", "English message"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastError).toHaveBeenCalledWith(
      "Không chọn được kho xuất",
      expect.stringMatching(/Không đổi được kho xuất nữa/),
    );
    expect(toastError.mock.calls[0]?.[1]).not.toContain("English message");
  });

  it("409 ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED (đơn đã đổi bước) → đóng hộp thoại và báo", async () => {
    const toastError = vi.spyOn(toast, "error");
    await choose(new ApiError(409, "ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED", "x"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastError).toHaveBeenCalledWith(
      "Không chọn được kho xuất",
      expect.stringMatching(/hợp đồng đã ký/),
    );
  });

  it("404 WAREHOUSE_NOT_FOUND → giữ hộp thoại và lựa chọn, báo ngay trong hộp thoại", async () => {
    const { dialog } = await choose(
      new ApiError(404, "WAREHOUSE_NOT_FOUND", "No active warehouse"),
    );
    expect(
      await within(dialog).findByText("Không tìm thấy kho đã chọn. Chọn lại kho."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /HCM01/ })).toBeChecked();
  });

  it("lỗi mạng → giữ hộp thoại, câu tiếng Việt chung", async () => {
    const { dialog } = await choose(new ApiError(0, "NETWORK_ERROR", "Network Error"));
    expect(await within(dialog).findByText(/Không kết nối được máy chủ/)).toBeInTheDocument();
  });

  it("bấm gửi hai lần liên tiếp chỉ gửi MỘT request (chặn gửi lặp)", async () => {
    await renderOrder(SHIPPING_PERMISSION_SETS.sale);
    const { user, dialog } = await openDialog();
    const put = vi.spyOn(api, "put").mockImplementation(() => new Promise(() => undefined));
    await user.click(within(dialog).getByRole("radio", { name: /HCM01/ }));
    const submit = within(dialog).getByRole("button", { name: "Chọn kho và giữ hàng" });
    await user.dblClick(submit);
    expect(put).toHaveBeenCalledTimes(1);
  });
});

describe("danh sách kho — trạng thái tải", () => {
  it("không tải được danh sách kho → báo tiếng Việt trong hộp thoại, nút gửi vẫn khoá", async () => {
    mockOrderApiGet(SHIPPING_PERMISSION_SETS.sale, {
      [DETAIL_PATH]: () => apiOrderAt("CONFIRMED"),
      [HISTORY_PATH]: () => [],
      [COVERAGE_PATH]: () => NOT_HELD,
      [OPTIONS_PATH]: () => {
        throw new ApiError(500, "INTERNAL_ERROR", "boom");
      },
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Chọn kho xuất" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Không tải được danh sách kho.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Chọn kho và giữ hàng" })).toBeDisabled();
  });
});
