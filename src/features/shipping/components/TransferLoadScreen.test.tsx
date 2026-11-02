import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, PACK_SHIPMENT_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";
import { resetScanIds } from "@/features/shipping/scan-ids";

import {
  FTL_ID,
  TRANSFER_NUMBER,
  TRANSFER_ORDER_ID,
  ftlLoad,
  ftlParcel,
  loadingFtl,
  transferLoad,
  transferManifest,
  transferShipment,
} from "../__fixtures__/ftl-load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { HandoverDone } from "./handover/HandoverDone";
import { LoadScreen } from "./LoadScreen";
import { ManifestScreen } from "./ManifestScreen";

import type { Load } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  useRejectedScansStore.setState({ byLoad: {} });
  resetScanIds();
  sessionStorage.clear();
});

const PATH = `/fulfillment/loads/${FTL_ID}`;
const L = UI_LABELS.shipping;
const T = L.ftl.transfer;

function renderLoad(actor: (typeof ACTORS)[keyof typeof ACTORS], load: Load) {
  const spies = mockShippingApi(actor, {
    get: { [PATH]: () => load },
    post: { [`${PATH}/scans`]: () => load },
  });
  renderShippingScreen(<LoadScreen id={FTL_ID} />);
  return spies;
}

const ready = () => screen.findByRole("heading", { name: `${L.load.title} · ${FTL_ID}` });

describe("Xe của kế hoạch nguồn TRANSFER — dòng là một lệnh chuyển kho (BE PR #164)", () => {
  it("dòng hiện số lệnh liên kết sang lệnh chuyển kho + nhãn 'Lệnh chuyển kho'; không có liên kết lô giao / đơn, không có trạng thái lô", async () => {
    renderLoad(ACTORS.warehouseManager, transferLoad());
    await ready();
    const card = screen.getByRole("region", { name: `${T.cardAria} ${TRANSFER_NUMBER}` });
    expect(within(card).getByRole("link", { name: TRANSFER_NUMBER })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.transfers.detail(TRANSFER_ORDER_ID),
    );
    expect(within(card).getByText(T.badge)).toBeInTheDocument();
    expect(within(card).queryAllByRole("link")).toHaveLength(1);
    // Trạng thái "lô giao" không áp dụng cho lệnh chuyển kho (BE trả trạng thái của lệnh)
    expect(within(card).queryByText(PACK_SHIPMENT_STATUS_DISPLAY.UNKNOWN)).not.toBeInTheDocument();
    expect(within(card).queryByText(/Không rõ/)).not.toBeInTheDocument();
  });

  it("dòng của lệnh không có chữ 'Lô giao' và không hiện COD (trên nhãn / chốt) — lệnh chuyển kho không thu hộ", async () => {
    renderLoad(ACTORS.warehouseManager, transferLoad());
    await ready();
    expect(screen.getByRole("heading", { name: `${T.sectionTitle} (1)` })).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(L.load.shipmentsTitle))).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: new RegExp(`^${L.shipments.title}`) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(L.load.labelCod))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(L.load.fixedCod))).not.toBeInTheDocument();
  });

  it("xe chở lô giao của đơn khách vẫn có tiêu đề 'Lô giao trên chuyến' và COD trên nhãn (không đổi hành vi cũ)", async () => {
    renderLoad(ACTORS.warehouseManager, ftlLoad());
    await ready();
    expect(
      screen.getByRole("heading", { name: `${L.load.shipmentsTitle} (1)` }),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(L.load.labelCod))).toBeInTheDocument();
    expect(screen.queryByText(T.badge)).not.toBeInTheDocument();
  });

  it("lệnh trên xe do kế hoạch quản lý: không có nút gỡ lô dù là quản lý kho; không thêm lô", async () => {
    renderLoad(ACTORS.warehouseManager, transferLoad());
    await ready();
    expect(screen.queryByRole("button", { name: L.load.removeShipment })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.load.addShipments })).not.toBeInTheDocument();
  });

  it("tiến độ kiện lên xe của lệnh: 0/2 rồi quét từng kiện theo mã nhãn", async () => {
    const user = userEvent.setup();
    const scanned = loadingFtl({
      shipments: [
        transferShipment([ftlParcel("PKG-TO-1-1", true), ftlParcel("PKG-TO-1-2", false)]),
      ],
    });
    const { post } = renderLoad(
      ACTORS.warehouseStaff,
      loadingFtl({ shipments: transferLoad().shipments }),
    );
    post.mockResolvedValueOnce({ data: scanned });
    await user.type(await screen.findByLabelText(L.scan.label), "PKG-TO-1-1{Enter}");
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `${PATH}/scans`,
        expect.objectContaining({ packageCode: "PKG-TO-1-1" }),
      ),
    );
    expect(
      await screen.findByRole("progressbar", {
        name: `${L.load.shipmentLoaded} ${TRANSFER_NUMBER}`,
      }),
    ).toHaveAttribute("aria-valuenow", "1");
  });

  it("kết quả bàn giao: liên kết lệnh sang trang lệnh chuyển kho, không in trạng thái 'Chờ xe cuối' của lô", async () => {
    const load = transferLoad({ status: "DISPATCHED" });
    renderShippingScreen(<HandoverDone load={load} onClose={() => {}} />);
    const link = await screen.findByRole("link", { name: TRANSFER_NUMBER });
    expect(link).toHaveAttribute("href", ADMIN_ROUTES.transfers.detail(TRANSFER_ORDER_ID));
    const row = link.closest("li") as HTMLElement;
    expect(
      within(row).queryByText(L.ftl.handover.shipmentStatus.READY_TO_DISPATCH),
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByText(L.ftl.handover.shipmentStatus.HANDED_OVER),
    ).not.toBeInTheDocument();
  });
});

describe("Biên bản theo xe của kế hoạch nguồn TRANSFER", () => {
  it("dòng của lệnh: số lệnh + nhãn 'Lệnh chuyển kho' thay số đơn; người nhận / địa chỉ là kho đích; COD 0", async () => {
    mockShippingApi(ACTORS.warehouseStaff, {
      get: { [`${PATH}/manifest`]: () => transferManifest() },
    });
    renderShippingScreen(<ManifestScreen id={FTL_ID} />);
    expect(await screen.findByText(TRANSFER_NUMBER)).toBeInTheDocument();
    expect(screen.getByText(T.badge)).toBeInTheDocument();
    expect(screen.getByText("Kho Đà Nẵng")).toBeInTheDocument();
    expect(screen.getByText("12 Nguyễn Văn Linh, Đà Nẵng")).toBeInTheDocument();
    expect(screen.getByText("PKG-TO-1-1")).toBeInTheDocument();
    expect(screen.getByText("PKG-TO-1-2")).toBeInTheDocument();
  });
});
