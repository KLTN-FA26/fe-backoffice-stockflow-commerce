/**
 * Phiếu nhập hàng hoàn của yêu cầu trả hàng nhận theo số lượng SKU đã duyệt (WF-05 BE-22, Q-11): bảng "Hàng được duyệt
 * trả" thay cho "x / y thùng", thùng của chuyến là ứng viên có thể chọn trực tiếp — chọn chưa phải đã nhận, vẫn phải ghi
 * nhận; thùng phải mở đếm không gửi nguyên thùng và không điền sẵn số đếm.
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
const progressRow = (over: Record<string, unknown> = {}) => ({
  sku: "SKU-B",
  approvedQuantity: 15,
  confirmedReceivedQuantity: 0,
  currentReceiptQuantity: 0,
  remainingQuantity: 15,
  ...over,
});
const receiptJson = (over: Record<string, unknown> = {}) => ({
  id: "gr-1",
  number: "GR-RET-0001",
  receiptType: "RETURN",
  status: "DRAFT",
  warehouseId: "wh-1",
  orderId: "ord-1",
  returnRequestId: "ret-1",
  rmaNumber: "RMA-20261110-0001",
  quarantineLocationCode: "WH1-QC01",
  receivedAt: "2026-11-15T03:00:00Z",
  cartons: [],
  expectedCartons: [
    { lpn: "LPN-B1", sku: "SKU-B", quantity: 20, scanned: false },
    { lpn: "LPN-B2", sku: "SKU-B", quantity: 20, scanned: false },
  ],
  looseLines: [],
  version: 0,
  returnProgress: [progressRow()],
  candidateCartons: [
    {
      lpn: "LPN-B1",
      sku: "SKU-B",
      quantity: 20,
      maxReceivableQuantity: 15,
      eligibility: "COUNT_REQUIRED",
    },
    {
      lpn: "LPN-B2",
      sku: "SKU-B",
      quantity: 20,
      maxReceivableQuantity: 15,
      eligibility: "COUNT_REQUIRED",
    },
    {
      lpn: "LPN-A1",
      sku: "SKU-A",
      quantity: 10,
      maxReceivableQuantity: 0,
      eligibility: "SKU_NOT_APPROVED",
    },
  ],
  ...over,
});

function render(
  receipt: Record<string, unknown>,
  scan = vi.fn((_body: unknown): unknown => receipt),
) {
  mockReturnApi(WAREHOUSE_GRANTS, {
    get: { [BASE]: () => receipt },
    post: { [`${BASE}/cartons`]: (_p, body) => scan(body) },
  });
  const user = userEvent.setup();
  renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
  return { scan, user };
}

describe("RMA receiving by approved units", () => {
  it("shows the approved SKU with its quantities instead of a carton ratio; unapproved packages stay out", async () => {
    render(receiptJson());
    const table = await screen.findByRole("table", { name: "Hàng được duyệt trả" });
    const cells = within(table)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(cells.slice(0, 5)).toEqual(["SKU-B", "15", "0", "0", "15"]);
    expect(screen.queryByText(/Đã quét 0 \/ 2 thùng/)).toBeNull();
    const candidates = screen.getByRole("table", { name: "Thùng có thể nhận" });
    expect(within(candidates).getByText("LPN-B1")).toBeInTheDocument();
    expect(within(candidates).queryByText("LPN-A1")).toBeNull();
    expect(screen.getByText("Thùng không nhận được (1)")).toBeInTheDocument();
    expect(within(candidates).getAllByText("Phải mở đếm — tối đa 15")).toHaveLength(2);
  });

  it("selecting a carton does not record it; a carton that must be counted is not sent sealed", async () => {
    const { scan, user } = render(receiptJson());
    await user.click(await screen.findByRole("button", { name: "Chọn thùng LPN-B1" }));
    expect(scan).not.toHaveBeenCalled();
    const box = screen.getByRole("region", { name: "Thùng đã chọn" });
    expect(within(box).getByText(/LPN-B1 · SKU-B · nhãn 20/)).toBeInTheDocument();
    await user.click(within(box).getByRole("button", { name: "Ghi nhận thùng" }));
    expect(
      await screen.findByText(/Thùng nguyên vượt số còn nhận được \(15\)/),
    ).toBeInTheDocument();
    expect(scan).not.toHaveBeenCalled();
    // The count is not prefilled: the clerk types what is really in the carton
    await user.click(screen.getByRole("checkbox", { name: "Thùng đã mở" }));
    expect(screen.getByLabelText("Số đếm thực tế")).toHaveValue(null);
    await user.type(screen.getByLabelText("Số đếm thực tế"), "16");
    await user.click(within(box).getByRole("button", { name: "Ghi nhận thùng" }));
    expect(await screen.findByText(/Số đếm vượt số còn nhận được \(15\)/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Số đếm thực tế"));
    await user.type(screen.getByLabelText("Số đếm thực tế"), "15");
    await user.click(within(box).getByRole("button", { name: "Ghi nhận thùng" }));
    await waitFor(() => expect(scan).toHaveBeenCalledWith({ lpn: "LPN-B1", countedQuantity: 15 }));
  });

  it("scanning and typing go through the same path as selecting", async () => {
    const receipt = receiptJson({
      candidateCartons: [
        {
          lpn: "LPN-B1",
          sku: "SKU-B",
          quantity: 10,
          maxReceivableQuantity: 10,
          eligibility: "RECEIVABLE",
        },
      ],
    });
    const { scan, user } = render(receipt);
    await user.type(await screen.findByLabelText("LPN"), "LPN-B1{Enter}");
    await waitFor(() => expect(scan).toHaveBeenCalledWith({ lpn: "LPN-B1" }));
  });

  it("everything recorded on the draft: counting done, confirmation still required — not received", async () => {
    render(
      receiptJson({
        cartons: [{ lpn: "LPN-B1", sku: "SKU-B", quantity: 20, countedQuantity: 15, opened: true }],
        returnProgress: [progressRow({ currentReceiptQuantity: 15, remainingQuantity: 0 })],
        candidateCartons: [],
      }),
    );
    expect(
      await screen.findByText(/Hàng chỉ được tính là đã nhận sau khi xác nhận phiếu/),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Đã ghi trên phiếu này" })).toBeInTheDocument();
    expect(screen.getByText("Đã ghi 1 thùng")).toBeInTheDocument();
  });

  it("a refused scan says why, from the BE details", async () => {
    const scan = vi.fn((_body: unknown): unknown => {
      throw apiError(409, "RETURN_CARTON_NOT_CLAIMED", undefined, "not claimed", { approved: 0 });
    });
    const { user } = render(receiptJson(), scan);
    await user.type(await screen.findByLabelText("LPN"), "LPN-A1{Enter}");
    expect(await screen.findByText(/SKU của thùng này không được duyệt trả/)).toBeInTheDocument();
  });
});

describe("a carrier's return (RTO) keeps reconciling cartons", () => {
  it("counts cartons; one back on an earlier trip is not missing", async () => {
    render(
      receiptJson({
        returnRequestId: null,
        rmaNumber: null,
        shipmentId: "sh-1",
        shipmentCode: "S-1",
        returnProgress: null,
        candidateCartons: null,
        expectedCartons: [
          { lpn: "LPN-1", sku: "SKU-B", quantity: 20, scanned: false, receivedEarlier: true },
          { lpn: "LPN-2", sku: "SKU-B", quantity: 20, scanned: false, receivedEarlier: false },
        ],
      }),
    );
    expect(await screen.findByText("Đã quét 0 / 1 thùng")).toBeInTheDocument();
    expect(screen.getByText("Đã về ở phiếu trước")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Hàng được duyệt trả" })).toBeNull();
  });
});
