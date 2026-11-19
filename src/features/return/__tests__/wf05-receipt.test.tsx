/**
 * WF-05 TH-4 trên phiếu nhập hàng hoàn: thùng đã mở kèm số đếm thực tế, hàng lẻ không nhãn (chỉ phiếu của yêu cầu trả
 * hàng), và mô tả xác nhận nói đúng chuyện về một phần.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/test/api-screen";

import { ReturnReceiptDetail } from "..";
import { WAREHOUSE_GRANTS, mockReturnApi, renderReturnScreen } from "../__fixtures__/screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const BASE = "/goods-receipts/returns/gr-1";
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
  expectedCartons: [{ lpn: "LPN-0001", sku: "SKU-CUP-01", quantity: 10, scanned: false }],
  looseLines: [],
  version: 0,
  ...over,
});

describe("opened carton", () => {
  /** Phiếu nháp với ô quét; trả spy của POST quét thùng. */
  async function openScan() {
    const scan = vi.fn((_body: unknown) => receiptJson());
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { [BASE]: () => receiptJson() },
      post: { [`${BASE}/cartons`]: (_p, body) => scan(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    await screen.findByLabelText("LPN");
    return { scan, user };
  }
  const opened = () => screen.getByRole("checkbox", { name: "Thùng đã mở" });

  it("'Thùng đã mở' reveals the count and requires it before scanning", async () => {
    const { scan, user } = await openScan();
    expect(screen.queryByLabelText("Số đếm thực tế")).toBeNull();
    await user.click(opened());
    await user.type(screen.getByLabelText("LPN"), "LPN-0001{Enter}");
    expect(await screen.findByText(/nhập số đếm thực tế/)).toBeInTheDocument();
    expect(scan).not.toHaveBeenCalled();
  });

  it("a count above the carton's label is refused before scanning", async () => {
    const { scan, user } = await openScan();
    await user.click(opened());
    await user.type(screen.getByLabelText("Số đếm thực tế"), "11");
    await user.type(screen.getByLabelText("LPN"), "LPN-0001{Enter}");
    expect(await screen.findByText(/không được vượt số trên nhãn/)).toBeInTheDocument();
    expect(scan).not.toHaveBeenCalled();
  });

  it("sends the count, then the next carton is sealed again (no count sent)", async () => {
    const { scan, user } = await openScan();
    await user.click(opened());
    await user.type(screen.getByLabelText("Số đếm thực tế"), "7");
    await user.type(screen.getByLabelText("LPN"), "LPN-0001{Enter}");
    await waitFor(() => expect(scan).toHaveBeenCalledWith({ lpn: "LPN-0001", countedQuantity: 7 }));
    await waitFor(() => expect(opened()).not.toBeChecked());
    await user.type(screen.getByLabelText("LPN"), "LPN-0001{Enter}");
    await waitFor(() => expect(scan).toHaveBeenLastCalledWith({ lpn: "LPN-0001" }));
  });

  it("the carton table shows an opened carton with its count", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: {
        [BASE]: () =>
          receiptJson({
            cartons: [
              {
                lpn: "LPN-0001",
                sku: "SKU-CUP-01",
                quantity: 10,
                countedQuantity: 7,
                opened: true,
              },
              {
                lpn: "LPN-0002",
                sku: "SKU-CUP-01",
                quantity: 10,
                countedQuantity: 10,
                opened: false,
              },
            ],
          }),
      },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    const table = await screen.findByRole("table", { name: "Thùng đã quét" });
    expect(within(table).getByText("Đã mở · đếm 7/10")).toBeInTheDocument();
    expect(within(table).getByText("Nguyên thùng")).toBeInTheDocument();
  });

  it("a count above the label refused by the backend is explained", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { [BASE]: () => receiptJson({ expectedCartons: [] }) },
      post: {
        [`${BASE}/cartons`]: () => {
          throw apiError(400, "VALIDATION_FAILED");
        },
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    await user.click(await screen.findByRole("checkbox", { name: "Thùng đã mở" }));
    await user.type(screen.getByLabelText("Số đếm thực tế"), "50");
    await user.type(screen.getByLabelText("LPN"), "LPN-0009{Enter}");
    expect(
      await screen.findByText("LPN-0009: Số đếm thực tế không được vượt số trên nhãn thùng."),
    ).toBeInTheDocument();
  });
});

describe("loose units", () => {
  it("records SKU, lot and quantity; removes a line; confirms with loose units only", async () => {
    const record = vi.fn((_body: unknown) => receiptJson());
    const remove = vi.fn(() => receiptJson());
    const withLoose = receiptJson({
      looseLines: [{ id: "ll-1", sku: "SKU-CUP-01", lotNumber: null, quantity: 3 }],
    });
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { [BASE]: () => withLoose },
      post: { [`${BASE}/loose-lines`]: (_p, body) => record(body) },
      delete: { [`${BASE}/loose-lines/ll-1`]: remove },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    const card = (await screen.findByRole("heading", { name: "Hàng lẻ không nhãn" }))
      .parentElement as HTMLElement;
    expect(screen.getByRole("button", { name: /Xác nhận nhập/ })).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /Ghi nhận/ }));
    expect(await within(card).findByText("Nhập SKU")).toBeInTheDocument();
    expect(record).not.toHaveBeenCalled();

    await user.type(within(card).getByLabelText(/^SKU/), "SKU-CUP-01");
    await user.type(within(card).getByLabelText(/Lô/), "L-01");
    await user.type(within(card).getByLabelText(/Số lượng/), "2");
    await user.click(within(card).getByRole("button", { name: /Ghi nhận/ }));
    await waitFor(() =>
      expect(record).toHaveBeenCalledWith({ sku: "SKU-CUP-01", lotNumber: "L-01", quantity: 2 }),
    );

    await user.click(within(card).getByRole("button", { name: "Gỡ SKU-CUP-01" }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
  });

  it("a SKU not of the order is explained", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { [BASE]: () => receiptJson() },
      post: {
        [`${BASE}/loose-lines`]: () => {
          throw apiError(400, "VALIDATION_FAILED");
        },
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    const card = (await screen.findByRole("heading", { name: "Hàng lẻ không nhãn" }))
      .parentElement as HTMLElement;
    await user.type(within(card).getByLabelText(/^SKU/), "SKU-OTHER");
    await user.type(within(card).getByLabelText(/Số lượng/), "1");
    await user.click(within(card).getByRole("button", { name: /Ghi nhận/ }));
    expect(await within(card).findByText(/SKU phải là một SKU của đơn/)).toBeInTheDocument();
  });

  it("a returned-shipment receipt takes no loose units", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: {
        [BASE]: () => receiptJson({ returnRequestId: null, rmaNumber: null, shipmentId: "sh-1" }),
      },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    await screen.findByLabelText("LPN");
    expect(screen.queryByRole("heading", { name: "Hàng lẻ không nhãn" })).toBeNull();
  });
});

it("the confirmation says a partial parcel keeps the return awaiting its goods", async () => {
  mockReturnApi(WAREHOUSE_GRANTS, {
    get: {
      [BASE]: () =>
        receiptJson({ cartons: [{ lpn: "LPN-0001", sku: "SKU-CUP-01", quantity: 10 }] }),
    },
  });
  const user = userEvent.setup();
  renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
  await user.click(await screen.findByRole("button", { name: /Xác nhận nhập/ }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent(/nếu mới về một phần, yêu cầu vẫn "Chờ hàng về"/);
  expect(dialog).toHaveTextContent(/"Đã nhận đủ hàng"/);
});
