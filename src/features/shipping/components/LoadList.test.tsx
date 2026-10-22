import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { ftlRow } from "../__fixtures__/ftl-load";
import { LOAD_ID, apiLoad } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  bePage,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { LoadList } from "./LoadList";

import type { TestActor } from "../__fixtures__/render";
import type { LoadRow } from "../types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
  sessionStorage.clear();
});

const L = UI_LABELS.shipping;
const ROW: LoadRow = {
  loadId: LOAD_ID,
  code: LOAD_ID,
  warehouseId: "wh-hcm",
  mode: "PARCEL",
  status: "LOADING",
  carrierId: "car-ghn",
  carrierName: "Giao Hàng Nhanh",
  vehiclePlate: "51C-628.14",
  driverName: "Lê Văn Xế",
  shipmentCount: 2,
  packageCount: 1,
  version: 4,
};

function renderList(actor: TestActor, search = "", rows: LoadRow[] = [ROW]) {
  const spies = mockShippingApi(actor, {
    get: { "/fulfillment/loads": () => bePage(rows) },
    post: { "/fulfillment/loads": () => apiLoad() },
  });
  renderShippingScreen(<LoadList />, search);
  return spies;
}

describe("LoadList — chuyến xe", () => {
  it("hiện chuyến với hãng, xe + tài xế, số lô, kiện đã lên xe; lọc gửi đúng tham số BE (một trạng thái)", async () => {
    const { get } = renderList(
      ACTORS.warehouseStaff,
      "?status=LOADING&warehouse=wh-hcm&carrier=car-ghn&q=51C",
    );
    expect(await screen.findByRole("link", { name: LOAD_ID })).toHaveAttribute(
      "href",
      `/admin/loads/${LOAD_ID}`,
    );
    expect(screen.getByText("Giao Hàng Nhanh")).toBeInTheDocument();
    expect(screen.getByText("51C-628.14")).toBeInTheDocument();
    expect(screen.getByText("Lê Văn Xế")).toBeInTheDocument();
    await waitFor(() => {
      const params = get.mock.calls.find(([url]) => url === "/fulfillment/loads")?.[1]?.params;
      expect(params).toMatchObject({
        status: "LOADING",
        warehouseId: "wh-hcm",
        carrierId: "car-ghn",
        search: "51C",
      });
    });
  });

  it("chỉ xem / điều phối đơn: không có nút Mở chuyến", async () => {
    renderList(ACTORS.orderCoordinator);
    await screen.findByRole("link", { name: LOAD_ID });
    expect(screen.queryByRole("button", { name: L.loads.open })).not.toBeInTheDocument();
  });

  it("danh sách rỗng: 'chưa có chuyến' khác 'lọc không ra kết quả'", async () => {
    renderList(ACTORS.warehouseStaff, "", []);
    expect(await screen.findByText(L.loads.empty.noDataTitle)).toBeInTheDocument();
  });
});

describe("LoadList — chuyến nguyên xe (BE PR #162)", () => {
  const FTL = ftlRow({ loadId: "LD-F001", code: "LD-F001", status: "VEHICLE_BOOKED" });
  const PLANNED = ftlRow({
    loadId: "LD-F002",
    code: "LD-F002",
    status: "PLANNED",
    vehicleSeq: 2,
    carrierId: undefined,
    carrierName: undefined,
  });

  it("dòng nguyên xe hiện hình thức, mã kế hoạch + số xe, trạng thái Đã lập kế hoạch / Đã đặt xe; chuyến gửi kiện để trống cột kế hoạch", async () => {
    renderList(ACTORS.warehouseStaff, "", [ROW, FTL, PLANNED]);
    await screen.findByRole("link", { name: "LD-F001" });
    const planLinks = screen.getAllByRole("link", { name: "LP-2026-0001" });
    expect(planLinks).toHaveLength(2);
    expect(planLinks[0]).toHaveAttribute("href", "/admin/load-plans/lp-1");
    expect(screen.getByText(`${L.ftl.vehicleSeq} 1`)).toBeInTheDocument();
    expect(screen.getByText(`${L.ftl.vehicleSeq} 2`)).toBeInTheDocument();
    expect(screen.getAllByText(L.load.mode.FULL_TRUCKLOAD)).toHaveLength(2);
    expect(screen.getAllByText(L.load.mode.PARCEL).length).toBeGreaterThan(0);
    expect(screen.getByText("Đã đặt xe")).toBeInTheDocument();
    expect(screen.getByText("Đã lập kế hoạch")).toBeInTheDocument();
  });

  it("bộ lọc hình thức: gửi `mode` cho BE và lọc thêm trên trang trả về (BE chưa lọc theo hình thức)", async () => {
    const { get } = renderList(ACTORS.warehouseStaff, "?mode=FULL_TRUCKLOAD", [ROW, FTL]);
    await screen.findByRole("link", { name: "LD-F001" });
    expect(screen.queryByRole("link", { name: LOAD_ID })).not.toBeInTheDocument();
    await waitFor(() => {
      const params = get.mock.calls.find(([url]) => url === "/fulfillment/loads")?.[1]?.params;
      expect(params).toMatchObject({ mode: "FULL_TRUCKLOAD" });
    });
  });

  it("chọn hình thức trong bộ lọc → chỉ còn chuyến thuộc hình thức đó", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.warehouseStaff, "", [ROW, FTL]);
    await screen.findByRole("link", { name: "LD-F001" });
    await user.click(screen.getByRole("combobox", { name: L.ftl.modeFilter }));
    await user.click(await screen.findByRole("option", { name: L.load.mode.PARCEL }));
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "LD-F001" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: LOAD_ID })).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: L.ftl.modeFilter }));
    await user.click(await screen.findByRole("option", { name: L.load.mode.FULL_TRUCKLOAD }));
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: LOAD_ID })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "LD-F001" })).toBeInTheDocument();
  });

  it("trang này toàn chuyến gửi kiện mà lọc nguyên xe: giữ bảng + phân trang để sang trang có chuyến nguyên xe, không báo 'không có kết quả'", async () => {
    const user = userEvent.setup();
    const { get } = mockShippingApi(ACTORS.warehouseStaff, {
      get: {
        "/fulfillment/loads": (params) => {
          const page = (params as { page?: number }).page ?? 0;
          // BE không lọc theo hình thức: trang 0 toàn chuyến gửi kiện, chuyến nguyên xe nằm ở trang 1
          return {
            ...bePage(page === 0 ? [ROW] : [FTL], page),
            totalElements: 2,
            totalPages: 2,
            hasNext: page === 0,
          };
        },
      },
    });
    renderShippingScreen(<LoadList />, "?mode=FULL_TRUCKLOAD");
    expect(await screen.findByText(L.ftl.modeFilterPageNote)).toBeInTheDocument();
    expect(screen.queryByText(UI_LABELS.emptyList.noResultsTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(L.loads.empty.noDataTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: LOAD_ID })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Sau" }));
    expect(await screen.findByRole("link", { name: "LD-F001" })).toBeInTheDocument();
    expect(
      get.mock.calls
        .filter(([url]) => url === "/fulfillment/loads")
        .some(([, c]) => (c?.params as { page?: number } | undefined)?.page === 1),
    ).toBe(true);
  });

  it("BE không có chuyến nào (totalElements 0) khi đang lọc → 'không có kết quả', khác 'chưa có chuyến'", async () => {
    renderList(ACTORS.warehouseStaff, "?mode=FULL_TRUCKLOAD", []);
    expect(await screen.findByText(UI_LABELS.emptyList.noResultsTitle)).toBeInTheDocument();
    expect(screen.queryByText(L.loads.empty.noDataTitle)).not.toBeInTheDocument();
  });

  it("bộ lọc trạng thái có Đã lập kế hoạch và Đã đặt xe; gửi đúng một trạng thái cho BE", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.warehouseStaff, "", [FTL]);
    await screen.findByRole("link", { name: "LD-F001" });
    await user.click(screen.getByRole("combobox", { name: L.shipments.statusFilter }));
    expect(await screen.findByRole("option", { name: "Đã lập kế hoạch" })).toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Đã đặt xe" }));
    await waitFor(() => {
      const calls = get.mock.calls.filter(([url]) => url === "/fulfillment/loads");
      expect(calls.at(-1)?.[1]?.params).toMatchObject({ status: "VEHICLE_BOOKED" });
    });
  });
});

describe("Mở chuyến từ danh sách chuyến", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: L.loads.open }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("combobox", { name: new RegExp(L.openDialog.warehouse) }),
    );
    await user.click(await screen.findByRole("option", { name: /HCM · Kho TP\.HCM/ }));
    await user.click(
      within(dialog).getByRole("combobox", { name: new RegExp(L.openDialog.carrier) }),
    );
    await user.click(await screen.findByRole("option", { name: /GHN/ }));
    return dialog;
  }

  it("không chọn lô: BE tự lấy lô của kho đã gán cho hãng (không gửi shipmentIds)", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseStaff);
    const dialog = await fill(user);
    await user.click(within(dialog).getByRole("button", { name: L.openDialog.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).toMatchObject({ warehouseId: "wh-hcm", carrierId: "car-ghn" });
    expect(body.shipmentIds).toBeUndefined();
    expect(body.vehiclePlate).toBeUndefined();
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/loads/${LOAD_ID}`));
  });

  it("mất mạng khi mở → bấm lại gửi CÙNG requestId (BE không mở hai chuyến); mở được thì lần sau lấy id mới", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseStaff);
    post.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    const dialog = await fill(user);
    await user.click(within(dialog).getByRole("button", { name: L.openDialog.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await user.click(await within(dialog).findByRole("button", { name: L.openDialog.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const ids = post.mock.calls.map((c) => (c[1] as { requestId: string }).requestId);
    expect(ids[1]).toBe(ids[0]);
    await waitFor(() => expect(push).toHaveBeenCalled());
    // Mở chuyến mới (id đã bỏ sau thành công)
    const second = await fill(user);
    await user.click(within(second).getByRole("button", { name: L.openDialog.submit }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    expect((post.mock.calls[2]?.[1] as { requestId: string }).requestId).not.toBe(ids[0]);
  });

  it("hãng ngừng dùng (409 CARRIER_INACTIVE) → lỗi tiếng Việt trong hộp thoại, hộp thoại giữ nguyên", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseStaff);
    post.mockRejectedValueOnce(new ApiError(409, "CARRIER_INACTIVE", "en"));
    const dialog = await fill(user);
    await user.click(within(dialog).getByRole("button", { name: L.openDialog.submit }));
    expect(await within(dialog).findByText(/ngừng sử dụng/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
