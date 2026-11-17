import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage } from "@/test/api-screen";

import { ReturnDetail, ReturnReceiptDetail, ReturnReceiptList } from "..";
import {
  SALES_GRANTS,
  WAREHOUSE_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
  returnRowJson,
} from "../__fixtures__/screen";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const receiptJson = (over: Record<string, unknown> = {}) => ({
  id: "gr-1",
  number: "GR-RET-0001",
  receiptType: "RETURN",
  status: "DRAFT",
  warehouseId: "wh-1",
  orderId: "ord-1",
  orderNumber: "SO-1",
  returnRequestId: "ret-1",
  rmaNumber: "RMA-20261110-0001",
  quarantineLocationCode: "WH1-QC01",
  receivedAt: "2026-11-15T03:00:00Z",
  cartons: [],
  expectedCartons: [
    { lpn: "LPN-0001", sku: "SKU-CUP-01", quantity: 24, scanned: false },
    { lpn: "LPN-0002", sku: "SKU-CUP-01", quantity: 24, scanned: false },
  ],
  version: 0,
  ...over,
});

describe("RMA → return receipt", () => {
  it("an approved claim offers the warehouse a link to open its return receipt (17 BR-18)", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { "/returns/ret-1": () => returnJson({ status: "AWAITING_RETURN" }) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByRole("link", { name: /Lập phiếu nhập hàng hoàn/ })).toHaveAttribute(
      "href",
      "/admin/receipts/returns?create=true&returnRequestId=ret-1",
    );
  });

  it("the link opens the dialog with the RMA chosen; quarantine areas come from the warehouse map", async () => {
    const create = vi.fn((_body: unknown) => receiptJson());
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: {
        "/goods-receipts/returns": () => bePage([]),
        "/returns": () => bePage([returnRowJson({ status: "AWAITING_RETURN" })]),
        "/fulfillment/shipments": () => bePage([]),
        "/warehouses": () => bePage([{ id: "wh-1", prefix: "WH1", name: "Kho Bình Dương" }]),
        "/warehouses/wh-1/layout": () => ({
          areas: [
            {
              code: "QC01",
              type: "QUARANTINE",
              name: "Cách ly",
              usable: true,
              locationCode: "WH1-QC01",
            },
            { code: "STG1", type: "STAGING", usable: true, locationCode: "WH1-STG1" },
          ],
        }),
      },
      post: { "/goods-receipts/returns": (_p, body) => create(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptList />, "?create=true&returnRequestId=ret-1");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: /Kho nhận/ }));
    await user.click(await screen.findByRole("option", { name: "Kho Bình Dương" }));
    await user.click(within(dialog).getByRole("combobox", { name: /Khu cách ly/ }));
    expect(screen.queryByRole("option", { name: /WH1-STG1/ })).toBeNull();
    await user.click(await screen.findByRole("option", { name: /WH1-QC01/ }));
    await user.click(within(dialog).getByRole("button", { name: "Lập phiếu" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        returnRequestId: "ret-1",
        quarantineLocationCode: "WH1-QC01",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/receipts/returns/gr-1"));
  });

  it("Sales (no goods-receipt permission) cannot open a receipt", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => returnJson({ status: "AWAITING_RETURN" }) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await screen.findByText("Lem mực mặt trước");
    expect(screen.queryByRole("link", { name: /Lập phiếu nhập hàng hoàn/ })).toBeNull();
  });
});

describe("ReturnReceiptDetail", () => {
  it("scans an LPN with its condition; an empty draft cannot be confirmed", async () => {
    const scan = vi.fn((_body: unknown) =>
      receiptJson({
        cartons: [{ lpn: "LPN-0001", sku: "SKU-CUP-01", quantity: 24, condition: "Móp góc" }],
      }),
    );
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { "/goods-receipts/returns/gr-1": () => receiptJson() },
      post: { "/goods-receipts/returns/gr-1/cartons": (_p, body) => scan(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await screen.findByText("Đã quét 0 / 2 thùng")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác nhận nhập/ })).toBeNull();
    await user.type(screen.getByLabelText(/Tình trạng thùng/), "Móp góc");
    await user.type(screen.getByLabelText("LPN"), "LPN-0001{Enter}");
    await waitFor(() =>
      expect(scan).toHaveBeenCalledWith({ lpn: "LPN-0001", condition: "Móp góc" }),
    );
  });

  it("confirms a draft with cartons; a closed receipt has no actions", async () => {
    const confirm = vi.fn(() => receiptJson({ status: "CLOSED" }));
    const withCarton = receiptJson({
      cartons: [{ lpn: "LPN-0001", sku: "SKU-CUP-01", quantity: 24 }],
    });
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { "/goods-receipts/returns/gr-1": () => withCarton },
      post: { "/goods-receipts/returns/gr-1/confirmation": confirm },
    });
    const user = userEvent.setup();
    const view = renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    await user.click(await screen.findByRole("button", { name: /Xác nhận nhập/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận nhập" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    view.unmount();
    vi.restoreAllMocks();

    mockReturnApi(WAREHOUSE_GRANTS, {
      get: {
        "/goods-receipts/returns/gr-1": () =>
          receiptJson({ status: "CLOSED", cartons: withCarton.cartons }),
      },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    await screen.findByText("Đã quét 1 / 2 thùng");
    expect(screen.queryByRole("button", { name: /Xác nhận nhập|Huỷ phiếu|Gỡ/ })).toBeNull();
    expect(screen.queryByLabelText("LPN")).toBeNull();
  });
});
