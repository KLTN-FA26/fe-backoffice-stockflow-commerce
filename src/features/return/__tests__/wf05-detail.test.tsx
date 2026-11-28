/**
 * WF-05 trên màn chi tiết yêu cầu trả hàng: các lần hàng về (TH-3), "Đã nhận đủ hàng", không rút được khi đã có kiện về,
 * "Kết thúc không hoàn tiền" (TH-4), nhãn RESOLVED, và Sale thêm ảnh bằng chứng tải thẳng lên kho.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { storageClient } from "@/lib/api/direct-upload";
import { formatDateTime } from "@/lib/format/date";
import { apiError } from "@/test/api-screen";

import { ReturnDetail } from "..";
import {
  ACCOUNTANT_GRANTS,
  SALES_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
} from "../__fixtures__/screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const line = (approvedQuantity: number, receivedQuantity: number) => ({
  id: "line-1",
  orderLineId: "ol-1",
  sku: "SKU-CUP-01",
  customPrinted: true,
  unitPrice: 100_000,
  requestedQuantity: 24,
  approvedQuantity,
  receivedQuantity,
  refundQuantity: 0,
});

const PARCEL_AT = "2026-11-14T04:00:00Z";
const partlyBack = (over: Record<string, unknown> = {}) =>
  returnJson({
    status: "AWAITING_RETURN",
    lines: [line(20, 5)],
    review: { decidedAt: "2026-11-11T02:00:00Z", returnRequired: true },
    receipt: {
      receivedAt: PARCEL_AT,
      locationCode: "WH1-QC01",
      goodsReceiptId: "gr-1",
      receivedBy: "4f1c2d3e-0000-4000-8000-000000000001",
      parcels: [
        {
          parcel: 1,
          goodsReceiptId: "gr-1",
          receiptNumber: "GR-RET-0001",
          locationCode: "WH1-QC01",
          receivedBy: "4f1c2d3e-0000-4000-8000-000000000001",
          receivedByName: "Phạm Thu Hà",
          receivedAt: PARCEL_AT,
        },
      ],
    },
    ...over,
  });

describe("TH-3 — goods back in parcels", () => {
  it("lists each parcel with its receipt link, date and receiver", async () => {
    mockReturnApi(SALES_GRANTS, { get: { "/returns/ret-1": () => partlyBack() } });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const parcels = await screen.findByRole("list", { name: "Các lần hàng về" });
    expect(within(parcels).getByText("Lần 1")).toBeInTheDocument();
    expect(within(parcels).getByRole("link", { name: "GR-RET-0001" })).toHaveAttribute(
      "href",
      "/admin/receipts/returns/gr-1",
    );
    expect(within(parcels).getByText(formatDateTime(PARCEL_AT))).toBeInTheDocument();
    // #286: người nhận hiện bằng tên BE kèm, không mảnh UUID
    expect(within(parcels).getByText("Phạm Thu Hà")).toBeInTheDocument();
    expect(within(parcels).queryByText(/4f1c2d3e/)).not.toBeInTheDocument();
  });

  it("a parcel back hides Cancel; Sales mark the goods complete with an optional note", async () => {
    const complete = vi.fn((_body: unknown) => partlyBack({ status: "RECEIVED" }));
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => partlyBack() },
      post: { "/returns/ret-1/goods-complete": (_p, body) => complete(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Đã nhận đủ hàng/ }));
    expect(screen.queryByRole("button", { name: /Rút thay khách/ })).toBeNull();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/chốt theo số đã về/);
    await user.type(within(dialog).getByLabelText(/Ghi chú/), "Khách hết hàng");
    await user.click(within(dialog).getByRole("button", { name: "Đã nhận đủ hàng" }));
    await waitFor(() =>
      expect(complete).toHaveBeenCalledWith({ version: 2, note: "Khách hết hàng" }),
    );
  });

  it("nothing back yet: no goods-complete; cancelling after a parcel came meanwhile explains why", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => returnJson({ status: "AWAITING_RETURN" }) },
      post: {
        "/returns/ret-1/cancellation": () => {
          throw apiError(409, "RETURN_GOODS_PARTLY_RECEIVED");
        },
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Rút thay khách/ }));
    expect(screen.queryByRole("button", { name: /Đã nhận đủ hàng/ })).toBeNull();
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Khách đổi ý");
    await user.click(within(dialog).getByRole("button", { name: "Rút yêu cầu" }));
    expect(
      await within(dialog).findByText(/Đã có kiện hàng của yêu cầu này về kho nên không rút được/),
    ).toBeInTheDocument();
  });
});

describe("TH-4 — closure without refund", () => {
  const nothingUsable = () =>
    partlyBack({ status: "RECEIVED", lines: [line(20, 0)], receipt: { goodsReceiptId: "gr-1" } });

  it("nothing refundable: only 'Kết thúc không hoàn tiền', sent with the version", async () => {
    const close = vi.fn((_body: unknown) => nothingUsable());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => nothingUsable() },
      post: { "/returns/ret-1/closure-without-refund": (_p, body) => close(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Kết thúc không hoàn tiền/ }));
    expect(screen.queryByRole("button", { name: /Đề xuất hoàn tiền/ })).toBeNull();
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Kết thúc" }));
    await waitFor(() => expect(close).toHaveBeenCalledWith({ version: 2 }));
  });

  it("something refundable: the refund proposal stays, no closure", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => partlyBack({ status: "RECEIVED" }) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByRole("button", { name: /Đề xuất hoàn tiền/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kết thúc không hoàn tiền/ })).toBeNull();
  });

  it("a return closed without refund reads 'Đã xử lý xong' and links no refund screen", async () => {
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: {
        "/returns/ret-1": () => ({
          ...nothingUsable(),
          status: "RESOLVED",
          resolution: {
            settlementAmount: 0,
            settledAt: "2026-11-15T03:00:00Z",
            offsetAmount: 0,
            refundedAmount: 0,
            vatAdjustmentRequired: false,
          },
        }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByText(/Đã kết thúc không hoàn tiền/)).toBeInTheDocument();
    expect(screen.getAllByText("Đã xử lý xong").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Mở màn hoàn tiền" })).toBeNull();
  });
});

describe("claim photos added by Sales", () => {
  const SLOT = "/returns/ret-1/evidence/uploads";
  const slot = () => ({
    uploadId: "up-1",
    method: "PUT",
    url: "https://bucket.example.com/incoming/up-1",
    headers: { "Content-Type": "image/jpeg" },
  });
  const jpeg = () => new File(["abc"], "loi.jpg", { type: "image/jpeg" });

  it("slot → PUT → attach, with the file declared as it is", async () => {
    const declare = vi.fn((_body: unknown) => slot());
    const attach = vi.fn((_body: unknown) => returnJson());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => returnJson() },
      post: {
        [SLOT]: (_p, body) => declare(body),
        "/returns/ret-1/evidence": (_p, body) => attach(body),
      },
    });
    const put = vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.upload(await screen.findByLabelText("Thêm ảnh"), jpeg());
    await waitFor(() => expect(attach).toHaveBeenCalledWith({ uploadId: "up-1" }));
    expect(declare).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "loi.jpg", contentType: "image/jpeg", sizeBytes: 3 }),
    );
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({ method: "PUT", url: "https://bucket.example.com/incoming/up-1" }),
    );
  });

  it("a non-image is refused before any request; the photo limit is explained", async () => {
    const declare = vi.fn((_body: unknown) => {
      throw apiError(409, "RETURN_EVIDENCE_LIMIT_REACHED");
    });
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => returnJson() },
      post: { [SLOT]: (_p, body) => declare(body) },
    });
    const user = userEvent.setup({ applyAccept: false });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const input = await screen.findByLabelText("Thêm ảnh");
    await user.upload(input, new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("Chỉ nhận ảnh JPEG, PNG hoặc WebP.")).toBeInTheDocument();
    expect(declare).not.toHaveBeenCalled();
    await user.upload(input, jpeg());
    expect(await screen.findByText("Yêu cầu đã đủ số ảnh tối đa.")).toBeInTheDocument();
  });

  it("no upload once the goods are back, nor without sales-rmas:CREATE", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => partlyBack({ status: "RECEIVED" }) },
    });
    const view = renderReturnScreen(<ReturnDetail id="ret-1" />);
    await screen.findByText("Lem mực mặt trước");
    expect(screen.queryByLabelText("Thêm ảnh")).toBeNull();
    view.unmount();
    vi.restoreAllMocks();

    mockReturnApi(ACCOUNTANT_GRANTS, { get: { "/returns/ret-1": () => returnJson() } });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await screen.findByText("Lem mực mặt trước");
    expect(screen.queryByRole("button", { name: /Thêm ảnh/ })).toBeNull();
  });
});
