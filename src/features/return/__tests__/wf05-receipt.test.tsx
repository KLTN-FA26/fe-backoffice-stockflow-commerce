/**
 * WF-05 TH-4 trên phiếu nhập hàng hoàn: thùng đã mở kèm số đếm thực tế, hàng lẻ không nhãn (chỉ phiếu của yêu cầu trả
 * hàng), và mô tả xác nhận nói đúng chuyện về một phần.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/test/api-screen";

import { ReturnReceiptDetail } from "..";
import {
  WAREHOUSE_GRANTS,
  WAREHOUSE_MANAGER_GRANTS,
  mockReturnApi,
  renderReturnScreen,
} from "../__fixtures__/screen";

// jsdom has no `crypto.subtle` on every Node version: the direct upload itself is covered by `direct-upload.test.ts`;
// here it only has to declare through the receipt's photo slot and hand back an upload id.
vi.mock("@/lib/api/direct-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/direct-upload")>()),
  uploadFileDirect: async (options: {
    file: File;
    declare: (declaration: unknown) => Promise<{ uploadId: string }>;
  }) => {
    const slot = await options.declare({
      fileName: options.file.name,
      contentType: options.file.type,
      sizeBytes: options.file.size,
      sha256: "0".repeat(64),
    });
    return slot.uploadId;
  },
}));

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

describe("loose units (WF-05 TH-4, Q-18: photo required)", () => {
  const PHOTO_SLOT = "/goods-receipts/gr-1/photos/uploads";
  // BE: ảnh PUT xong được giữ thành ảnh nhận hàng của phiếu; `id` của nó là `photoId` của dòng hàng lẻ
  const PHOTO_ATTACH = "/goods-receipts/gr-1/photos";
  const photo = () => new File(["abc"], "le.jpg", { type: "image/jpeg" });

  it("a photo is required; then slot → PUT → receipt photo → line with photoId; removes a line", async () => {
    const record = vi.fn((_body: unknown) => receiptJson());
    const attach = vi.fn((_body: unknown) => ({ id: "ph-1", receiptId: "gr-1", stage: "RECEIPT" }));
    const slot = vi.fn((_body: unknown) => ({
      uploadId: "up-1",
      method: "PUT",
      url: "/x",
      headers: {},
    }));
    const remove = vi.fn(() => receiptJson());
    const withLoose = receiptJson({
      looseLines: [
        { id: "ll-1", sku: "SKU-CUP-01", lotNumber: null, quantity: 3, photoId: "ph-0" },
      ],
    });
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { [BASE]: () => withLoose },
      post: {
        [`${BASE}/loose-lines`]: (_p, body) => record(body),
        [PHOTO_SLOT]: (_p, body) => slot(body),
        [PHOTO_ATTACH]: (_p, body) => attach(body),
      },
      delete: { [`${BASE}/loose-lines/ll-1`]: remove },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    const card = (await screen.findByRole("heading", { name: "Hàng lẻ không nhãn" }))
      .parentElement as HTMLElement;
    expect(within(card).getByText("Có ảnh")).toBeInTheDocument();

    await user.type(within(card).getByLabelText(/^SKU/), "SKU-CUP-01");
    await user.type(within(card).getByLabelText(/Lô/), "L-01");
    await user.type(within(card).getByLabelText(/Số lượng/), "2");
    await user.click(within(card).getByRole("button", { name: /Ghi nhận/ }));
    expect(await within(card).findByText(/Chụp hoặc chọn ảnh hàng lẻ/)).toBeInTheDocument();
    expect(record).not.toHaveBeenCalled();

    await user.upload(within(card).getByLabelText(/Ảnh hàng lẻ/), photo());
    await user.click(within(card).getByRole("button", { name: /Ghi nhận/ }));
    await waitFor(() =>
      expect(record).toHaveBeenCalledWith({
        sku: "SKU-CUP-01",
        lotNumber: "L-01",
        quantity: 2,
        photoId: "ph-1",
      }),
    );
    expect(attach).toHaveBeenCalledWith({ uploadId: "up-1" });
    expect(slot).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/jpeg" }));

    await user.click(within(card).getByRole("button", { name: "Gỡ SKU-CUP-01" }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
  });

  it("a non-JPEG/PNG photo is refused before any request", async () => {
    const slot = vi.fn();
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { [BASE]: () => receiptJson() },
      post: { [PHOTO_SLOT]: slot },
    });
    const user = userEvent.setup({ applyAccept: false });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    const card = (await screen.findByRole("heading", { name: "Hàng lẻ không nhãn" }))
      .parentElement as HTMLElement;
    await user.upload(
      within(card).getByLabelText(/Ảnh hàng lẻ/),
      new File(["x"], "a.webp", { type: "image/webp" }),
    );
    expect(await within(card).findByText("Chỉ nhận ảnh JPEG hoặc PNG.")).toBeInTheDocument();
    expect(slot).not.toHaveBeenCalled();
  });

  it.each([
    ["VALIDATION_FAILED", 400, /SKU phải là một SKU của đơn/],
    ["RETURN_LOOSE_EXCEEDS_APPROVED", 409, /vượt số đã duyệt trả/],
    ["RETURN_LOOSE_PHOTO_REQUIRED", 400, /Hàng lẻ phải kèm ảnh/],
  ])("BE %s is explained in Vietnamese", async (code, status, text) => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { [BASE]: () => receiptJson() },
      post: {
        [PHOTO_SLOT]: () => ({ uploadId: "up-1", method: "PUT", url: "/x", headers: {} }),
        [PHOTO_ATTACH]: () => ({ id: "ph-1" }),
        [`${BASE}/loose-lines`]: () => {
          throw apiError(status, code);
        },
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    const card = (await screen.findByRole("heading", { name: "Hàng lẻ không nhãn" }))
      .parentElement as HTMLElement;
    await user.type(within(card).getByLabelText(/^SKU/), "SKU-OTHER");
    await user.type(within(card).getByLabelText(/Số lượng/), "1");
    await user.upload(within(card).getByLabelText(/Ảnh hàng lẻ/), photo());
    await user.click(within(card).getByRole("button", { name: /Ghi nhận/ }));
    expect(await within(card).findByText(text)).toBeInTheDocument();
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

describe("confirming a receipt with an opened carton or loose units (WF-05 Q-18)", () => {
  const openedCarton = {
    lpn: "LPN-0001",
    sku: "SKU-CUP-01",
    quantity: 10,
    countedQuantity: 8,
    opened: true,
    scannedBy: "u-clerk",
  };
  const confirmButton = () => screen.findByRole("button", { name: /Xác nhận nhập/ });

  it("a warehouse clerk sees the button locked, with the reason", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: { [BASE]: () => receiptJson({ cartons: [openedCarton] }) },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await confirmButton()).toBeDisabled();
    expect(screen.getByText(/chỉ Quản lý kho xác nhận được/)).toBeInTheDocument();
    expect(screen.getByText("Sẽ không nhập tồn (thùng đã mở)")).toBeInTheDocument();
  });

  it("a warehouse manager who did not count confirms", async () => {
    mockReturnApi(WAREHOUSE_MANAGER_GRANTS, {
      get: { [BASE]: () => receiptJson({ cartons: [openedCarton] }) },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await confirmButton()).toBeEnabled();
  });

  it("the manager who scanned the carton or recorded the loose line cannot confirm", async () => {
    mockReturnApi(WAREHOUSE_MANAGER_GRANTS, {
      get: {
        [BASE]: () =>
          receiptJson({
            looseLines: [
              { id: "ll-1", sku: "SKU-CUP-01", quantity: 2, recordedBy: "u-test", photoId: "ph-1" },
            ],
          }),
      },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await confirmButton()).toBeDisabled();
    expect(screen.getByText(/phải do một Quản lý kho khác xác nhận/)).toBeInTheDocument();
  });

  it("the manager who recounted an opened carton (countedBy) cannot confirm", async () => {
    mockReturnApi(WAREHOUSE_MANAGER_GRANTS, {
      get: { [BASE]: () => receiptJson({ cartons: [{ ...openedCarton, countedBy: "u-test" }] }) },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await confirmButton()).toBeDisabled();
    expect(screen.getByText(/phải do một Quản lý kho khác xác nhận/)).toBeInTheDocument();
  });

  it("the BE flag managerConfirmationRequired wins over the FE's own reading", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: {
        [BASE]: () =>
          receiptJson({
            cartons: [{ lpn: "LPN-0001", sku: "SKU-CUP-01", quantity: 10 }],
            managerConfirmationRequired: true,
          }),
      },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await confirmButton()).toBeDisabled();
    expect(screen.getByText(/chỉ Quản lý kho xác nhận được/)).toBeInTheDocument();
  });

  it("sealed cartons only: any clerk confirms (no manager needed)", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: {
        [BASE]: () =>
          receiptJson({ cartons: [{ lpn: "LPN-0001", sku: "SKU-CUP-01", quantity: 10 }] }),
      },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await confirmButton()).toBeEnabled();
  });

  it("a confirmed opened carton reads 'Không nhập tồn — huỷ'", async () => {
    mockReturnApi(WAREHOUSE_GRANTS, {
      get: {
        [BASE]: () =>
          receiptJson({ status: "CLOSED", cartons: [{ ...openedCarton, stockEntered: false }] }),
      },
    });
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    expect(await screen.findByText("Không nhập tồn — huỷ")).toBeInTheDocument();
  });

  it.each([
    ["RETURN_RECEIPT_MANAGER_CONFIRMATION_REQUIRED", 403, /chỉ Quản lý kho xác nhận được/],
    ["RETURN_RECEIPT_SELF_CONFIRMATION", 409, /phải do một Quản lý kho khác xác nhận/],
  ])("BE %s refusing the confirmation is explained", async (code, status, text) => {
    mockReturnApi(WAREHOUSE_MANAGER_GRANTS, {
      get: { [BASE]: () => receiptJson({ cartons: [openedCarton] }) },
      post: {
        [`${BASE}/confirmation`]: () => {
          throw apiError(status, code);
        },
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnReceiptDetail id="gr-1" />);
    await user.click(await confirmButton());
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Xác nhận nhập/ }));
    expect(await within(dialog).findByText(text)).toBeInTheDocument();
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
