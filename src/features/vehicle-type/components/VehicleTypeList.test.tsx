import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS, VEHICLE_TYPE_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { VT_20DC_ID, apiCustomTruck, apiVehicleType } from "../__fixtures__/vehicle-type";
import {
  VEHICLE_TYPE_ACTORS as ACTORS,
  bePage,
  mockVehicleTypeApi,
  renderVehicleTypeScreen,
} from "../__fixtures__/render";
import { VehicleTypeList } from "./VehicleTypeList";

import type { TestActor } from "../__fixtures__/render";
import type { VehicleType } from "../types";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const L = UI_LABELS.vehicleType;
const PATH = "/fulfillment/vehicle-types";
const ROWS = [apiVehicleType(), apiCustomTruck()];

function renderList(actor: TestActor, search = "", rows: VehicleType[] = ROWS) {
  const spies = mockVehicleTypeApi(actor, {
    get: { [PATH]: () => bePage(rows) },
    put: {
      [`${PATH}/${VT_20DC_ID}`]: (_params, body) => ({
        ...apiVehicleType(),
        ...(body as object),
        version: 1,
      }),
    },
  });
  renderVehicleTypeScreen(<VehicleTypeList />, search);
  return spies;
}

describe("VehicleTypeList — hiển thị danh sách", () => {
  it("hiện mã, tên, loại, kích thước mét (mm ở tooltip), tải trọng, số xe, khe góc, trạng thái, nhãn mặc định", async () => {
    renderList(ACTORS.viewOnly);
    expect(await screen.findByText("20DC")).toBeInTheDocument();
    const row = screen.getByText("20DC").closest("tr");
    expect(row).not.toBeNull();
    const inRow = within(row as HTMLElement);
    expect(inRow.getByText(L.presetBadge)).toBeInTheDocument();
    expect(inRow.getByText("Container 20' Dry (20DC)")).toBeInTheDocument();
    expect(inRow.getByText("Container")).toBeInTheDocument();
    expect(inRow.getByText("5,898 × 2,352 × 2,393 m")).toHaveAttribute(
      "title",
      "5.898 × 2.352 × 2.393 mm",
    );
    expect(inRow.getByText("28.200 kg")).toBeInTheDocument();
    expect(inRow.getByText("100 mm")).toBeInTheDocument();
    expect(inRow.getByText("Đang dùng")).toBeInTheDocument();
    // Loại xe tự thêm: không có nhãn mặc định
    const custom = within(screen.getByText("TRUCK-3T").closest("tr") as HTMLElement);
    expect(custom.queryByText(L.presetBadge)).not.toBeInTheDocument();
    expect(custom.getByText("Xe tải")).toBeInTheDocument();
  });

  it("lọc / tìm / trang trên URL gửi đúng tham số BE (một trạng thái, search, trang từ 0)", async () => {
    const { get } = renderList(ACTORS.viewOnly, "?status=INACTIVE&q=20&page=2");
    await screen.findByText("20DC");
    await waitFor(() => {
      const params = get.mock.calls.find(([url]) => url === PATH)?.[1]?.params;
      expect(params).toMatchObject({ status: "INACTIVE", search: "20", page: 1, size: 15 });
    });
  });

  it("chưa có loại xe và lọc không ra kết quả là hai thông điệp khác nhau", async () => {
    renderList(ACTORS.viewOnly, "", []);
    expect(await screen.findByText(L.empty.noDataTitle)).toBeInTheDocument();
  });

  it("lọc không ra kết quả: có nút bỏ bộ lọc", async () => {
    renderList(ACTORS.viewOnly, "?q=zzz", []);
    expect(await screen.findByText(UI_LABELS.emptyList.noResultsTitle)).toBeInTheDocument();
    expect(screen.getByText(L.empty.noResultsDescription)).toBeInTheDocument();
    // Một nút ở thanh lọc, một nút trong vùng rỗng
    expect(screen.getAllByRole("button", { name: UI_LABELS.emptyList.clearFilters })).toHaveLength(
      2,
    );
  });

  it("lỗi tải: hiện câu lỗi và nút thử lại", async () => {
    mockVehicleTypeApi(ACTORS.viewOnly, {
      get: {
        [PATH]: () => {
          throw new ApiError(0, "NETWORK_ERROR", "offline");
        },
      },
    });
    renderVehicleTypeScreen(<VehicleTypeList />);
    expect(await screen.findByText(L.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByText(UI_LABELS.loadError.networkDescription)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: UI_LABELS.common.retry })).toBeInTheDocument();
  });
});

describe("VehicleTypeList — cổng quyền theo mã", () => {
  it("quản lý kho (UPDATE): có nút Thêm, Sửa và Ngừng dùng", async () => {
    renderList(ACTORS.warehouseManager);
    await screen.findByText("20DC");
    expect(screen.getByRole("button", { name: L.create })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${L.edit} 20DC` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${L.deactivate} 20DC` })).toBeInTheDocument();
  });

  it("chỉ xem (READ): thấy bảng nhưng không có nút Thêm / Sửa / Ngừng dùng, bấm dòng không mở form", async () => {
    renderList(ACTORS.viewOnly);
    await userEvent.click(await screen.findByText("Container 20' Dry (20DC)"));
    expect(screen.queryByRole("button", { name: L.create })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `${L.edit} 20DC` })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `${L.deactivate} 20DC` })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("có VIEW_PAGE nhưng thiếu READ: báo không có quyền xem dữ liệu và không gọi danh sách", async () => {
    const { get } = renderList(ACTORS.noRead);
    expect(await screen.findByText(L.noReadTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });

  it("không có VIEW_PAGE: chặn trang", async () => {
    const { get } = renderList(ACTORS.noAccess);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });
});

describe("VehicleTypeList — ngừng dùng / dùng lại", () => {
  it("xác nhận ngừng dùng: PUT đủ trường của dòng, status INACTIVE, version đã đọc", async () => {
    const { put } = renderList(ACTORS.warehouseManager);
    await userEvent.click(await screen.findByRole("button", { name: `${L.deactivate} 20DC` }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(new RegExp(L.confirm.deactivateTitle))).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: L.deactivate }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put).toHaveBeenCalledWith(
      `${PATH}/${VT_20DC_ID}`,
      expect.objectContaining({
        code: "20DC",
        name: "Container 20' Dry (20DC)",
        kind: "CONTAINER",
        innerLengthMm: 5898,
        maxPayloadKg: 28200,
        availableCount: 10,
        gussetMm: 100,
        status: "INACTIVE",
        version: 0,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("dòng đang ngừng dùng có nút Dùng lại (status ACTIVE)", async () => {
    const { put } = renderList(ACTORS.warehouseManager, "", [
      apiVehicleType({ status: "INACTIVE" }),
    ]);
    await userEvent.click(await screen.findByRole("button", { name: `${L.activate} 20DC` }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: L.activate }),
    );
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]?.[1]).toMatchObject({ status: "ACTIVE" });
  });

  it("OPTIMISTIC_LOCK: báo trong dialog bằng tiếng Việt, dialog giữ nguyên", async () => {
    const { put } = renderList(ACTORS.warehouseManager);
    put.mockRejectedValueOnce(new ApiError(409, "OPTIMISTIC_LOCK", "changed"));
    await userEvent.click(await screen.findByRole("button", { name: `${L.deactivate} 20DC` }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: L.deactivate }),
    );
    expect(
      await screen.findByText(VEHICLE_TYPE_ERROR_MESSAGES.OPTIMISTIC_LOCK),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
