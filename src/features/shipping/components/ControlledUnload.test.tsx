import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES, SHIPPING_FIELD_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { resetScanIds } from "@/features/shipping/scan-ids";

import { FTL_ID, ftlLoad, loadingFtl, pendingUnload, plannedLoad } from "../__fixtures__/ftl-load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { LoadScreen } from "./LoadScreen";

import type { Load } from "../types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
  useRejectedScansStore.setState({ byLoad: {} });
  resetScanIds();
  sessionStorage.clear();
});

const PATH = `/fulfillment/loads/${FTL_ID}`;
const REPLACEMENT_ID = `${FTL_ID}-r`;
const L = UI_LABELS.shipping;
const C = L.ftl.controlledCancel;
const U = L.ftl.unload;

/** Xe đã huỷ có kiểm soát (XE_HONG): hai kiện bị khoá, kiện 1 của bộ + một kiện lẻ. */
function controlledCancelled(patch: Partial<Load> = {}): Load {
  return ftlLoad({
    status: "CANCELLED",
    cancelReasonCode: "XE_HONG",
    cancelReason: "Gãy trục sau",
    cancelledAt: "2026-10-21T04:00:00Z",
    carrierBookingToCancel: true,
    shipments: [],
    shipmentCount: 0,
    expectedPackageCount: 0,
    loadedPackageCount: 0,
    pendingUnloads: [
      pendingUnload("PKG-SO-1-1", { reasonCode: "XE_HONG", reason: "Gãy trục sau" }),
      pendingUnload("PKG-SO-1-2", { reasonCode: "XE_HONG", reason: "Gãy trục sau" }),
    ],
    ...patch,
  });
}

function render(
  actor: Parameters<typeof mockShippingApi>[0],
  load: Load,
  post: Record<string, (params: unknown, body?: unknown) => unknown> = {},
) {
  const spies = mockShippingApi(actor, {
    get: { [PATH]: () => load },
    post: Object.fromEntries(
      Object.entries(post).map(([suffix, handler]) => [`${PATH}${suffix}`, handler]),
    ),
  });
  renderShippingScreen(<LoadScreen id={FTL_ID} />);
  return spies;
}

const ready = () => screen.findByRole("heading", { name: `${L.load.title} · ${FTL_ID}` });

describe("Huỷ có kiểm soát một xe (SCRUM-474 UNLOAD-DESIGN)", () => {
  it("gate theo mã quyền: chỉ người có fulfillment-controlled-cancellations:UPDATE thấy nút; nhân viên kho, điều phối thì không", async () => {
    render(ACTORS.warehouseManager, loadingFtl());
    await ready();
    expect(screen.getByRole("button", { name: C.cancelButton })).toBeInTheDocument();
  });

  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff],
    ["điều phối đơn", ACTORS.orderCoordinator],
    ["chỉ xem", ACTORS.viewOnly],
  ])("%s không có nút huỷ có kiểm soát", async (_name, actor) => {
    render(actor, loadingFtl());
    await ready();
    expect(screen.queryByRole("button", { name: C.cancelButton })).not.toBeInTheDocument();
  });

  it("chỉ xe đang xếp hàng: xe chưa đặt / đã đặt / đã huỷ không có nút", async () => {
    render(ACTORS.warehouseManager, plannedLoad());
    await ready();
    expect(screen.queryByRole("button", { name: C.cancelButton })).not.toBeInTheDocument();
  });

  it("chọn mã lý do + ghi chú → POST /controlled-cancellation {reasonCode, note}; Ở LẠI chuyến vừa huỷ (quét dỡ là việc gấp), biểu ngữ dẫn sang chuyến thay thế", async () => {
    const user = userEvent.setup();
    const cancelled = controlledCancelled({
      replacementLoadId: REPLACEMENT_ID,
      replacementLoadCode: `${FTL_ID}-R`,
    });
    const replacement = plannedLoad({ loadId: REPLACEMENT_ID, code: `${FTL_ID}-R` });
    const { post } = render(ACTORS.warehouseManager, loadingFtl(), {
      "/controlled-cancellation": () => ({ cancelled, replacement }),
    });
    await user.click(await screen.findByRole("button", { name: C.cancelButton }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: C.vehicle.confirm });
    // Chưa có ghi chú → chưa gửi được
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "  Gãy trục sau  ");
    // Chưa chọn mã lý do → báo lỗi trong hộp thoại, chưa gọi API
    await user.click(confirm);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      SHIPPING_FIELD_MESSAGES.controlledReasonCodeRequired,
    );
    expect(post).not.toHaveBeenCalledWith(`${PATH}/controlled-cancellation`, expect.anything());

    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: C.reasonCode.XE_HONG }));
    await user.click(within(dialog).getByRole("button", { name: C.vehicle.confirm }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/controlled-cancellation`, {
        reasonCode: "XE_HONG",
        note: "Gãy trục sau",
      }),
    );
    // Chuyến vừa huỷ hiện ngay với kiện cần dỡ; không chuyển trang
    const banner = (await screen.findByText(C.cancelledBanner.title)).parentElement as HTMLElement;
    expect(within(banner).getByRole("link", { name: `${FTL_ID}-R` })).toHaveAttribute(
      "href",
      `/admin/loads/${REPLACEMENT_ID}`,
    );
    expect(screen.getByRole("heading", { name: `${U.controlledTitle} (2)` })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("409 INVALID_LOAD_TRANSITION (xe vừa đổi trạng thái ở nơi khác): lỗi trong hộp thoại và tải lại chuyến", async () => {
    const user = userEvent.setup();
    const { post, get } = render(ACTORS.warehouseManager, loadingFtl());
    post.mockRejectedValueOnce(new ApiError(409, "INVALID_LOAD_TRANSITION", "en"));
    await user.click(await screen.findByRole("button", { name: C.cancelButton }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Gãy trục");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: C.reasonCode.XE_HONG }));
    const loadGets = () => get.mock.calls.filter(([url]) => url === PATH).length;
    const before = loadGets();
    await user.click(within(dialog).getByRole("button", { name: C.vehicle.confirm }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      SHIPPING_ERROR_MESSAGES.INVALID_LOAD_TRANSITION,
    );
    await waitFor(() => expect(loadGets()).toBeGreaterThan(before));
  });

  it("bốn mã lý do đều chọn được", async () => {
    const user = userEvent.setup();
    render(ACTORS.warehouseManager, loadingFtl());
    await user.click(await screen.findByRole("button", { name: C.cancelButton }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    for (const label of Object.values(C.reasonCode)) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
  });
});

describe("Xe đã huỷ có kiểm soát — kiện bị khoá, quét dỡ và xác nhận không quét", () => {
  it("huỷ cả kế hoạch (không có chuyến thay thế): biểu ngữ chỉ nêu lý do, không nhắc chuyến thay thế", async () => {
    render(ACTORS.warehouseManager, controlledCancelled());
    const banner = (await screen.findByText(C.cancelledBanner.title)).parentElement as HTMLElement;
    expect(
      within(banner).queryByText(new RegExp(C.cancelledBanner.replacement)),
    ).not.toBeInTheDocument();
    expect(within(banner).queryByRole("link")).not.toBeInTheDocument();
  });

  it("hiện lý do (mã + ghi chú), danh sách kiện còn phải dỡ kèm mã lý do; không còn nút huỷ có kiểm soát", async () => {
    render(ACTORS.warehouseManager, controlledCancelled());
    await ready();
    const banner = screen.getByText(C.cancelledBanner.title).parentElement as HTMLElement;
    expect(within(banner).getByText(C.reasonCode.XE_HONG)).toBeInTheDocument();
    expect(within(banner).getByText(/Gãy trục sau/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: `${U.controlledTitle} (2)` })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: U.title });
    expect(within(table).getAllByText(C.reasonCode.XE_HONG)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: C.cancelButton })).not.toBeInTheDocument();
  });

  it("nhân viên kho quét dỡ được (POST /unloads) nhưng không có nút xác nhận không quét", async () => {
    const user = userEvent.setup();
    const after = controlledCancelled({
      pendingUnloads: [pendingUnload("PKG-SO-1-2", { reasonCode: "XE_HONG" })],
    });
    const { post } = render(ACTORS.warehouseStaff, controlledCancelled(), {
      "/unloads": () => after,
    });
    const input = await screen.findByLabelText(U.label);
    expect(screen.queryByRole("button", { name: /Xác nhận không quét/ })).not.toBeInTheDocument();
    await user.type(input, "pkg-so-1-1{Enter}");
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/unloads`, { packageCode: "PKG-SO-1-1" }),
    );
    expect(
      await screen.findByRole("heading", { name: `${U.controlledTitle} (1)` }),
    ).toBeInTheDocument();
  });

  it("quản lý kho xác nhận dỡ không quét: POST /unload-overrides {packageId, note}", async () => {
    const user = userEvent.setup();
    const after = controlledCancelled({
      pendingUnloads: [pendingUnload("PKG-SO-1-2", { reasonCode: "XE_HONG" })],
    });
    const { post } = render(ACTORS.warehouseManager, controlledCancelled(), {
      "/unload-overrides": () => after,
    });
    await user.click(await screen.findByRole("button", { name: U.overrideAria("PKG-SO-1-1") }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(U.overrideNote), "Nhãn bị ướt");
    await user.click(within(dialog).getByRole("button", { name: U.overrideConfirm }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/unload-overrides`, {
        packageId: "pkg-PKG-SO-1-1",
        note: "Nhãn bị ướt",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: `${U.controlledTitle} (1)` }),
    ).toBeInTheDocument();
  });

  it("ghi chú của xác nhận không quét là tuỳ chọn: bỏ trống vẫn gửi được", async () => {
    const user = userEvent.setup();
    const { post } = render(ACTORS.warehouseManager, controlledCancelled(), {
      "/unload-overrides": () => controlledCancelled({ pendingUnloads: [] }),
    });
    await user.click(await screen.findByRole("button", { name: U.overrideAria("PKG-SO-1-2") }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: U.overrideConfirm }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/unload-overrides`, {
        packageId: "pkg-PKG-SO-1-2",
        note: undefined,
      }),
    );
  });
});
