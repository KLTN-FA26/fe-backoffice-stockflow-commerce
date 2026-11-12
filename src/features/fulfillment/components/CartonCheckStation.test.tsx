import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CARTON_CHECK_ERROR_MESSAGES, CARTON_NOT_CHECKED_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import {
  CARTON_CHECK_PATH,
  LINE_A_ID,
  OTHER_STARTER_ID,
  allLabeledSession,
  apiCarton,
  apiSession,
  checkedCarton,
  labeledCarton,
  startedSession,
} from "../__fixtures__/carton-check";
import { renderCartonCheckStation, stubUuids } from "../__fixtures__/carton-check-render";
import { IDENTITIES } from "../__fixtures__/render";
import { apiTask, stagedTask } from "../__fixtures__/task";

import type { CartonCheckSessionDto } from "../carton-check-types";

const L = UI_LABELS.cartonCheck;
const START = `${CARTON_CHECK_PATH}/packing-start`;
const CHECKS = `${CARTON_CHECK_PATH}/carton-checks`;
const LABELS = `${CARTON_CHECK_PATH}/carton-labels`;
const PDF = `${CARTON_CHECK_PATH}/shipping-labels`;
const COMPLETION = `${CARTON_CHECK_PATH}/packing-completion`;
const cartonPath = (lpn: string, action: string) => `${CARTON_CHECK_PATH}/cartons/${lpn}/${action}`;

beforeEach(() => {
  // jsdom không có blob URL — hộp thoại PDF cần để xem trước / tải xuống
  URL.createObjectURL = vi.fn(() => "blob:carton-labels");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

const rowOf = (lpn: string) => screen.getByText(lpn).closest("tr") as HTMLElement;
const pdfBlob = () => new Blob(["%PDF-1.4"], { type: "application/pdf" });

/** Phiên với thùng đầu đổi sang `patch`; thùng thứ hai giữ nguyên. */
function withFirst(
  session: CartonCheckSessionDto,
  patch: Partial<CartonCheckSessionDto["cartons"][number]>,
): CartonCheckSessionDto {
  const [first, ...rest] = session.cartons;
  return { ...session, cartons: [{ ...(first ?? apiCarton()), ...patch }, ...rest] };
}

describe("CartonCheckStation — phiên chưa bắt đầu (Pending)", () => {
  it("hiện dòng hàng, thùng To Check, hướng dẫn bắt đầu; chưa có ô quét / hoàn tất", async () => {
    renderCartonCheckStation();
    expect(await screen.findByText(L.notice.pendingStart)).toBeInTheDocument();
    expect(screen.getByText("LPN000001")).toBeInTheDocument();
    expect(within(rowOf("LPN000001")).getByText("Chờ kiểm")).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scan.label)).toBeNull();
    expect(screen.queryByRole("button", { name: L.action.complete })).toBeNull();
    expect(screen.getByRole("button", { name: L.action.start })).toBeEnabled();
  });

  it("Bắt đầu kiểm thùng → POST packing-start; phiên chuyển In Progress, hiện ô quét và nút hoàn tất", async () => {
    const user = userEvent.setup();
    const { post } = renderCartonCheckStation({
      post: (state) => ({
        [START]: () => {
          state.session = startedSession();
          return state.session;
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.start }));
    expect(await screen.findByLabelText(L.scan.label)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(START);
    expect(screen.getByRole("button", { name: L.action.complete })).toBeInTheDocument();
  });

  it("task còn Staged (thùng ở khu chờ xuất): không có nút Bắt đầu, báo chờ quản lý kho chuyển sang khu xuất hàng", async () => {
    renderCartonCheckStation({ task: stagedTask() });
    // Thông báo ở đầu trạm và câu giải thích ở thẻ trạng thái
    expect((await screen.findAllByText(L.notice.waitingPick)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: L.action.start })).toBeNull();
  });

  it("người khác bắt đầu trước: BE trả 409 PACKING_TAKEN → câu tiếng Việt nêu tên người đang kiểm", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    renderCartonCheckStation({
      session: apiSession({ startedByName: "Nguyễn Văn Đạt" }),
      post: () => ({
        [START]: () => {
          throw new ApiError(409, "PACKING_TAKEN", "Another worker");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.start }));
    await waitFor(() => expect(error).toHaveBeenCalledWith(L.notice.takenTitle("Nguyễn Văn Đạt")));
  });
});

describe("CartonCheckStation — quét LPN (docs 08 §4.2)", () => {
  it("quét đúng LPN → POST carton-checks {lpn}, thùng thành Checked, báo xanh", async () => {
    const user = userEvent.setup();
    const { post } = renderCartonCheckStation({
      session: startedSession(),
      post: (state) => ({
        [CHECKS]: (_params, body) => {
          const lpn = (body as { lpn: string }).lpn;
          state.session = {
            ...state.session,
            cartons: state.session.cartons.map((c) =>
              c.lpn === lpn ? checkedCarton({ ...c, status: "CHECKED" }) : c,
            ),
          };
          return state.session;
        },
      }),
    });
    await user.type(await screen.findByLabelText(L.scan.label), "LPN000001{Enter}");
    expect((await screen.findAllByText(L.scan.checked("LPN000001"))).length).toBeGreaterThan(0);
    expect(post).toHaveBeenCalledWith(CHECKS, { lpn: "LPN000001" });
    expect(within(rowOf("LPN000001")).getByText("Đã kiểm")).toBeInTheDocument();
  });

  it("quét lại thùng đã kiểm → BE không ghi thêm; màn báo 'đã kiểm trước đó'", async () => {
    const user = userEvent.setup();
    renderCartonCheckStation({
      session: startedSession({
        cartons: [checkedCarton(), apiCarton({ packageNo: 2, lpn: "LPN000002" })],
      }),
      post: (state) => ({ [CHECKS]: () => state.session }),
    });
    await user.type(await screen.findByLabelText(L.scan.label), "LPN000001{Enter}");
    expect((await screen.findAllByText(L.scan.repeated("LPN000001"))).length).toBeGreaterThan(0);
  });

  it("LPN lạ / của đơn khác → câu tiếng Việt từ mã CARTON_NOT_IN_TASK, báo đỏ", async () => {
    const user = userEvent.setup();
    renderCartonCheckStation({
      session: startedSession(),
      post: () => ({
        [CHECKS]: () => {
          throw new ApiError(409, "CARTON_NOT_IN_TASK", "was not picked");
        },
      }),
    });
    await user.type(await screen.findByLabelText(L.scan.label), "LPN-LA{Enter}");
    expect(
      (await screen.findAllByText(`LPN-LA — ${CARTON_CHECK_ERROR_MESSAGES.CARTON_NOT_IN_TASK}`))
        .length,
    ).toBeGreaterThan(0);
  });

  it("ô quét trống → nhắc nhập LPN, không gọi BE", async () => {
    const user = userEvent.setup();
    const { post } = renderCartonCheckStation({ session: startedSession() });
    await user.type(await screen.findByLabelText(L.scan.label), "   {Enter}");
    expect(post).not.toHaveBeenCalled();
  });
});

describe("CartonCheckStation — dán nhãn và in PDF (docs 08 §4.3)", () => {
  const labeledAfterLabel = (state: { session: CartonCheckSessionDto }, lpns: string[]) => {
    state.session = {
      ...state.session,
      orderLocked: true,
      cartons: state.session.cartons.map((c) =>
        lpns.includes(c.lpn) ? labeledCarton({ ...c, status: "LABELED" }) : c,
      ),
    };
    return state.session;
  };

  it("Dán nhãn một thùng Checked → POST carton-labels {lpns}, rồi mở PDF nhãn của đúng thùng đó; đơn báo đã khoá", async () => {
    const user = userEvent.setup();
    const { post } = renderCartonCheckStation({
      session: startedSession({
        cartons: [checkedCarton(), apiCarton({ packageNo: 2, lpn: "LPN000002" })],
      }),
      post: (state) => ({
        [LABELS]: (_params, body) => labeledAfterLabel(state, (body as { lpns: string[] }).lpns),
        [PDF]: pdfBlob,
      }),
    });
    await user.click(
      await within(await waitForRow("LPN000001")).findByRole("button", { name: L.action.label }),
    );
    expect(await screen.findByTitle(L.labels.preview)).toHaveAttribute("src", "blob:carton-labels");
    expect(post).toHaveBeenCalledWith(LABELS, { lpns: ["LPN000001"] });
    expect(post).toHaveBeenCalledWith(
      PDF,
      { lpns: ["LPN000001"] },
      { responseType: "blob", headers: { Accept: "application/pdf, application/json" } },
    );
    expect((await screen.findAllByText(L.notice.lockedTitle)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: L.labels.printNow })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(L.labels.download) })).toHaveAttribute(
      "download",
      "shipping-labels.pdf",
    );
  });

  it("thùng To Check không có nút Dán nhãn; phải quét trước (docs 08 BR-08)", async () => {
    renderCartonCheckStation({ session: startedSession() });
    await screen.findByText("LPN000001");
    expect(screen.queryByRole("button", { name: L.action.label })).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(L.action.labelAll) })).toBeNull();
  });

  it("Dán nhãn loạt: chỉ gửi thùng Checked của SKU đã có quy cách; SKU thiếu quy cách hiện cảnh báo và không dán", async () => {
    const user = userEvent.setup();
    const { post } = renderCartonCheckStation({
      session: startedSession({
        skusWithoutCartonSpec: ["MUG-WHT-11"],
        cartons: [
          checkedCarton(),
          checkedCarton({ packageNo: 2, lpn: "LPN000002", sku: "MUG-WHT-11" }),
        ],
      }),
      post: (state) => ({
        [LABELS]: (_params, body) => labeledAfterLabel(state, (body as { lpns: string[] }).lpns),
        [PDF]: pdfBlob,
      }),
    });
    expect(await screen.findByText(L.notice.unmeasuredTitle)).toBeInTheDocument();
    expect(screen.getByText(/MUG-WHT-11 chưa khai báo/)).toBeInTheDocument();
    // Dòng của SKU thiếu quy cách không có nút Dán nhãn
    expect(within(rowOf("LPN000002")).queryByRole("button", { name: L.action.label })).toBeNull();
    await user.click(screen.getByRole("button", { name: new RegExp(L.action.labelAll) }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(LABELS, { lpns: ["LPN000001"] }));
  });

  it("BE từ chối vì thiếu quy cách thùng (422) → câu tiếng Việt nêu SKU", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    renderCartonCheckStation({
      session: startedSession({ cartons: [checkedCarton()] }),
      post: () => ({
        [LABELS]: () => {
          throw new ApiError(
            422,
            "CARTON_SPEC_UNMEASURED",
            "x",
            { sku: "TEE-BLK-M" },
            undefined,
            undefined,
            [{ field: "sku", message: "TEE-BLK-M" }],
          );
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.label }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/TEE-BLK-M chưa khai báo kích thước/),
      ),
    );
  });

  it("In nhãn các thùng đã dán: PDF không chọn thùng; tạo file khi bấm 'Tạo file nhãn'", async () => {
    const user = userEvent.setup();
    const { post } = renderCartonCheckStation({
      session: allLabeledSession(),
      post: () => ({ [PDF]: pdfBlob }),
    });
    await user.click(await screen.findByRole("button", { name: new RegExp(L.action.printAll) }));
    expect(screen.getByText(L.labels.descriptionAll)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: L.labels.generate }));
    expect(await screen.findByTitle(L.labels.preview)).toBeInTheDocument();
    expect(post.mock.calls[0]?.[1]).toBeUndefined();
  });

  it("PDF lỗi (409 CARTON_NOT_CHECKED) → báo trong hộp thoại, không có xem trước", async () => {
    const user = userEvent.setup();
    renderCartonCheckStation({
      session: allLabeledSession(),
      post: () => ({
        [PDF]: () => {
          throw new ApiError(409, "CARTON_NOT_CHECKED", "x");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: new RegExp(L.action.printAll) }));
    await user.click(screen.getByRole("button", { name: L.labels.generate }));
    expect(await screen.findByText(CARTON_NOT_CHECKED_MESSAGES.print)).toBeInTheDocument();
    expect(screen.queryByTitle(L.labels.preview)).toBeNull();
  });

  it("In lại nhãn: xác nhận → POST label-reprint?fromVersion=<đang dán>, rồi mở PDF; nhãn cũ vô hiệu", async () => {
    const user = userEvent.setup();
    const { post } = renderCartonCheckStation({
      session: allLabeledSession(),
      post: (state) => ({
        [cartonPath("LPN000001", "label-reprint")]: () => {
          state.session = withFirst(state.session, { labelVersion: 2 });
          return state.session;
        },
        [PDF]: pdfBlob,
      }),
    });
    await user.click(
      await within(await waitForRow("LPN000001")).findByRole("button", { name: L.action.reprint }),
    );
    expect(screen.getByText(L.reprint.description(1))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.reprint.submit }));
    expect(await screen.findByTitle(L.labels.preview)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(cartonPath("LPN000001", "label-reprint"), undefined, {
      params: { fromVersion: 1 },
    });
  });
});

describe("CartonCheckStation — loại thùng hư hỏng (docs 08 §4.2 bước 4)", () => {
  it("Loại thùng + ghi chú → POST removal {note}; thùng thành Removed, báo chờ cất vào khu cách ly", async () => {
    const user = userEvent.setup();
    const { post } = renderCartonCheckStation({
      session: startedSession(),
      post: (state) => ({
        [cartonPath("LPN000001", "removal")]: (_params, body) => {
          state.session = withFirst(state.session, {
            status: "REMOVED",
            removalReason: "DAMAGED",
            removalNote: (body as { note?: string }).note,
          });
          return state.session;
        },
      }),
    });
    await user.click(
      await within(await waitForRow("LPN000001")).findByRole("button", { name: L.action.remove }),
    );
    await user.type(screen.getByLabelText(L.remove.note), "Móp góc");
    await user.click(screen.getByRole("button", { name: L.remove.submit }));
    expect(await screen.findByText(L.notice.removedTitle)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(cartonPath("LPN000001", "removal"), { note: "Móp góc" });
    expect(within(rowOf("LPN000001")).getByText("Đã loại")).toBeInTheDocument();
    expect(within(rowOf("LPN000001")).queryByRole("button", { name: L.action.remove })).toBeNull();
  });

  it("thùng đã vào shipment: BE từ chối (PACKAGE_SHIPPED) → UI không có nút Loại thùng; thùng chưa vào shipment thì có", async () => {
    renderCartonCheckStation({
      session: startedSession({
        cartons: [
          labeledCarton({ shipmentId: "s-1" }),
          labeledCarton({ packageNo: 2, lpn: "LPN000002" }),
        ],
        shipments: [
          {
            shipmentId: "s-1",
            code: "SO-1-S1",
            status: "READY_TO_DISPATCH",
            packageCount: 1,
            partial: true,
          },
        ],
      }),
    });
    await screen.findByText("LPN000001");
    expect(within(rowOf("LPN000001")).queryByRole("button", { name: L.action.remove })).toBeNull();
    expect(
      within(rowOf("LPN000002")).getByRole("button", { name: L.action.remove }),
    ).toBeInTheDocument();
    expect(within(rowOf("LPN000001")).getByText("SO-1-S1")).toBeInTheDocument();
  });
});

describe("CartonCheckStation — hoàn tất (docs 08 §4.4)", () => {
  it("đủ thùng: gửi requestId (nhớ theo task), partial = false; kết quả nêu shipment và cảnh báo thanh toán, hoàn tất vẫn thành công (BR-11)", async () => {
    const user = userEvent.setup();
    const issued = stubUuids();
    const { post } = renderCartonCheckStation({
      session: allLabeledSession(),
      post: (state) => ({
        [COMPLETION]: () => {
          state.session = {
            ...state.session,
            status: "COMPLETED",
            shipments: [
              {
                shipmentId: "s-1",
                code: "SO-20261010-000431-S1",
                status: "READY_TO_DISPATCH",
                packageCount: 2,
                partial: false,
              },
            ],
            cartons: state.session.cartons.map((c) => ({ ...c, shipmentId: "s-1" })),
          };
          return apiTask({
            pickStatus: "PICKED",
            packStatus: "COMPLETED",
            shipmentId: "s-1",
            paymentDue: { amountDueBeforeHandover: 2500000, currency: "VND" },
          });
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    expect(screen.getByRole("radio", { name: new RegExp(L.complete.modeFull) })).toBeChecked();
    await user.click(screen.getByRole("button", { name: L.complete.submitFull }));
    expect(await screen.findByText(L.complete.resultTitle)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(COMPLETION, {
      requestId: issued()[0],
      partial: false,
      note: undefined,
    });
    expect((await screen.findAllByText(/SO-20261010-000431-S1/)).length).toBeGreaterThan(0);
    expect(screen.getByText(L.complete.resultFull, { exact: false })).toBeInTheDocument();
    // Cảnh báo BEFORE_DELIVERY chưa thu: số tiền, không chặn
    expect(screen.getByText(L.notice.paymentTitle)).toBeInTheDocument();
    expect(screen.getByText(/2\.500\.000/)).toBeInTheDocument();
  });

  it("còn thùng chưa dán nhãn → hộp thoại báo rõ và khoá nút hoàn tất (BE PACKING_INCOMPLETE)", async () => {
    const user = userEvent.setup();
    renderCartonCheckStation({
      session: startedSession({
        cartons: [labeledCarton(), checkedCarton({ packageNo: 2, lpn: "LPN000002" })],
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    expect(screen.getByText(L.complete.pendingTitle)).toBeInTheDocument();
    expect(screen.getByText(L.complete.pendingDescription("LPN000002"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.complete.submitPartial })).toBeDisabled();
  });

  it("chưa có thùng nào dán nhãn → báo chưa có gì để giao (BE PACK_NOTHING_TO_SHIP)", async () => {
    const user = userEvent.setup();
    renderCartonCheckStation({ session: startedSession({ cartons: [] }) });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    expect(screen.getByText(L.complete.nothingTitle)).toBeInTheDocument();
  });

  it("thiếu thùng (đã loại): mặc định giao một phần, bắt buộc ghi chú; gửi partial + note", async () => {
    const user = userEvent.setup();
    const base = allLabeledSession();
    const issued = stubUuids();
    const { post } = renderCartonCheckStation({
      session: {
        ...base,
        lines: base.lines.map((line) =>
          line.orderLineId === LINE_A_ID
            ? { ...line, labeledCartons: 0, removedCartons: 1, labeledUnits: 0, missingUnits: 10 }
            : line,
        ),
        cartons: [
          apiCarton({ status: "REMOVED", removalReason: "DAMAGED" }),
          ...base.cartons.slice(1),
        ],
      },
      post: () => ({
        [COMPLETION]: () =>
          apiTask({ pickStatus: "PICKED", packStatus: "IN_PROGRESS", shipmentId: "s-2" }),
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    expect(screen.getByRole("radio", { name: new RegExp(L.complete.modeFull) })).toBeDisabled();
    expect(screen.getByRole("radio", { name: new RegExp(L.complete.modePartial) })).toBeChecked();
    expect(screen.getByText(L.complete.missingLine("TEE-BLK-M", 0, 10))).toBeInTheDocument();
    // Thiếu ghi chú → báo tại ô, chưa gọi BE
    await user.click(screen.getByRole("button", { name: L.complete.submitPartial }));
    expect(await screen.findByText(UI_LABELS.cartonCheck.complete.note)).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Ghi lý do giao một phần");
    expect(post).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(L.complete.note), "Thùng hỏng đã loại");
    await user.click(screen.getByRole("button", { name: L.complete.submitPartial }));
    expect(await screen.findByText(L.complete.resultTitle)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(COMPLETION, {
      requestId: issued()[0],
      partial: true,
      note: "Thùng hỏng đã loại",
    });
    expect(screen.getByText(L.complete.resultPartial, { exact: false })).toBeInTheDocument();
  });

  it("đơn chưa được Sale cho phép giao một phần → BE 409 PACK_PARTIAL_NOT_ALLOWED, hiện câu tiếng Việt trong hộp thoại", async () => {
    const user = userEvent.setup();
    const base = allLabeledSession();
    renderCartonCheckStation({
      session: {
        ...base,
        lines: base.lines.map((line) => ({ ...line, labeledUnits: 0, missingUnits: 10 })),
      },
      post: () => ({
        [COMPLETION]: () => {
          throw new ApiError(409, "PACK_PARTIAL_NOT_ALLOWED", "Order does not allow partial");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    await user.type(screen.getByLabelText(L.complete.note), "Khách đồng ý nhận trước");
    await user.click(screen.getByRole("button", { name: L.complete.submitPartial }));
    expect(
      await screen.findByText(CARTON_CHECK_ERROR_MESSAGES.PACK_PARTIAL_NOT_ALLOWED),
    ).toBeInTheDocument();
  });

  it("BE 409 PACKING_INCOMPLETE khi hoàn tất đủ → câu tiếng Việt, hộp thoại giữ nguyên", async () => {
    const user = userEvent.setup();
    renderCartonCheckStation({
      session: allLabeledSession(),
      post: () => ({
        [COMPLETION]: () => {
          throw new ApiError(409, "PACKING_INCOMPLETE", "Cartons are missing");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    await user.click(screen.getByRole("button", { name: L.complete.submitFull }));
    expect(
      await screen.findByText(CARTON_CHECK_ERROR_MESSAGES.PACKING_INCOMPLETE),
    ).toBeInTheDocument();
  });
});

describe("CartonCheckStation — action-gating theo quyền và người bắt đầu (BR-06)", () => {
  it("người khác bắt đầu phiên: NV kho chỉ xem — không ô quét, không hoàn tất, không dán nhãn / loại thùng", async () => {
    renderCartonCheckStation({
      session: startedSession({
        cartons: [checkedCarton(), apiCarton({ packageNo: 2, lpn: "LPN000002" })],
      }),
      userId: OTHER_STARTER_ID,
    });
    expect(await screen.findByText(L.notice.takenTitle("Hoàng Anh Tuấn"))).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scan.label)).toBeNull();
    expect(screen.queryByRole("button", { name: L.action.complete })).toBeNull();
    expect(screen.queryByRole("button", { name: L.action.label })).toBeNull();
    expect(screen.queryByRole("button", { name: L.action.remove })).toBeNull();
    expect(screen.queryByRole("button", { name: L.action.start })).toBeNull();
  });

  it("quản lý kho (packing:APPROVE) làm thay được: có ô quét + nút hoàn tất, kèm thông báo làm hộ", async () => {
    renderCartonCheckStation({
      identity: IDENTITIES.warehouseManager,
      session: startedSession(),
      userId: OTHER_STARTER_ID,
    });
    expect(await screen.findByLabelText(L.scan.label)).toBeInTheDocument();
    expect(screen.getByText(L.notice.managerTitle("Hoàng Anh Tuấn"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.action.complete })).toBeInTheDocument();
  });

  it("chỉ có quyền xem (packages:READ, không packing:UPDATE): không bắt đầu, không quét; báo chỉ xem", async () => {
    renderCartonCheckStation({
      identity: {
        permissions: ["fulfillment-packages:VIEW_PAGE", "fulfillment-packages:READ"],
      },
      session: apiSession(),
    });
    expect(await screen.findByText(L.notice.viewOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.start })).toBeNull();
    expect(screen.queryByRole("button", { name: L.action.print })).toBeNull();
  });

  it("phiên Completed: không còn thao tác kiểm; vẫn in lại / in nhãn thùng đã dán", async () => {
    renderCartonCheckStation({
      session: {
        ...allLabeledSession(),
        status: "COMPLETED",
        completedAt: "2026-10-10T05:00:00Z",
      },
    });
    expect(await screen.findByText(L.notice.readOnlyDone)).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scan.label)).toBeNull();
    expect(screen.queryByRole("button", { name: L.action.complete })).toBeNull();
    const row = rowOf("LPN000001");
    expect(within(row).getByRole("button", { name: L.action.reprint })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: L.action.remove })).toBeNull();
  });

  it("phiên Cancelled (đơn huỷ trước thùng đầu): báo đã đóng, thùng Removed không có thao tác", async () => {
    renderCartonCheckStation({
      session: startedSession({
        status: "CANCELLED",
        cartons: [apiCarton({ status: "REMOVED", removalReason: "ORDER_CANCELLED" })],
      }),
    });
    expect(await screen.findByText(L.notice.cancelled)).toBeInTheDocument();
    expect(within(rowOf("LPN000001")).getByText("Đã loại")).toBeInTheDocument();
    expect(within(rowOf("LPN000001")).queryByRole("button")).toBeNull();
  });

  it("còn đợt BEFORE_DELIVERY chưa thu: phiên nêu số tiền cần thu trước bàn giao — chỉ cảnh báo, vẫn thao tác được", async () => {
    renderCartonCheckStation({
      session: startedSession({ paymentDue: { amount: 1500000, currency: "VND" } }),
    });
    expect(await screen.findByText(L.notice.paymentTitle)).toBeInTheDocument();
    expect(screen.getByText(/1\.500\.000/)).toBeInTheDocument();
    expect(screen.getByLabelText(L.scan.label)).toBeInTheDocument();
  });

  it("điều phối đơn không có packages:VIEW_PAGE → bị chặn ở cổng route", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderCartonCheckStation({ identity: IDENTITIES.orderCoordinator });
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
  });
});

/** Chờ thùng hiện trong bảng (phiên tải xong) rồi trả hàng của nó. */
async function waitForRow(lpn: string): Promise<HTMLElement> {
  await screen.findByText(lpn);
  return rowOf(lpn);
}
