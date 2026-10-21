import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES as ERR, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { resetScanIds } from "@/features/shipping/scan-ids";

import { LOAD_ID, apiLoad, loadShipment, parcel } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  bePage,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { LoadScreen } from "./LoadScreen";

import type { TestActor } from "../__fixtures__/render";
import type { Load } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  useRejectedScansStore.setState({ byLoad: {} });
  resetScanIds();
  sessionStorage.clear();
});

const PATH = `/fulfillment/loads/${LOAD_ID}`;
const L = UI_LABELS.shipping;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Chuyến đủ kiện: một lô, một kiện đã lên xe. */
const fullLoad = (patch: Partial<Load> = {}) =>
  apiLoad({
    shipments: [loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)])],
    ...patch,
  });

interface Handlers {
  scan?: (body: { scanId?: string; packageCode: string }) => unknown;
  handover?: (body: Record<string, unknown>) => unknown;
  cancellation?: (body: Record<string, unknown>) => unknown;
  unscan?: () => unknown;
  removeShipment?: () => unknown;
}

function renderLoad(actor: TestActor, load: Load, handlers: Handlers = {}) {
  const spies = mockShippingApi(actor, {
    get: { [PATH]: () => load },
    post: {
      [`${PATH}/scans`]: (_p, body) => (handlers.scan ?? (() => load))(body as never),
      [`${PATH}/handover`]: (_p, body) => (handlers.handover ?? (() => load))(body as never),
      [`${PATH}/cancellation`]: (_p, body) =>
        (handlers.cancellation ?? (() => load))(body as never),
    },
    delete: {
      [`${PATH}/scans/pkg-PKG-SO-1-1`]: () => (handlers.unscan ?? (() => load))(),
      [`${PATH}/shipments/shp-SO-1-S1`]: () => (handlers.removeShipment ?? (() => load))(),
    },
  });
  renderShippingScreen(<LoadScreen id={LOAD_ID} />);
  return spies;
}

describe("LoadScreen — thông tin chuyến và tiến độ", () => {
  it("hiện hãng, xe, tài xế, tiến độ tổng và theo từng lô; kiện chưa lên xe được nói rõ", async () => {
    renderLoad(ACTORS.warehouseStaff, apiLoad());
    expect(
      await screen.findByRole("heading", { name: `${L.load.title} · ${LOAD_ID}` }),
    ).toBeInTheDocument();
    expect(screen.getByText("GHN Giao Hàng Nhanh")).toBeInTheDocument();
    expect(screen.getByText("51C-628.14")).toBeInTheDocument();
    // 1/3 kiện lên xe: tiến độ tổng, lô S1 đủ 1/1, lô S2 0/2
    expect(screen.getByRole("progressbar", { name: L.load.progressAria })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    const s1 = screen.getByRole("region", { name: `${L.shipments.title} SO-1-S1` });
    expect(within(s1).getByText(L.load.shipmentComplete)).toBeInTheDocument();
    const s2 = screen.getByRole("region", { name: `${L.shipments.title} SO-2-S1` });
    expect(within(s2).getAllByText(L.load.notLoaded)).toHaveLength(2);
    expect(within(s2).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("mỗi lô liên kết sang chi tiết lô giao", async () => {
    renderLoad(ACTORS.warehouseStaff, apiLoad());
    const link = await screen.findByRole("link", { name: "SO-1-S1" });
    expect(link).toHaveAttribute("href", "/admin/shipments/shp-SO-1-S1");
  });
});

describe("LoadScreen — quét kiện", () => {
  it("ô quét luôn focus; Enter gửi mã in hoa kèm scanId (uuid); báo đã lên xe và xoá ô", async () => {
    const user = userEvent.setup();
    const after = apiLoad({
      shipments: [
        loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)]),
        loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", true), parcel("PKG-SO-2-2", false)]),
      ],
    });
    const { post } = renderLoad(ACTORS.warehouseStaff, apiLoad(), { scan: () => after });
    const input = await screen.findByLabelText(L.scan.label);
    expect(input).toHaveFocus();
    await user.type(input, " pkg-so-2-1{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0] ?? [];
    expect(url).toBe(`${PATH}/scans`);
    expect(body).toMatchObject({ packageCode: "PKG-SO-2-1" });
    expect((body as { scanId: string }).scanId).toMatch(UUID);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(`PKG-SO-2-1 — ${L.scan.accepted} (2/3)`),
    );
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("phản hồi không có kiện trên xe (BE replay câu trả lời cũ) → không báo thành công, scanId đổi mới", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, apiLoad());
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-SO-2-1{Enter}");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(L.scan.notLoaded));
    expect(screen.queryByRole("status")).toBeEmptyDOMElement();
    await user.type(input, "PKG-SO-2-1{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const ids = post.mock.calls.map((c) => (c[1] as { scanId: string }).scanId);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("scanId đang chờ (mất mạng) bị bỏ khi kiện đó vừa được gỡ khỏi xe → quét lại là lần quét mới", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const { post, delete: del } = renderLoad(ACTORS.warehouseStaff, apiLoad(), {
      scan: () => {
        calls += 1;
        if (calls === 1) throw new ApiError(0, "NETWORK_ERROR", "offline");
        return apiLoad();
      },
    });
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-SO-1-1{Enter}");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(L.scan.notSent));
    await user.click(
      await screen.findByRole("button", { name: `${L.load.unscanAria} PKG-SO-1-1` }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith(`${PATH}/scans/pkg-PKG-SO-1-1`));
    await user.type(input, "PKG-SO-1-1{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const ids = post.mock.calls.map((c) => (c[1] as { scanId: string }).scanId);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("mỗi lần quét một scanId mới; hai mã liên tiếp gửi lần lượt đúng thứ tự", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, apiLoad());
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-A{Enter}PKG-B{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const bodies = post.mock.calls.map((c) => c[1] as { scanId: string; packageCode: string });
    expect(bodies.map((b) => b.packageCode)).toEqual(["PKG-A", "PKG-B"]);
    expect(bodies[0]?.scanId).not.toBe(bodies[1]?.scanId);
  });

  it("mất mạng giữa chừng → quét lại CÙNG mã dùng lại ĐÚNG scanId; thành công thì lần sau lấy id mới", async () => {
    const user = userEvent.setup();
    let calls = 0;
    const { post } = renderLoad(ACTORS.warehouseStaff, apiLoad(), {
      scan: () => {
        calls += 1;
        if (calls === 1) throw new ApiError(0, "NETWORK_ERROR", "offline");
        return apiLoad();
      },
    });
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-SO-2-1{Enter}");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(L.scan.notSent));
    await user.type(input, "PKG-SO-2-1{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const ids = post.mock.calls.map((c) => (c[1] as { scanId: string }).scanId);
    expect(ids[1]).toBe(ids[0]);
    await user.type(input, "PKG-SO-2-1{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    expect((post.mock.calls[2]?.[1] as { scanId: string }).scanId).not.toBe(ids[0]);
  });

  it("câu trả lời dứt khoát (409) → lần quét sau lấy scanId mới; lỗi dịch sang tiếng Việt và vào danh sách từ chối", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, apiLoad(), {
      scan: () => {
        throw new ApiError(409, "PACKAGE_ALREADY_LOADED", "en");
      },
    });
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-X{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(`PKG-X — ${ERR.PACKAGE_ALREADY_LOADED}`),
    );
    await user.type(input, "PKG-X{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const ids = post.mock.calls.map((c) => (c[1] as { scanId: string }).scanId);
    expect(ids[1]).not.toBe(ids[0]);
    expect(
      screen.getByRole("heading", { name: `${L.scan.rejectedTitle} (1)` }),
    ).toBeInTheDocument();
  });

  it("mã có dấu / khoảng trắng bị chặn trước khi gửi", async () => {
    const user = userEvent.setup();
    const { post } = renderLoad(ACTORS.warehouseStaff, apiLoad());
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG Đ1{Enter}");
    expect(post).not.toHaveBeenCalled();
  });

  it("gỡ kiện đã quét khỏi xe → DELETE /scans/{packageId}", async () => {
    const user = userEvent.setup();
    const { delete: del } = renderLoad(ACTORS.warehouseStaff, apiLoad());
    await user.click(
      await screen.findByRole("button", { name: `${L.load.unscanAria} PKG-SO-1-1` }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith(`${PATH}/scans/pkg-PKG-SO-1-1`));
  });

  it("bỏ lô khỏi chuyến cần xác nhận rồi DELETE /shipments/{id}", async () => {
    const user = userEvent.setup();
    const { delete: del } = renderLoad(ACTORS.warehouseStaff, apiLoad());
    const card = await screen.findByRole("region", { name: `${L.shipments.title} SO-1-S1` });
    await user.click(within(card).getByRole("button", { name: new RegExp(L.load.removeShipment) }));
    expect(del).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: L.load.removeShipment }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith(`${PATH}/shipments/shp-SO-1-S1`));
  });
});

describe("LoadScreen — gate quyền / vai trò / trạng thái", () => {
  it("điều phối đơn hàng chỉ xem: không ô quét, không nút lên xe / bàn giao; có lý do", async () => {
    renderLoad(ACTORS.orderCoordinator, apiLoad());
    await screen.findByRole("heading", { name: `${L.load.title} · ${LOAD_ID}` });
    expect(screen.queryByLabelText(L.scan.label)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.load.actions.handover })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.load.addShipments })).not.toBeInTheDocument();
    expect(screen.getByText(L.load.noActions.notDispatcher)).toBeInTheDocument();
    // Biên bản vẫn xem được
    expect(screen.getByRole("link", { name: new RegExp(L.load.actions.manifest) })).toHaveAttribute(
      "href",
      `/admin/loads/${LOAD_ID}/manifest`,
    );
  });

  it("chuyến đã bàn giao: không ô quét, không gỡ kiện; hiện người ký và mã biên bản", async () => {
    renderLoad(
      ACTORS.warehouseManager,
      fullLoad({
        status: "DISPATCHED",
        dispatchedAt: "2026-10-21T03:00:00Z",
        carrierRepresentative: "Anh Tài",
        signatureRef: "BB-77",
      }),
    );
    await screen.findByText("Anh Tài");
    expect(screen.getByText("BB-77")).toBeInTheDocument();
    expect(screen.getByText(L.load.noActions.dispatched)).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scan.label)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gỡ kiện khỏi xe/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.load.actions.cancel })).not.toBeInTheDocument();
  });

  it("nút huỷ chuyến chỉ có ở quản lý kho; bắt buộc lý do rồi POST /cancellation", async () => {
    const user = userEvent.setup();
    const staff = renderLoad(ACTORS.warehouseStaff, apiLoad());
    await screen.findByRole("heading", { name: `${L.load.title} · ${LOAD_ID}` });
    expect(screen.queryByRole("button", { name: L.load.actions.cancel })).not.toBeInTheDocument();
    cleanup();
    staff.get.mockRestore();
    const { post } = renderLoad(ACTORS.warehouseManager, apiLoad());
    await user.click(await screen.findByRole("button", { name: L.load.actions.cancel }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: L.load.cancelDialog.confirm });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Hãng huỷ xe");
    await user.click(confirm);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/cancellation`, { reason: "Hãng huỷ xe" }),
    );
  });
});

describe("LoadScreen — thêm lô vào chuyến", () => {
  it("lọc theo hãng ở BE, giữ lô chưa gán hãng, bỏ lô nguyên xe / lô hãng khác / lô đã lên chuyến khác", async () => {
    const user = userEvent.setup();
    const row = (code: string, patch: Record<string, unknown> = {}) => ({
      shipmentId: `shp-${code}`,
      code,
      orderId: `ord-${code}`,
      warehouseId: "wh-hcm",
      status: "READY_TO_DISPATCH",
      deliveryMode: "PARCEL",
      packageCount: 1,
      partial: false,
      wholeOrderHandover: false,
      version: 0,
      ...patch,
    });
    const spies = mockShippingApi(ACTORS.warehouseStaff, {
      get: {
        [PATH]: () => apiLoad(),
        "/fulfillment/shipments": (params) => {
          const carrierId = (params as { carrierId?: string }).carrierId;
          return carrierId
            ? bePage([row("MINE-1", { carrierId: "car-ghn" })])
            : bePage([
                row("MINE-1", { carrierId: "car-ghn" }),
                row("FREE-1"),
                row("OTHER-1", { carrierId: "car-vtp" }),
                row("FTL-1", { deliveryMode: "FULL_TRUCKLOAD" }),
                row("BUSY-1", { loadId: "LOAD-9" }),
              ]);
        },
      },
    });
    renderShippingScreen(<LoadScreen id={LOAD_ID} />);
    await user.click(await screen.findByRole("button", { name: L.load.addShipments }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("MINE-1")).toBeInTheDocument();
    expect(within(dialog).getByText("FREE-1")).toBeInTheDocument();
    for (const hidden of ["OTHER-1", "FTL-1", "BUSY-1"]) {
      expect(within(dialog).queryByText(hidden)).not.toBeInTheDocument();
    }
    const calls = spies.get.mock.calls
      .filter(([url]) => url === "/fulfillment/shipments")
      .map(([, config]) => config?.params as Record<string, unknown>);
    expect(calls).toContainEqual(
      expect.objectContaining({ carrierId: "car-ghn", warehouseId: "wh-hcm" }),
    );
    expect(calls.some((p) => p.carrierId === undefined)).toBe(true);
  });
});
