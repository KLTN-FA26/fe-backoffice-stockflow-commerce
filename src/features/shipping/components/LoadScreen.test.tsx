import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES as ERR, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { resetScanIds } from "@/features/shipping/scan-ids";

import { LOAD_ID, apiLoad, loadShipment, parcel } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
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
  unscan?: () => unknown;
}

function renderLoad(actor: TestActor, load: Load, handlers: Handlers = {}) {
  const spies = mockShippingApi(actor, {
    get: { [PATH]: () => load },
    post: {
      [`${PATH}/scans`]: (_p, body) => (handlers.scan ?? (() => load))(body as never),
      [`${PATH}/handover`]: (_p, body) => (handlers.handover ?? (() => load))(body as never),
    },
    delete: {
      [`${PATH}/scans/pkg-PKG-SO-1-1`]: () => (handlers.unscan ?? (() => load))(),
    },
  });
  renderShippingScreen(<LoadScreen id={LOAD_ID} />);
  return spies;
}

/** Thẻ "Thông tin chuyến": các giá trị cùng có ở thẻ Đặt xe / Mã vận đơn nên phải tìm trong đúng thẻ. */
const infoCard = () =>
  within(screen.getByRole("heading", { name: L.load.info }).closest("section") as HTMLElement);

describe("LoadScreen — thông tin chuyến và tiến độ", () => {
  it("thẻ thông tin hiện hãng, xe, tài xế và mã vận đơn; tiến độ tổng và theo từng lô, kiện chưa lên xe được nói rõ", async () => {
    renderLoad(ACTORS.warehouseStaff, apiLoad());
    expect(
      await screen.findByRole("heading", { name: `${L.load.title} · ${LOAD_ID}` }),
    ).toBeInTheDocument();
    const info = infoCard();
    expect(info.getByText("GHN Giao Hàng Nhanh")).toBeInTheDocument();
    expect(info.getByText("51C-628.14")).toBeInTheDocument();
    expect(info.getByText("Lê Văn Xế")).toBeInTheDocument();
    expect(info.getByText(UI_LABELS.shipping.waybill.card.number)).toBeInTheDocument();
    expect(info.getByText("GHN-250001")).toBeInTheDocument();
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

  it("chuyến chưa có mã vận đơn: ô mã vận đơn của thẻ thông tin hiện dấu gạch, không hiện mã cũ", async () => {
    renderLoad(ACTORS.warehouseStaff, apiLoad({ waybillNo: undefined }));
    await screen.findByRole("heading", { name: `${L.load.title} · ${LOAD_ID}` });
    const info = screen.getByRole("heading", { name: L.load.info }).closest("section");
    const item = within(info as HTMLElement).getByText(UI_LABELS.shipping.waybill.card.number)
      .parentElement as HTMLElement;
    expect(within(item).getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("GHN-250001")).not.toBeInTheDocument();
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
});

describe("LoadScreen — gate mã quyền / trạng thái", () => {
  const CANCEL = UI_LABELS.shipping.ftl.controlledCancel.cancelButton;

  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff, { scan: true, handover: true, cancel: false }],
    ["quản lý kho", ACTORS.warehouseManager, { scan: true, handover: true, cancel: true }],
    [
      "điều phối đơn hàng",
      ACTORS.orderCoordinator,
      { scan: false, handover: false, cancel: false },
    ],
    ["chỉ xem", ACTORS.viewOnly, { scan: false, handover: false, cancel: false }],
  ])(
    "%s: ô quét / gỡ kiện / bàn giao / huỷ có kiểm soát đúng theo mã quyền",
    async (_n, actor, want) => {
      renderLoad(actor, fullLoad());
      await screen.findByRole("heading", { name: `${L.load.title} · ${LOAD_ID}` });
      const present = (el: HTMLElement | null) => el !== null;
      expect(present(screen.queryByLabelText(L.scan.label))).toBe(want.scan);
      expect(
        present(screen.queryByRole("button", { name: `${L.load.unscanAria} PKG-SO-1-1` })),
      ).toBe(want.scan);
      expect(present(screen.queryByRole("button", { name: L.load.actions.handover }))).toBe(
        want.handover,
      );
      expect(present(screen.queryByRole("button", { name: CANCEL }))).toBe(want.cancel);
      // Biên bản luôn xem được
      expect(
        screen.getByRole("link", { name: new RegExp(L.load.actions.manifest) }),
      ).toHaveAttribute("href", `/admin/loads/${LOAD_ID}/manifest`);
    },
  );

  it("không có fulfillment-dispatch:UPDATE: chỉ xem, có câu giải thích vì sao không có ô quét", async () => {
    renderLoad(ACTORS.orderCoordinator, apiLoad());
    await screen.findByRole("heading", { name: `${L.load.title} · ${LOAD_ID}` });
    expect(screen.getByText(L.load.noActions.viewOnly)).toBeInTheDocument();
  });

  it("chưa đủ kiện: nút bàn giao có nhưng khoá, kèm lý do", async () => {
    renderLoad(ACTORS.warehouseStaff, apiLoad());
    const button = await screen.findByRole("button", { name: L.load.actions.handover });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", L.load.disabledReason.notFullyLoaded);
  });

  it("chuyến đã bàn giao: không ô quét, không gỡ kiện, không bàn giao / huỷ; hiện người ký và mã biên bản", async () => {
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
    expect(screen.queryByRole("button", { name: L.load.actions.handover })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: CANCEL })).not.toBeInTheDocument();
  });
});
