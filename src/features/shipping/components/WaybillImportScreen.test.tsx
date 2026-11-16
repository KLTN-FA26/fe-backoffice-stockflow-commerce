import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  SHIPPING_ERROR_MESSAGES,
  SHIPPING_LIMITS,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { WaybillImportScreen } from "./WaybillImportScreen";

import type { TestActor } from "../__fixtures__/render";

const I = UI_LABELS.shipping.waybill.import;
const IMPORT = FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS;
const TEMPLATE_URL = "/fulfillment/waybill-imports/template";
const PREVIEW_URL = "/fulfillment/waybill-imports/preview";
const IMPORT_URL = "/fulfillment/waybill-imports";

const line = (
  patch: { line: number; outcome: string; loadCode?: string } & Record<string, unknown>,
) => {
  const loadCode = patch.loadCode ?? "LD-2026-F002";
  return { loadCode, waybillNo: "VTP-1", loadId: loadCode, ...patch };
};

/** Xem trước: dòng 2 mới, 3 và 7 ghi đè mã cũ, 4 không đổi, 5 trùng mã trong hãng, 6 chưa đặt xe. */
const PREVIEW = {
  fileName: "van-don.csv",
  rowsTotal: 6,
  rowsApplied: 1,
  rowsRejected: 2,
  lines: [
    line({ line: 2, outcome: "NEW", vehiclePlate: "51D-111.11", driverName: "Tài A" }),
    line({ line: 3, outcome: "OVERWRITE", loadCode: "LD-2026-F001", waybillNo: "GHN-NEW-3" }),
    line({ line: 4, outcome: "SAME", loadCode: "LD-2026-F004", waybillNo: "GHN-4" }),
    line({
      line: 5,
      outcome: "ERROR",
      loadCode: "LD-2026-F005",
      waybillNo: "VTP-DUP",
      problem: "DUPLICATE_IN_CARRIER",
      holderCode: "LD-2026-F003",
    }),
    line({
      line: 6,
      outcome: "ERROR",
      loadCode: "LD-2026-F006",
      waybillNo: "GHN-6",
      problem: "LOAD_NOT_BOOKED",
    }),
    line({ line: 7, outcome: "OVERWRITE", loadCode: "LD-2026-F007", waybillNo: "GHN-NEW-7" }),
  ],
};

const RESULT = {
  importId: "imp-1",
  fileName: "van-don.csv",
  rowsTotal: 6,
  rowsApplied: 3,
  rowsRejected: 2,
  lines: [
    ...PREVIEW.lines.slice(0, 1),
    PREVIEW.lines[1],
    PREVIEW.lines[2],
    PREVIEW.lines[3],
    PREVIEW.lines[4],
    { ...PREVIEW.lines[5], outcome: "ERROR", problem: "OVERWRITE_NOT_CONFIRMED" },
  ],
};

const csvFile = (name = "van-don.csv") => new File(["a,b"], name, { type: "text/csv" });

type Handler = (params: unknown, body?: unknown) => unknown;

function renderScreen(
  actor: TestActor = ACTORS.warehouseStaff,
  handlers: { preview?: Handler; import?: Handler; template?: Handler } = {},
) {
  const spies = mockShippingApi(actor, {
    get: { [TEMPLATE_URL]: handlers.template ?? (() => new Blob(["h"], { type: "text/csv" })) },
    post: {
      [PREVIEW_URL]: handlers.preview ?? (() => PREVIEW),
      [IMPORT_URL]: handlers.import ?? (() => RESULT),
    },
  });
  renderShippingScreen(<WaybillImportScreen />);
  return spies;
}

/** Chọn file qua ô file gốc (userEvent.upload) rồi bấm Xem trước. */
async function previewFile(user: ReturnType<typeof userEvent.setup>, file = csvFile()) {
  await user.upload(await screen.findByLabelText(I.fileLabel), file);
  await user.click(screen.getByRole("button", { name: I.preview }));
  await screen.findByText(I.previewTitle, { selector: "h2" });
}

const callsTo = (spy: { mock: { calls: unknown[][] } }, url: string) =>
  spy.mock.calls.filter(([target]) => target === url);

let anchorClick: ReturnType<typeof vi.spyOn>;
let downloads: string[];

beforeEach(() => {
  downloads = [];
  URL.createObjectURL = vi.fn(() => "blob:waybill-template");
  URL.revokeObjectURL = vi.fn();
  // jsdom không điều hướng được tới blob: — bắt lệnh tải file thay vì để nó báo "not implemented"
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WaybillImportScreen — tải file mẫu", () => {
  it("bấm 'Tải file mẫu' gọi GET template dạng blob và tải về đúng tên file CSV", async () => {
    const user = userEvent.setup();
    const { get } = renderScreen();
    await user.click(await screen.findByRole("button", { name: I.template }));
    await waitFor(() => expect(downloads).toEqual([I.templateFileName]));
    const [call] = callsTo(get, TEMPLATE_URL);
    expect(call?.[1]).toMatchObject({ responseType: "blob" });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:waybill-template");
    expect(screen.queryByText(I.templateFailed)).not.toBeInTheDocument();
  });

  it("tải mẫu lỗi → báo bằng câu tiếng Việt, không tải gì", async () => {
    const user = userEvent.setup();
    renderScreen(ACTORS.warehouseStaff, {
      template: () => {
        throw new ApiError(500, "INTERNAL", "en");
      },
    });
    await user.click(await screen.findByRole("button", { name: I.template }));
    expect(await screen.findByRole("alert")).toHaveTextContent(I.templateFailed);
    expect(downloads).toEqual([]);
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it("có liên kết về danh sách chuyến xe", async () => {
    renderScreen();
    expect(await screen.findByRole("link", { name: I.back })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.loads.list,
    );
  });
});

describe("WaybillImportScreen — chọn file và xem trước", () => {
  it("chưa chọn file thì 'Xem trước' khóa; chọn file rồi gửi POST preview kèm FormData có đúng file, chưa nhập gì", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen();
    const button = await screen.findByRole("button", { name: I.preview });
    expect(button).toBeDisabled();
    const file = csvFile();
    await user.upload(screen.getByLabelText(I.fileLabel), file);
    expect(button).toBeEnabled();
    await user.click(button);
    await screen.findByText(I.previewTitle, { selector: "h2" });
    const [previewCall] = callsTo(post, PREVIEW_URL);
    expect(previewCall?.[1]).toBeInstanceOf(FormData);
    expect((previewCall?.[1] as FormData).get("file")).toBe(file);
    expect(previewCall?.[2]).toMatchObject({ headers: { "Content-Type": "multipart/form-data" } });
    expect(callsTo(post, IMPORT_URL)).toHaveLength(0);
  });

  it("bảng hiện từng dòng với kết quả tiếng Việt, lý do lỗi và chuyến đang giữ mã trùng; tóm tắt số dòng", async () => {
    const user = userEvent.setup();
    renderScreen();
    await previewFile(user);
    expect(screen.getByText(I.summary(6, 1, 2))).toBeInTheDocument();
    const table = screen.getByRole("table", { name: I.previewTitle });
    const row = (code: string) => {
      const found = within(table)
        .getAllByRole("row")
        .find((r) => within(r).queryByText(code));
      if (!found) throw new Error(`Không có dòng ${code}`);
      return within(found);
    };
    expect(row("VTP-1").getByText(I.outcome.NEW)).toBeInTheDocument();
    expect(row("VTP-1").getByText("51D-111.11")).toBeInTheDocument();
    expect(row("VTP-1").getByText("Tài A")).toBeInTheDocument();
    expect(row("GHN-NEW-3").getByText(I.outcome.OVERWRITE)).toBeInTheDocument();
    expect(row("GHN-4").getByText(I.outcome.SAME)).toBeInTheDocument();
    expect(row("VTP-DUP").getByText(I.outcome.ERROR)).toBeInTheDocument();
    expect(
      row("VTP-DUP").getByText(`${I.problem.DUPLICATE_IN_CARRIER} (${I.heldBy} LD-2026-F003)`),
    ).toBeInTheDocument();
    expect(row("GHN-6").getByText(I.problem.LOAD_NOT_BOOKED)).toBeInTheDocument();
    // Dòng của chuyến có liên kết sang chi tiết chuyến
    expect(row("GHN-NEW-3").getByRole("link", { name: "LD-2026-F001" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.loads.detail("LD-2026-F001"),
    );
  });

  it("chỉ dòng sẽ ghi đè có ô tick, mặc định KHÔNG tick (BR-25) và có lời nhắc xác nhận", async () => {
    const user = userEvent.setup();
    renderScreen();
    await previewFile(user);
    expect(screen.getByText(I.overwriteHint)).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: `${I.overwriteConfirm} ${I.line.toLowerCase()} 3` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: `${I.overwriteConfirm} ${I.line.toLowerCase()} 7` }),
    ).toBeInTheDocument();
  });

  it("chọn file khác sau khi xem trước → bảng cũ biến mất, phải xem trước lại", async () => {
    const user = userEvent.setup();
    renderScreen();
    await previewFile(user);
    await user.upload(screen.getByLabelText(I.fileLabel), csvFile("khac.csv"));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: I.apply })).not.toBeInTheDocument();
  });

  it("file quá 1 MB bị từ chối ngay phía FE: báo lỗi, 'Xem trước' khóa, không gọi API", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen();
    const big = new File([new Uint8Array(SHIPPING_LIMITS.waybillImportMaxBytes + 1)], "lon.csv", {
      type: "text/csv",
    });
    await user.upload(await screen.findByLabelText(I.fileLabel), big);
    expect(await screen.findByRole("alert")).toHaveTextContent(I.fileTooLarge);
    expect(screen.getByRole("button", { name: I.preview })).toBeDisabled();
    expect(callsTo(post, PREVIEW_URL)).toHaveLength(0);
  });

  it("file đúng 1 MB vẫn được nhận", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen();
    const exact = new File([new Uint8Array(SHIPPING_LIMITS.waybillImportMaxBytes)], "vua.csv", {
      type: "text/csv",
    });
    await user.upload(await screen.findByLabelText(I.fileLabel), exact);
    expect(screen.queryByText(I.fileTooLarge)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: I.preview }));
    await screen.findByText(I.previewTitle, { selector: "h2" });
    expect(callsTo(post, PREVIEW_URL)).toHaveLength(1);
  });

  it("BE từ chối file (400 WAYBILL_IMPORT_INVALID_FILE) → câu lỗi tiếng Việt, không hiện bảng", async () => {
    const user = userEvent.setup();
    renderScreen(ACTORS.warehouseStaff, {
      preview: () => {
        throw new ApiError(400, "WAYBILL_IMPORT_INVALID_FILE", "en");
      },
    });
    await user.upload(await screen.findByLabelText(I.fileLabel), csvFile());
    await user.click(screen.getByRole("button", { name: I.preview }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      SHIPPING_ERROR_MESSAGES.WAYBILL_IMPORT_INVALID_FILE,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("WaybillImportScreen — nhập các dòng hợp lệ", () => {
  it("tick hai dòng ghi đè → POST kèm overwriteLines '3,7' và đúng file; hiện kết quả không còn ô tick", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen();
    const file = csvFile();
    await previewFile(user, file);
    // Tick theo thứ tự ngược: FE vẫn gửi số dòng tăng dần
    await user.click(
      screen.getByRole("checkbox", { name: `${I.overwriteConfirm} ${I.line.toLowerCase()} 7` }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: `${I.overwriteConfirm} ${I.line.toLowerCase()} 3` }),
    );
    await user.click(screen.getByRole("button", { name: I.apply }));

    expect(await screen.findByText(I.resultTitle)).toBeInTheDocument();
    const [importCall] = callsTo(post, IMPORT_URL);
    expect(importCall?.[1]).toBeInstanceOf(FormData);
    expect((importCall?.[1] as FormData).get("file")).toBe(file);
    expect(importCall?.[2]).toMatchObject({
      params: { overwriteLines: "3,7" },
      headers: { "Content-Type": "multipart/form-data" },
    });
    expect(screen.getByText(I.resultSummary(3, 2))).toBeInTheDocument();
    expect(screen.getByText(I.resultHint)).toBeInTheDocument();
    // Bảng kết quả: dòng ghi đè không được xác nhận hiện là lỗi kèm lý do; không còn ô tick, không còn nút nhập
    expect(screen.getByText(I.problem.OVERWRITE_NOT_CONFIRMED)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: I.apply })).not.toBeInTheDocument();
  });

  it("không tick dòng ghi đè nào → không gửi overwriteLines (BE từ chối các dòng đó)", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen();
    await previewFile(user);
    await user.click(screen.getByRole("button", { name: I.apply }));
    await screen.findByText(I.resultTitle);
    const [importCall] = callsTo(post, IMPORT_URL);
    expect((importCall?.[2] as { params?: unknown }).params).toBeUndefined();
  });

  it("bỏ tick lại thì dòng đó không còn trong overwriteLines", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen();
    await previewFile(user);
    const seven = screen.getByRole("checkbox", {
      name: `${I.overwriteConfirm} ${I.line.toLowerCase()} 7`,
    });
    const three = screen.getByRole("checkbox", {
      name: `${I.overwriteConfirm} ${I.line.toLowerCase()} 3`,
    });
    await user.click(seven);
    await user.click(three);
    await user.click(seven);
    expect(seven).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: I.apply }));
    await screen.findByText(I.resultTitle);
    expect(callsTo(post, IMPORT_URL)[0]?.[2]).toMatchObject({ params: { overwriteLines: "3" } });
  });

  it("không có dòng nào áp dụng được: nút nhập khóa kèm lời nhắc; chỉ dòng ghi đè thì phải tick mới mở khóa", async () => {
    const user = userEvent.setup();
    renderScreen(ACTORS.warehouseStaff, {
      preview: () => ({
        ...PREVIEW,
        rowsApplied: 0,
        lines: [PREVIEW.lines[1], PREVIEW.lines[2], PREVIEW.lines[3]],
      }),
    });
    await previewFile(user);
    const apply = screen.getByRole("button", { name: I.apply });
    expect(apply).toBeDisabled();
    expect(screen.getByText(I.noApplicable)).toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: `${I.overwriteConfirm} ${I.line.toLowerCase()} 3` }),
    );
    expect(apply).toBeEnabled();
    expect(screen.queryByText(I.noApplicable)).not.toBeInTheDocument();
  });

  it("toàn dòng lỗi / không đổi: không có ô tick, nút nhập khóa", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen(ACTORS.warehouseStaff, {
      preview: () => ({ ...PREVIEW, lines: [PREVIEW.lines[2], PREVIEW.lines[3]] }),
    });
    await previewFile(user);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(I.overwriteHint)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: I.apply })).toBeDisabled();
    expect(callsTo(post, IMPORT_URL)).toHaveLength(0);
  });

  it("nhập lỗi (400 WAYBILL_IMPORT_INVALID_FILE) → hiện câu lỗi, vẫn giữ bảng xem trước", async () => {
    const user = userEvent.setup();
    renderScreen(ACTORS.warehouseStaff, {
      import: () => {
        throw new ApiError(400, "WAYBILL_IMPORT_INVALID_FILE", "en");
      },
    });
    await previewFile(user);
    await user.click(screen.getByRole("button", { name: I.apply }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      SHIPPING_ERROR_MESSAGES.WAYBILL_IMPORT_INVALID_FILE,
    );
    expect(screen.getByRole("table", { name: I.previewTitle })).toBeInTheDocument();
    expect(screen.queryByText(I.resultTitle)).not.toBeInTheDocument();
  });

  it("'Nhập file khác' đưa màn về trạng thái ban đầu", async () => {
    const user = userEvent.setup();
    renderScreen();
    await previewFile(user);
    await user.click(screen.getByRole("button", { name: I.apply }));
    await screen.findByText(I.resultTitle);
    await user.click(screen.getByRole("button", { name: I.another }));
    expect(screen.queryByText(I.resultTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: I.preview })).toBeDisabled();
  });
});

describe("WaybillImportScreen — quyền", () => {
  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff],
    ["quản lý kho", ACTORS.warehouseManager],
  ])("%s thấy file mẫu, ô chọn file và nút xem trước", async (_name, actor) => {
    renderScreen(actor);
    expect(await screen.findByRole("button", { name: I.template })).toBeInTheDocument();
    expect(screen.getByLabelText(I.fileLabel)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: I.preview })).toBeInTheDocument();
    expect(screen.queryByText(I.noPermission)).not.toBeInTheDocument();
  });

  it.each([
    ["người chỉ xem (không có quyền file vận đơn)", ACTORS.viewOnly],
    ["điều phối đơn", ACTORS.orderCoordinator],
    ["không có quyền nào", ACTORS.noAccess],
  ])("%s → màn bị chặn, không có nút nào của màn nhập file", async (_name, actor) => {
    const { get, post } = renderScreen(actor);
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    expect(screen.getByText(UI_LABELS.shipping.forbiddenDescription)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: I.template })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(I.fileLabel)).not.toBeInTheDocument();
    expect(callsTo(get, TEMPLATE_URL)).toHaveLength(0);
    expect(post).not.toHaveBeenCalled();
  });

  it("cổng route cần ĐỦ cả quyền xem trang giao hàng lẫn waybill-imports:READ", async () => {
    // Chỉ có quyền file, thiếu quyền xem trang
    const { unmount } = renderShippingScreenWith({ permissions: [IMPORT.read, IMPORT.create] });
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();
    // Có quyền xem trang + CREATE nhưng thiếu READ
    renderShippingScreenWith({ permissions: [SHIPMENT_PERMISSIONS.viewPage, IMPORT.create] });
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByLabelText(I.fileLabel)).not.toBeInTheDocument();
  });

  it("có READ nhưng không có CREATE: chỉ còn nút tải file mẫu, kèm câu giải thích; vẫn tải được mẫu", async () => {
    const user = userEvent.setup();
    const readOnly: TestActor = {
      permissions: [SHIPMENT_PERMISSIONS.viewPage, SHIPMENT_PERMISSIONS.read, IMPORT.read],
    };
    const { get, post } = renderScreen(readOnly);
    expect(await screen.findByText(I.noPermission)).toBeInTheDocument();
    expect(screen.queryByLabelText(I.fileLabel)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: I.preview })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: I.template }));
    await waitFor(() => expect(downloads).toEqual([I.templateFileName]));
    expect(callsTo(get, TEMPLATE_URL)).toHaveLength(1);
    expect(post).not.toHaveBeenCalled();
  });
});

function renderShippingScreenWith(actor: TestActor) {
  const spies = mockShippingApi(actor, {});
  return { ...renderShippingScreen(<WaybillImportScreen />), spies };
}
