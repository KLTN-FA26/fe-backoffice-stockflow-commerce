/**
 * Ngăn kéo "Ước tính xếp xe" (SCRUM-287 F3): cổng quyền theo mã, tải ước tính hiện hành (GET) trước, chọn loại xe + cách
 * chọn xe rồi POST, banner thiếu dữ liệu kèm link hồ sơ hàng tồn, "Dừng do hết thời gian tính", kiện chưa xếp và lỗi
 * bằng tiếng Việt. Khung 3D (three / WebGL) được thay bằng một nút giả — jsdom không có WebGL.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_ITEM_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  apiEstimate,
  apiIncompleteEstimate,
  apiTwoVehicleEstimate,
  apiVehicleTypePage,
  ORDER_ID,
  WAREHOUSE_ID,
} from "../../__fixtures__/estimate";
import {
  ESTIMATE_PERMISSION_SETS,
  mockEstimateGet,
  renderWithEstimateProviders,
} from "../../__fixtures__/render-estimate";

import { LoadEstimateButton } from "./LoadEstimateButton";

import type { PermissionCode } from "@/lib/auth";

vi.mock("../viewer/VehicleViewer", () => ({
  VehicleViewer: ({ layout }: { layout: { seq: number; code: string; boxes: unknown[] } }) => (
    <div data-testid="viewer" data-seq={layout.seq} data-code={layout.code}>
      {layout.boxes.length} kiện
    </div>
  ),
}));

afterEach(() => vi.restoreAllMocks());

const CURRENT = "/fulfillment/load-estimates";
const TYPES = "/fulfillment/vehicle-types";

const notFound = () => {
  throw new ApiError(404, "LOAD_ESTIMATE_NOT_FOUND", "x");
};

async function open(
  permissions: readonly PermissionCode[],
  routes: Parameters<typeof mockEstimateGet>[1],
  props: Partial<Parameters<typeof LoadEstimateButton>[0]> = {},
) {
  const get = mockEstimateGet(permissions, routes);
  await renderWithEstimateProviders(
    <LoadEstimateButton
      orderId={ORDER_ID}
      orderNumber="SO-1"
      warehouseId={null}
      released
      {...props}
    />,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ước tính xếp xe" }));
  return { get, user, drawer: await screen.findByRole("dialog") };
}

describe("LoadEstimateButton — cổng quyền theo mã (UI-only; Backend re-check)", () => {
  it("không có READ lẫn CREATE → không hiện nút", async () => {
    mockEstimateGet(ESTIMATE_PERMISSION_SETS.none, {});
    await renderWithEstimateProviders(
      <LoadEstimateButton orderId={ORDER_ID} orderNumber="SO-1" warehouseId={null} released />,
    );
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: "Ước tính xếp xe" })).not.toBeInTheDocument();
  });

  it("chỉ READ → xem ước tính hiện hành, KHÔNG có ô chọn loại xe / nút Ước tính, không gọi danh sách loại xe", async () => {
    const { get } = await open(ESTIMATE_PERMISSION_SETS.readOnly, {
      [CURRENT]: () => apiEstimate(),
    });
    expect(await screen.findByTestId("viewer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ước tính(?: lại)?$/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Loại xe được dùng")).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === TYPES)).toBe(false);
  });

  it("chỉ CREATE → không gọi GET hiện hành (thiếu READ), vẫn tính được", async () => {
    const { get } = await open(ESTIMATE_PERMISSION_SETS.createOnly, {
      [TYPES]: () => apiVehicleTypePage,
    });
    expect(await screen.findByRole("button", { name: "Ước tính" })).toBeEnabled();
    expect(get.mock.calls.some(([url]) => url === CURRENT)).toBe(false);
  });
});

describe("LoadEstimateDrawer — nội dung", () => {
  it("luôn ghi 'Ước tính — chỉ để tham khảo' (LP2-1) và tải ước tính hiện hành bằng GET trước", async () => {
    const { get, drawer } = await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: () => apiEstimate(),
      [TYPES]: () => apiVehicleTypePage,
    });
    expect(within(drawer).getAllByText("Ước tính — chỉ để tham khảo").length).toBeGreaterThan(0);
    expect(await screen.findByTestId("viewer")).toHaveAttribute("data-code", "40HC");
    expect(get).toHaveBeenCalledWith(CURRENT, {
      params: { sourceType: "ORDER", sourceId: ORDER_ID },
      signal: expect.anything(),
    });
  });

  it("số liệu, bảng dòng (quy tắc, đơn vị, thùng lẻ, kích thước, kg), kiện chưa xếp kèm lý do và cảnh báo bằng tiếng Việt", async () => {
    await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: () => apiEstimate(),
      [TYPES]: () => apiVehicleTypePage,
    });
    // dải số liệu
    expect(await screen.findByText("Hiệu suất")).toBeInTheDocument();
    expect(screen.getByText("Số xe")).toBeInTheDocument();
    // bảng dòng
    const lines = screen.getByRole("table", { name: "Thùng hàng theo dòng đơn" });
    const sofa = within(lines).getByRole("row", { name: /SF-A/ });
    expect(within(sofa).getByText("Đơn vị giao mặc định")).toBeInTheDocument();
    expect(within(sofa).getByText("CTN (×4)")).toBeInTheDocument();
    expect(within(sofa).getByText(/2 đơn vị · 4,75 kg/)).toBeInTheDocument();
    expect(within(sofa).getByText("60×40×40")).toBeInTheDocument();
    expect(within(lines).getByText("bộ 2 kiện")).toBeInTheDocument();
    // kiện chưa xếp
    const unplaced = screen.getByRole("table", { name: "Kiện chưa xếp được" });
    expect(within(unplaced).getByText("Hết chỗ trong các xe")).toBeInTheDocument();
    expect(within(unplaced).getByText("Quá lớn so với lòng xe hoặc cửa xe")).toBeInTheDocument();
    // cảnh báo dịch theo mã, không lộ câu tiếng Anh của BE
    const warnings = screen.getByRole("region", { name: "Cảnh báo" });
    expect(within(warnings).getByText(/Đơn vị giao mặc định thiếu kích thước/)).toBeInTheDocument();
    expect(within(warnings).queryByText(/lacks a weight/)).not.toBeInTheDocument();
  });

  it("ước tính hoàn chỉnh → không có banner thiếu dữ liệu", async () => {
    await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: () => apiEstimate(),
      [TYPES]: () => apiVehicleTypePage,
    });
    await screen.findByTestId("viewer");
    expect(screen.queryByText(/một số dòng thiếu kích thước/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("incomplete → banner liệt kê dòng thiếu, trường còn trống và link sang hồ sơ hàng tồn (có quyền xem trang đó)", async () => {
    await open([...ESTIMATE_PERMISSION_SETS.full, INVENTORY_ITEM_PERMISSIONS.viewPage], {
      [CURRENT]: () => apiIncompleteEstimate(),
      [TYPES]: () => apiVehicleTypePage,
    });
    const banner = await screen.findByRole("alert");
    expect(
      within(banner).getByText(/một số dòng thiếu kích thước hoặc khối lượng/),
    ).toBeInTheDocument();
    expect(within(banner).getByText("TV-F")).toBeInTheDocument();
    expect(within(banner).getByText(/Thiếu: chiều dài, khối lượng/)).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: "Mở hồ sơ hàng tồn TV-F" })).toHaveAttribute(
      "href",
      "/admin/inventory-items/item-TV-F",
    );
  });

  it("incomplete mà thiếu quyền mở hồ sơ hàng tồn → báo chứ không đưa tới trang 403", async () => {
    await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: () => apiIncompleteEstimate(),
      [TYPES]: () => apiVehicleTypePage,
    });
    const banner = await screen.findByRole("alert");
    expect(within(banner).queryByRole("link")).not.toBeInTheDocument();
    expect(within(banner).getByText("Không có quyền mở hồ sơ hàng tồn")).toBeInTheDocument();
  });

  it("hết thời gian tính → 'Dừng do hết thời gian tính' + lý do kiện + cảnh báo bộ; chuyển xe bằng nút", async () => {
    const { user } = await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: () => apiTwoVehicleEstimate(),
      [TYPES]: () => apiVehicleTypePage,
    });
    // vừa là tiêu đề banner vừa là lý do của kiện chưa xếp
    expect(
      (await screen.findAllByText("Dừng do hết thời gian tính")).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/phương án tốt nhất tìm được/)).toBeInTheDocument();
    expect(screen.getByText(/kiện thừa/)).toBeInTheDocument();

    expect(screen.getByTestId("viewer")).toHaveAttribute("data-seq", "1");
    await user.click(screen.getByRole("button", { name: "Xe #2 · PICKUP-1T" }));
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-seq", "2");
    expect(screen.getByRole("button", { name: "Xe #2 · PICKUP-1T" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("đơn chưa có ước tính (404 NOT_FOUND không phải lỗi) → gợi ý bấm Ước tính", async () => {
    await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: notFound,
      [TYPES]: () => apiVehicleTypePage,
    });
    expect(await screen.findByText(/chưa có ước tính/)).toBeInTheDocument();
    expect(screen.queryByText(/Không tải được ước tính hiện có/)).not.toBeInTheDocument();
  });
});

describe("LoadEstimateDrawer — tính ước tính (POST)", () => {
  it("chọn loại xe + 'Ít xe nhất' → POST đúng body, kết quả mới thay bản hiện hành", async () => {
    const { user } = await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: notFound,
      [TYPES]: () => apiVehicleTypePage,
    });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiTwoVehicleEstimate() });

    await user.click(await screen.findByRole("checkbox", { name: /Container 40' High Cube/ }));
    await user.click(screen.getByRole("radio", { name: /Ít xe nhất/ }));
    await user.click(screen.getByRole("button", { name: "Ước tính" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/fulfillment/load-estimates", {
        sources: [{ type: "ORDER", id: ORDER_ID }],
        vehicleTypeIds: ["vt-40hc"],
        selectionMode: "FEWEST_VEHICLES",
      }),
    );
    expect(await screen.findByRole("button", { name: "Xe #2 · PICKUP-1T" })).toBeInTheDocument();
    // đã có kết quả → nút đổi thành "Ước tính lại"
    expect(screen.getByRole("button", { name: "Ước tính lại" })).toBeInTheDocument();
  });

  it("mặc định: không chọn loại xe (= mọi loại đang dùng), 'Một loại xe'", async () => {
    const { user } = await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: notFound,
      [TYPES]: () => apiVehicleTypePage,
    });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiEstimate() });
    await user.click(await screen.findByRole("button", { name: "Ước tính" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/fulfillment/load-estimates",
        expect.objectContaining({ vehicleTypeIds: [], selectionMode: "SINGLE_TYPE" }),
      ),
    );
  });

  it("đơn CONFIRMED (từ hộp thoại release): chưa chọn kho → khoá nút; có kho → gửi warehouseId", async () => {
    const routes = { [CURRENT]: notFound, [TYPES]: () => apiVehicleTypePage };
    const first = await open(ESTIMATE_PERMISSION_SETS.full, routes, { released: false });
    expect(await screen.findByRole("button", { name: "Ước tính" })).toBeDisabled();
    expect(screen.getByText("Chọn kho trước khi ước tính.")).toBeInTheDocument();
    await first.user.keyboard("{Escape}");
  });

  it("đơn CONFIRMED có kho → POST kèm warehouseId", async () => {
    const { user } = await open(
      ESTIMATE_PERMISSION_SETS.full,
      { [CURRENT]: notFound, [TYPES]: () => apiVehicleTypePage },
      { released: false, warehouseId: WAREHOUSE_ID },
    );
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiEstimate() });
    await user.click(await screen.findByRole("button", { name: "Ước tính" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/fulfillment/load-estimates",
        expect.objectContaining({ warehouseId: WAREHOUSE_ID }),
      ),
    );
  });

  it.each([
    [422, "LOAD_ESTIMATE_PACKAGING_MISSING", /Không dòng nào có đủ kích thước/],
    [422, "LOAD_ESTIMATE_TOO_MANY_CARTONS", /quá nhiều thùng/],
    [409, "LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE", /không ước tính được ở trạng thái hiện tại/],
    [409, "VEHICLE_TYPE_INACTIVE", /loại xe đã ngừng dùng/],
  ] as const)(
    "%s %s → câu tiếng Việt trong ngăn kéo, không lộ message tiếng Anh",
    async (status, code, pattern) => {
      const { user } = await open(ESTIMATE_PERMISSION_SETS.full, {
        [CURRENT]: notFound,
        [TYPES]: () => apiVehicleTypePage,
      });
      vi.spyOn(api, "post").mockRejectedValue(new ApiError(status, code, "English server message"));
      await user.click(await screen.findByRole("button", { name: "Ước tính" }));
      const alert = await screen.findByText(pattern);
      expect(alert).toBeInTheDocument();
      expect(screen.queryByText("English server message")).not.toBeInTheDocument();
    },
  );

  it("422 PACKAGING_MISSING → liệt kê mặt hàng cần bổ sung (id từ inventoryItems[<id>]) kèm link hồ sơ hàng tồn", async () => {
    const { user } = await open(
      [...ESTIMATE_PERMISSION_SETS.full, INVENTORY_ITEM_PERMISSIONS.viewPage],
      { [CURRENT]: notFound, [TYPES]: () => apiVehicleTypePage },
    );
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(422, "LOAD_ESTIMATE_PACKAGING_MISSING", "x", {
        "inventoryItems[11111111-2222-3333-4444-555555555555]": "lengthCm is empty",
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Ước tính" }));
    const link = await screen.findByRole("link", { name: "Mở hồ sơ hàng tồn 11111111" });
    expect(link).toHaveAttribute(
      "href",
      "/admin/inventory-items/11111111-2222-3333-4444-555555555555",
    );
  });

  it("danh sách loại xe lỗi → báo và cho thử lại; ước tính hiện hành lỗi (không phải 404) → báo và cho thử lại", async () => {
    let typeCalls = 0;
    await open(ESTIMATE_PERMISSION_SETS.full, {
      [CURRENT]: () => {
        throw new ApiError(500, "HTTP_500", "x");
      },
      [TYPES]: () => {
        typeCalls += 1;
        throw new ApiError(403, "FORBIDDEN", "x");
      },
    });
    expect(await screen.findByText(/Không tải được danh sách loại xe/)).toBeInTheDocument();
    expect(await screen.findByText(/Không tải được ước tính hiện có/)).toBeInTheDocument();
    expect(typeCalls).toBeGreaterThan(0);
  });
});
