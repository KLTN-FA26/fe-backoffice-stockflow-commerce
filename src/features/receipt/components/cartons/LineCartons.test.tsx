import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CARTON_PRINT_LABELS as P, RECEIPT_CARTON_LABELS as L } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { RECEIPT_ID, apiReceipt, cartonLine, cartonPackage } from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { ReceiptDetail } from "../ReceiptDetail";

import type { PermissionCode } from "@/lib/auth";
import type { GoodsReceiptApiDto, ReceiptLineDto } from "../../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PATH = `/goods-receipts/${RECEIPT_ID}`;
const LABELS = "/inventory/stock-packages/labels";

/** Dòng của ví dụ issue #104 đã ở khu QC: 2 thùng IN_STOCK, 3.010 lẻ. */
function inStock(overrides: Partial<ReceiptLineDto> = {}): ReceiptLineDto {
  return cartonLine({
    lotNumber: "L01",
    qcProgress: "IN_QC_AREA",
    qcLocationCode: "HCM-QCA01",
    packages: [
      cartonPackage({ status: "IN_STOCK", locationCode: "HCM-QCA01" }),
      cartonPackage({
        id: "c0000000-0000-4000-8000-000000000002",
        lpn: "LPN-20261024-000002",
        quantity: 980,
        receivedQty: 980,
        status: "IN_STOCK",
        locationCode: "HCM-QCA01",
      }),
    ],
    ...overrides,
  });
}

beforeEach(() => {
  // jsdom không có object URL — PDF xem trước dùng blob URL
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:labels"),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => vi.restoreAllMocks());

function renderLines(
  permissions: readonly PermissionCode[],
  receipt: GoodsReceiptApiDto,
  print: () => unknown = () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
) {
  const spies = mockReceiptApi(permissions, { [PATH]: () => receipt }, { [LABELS]: print });
  renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
  return spies;
}

async function openCartons(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: L.openCartons("TABLE-OAK-160") }));
  return screen.findByRole("dialog");
}

describe("Thùng trên chi tiết phiếu (issue #104: LPN, đếm được, hiện còn, trạng thái, vị trí)", () => {
  it("ô Thùng / Lẻ tóm tắt; panel liệt kê từng thùng, trạng thái tiếng Việt và vị trí", async () => {
    const user = userEvent.setup();
    renderLines(ROLES.qcStaff, apiReceipt({ status: "IN_QC", lines: [inStock()] }));
    expect(await screen.findByText(L.cellSummary(2, 3010))).toBeInTheDocument();
    const panel = await openCartons(user);
    expect(within(panel).getByText("LPN-20261024-000002")).toBeInTheDocument();
    expect(within(panel).getAllByText("Trong kho")).toHaveLength(2);
    expect(within(panel).getAllByText("HCM-QCA01")).toHaveLength(2);
    expect(within(panel).getByText(L.panelSubtitle(2, 3010, "CARTON"))).toBeInTheDocument();
  });
});

describe("Action-gating: in nhãn thùng (inventory-stock-packages:CREATE — V20261020000700)", () => {
  it.each([
    ["NV kho", ROLES.warehouseStaff, true],
    ["Quản lý kho", ROLES.warehouseManager, true],
    ["NV QC", ROLES.qcStaff, false],
  ] as const)("%s → thấy nút in nhãn: %s", async (_role, permissions, visible) => {
    const user = userEvent.setup();
    renderLines(permissions, apiReceipt({ status: "IN_QC", lines: [inStock()] }));
    const panel = await openCartons(user);
    expect(within(panel).queryByRole("button", { name: L.printLine }) !== null).toBe(visible);
    expect(within(panel).queryAllByRole("checkbox").length > 0).toBe(visible);
  });

  it("dòng chỉ còn thùng đã dùng hết / thất lạc → không in được", async () => {
    const user = userEvent.setup();
    const line = inStock({
      packages: [
        cartonPackage({ status: "CONSUMED", quantity: 0 }),
        cartonPackage({ lpn: "LPN-20261024-000002", status: "LOST" }),
      ],
    });
    renderLines(ROLES.warehouseManager, apiReceipt({ status: "IN_PUTAWAY", lines: [line] }));
    const panel = await openCartons(user);
    expect(within(panel).queryByRole("button", { name: L.printLine })).not.toBeInTheDocument();
    expect(within(panel).getByText("Thất lạc")).toBeInTheDocument();
  });
});

describe("In / in lại nhãn thùng (BE POST /inventory/stock-packages/labels)", () => {
  it("in lại 1 thùng: gửi lpns + khổ A4, xem trước PDF, có nút In và Tải xuống", async () => {
    const user = userEvent.setup();
    const { post } = renderLines(
      ROLES.warehouseStaff,
      apiReceipt({ status: "IN_QC", lines: [inStock()] }),
    );
    const panel = await openCartons(user);
    await user.click(
      within(panel).getByRole("checkbox", { name: L.selectCarton("LPN-20261024-000002") }),
    );
    await user.click(within(panel).getByRole("button", { name: L.reprint(1) }));
    const dialog = await screen.findByRole("dialog", { name: P.title });
    await user.click(within(dialog).getByRole("radio", { name: /Tờ A4/ }));
    await user.click(within(dialog).getByRole("button", { name: P.generate }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[0]).toBe(LABELS);
    expect(post.mock.calls[0]?.[1]).toEqual({ lpns: ["LPN-20261024-000002"], format: "A4_SHEET" });
    expect(await within(dialog).findByTitle(P.preview)).toHaveAttribute("src", "blob:labels");
    expect(within(dialog).getByRole("link", { name: P.download })).toHaveAttribute("download");
    expect(within(dialog).getByRole("button", { name: P.printNow })).toBeEnabled();
  });

  it("in cả dòng gửi receiptLineId (mặc định cuộn nhiệt); lỗi BE → câu tiếng Việt trong dialog", async () => {
    const user = userEvent.setup();
    const { post } = renderLines(
      ROLES.warehouseStaff,
      apiReceipt({ status: "IN_QC", lines: [inStock()] }),
      () => {
        throw new ApiError(409, "INVALID_STOCK_PACKAGE_TRANSITION", "LPN is CONSUMED");
      },
    );
    const panel = await openCartons(user);
    await user.click(within(panel).getByRole("button", { name: L.printLine }));
    const dialog = await screen.findByRole("dialog", { name: P.title });
    await user.click(within(dialog).getByRole("button", { name: P.generate }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/không còn ở trạng thái/);
    expect(post.mock.calls[0]?.[1]).toEqual({
      receiptLineId: inStock().id,
      format: "THERMAL_ROLL",
    });
  });
});

describe("In nhãn — mỗi lần mở dialog là một lần in mới", () => {
  it("in cả dòng rồi đóng; in lại 1 thùng → dialog không còn PDF / nút In của lần trước", async () => {
    const user = userEvent.setup();
    renderLines(ROLES.warehouseStaff, apiReceipt({ status: "IN_QC", lines: [inStock()] }));
    const panel = await openCartons(user);
    await user.click(within(panel).getByRole("button", { name: L.printLine }));
    let dialog = await screen.findByRole("dialog", { name: P.title });
    await user.click(within(dialog).getByRole("button", { name: P.generate }));
    expect(await within(dialog).findByTitle(P.preview)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: P.close }));

    await user.click(
      within(panel).getByRole("checkbox", { name: L.selectCarton("LPN-20261024-000002") }),
    );
    await user.click(within(panel).getByRole("button", { name: L.reprint(1) }));
    dialog = await screen.findByRole("dialog", { name: P.title });
    expect(within(dialog).queryByTitle(P.preview)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: P.printNow })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: P.generate })).toBeInTheDocument();
  });
});

describe("In nhãn — đang tạo PDF thì không đổi khổ được", () => {
  it("bấm Tạo file in rồi, khi chờ BE thì radio khổ nhãn bị khoá (không gán nhầm PDF khổ cũ)", async () => {
    const user = userEvent.setup();
    const { post } = renderLines(
      ROLES.warehouseStaff,
      apiReceipt({ status: "IN_QC", lines: [inStock()] }),
    );
    // BE chưa trả lời
    post.mockImplementationOnce(() => new Promise(() => {}));
    const panel = await openCartons(user);
    await user.click(within(panel).getByRole("button", { name: L.printLine }));
    const dialog = await screen.findByRole("dialog", { name: P.title });
    await user.click(within(dialog).getByRole("button", { name: P.generate }));

    expect(within(dialog).getByRole("radio", { name: /Tờ A4/ })).toBeDisabled();
    expect(within(dialog).getByRole("radio", { name: /Cuộn nhiệt/ })).toBeDisabled();
  });
});
