import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { LOAD_ID, apiLoad, line } from "../__fixtures__/load";
import {
  SHIPPING_ROLE_PERMISSIONS as ROLES,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { ManifestScreen } from "./ManifestScreen";

import type { PermissionCode } from "@/lib/auth";
import type { Load } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// jsdom không có ResizeObserver mà Checkbox (radix use-size) dùng.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => vi.restoreAllMocks());

const PATH = `/fulfillment/loads/${LOAD_ID}`;
const L = UI_LABELS.shipping;
const FULL = [line(1, "2026-10-12T01:10:00Z"), line(2, "2026-10-12T01:12:00Z")];

function renderManifest(permissions: readonly PermissionCode[], load: Load) {
  const spies = mockShippingApi(
    permissions,
    { [PATH]: () => load, "/warehouses": () => ({ items: [] }) },
    {
      [`${PATH}/handover`]: () => ({
        ...load,
        status: "DISPATCHED",
        manifest: {
          manifestNumber: "MNF-1",
          carrierRepresentative: "Anh Tài",
          handedOverAt: "2026-10-12T02:00:00Z",
        },
      }),
    },
  );
  renderShippingScreen(<ManifestScreen id={LOAD_ID} />);
  return spies;
}

describe("ManifestScreen — đối soát + bàn giao", () => {
  it("còn kiện chưa lên xe → báo thiếu, nút bàn giao bị khoá", async () => {
    renderManifest(ROLES.warehouseStaff, apiLoad());
    expect(
      await screen.findByText(`${L.manifest.missingPrefix} 1 ${L.manifest.packagesUnit} (1/2)`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.action.handover })).toBeDisabled();
    // Thiếu kiện → không in tờ để ký (khoá nút In)
    expect(screen.getByRole("button", { name: L.action.print })).toBeDisabled();
  });

  it("bàn giao gặp lỗi dữ liệu cũ (máy khác vừa đổi chuyến) → toast báo, không mất lỗi", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error");
    mockShippingApi(
      ROLES.warehouseStaff,
      { [PATH]: () => apiLoad({ lines: FULL }), "/warehouses": () => ({ items: [] }) },
      {
        [`${PATH}/handover`]: () => {
          throw new ApiError(409, "OPTIMISTIC_LOCK", "stale");
        },
      },
    );
    renderShippingScreen(<ManifestScreen id={LOAD_ID} />);
    await user.click(await screen.findByRole("button", { name: L.action.handover }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Tên đại diện/), "Anh Tài");
    await user.click(within(dialog).getByLabelText(L.manifest.signedConfirm));
    await user.click(within(dialog).getByRole("button", { name: L.action.handover }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(SHIPPING_ERROR_MESSAGES.OPTIMISTIC_LOCK),
    );
  });

  it("đủ kiện → nhập đại diện hãng + xác nhận đã ký rồi bàn giao (version gửi kèm)", async () => {
    const user = userEvent.setup();
    const { post } = renderManifest(ROLES.warehouseStaff, apiLoad({ lines: FULL }));
    await user.click(await screen.findByRole("button", { name: L.action.handover }));

    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: L.action.handover });
    await user.type(within(dialog).getByLabelText(/Tên đại diện/), "Anh Tài");
    expect(submit).toBeDisabled();
    await user.click(within(dialog).getByLabelText(L.manifest.signedConfirm));
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/handover`, {
        version: 2,
        carrierRepresentative: "Anh Tài",
        note: undefined,
        signed: true,
      }),
    );
  });

  it("chuyến chưa xếp hàng (vào thẳng URL) → không hiện biên bản rỗng", async () => {
    renderManifest(ROLES.warehouseStaff, apiLoad({ status: "VEHICLE_BOOKED", lines: FULL }));
    expect(await screen.findByText(L.manifest.unavailableTitle)).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.handover })).not.toBeInTheDocument();
  });

  it("biên bản in được: danh sách kiện + hai ô ký, không có mã vận đơn", async () => {
    renderManifest(ROLES.viewOnly, apiLoad({ lines: FULL }));
    expect(await screen.findByText(L.document.title)).toBeInTheDocument();
    // Tờ đủ kiện (để ký) không ghi "chưa bàn giao"
    expect(screen.queryByText(L.document.notHandedOver, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText(L.manifest.warehouseSign)).toBeInTheDocument();
    expect(screen.getByText(L.manifest.carrierSign)).toBeInTheDocument();
    expect(screen.getByText("PKG-0002")).toBeInTheDocument();
    // Tài liệu in không có mã vận đơn / tracking (hãng bên thứ ba)
    expect(within(screen.getByRole("article")).queryByText(/vận đơn|tracking/i)).toBeNull();
    // Chỉ quyền xem → in được, không bàn giao được
    expect(screen.getByRole("button", { name: L.action.print })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.handover })).not.toBeInTheDocument();
  });
});
