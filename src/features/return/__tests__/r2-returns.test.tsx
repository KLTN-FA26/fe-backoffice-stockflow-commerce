/**
 * Audit r2 (FE pass 2) trên màn yêu cầu trả hàng: lựa chọn của khách cho hàng giữ hộ (returns H1 — Sale ghi, Quản lý kho
 * thực hiện), lịch sử / chênh lệch bằng tiếng Việt (L14), câu của "Rút thay khách" khi kho đang đếm (M-3).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { STOCK_PACKAGE_PERMISSIONS } from "@/constants/permissions";
import { RMA_PERMISSIONS } from "@/constants/returns";
import { ApiError } from "@/lib/api/error";

import { ReturnDetail } from "..";
import { cancelReturnErrorMessage } from "../errors";
import { discrepancyKindLabel, historyReasonText } from "../selectors";
import {
  SALES_GRANTS,
  WAREHOUSE_MANAGER_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
} from "../__fixtures__/screen";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const CUSTODY = "/inventory/stock-packages/customer-custody";
const heldCarton = (over: Record<string, unknown> = {}) => ({
  lpn: "LPN-0001",
  sku: "SKU-CUP-01",
  quantity: 24,
  locationCode: "WH1-QC01",
  returnRequestId: "ret-1",
  ownership: "CUSTOMER_HELD",
  heldAt: "2026-11-20T00:00:00Z",
  ...over,
});
/** Audit r3 RAD-3: BE r3c gửi các thùng giữ hộ trên chi tiết (`custodyCartons`, dạng `HeldCarton`). */
const refused = (over: Record<string, unknown> = {}) =>
  returnJson({
    status: "RESOLVED",
    outcome: "REFUSED",
    refusalReason: "CUSTOMER_DAMAGE",
    version: 7,
    custodyCartons: [heldCarton({ returnRequestId: undefined })],
    ...over,
  });
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 50,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});
const choiceCard = async () =>
  (await screen.findByRole("heading", { name: "Hàng của khách giữ hộ" })).parentElement
    ?.parentElement as HTMLElement;

describe("audit r2 returns H1: the customer's choice for goods held for them", () => {
  it("Sales record SEND_BACK with the version read", async () => {
    const api = mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => refused() },
      post: {
        "/returns/ret-1/custody-choice": () => refused({ custodyChoice: "SEND_BACK", version: 8 }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const card = await choiceCard();
    expect(within(card).getByText(/Chưa ghi lựa chọn của khách/)).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Ghi lựa chọn của khách" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi lựa chọn" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/returns/ret-1/custody-choice", {
        choice: "SEND_BACK",
        version: 7,
      }),
    );
  });

  it("a destruction on the customer's behalf needs the consent record before anything is sent", async () => {
    const api = mockReturnApi(SALES_GRANTS, { get: { "/returns/ret-1": () => refused() } });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const card = await choiceCard();
    await userEvent.click(within(card).getByRole("button", { name: "Ghi lựa chọn của khách" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Khách chọn/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Công ty huỷ hộ/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi lựa chọn" }));
    expect(
      await within(dialog).findByText("Huỷ hộ phải nêu biên bản khách đồng ý."),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("no card when the BE lists no held carton (refunded in full: the goods are the company's)", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: {
        "/returns/ret-1": () =>
          returnJson({
            status: "RESOLVED",
            outcome: "REFUNDED",
            lines: [
              {
                id: "line-1",
                orderLineId: "ol-1",
                sku: "SKU-CUP-01",
                customPrinted: true,
                unitPrice: 100_000,
                requestedQuantity: 24,
                refundQuantity: 24,
              },
            ],
          }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByRole("heading", { name: "Lịch sử" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hàng của khách giữ hộ" })).toBeNull();
  });

  it("the warehouse manager sees the held cartons and records the choice carried out, with its record", async () => {
    const grants: PermissionCode[] = [
      ...WAREHOUSE_MANAGER_GRANTS,
      STOCK_PACKAGE_PERMISSIONS.read,
      STOCK_PACKAGE_PERMISSIONS.update,
    ];
    const api = mockReturnApi(grants, {
      get: {
        "/returns/ret-1": () =>
          refused({
            custodyChoice: "DESTROY_ON_BEHALF",
            custodyChoiceNote: "BB-07/2026",
            custodyCartons: [heldCarton({ choice: "DESTROY_ON_BEHALF" })],
          }),
      },
      post: {
        "/inventory/stock-packages/LPN-0001/customer-custody/end": () =>
          heldCarton({ ownership: "CUSTOMER_DESTROYED", endedAt: "2026-11-24T02:00:00Z" }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const card = await choiceCard();
    expect(within(card).getByText("BB-07/2026")).toBeInTheDocument();
    // Kho không ghi / đổi lựa chọn — đó là việc của Sale
    expect(within(card).queryByRole("button", { name: /lựa chọn/ })).toBeNull();
    await userEvent.click(await within(card).findByRole("button", { name: "Đã thực hiện" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "BB huỷ 12/11");
    await userEvent.click(within(dialog).getByRole("button", { name: "Đã thực hiện" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/inventory/stock-packages/LPN-0001/customer-custody/end",
        { note: "BB huỷ 12/11" },
      ),
    );
    // Audit r3 RAD-3: the cartons come with the return (`custodyCartons`), not from the warehouse-wide list
    expect(api.get.mock.calls.some(([url]) => url === CUSTODY)).toBe(false);
  });

  it("a carton waiting for the customer's choice cannot be carried out yet", async () => {
    const grants: PermissionCode[] = [
      ...WAREHOUSE_MANAGER_GRANTS,
      RMA_PERMISSIONS.update,
      STOCK_PACKAGE_PERMISSIONS.read,
      STOCK_PACKAGE_PERMISSIONS.update,
    ];
    mockReturnApi(grants, {
      get: { "/returns/ret-1": () => refused() },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    const card = await choiceCard();
    expect(await within(card).findByText(/Chờ Sale ghi lựa chọn của khách/)).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Đã thực hiện" })).toBeNull();
  });
});

describe("audit r2 L14: history reasons and discrepancies in Vietnamese", () => {
  it("reads the BE's history codes", () => {
    expect(historyReasonText("RESOLVED_NOTHING_USABLE")).toBe(
      "Kết thúc không hoàn tiền — không có đơn vị đã duyệt về dùng được",
    );
    expect(historyReasonText("RECEIVED_WITH_DISCREPANCY GR-RET-0001")).toBe(
      "Đã về, có chênh lệch — phiếu GR-RET-0001",
    );
    const proposed = historyReasonText(
      "REFUND_PROPOSED 0 VND NOTHING_PAID REFUSED CUSTOMER_DAMAGE",
    );
    expect(proposed).toContain("Đề xuất hoàn 0");
    expect(proposed).toContain("đơn chưa thanh toán");
    expect(proposed).toContain("Hư hỏng do bảo quản/sử dụng");
    expect(proposed).not.toMatch(/REFUND_PROPOSED|NOTHING_PAID|CUSTOMER_DAMAGE/);
    expect(historyReasonText("RESOLVED_REFUSED NOT_DEFECTIVE")).toBe(
      "Kết thúc không hoàn tiền: Không phát hiện lỗi",
    );
    expect(historyReasonText("REFUND_SENT_BACK: goods of receipt GR-2 arrived")).toBe(
      "Đề xuất hoàn tiền bị trả lại: goods of receipt GR-2 arrived",
    );
    // Lý do người dùng gõ: nguyên văn
    expect(historyReasonText("Khách đổi ý")).toBe("Khách đổi ý");
  });

  it("names every discrepancy kind, an unknown one as a plain difference", () => {
    expect(discrepancyKindLabel("SHORT")).toBe("Thiếu");
    expect(discrepancyKindLabel("UNEXPECTED_ITEM")).toBe("Ngoài yêu cầu");
    expect(discrepancyKindLabel("WRONG_ITEM")).toBe("Sai mã hàng");
    expect(discrepancyKindLabel("SOMETHING_NEW")).toBe("Chênh lệch");
  });

  it("the history card shows no raw code", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: {
        "/returns/ret-1": () =>
          returnJson({
            status: "RESOLVED",
            outcome: "NOTHING_TO_REFUND",
            history: [
              {
                to: "RESOLVED",
                reason: "RESOLVED_NOTHING_USABLE",
                occurredAt: "2026-11-20T00:00:00Z",
              },
            ],
            discrepancies: [{ id: "d1", kind: "EXCESS", sku: "SKU-CUP-01", quantity: 2 }],
          }),
        [CUSTODY]: () => page([]),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByText(/không có đơn vị đã duyệt về dùng được/)).toBeInTheDocument();
    expect(screen.queryByText("RESOLVED_NOTHING_USABLE")).toBeNull();
    expect(screen.getByText(/Thừa SKU-CUP-01 × 2/)).toBeInTheDocument();
  });
});

describe("audit r2 M-3", () => {
  it("“Rút thay khách” refused because a parcel is being counted is worded for withdrawing", () => {
    const text = cancelReturnErrorMessage(new ApiError(409, "RETURN_RECEIPT_DRAFT_OPEN", "draft"));
    expect(text).toContain("chưa rút được");
    expect(text).not.toContain("hoàn tiền");
  });
});
