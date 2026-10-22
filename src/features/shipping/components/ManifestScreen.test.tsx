import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import { LOAD_ID, apiManifest } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { ManifestScreen } from "./ManifestScreen";

import type { Manifest } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = `/fulfillment/loads/${LOAD_ID}/manifest`;
const M = UI_LABELS.shipping.manifest;

function renderManifest(manifest: Manifest) {
  const spies = mockShippingApi(ACTORS.warehouseStaff, { get: { [PATH]: () => manifest } });
  renderShippingScreen(<ManifestScreen id={LOAD_ID} />);
  return spies;
}

describe("ManifestScreen — biên bản bàn giao in được", () => {
  it("đủ kiện: hiện kho, hãng, xe, từng lô với người nhận / COD, tổng; in bằng window.print", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderManifest(apiManifest());
    expect(await screen.findByRole("heading", { name: M.docTitle })).toBeInTheDocument();
    expect(screen.getByText("Kho TP.HCM")).toBeInTheDocument();
    expect(screen.getByText("GHN Giao Hàng Nhanh")).toBeInTheDocument();
    expect(screen.getByText("51C-628.14")).toBeInTheDocument();
    expect(screen.getByText("Vũ Đức Long")).toBeInTheDocument();
    expect(screen.getByText("15 Quang Trung, Hà Đông, Hà Nội")).toBeInTheDocument();
    expect(screen.getAllByText(/270\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText(M.warehouseSign)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: M.print });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("còn kiện chưa lên xe → báo thiếu, không cho in để ký; bản in tay chỉ là bản đối soát", async () => {
    const base = apiManifest();
    const manifest = apiManifest({
      shipments: [
        {
          ...(base.shipments[0] as NonNullable<(typeof base.shipments)[0]>),
          packages: [{ labelCode: "PKG-SO-1-1", loaded: false, labelOutdated: false }],
        },
      ],
    });
    renderManifest(manifest);
    const button = await screen.findByRole("button", { name: M.print });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", M.printBlocked);
    expect(screen.getByText(`${M.missingPrefix} 1 ${M.packagesUnit}`)).toBeInTheDocument();
    expect(screen.getByText(M.draftBanner)).toBeInTheDocument();
  });

  it("đã bàn giao: in được, hiện người ký, mã biên bản, ghi chú và COD đổi so với nhãn", async () => {
    const base = apiManifest();
    renderManifest(
      apiManifest({
        status: "DISPATCHED",
        dispatchedAt: "2026-10-21T03:00:00Z",
        dispatchedByName: "Nhân viên kho A",
        carrierRepresentative: "Trần Văn Tài",
        signatureRef: "BB-2026-9",
        handoverNote: "Hàng dễ vỡ",
        shipments: [
          {
            ...(base.shipments[0] as NonNullable<(typeof base.shipments)[0]>),
            codChangedSinceLabel: true,
          },
        ],
      }),
    );
    expect(await screen.findByText("Trần Văn Tài")).toBeInTheDocument();
    expect(screen.getByText("BB-2026-9")).toBeInTheDocument();
    expect(screen.getByText(/Hàng dễ vỡ/)).toBeInTheDocument();
    expect(screen.getByText("Nhân viên kho A")).toBeInTheDocument();
    expect(screen.getByText(M.codChanged)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: M.print })).toBeEnabled();
    expect(screen.queryByText(M.draftBanner)).not.toBeInTheDocument();
  });

  it("không có quyền đọc → không gọi API biên bản", async () => {
    const { get } = mockShippingApi(ACTORS.noAccess, { get: { [PATH]: () => apiManifest() } });
    renderShippingScreen(<ManifestScreen id={LOAD_ID} />);
    expect(await screen.findByText(UI_LABELS.shipping.forbiddenDescription)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });
});
