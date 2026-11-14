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
  it("đủ kiện: hiện kho, hãng, xe, mã vận đơn, từng lô với người nhận, tổng; in bằng window.print", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderManifest(apiManifest());
    expect(await screen.findByRole("heading", { name: M.docTitle })).toBeInTheDocument();
    expect(screen.getByText("Kho TP.HCM")).toBeInTheDocument();
    expect(screen.getByText("GHN Giao Hàng Nhanh")).toBeInTheDocument();
    expect(screen.getByText("51C-628.14")).toBeInTheDocument();
    expect(screen.getByText("Vũ Đức Long")).toBeInTheDocument();
    expect(screen.getByText("15 Quang Trung, Hà Đông, Hà Nội")).toBeInTheDocument();
    // Mã vận đơn (BR-23) nằm trên biên bản để hai bên đối chiếu khi ký
    const waybill = screen.getByText(UI_LABELS.shipping.ftl.manifest.waybill).parentElement;
    expect(waybill).toHaveTextContent("GHN-250001");
    expect(screen.getByText("PKG-SO-1-1")).toBeInTheDocument();
    expect(screen.getByText(`${M.totalPackages}`)).toBeInTheDocument();
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
          packages: [{ labelCode: "PKG-SO-1-1", loaded: false }],
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

  it("đã bàn giao: in được, hiện người ký, mã biên bản và ghi chú", async () => {
    renderManifest(
      apiManifest({
        status: "DISPATCHED",
        dispatchedAt: "2026-10-21T03:00:00Z",
        dispatchedByName: "Nhân viên kho A",
        carrierRepresentative: "Trần Văn Tài",
        signatureRef: "BB-2026-9",
        handoverNote: "Hàng dễ vỡ",
      }),
    );
    expect(await screen.findByText("Trần Văn Tài")).toBeInTheDocument();
    expect(screen.getByText("BB-2026-9")).toBeInTheDocument();
    expect(screen.getByText(/Hàng dễ vỡ/)).toBeInTheDocument();
    expect(screen.getByText("Nhân viên kho A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: M.print })).toBeEnabled();
    expect(screen.queryByText(M.draftBanner)).not.toBeInTheDocument();
  });

  it("chuyến chưa có mã vận đơn: ô mã vận đơn để dấu gạch cho hai bên điền đối chiếu", async () => {
    renderManifest(apiManifest({ waybillNo: undefined }));
    await screen.findByRole("heading", { name: M.docTitle });
    const waybill = screen.getByText(UI_LABELS.shipping.ftl.manifest.waybill).parentElement;
    expect(waybill).toHaveTextContent("—");
    expect(screen.queryByText("GHN-250001")).not.toBeInTheDocument();
  });

  it("biên bản BE không còn COD / mode: trường thừa không làm hỏng, lô và kiện vẫn in ra", async () => {
    const base = apiManifest();
    const legacy = {
      ...base,
      mode: "PARCEL",
      shipments: base.shipments.map((s) => ({
        ...s,
        codAmount: 270_000,
        codChangedSinceLabel: true,
      })),
    } as Manifest;
    renderManifest(legacy);
    expect(await screen.findByText("Vũ Đức Long")).toBeInTheDocument();
    expect(screen.getByText("SO-1-S1")).toBeInTheDocument();
    expect(screen.getByText("PKG-SO-1-1")).toBeInTheDocument();
    expect(screen.queryByText(/270\.000/)).not.toBeInTheDocument();
  });

  it("biên bản theo xe: hiện kế hoạch + số xe, loại xe và ghi chú chỉ gồm kiện của xe", async () => {
    renderManifest(apiManifest());
    expect(await screen.findByText("LP-2026-0001 · xe số 1")).toBeInTheDocument();
    expect(screen.getByText("TRUCK-1T25")).toBeInTheDocument();
    expect(screen.getByText(UI_LABELS.shipping.ftl.manifest.perVehicleNote)).toBeInTheDocument();
  });

  it("không có quyền đọc → không gọi API biên bản", async () => {
    const { get } = mockShippingApi(ACTORS.noAccess, { get: { [PATH]: () => apiManifest() } });
    renderShippingScreen(<ManifestScreen id={LOAD_ID} />);
    expect(await screen.findByText(UI_LABELS.shipping.forbiddenDescription)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });
});
