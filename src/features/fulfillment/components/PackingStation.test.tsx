import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FULFILLMENT_ERROR_MESSAGES,
  FULFILLMENT_FIELD_MESSAGES,
  PACKING_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { IDENTITIES, mockFulfillmentApi, renderFulfillmentScreen } from "../__fixtures__/render";
import {
  OTHER_PACKER_ID,
  apiSession,
  packLine,
  pendingSession,
  printLine,
} from "../__fixtures__/packing";
import {
  DESIGN_LINE_ID,
  ORDER_ID,
  OTHER_PICKER_ID,
  PICKER_ID,
  TASK_ID,
  apiEvidence,
  apiTask,
  fulfillmentOrder,
  mismatchEvidence,
  pickedTask,
} from "../__fixtures__/task";
import { PackingStation } from "./PackingStation";

import type { TestIdentity } from "../__fixtures__/render";
import type { PackingSessionDto } from "../packing-types";
import type { FulfillmentTaskApiDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const { fulfillment } = UI_LABELS;
const { action } = fulfillment;
const PATH = `/fulfillment/tasks/${TASK_ID}`;
const PREVIEW_PATH = `${PATH}/lines/${DESIGN_LINE_ID}/design-artifacts/CUSTOMER_PREVIEW/download-url`;
const PRINT_PATH = `${PATH}/lines/${DESIGN_LINE_ID}/design-artifacts/PRINT_READY/download-url`;

const artifact = (role: string, contentType: string) => ({
  artifactId: `art-${role}`,
  role,
  originalName: `design.${role}`,
  contentType,
  sizeBytes: 2048,
  checksum: "a".repeat(64),
  url: `https://files.example/${role}?sig=1`,
  expiresAt: "2026-10-10T03:05:00Z",
});

const EMPTY_PAGE = {
  items: [],
  page: 0,
  size: 200,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

/** Tab giả của `window.open` — đủ các thứ `ArtifactButtons` chạm tới. */
function fakeTab() {
  const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
  // jsdom không cho dựng `Window` thật; chỉ cần đúng ba thuộc tính trên
  return tab as typeof tab & Window;
}

const heldTask = (overrides: Partial<FulfillmentTaskApiDto> = {}) =>
  pickedTask({ packStatus: "ON_HOLD", integrityEvidence: [mismatchEvidence()], ...overrides });

interface Scenario {
  identity: TestIdentity;
  task: FulfillmentTaskApiDto;
  /** Phiên đóng gói (mặc định: PACKING bởi người được gán, có một dòng thường + một dòng in). */
  session?: PackingSessionDto;
  userId?: string;
  /** Kết quả lần lượt của các lần kiểm tra lại. */
  reverifyResults?: FulfillmentTaskApiDto[];
}

const withPrintLine = (overrides: Partial<PackingSessionDto> = {}) =>
  apiSession({ lines: [packLine(), printLine()], ...overrides });

function renderStation({
  identity,
  task: initial,
  session: initialSession,
  userId,
  reverifyResults,
}: Scenario) {
  let task = initial;
  let session = initialSession ?? withPrintLine();
  const next = (queue: FulfillmentTaskApiDto[] | undefined) => {
    const result = queue?.shift();
    if (!result) throw new Error("không còn kết quả giả lập");
    task = result;
    // BE PR #136: kiểm tra lại khớp → phiên đóng gói về PACKING
    if (result.packStatus === "PACKING") session = { ...session, packStatus: "PACKING" };
    return result;
  };
  const spies = mockFulfillmentApi(
    identity,
    {
      [PATH]: () => task,
      [`${PATH}/packing-session`]: () => session,
      [`/orders/${ORDER_ID}`]: () => fulfillmentOrder,
      "/orders": () => EMPTY_PAGE,
      [PREVIEW_PATH]: () => artifact("CUSTOMER_PREVIEW", "image/png"),
      [PRINT_PATH]: () => artifact("PRINT_READY", "application/pdf"),
    },
    {
      [`${PATH}/design-integrity-reverification`]: () => next(reverifyResults),
    },
  );
  renderFulfillmentScreen(<PackingStation id={TASK_ID} />, userId ?? PICKER_ID);
  return spies;
}

describe("PackingStation — thiết kế đã khoá bên cạnh dòng tuỳ chỉnh", () => {
  it("chỉ dòng tuỳ chỉnh có card: SKU, SL, checksum đã khoá, ảnh xem trước từ URL ký", async () => {
    const { get } = renderStation({ identity: IDENTITIES.staffWithOrders, task: pickedTask() });

    const card = (await screen.findByRole("heading", { name: "TEE-CUSTOM-L" })).closest("article");
    expect(card).not.toBeNull();
    const inCard = within(card as HTMLElement);
    expect(inCard.getByText("aaaaaaaaaaaa…")).toBeInTheDocument();
    expect(inCard.getByText("Chưa đối chiếu")).toBeInTheDocument();
    expect(
      await inCard.findByRole("img", { name: /Thiết kế đã khoá của TEE-CUSTOM-L/ }),
    ).toHaveAttribute("src", "https://files.example/CUSTOMER_PREVIEW?sig=1");
    // Dòng hàng thường không có card thiết kế
    expect(screen.queryByRole("heading", { name: "TEE-BLK-M" })).toBeNull();
    expect(get.mock.calls.some(([url]) => url === PREVIEW_PATH)).toBe(true);
  });

  it("tải file in: mở tab ngay trong cú bấm, gán URL ký sau khi API trả về", async () => {
    const user = userEvent.setup();
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockReturnValue(tab);
    const { get } = renderStation({ identity: IDENTITIES.staffWithOrders, task: pickedTask() });

    await user.click(await screen.findByRole("button", { name: "File in" }));
    // Tab mở trước khi có URL — không bị trình duyệt coi là popup
    expect(open).toHaveBeenCalledWith("", "_blank");
    await waitFor(() => expect(tab.location.href).toBe("https://files.example/PRINT_READY?sig=1"));
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
    expect(get.mock.calls.some(([url]) => url === PRINT_PATH)).toBe(true);
  });

  it("BE trả URL javascript: → không gán vào tab, đóng tab và báo lỗi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab);
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    mockFulfillmentApi(IDENTITIES.staffWithOrders, {
      [PATH]: () => pickedTask(),
      [`${PATH}/packing-session`]: () => withPrintLine(),
      [`/orders/${ORDER_ID}`]: () => fulfillmentOrder,
      "/orders": () => EMPTY_PAGE,
      [PREVIEW_PATH]: () => artifact("CUSTOMER_PREVIEW", "image/png"),
      [PRINT_PATH]: () => ({
        ...artifact("PRINT_READY", "application/pdf"),
        url: "javascript:alert(1)",
      }),
    });
    renderFulfillmentScreen(<PackingStation id={TASK_ID} />);

    await user.click(await screen.findByRole("button", { name: "File in" }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(tab.location.href).toBe("");
    expect(error).toHaveBeenCalled();
  });

  it("trình duyệt chặn tab mới → báo người dùng, không gọi API", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockReturnValue(null);
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    const { get } = renderStation({ identity: IDENTITIES.staffWithOrders, task: pickedTask() });

    await user.click(await screen.findByRole("button", { name: "File in" }));
    expect(error).toHaveBeenCalledWith(FULFILLMENT_ERROR_MESSAGES.popupBlocked);
    expect(get.mock.calls.some(([url]) => url === PRINT_PATH)).toBe(false);
  });

  it("BE từ chối cấp file (409), task chưa bị giữ → đóng tab, không báo sai là lệch checksum", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab);
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    const refuse = () => {
      throw new ApiError(409, "CONFLICT", "The order is SHIPPED; this fulfillment task is closed");
    };
    mockFulfillmentApi(IDENTITIES.staffWithOrders, {
      [PATH]: () => pickedTask({ packStatus: "PACKED", packedAt: "2026-10-10T03:00:00Z" }),
      [`${PATH}/packing-session`]: () => withPrintLine({ packStatus: "PACKED" }),
      [`/orders/${ORDER_ID}`]: () => fulfillmentOrder,
      "/orders": () => EMPTY_PAGE,
      [PREVIEW_PATH]: refuse,
      [PRINT_PATH]: refuse,
    });
    renderFulfillmentScreen(<PackingStation id={TASK_ID} />);

    // Khung xem trước cũng dùng câu trung tính
    expect(
      await screen.findByText(FULFILLMENT_ERROR_MESSAGES.artifactUnavailable),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "File in" }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(error).toHaveBeenCalledWith(FULFILLMENT_ERROR_MESSAGES.artifactUnavailable);
    expect(screen.queryByText(FULFILLMENT_ERROR_MESSAGES.artifactMismatch)).toBeNull();
  });

  it("task đang bị giữ, BE từ chối cấp file (409) → báo đúng là lệch checksum", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFulfillmentApi(IDENTITIES.staffWithOrders, {
      [PATH]: () => heldTask(),
      [`${PATH}/packing-session`]: () => withPrintLine({ packStatus: "ON_HOLD" }),
      [`/orders/${ORDER_ID}`]: () => fulfillmentOrder,
      "/orders": () => EMPTY_PAGE,
      [PREVIEW_PATH]: () => {
        throw new ApiError(409, "CONFLICT", "Design integrity verification failed");
      },
    });
    renderFulfillmentScreen(<PackingStation id={TASK_ID} />);
    expect(
      await screen.findByText(FULFILLMENT_ERROR_MESSAGES.artifactMismatch),
    ).toBeInTheDocument();
  });

  it("bundle không có file xem trước (404) → báo trong khung ảnh, vẫn tải được file khác", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFulfillmentApi(IDENTITIES.staffWithOrders, {
      [PATH]: () => pickedTask(),
      [`${PATH}/packing-session`]: () => withPrintLine(),
      [`/orders/${ORDER_ID}`]: () => fulfillmentOrder,
      "/orders": () => ({
        items: [],
        page: 0,
        size: 200,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      }),
      [PREVIEW_PATH]: () => {
        throw new ApiError(
          404,
          "NOT_FOUND",
          "The confirmed bundle has no CUSTOMER_PREVIEW artifact",
        );
      },
    });
    renderFulfillmentScreen(<PackingStation id={TASK_ID} />);
    expect(await screen.findByText(FULFILLMENT_ERROR_MESSAGES.artifactMissing)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "File in" })).toBeEnabled();
  });

  it("NV kho theo seed BE (thiếu sales-orders:READ), chưa đối chiếu → báo thiếu quyền xem dòng đơn", async () => {
    const { get } = renderStation({ identity: IDENTITIES.warehouseStaff, task: pickedTask() });
    expect(await screen.findByText(fulfillment.noOrderReadTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/orders"))).toBe(false);
    // Vẫn hoàn tất đóng gói được — BE tự đối chiếu
    expect(
      screen.getByRole("button", { name: UI_LABELS.packing.action.complete }),
    ).toBeInTheDocument();
  });

  it("thiếu sales-orders:READ nhưng đã có evidence → suy dòng từ evidence, vẫn tải được artifact", async () => {
    renderStation({
      identity: IDENTITIES.warehouseStaff,
      task: heldTask(),
      session: withPrintLine({ packStatus: "ON_HOLD" }),
    });
    expect(await screen.findByRole("heading", { name: "Dòng 1" })).toBeInTheDocument();
    expect(
      await screen.findByRole("img", { name: /Thiết kế đã khoá của Dòng 1/ }),
    ).toBeInTheDocument();
  });

  it("người đóng không phải người lấy hàng: pick đã xong → vẫn xem / tải được file thiết kế (BE #136)", async () => {
    renderStation({
      identity: IDENTITIES.staffWithOrders,
      task: pickedTask({ assignedUserId: OTHER_PICKER_ID }),
    });
    expect(await screen.findByRole("button", { name: "File in" })).toBeInTheDocument();
    expect(screen.queryByText(/không có quyền xem file thiết kế/)).toBeNull();
  });

  it("thiếu fulfillment-packages:READ (điều phối đơn) → không gọi API phiên, báo không có quyền xem", async () => {
    // Cổng route cần packages:VIEW_PAGE — cấp thêm để vào tới màn, vẫn thiếu packages:READ
    const identity = {
      permissions: [
        ...IDENTITIES.orderCoordinator.permissions,
        "fulfillment-packages:VIEW_PAGE" as const,
      ],
    };
    const { get } = renderStation({ identity, task: pickedTask(), userId: "coordinator-id" });
    expect(await screen.findByText(UI_LABELS.loadError.noReadTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).includes("packing-session"))).toBe(false);
  });
});

describe("PackingStation — kiểm tra lại thiết kế (flow X-CHK) và quyền thao tác", () => {
  const heldSession = () => withPrintLine({ packStatus: "ON_HOLD" });

  it("phiên bị giữ (BE 200 + ON_HOLD) → cảnh báo + evidence lệch; người có design-reverification:UPDATE (QC) có nút kiểm tra lại nhưng không hoàn tất / quét", async () => {
    renderStation({
      // QC theo seed không có packages:VIEW_PAGE — cấp thêm để vào tới màn
      identity: {
        permissions: [...IDENTITIES.qcStaff.permissions, "fulfillment-packages:VIEW_PAGE" as const],
      },
      task: heldTask(),
      session: heldSession(),
    });

    expect(await screen.findByText(fulfillment.holdTitle)).toBeInTheDocument();
    const history = screen.getByRole("table", { name: "Lịch sử đối chiếu checksum thiết kế" });
    expect(within(history).getByText("Lệch checksum")).toBeInTheDocument();
    expect(within(history).getByText("bbbbbbbbbbbb…")).toBeInTheDocument();
    // Không có nút bỏ qua; kiểm tra lại cần fulfillment-design-reverification:UPDATE (docs 08)
    expect(screen.getByRole("button", { name: action.reverify })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI_LABELS.packing.action.complete })).toBeNull();
    expect(screen.queryByLabelText(UI_LABELS.packing.scan.label)).toBeNull();
  });

  it("người đóng gói (chỉ fulfillment-packing:*) thấy phiên bị giữ nhưng không có nút kiểm tra lại", async () => {
    renderStation({
      identity: IDENTITIES.staffWithOrders,
      task: heldTask(),
      session: heldSession(),
    });

    expect(await screen.findByText(fulfillment.holdTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.reverify })).toBeNull();
  });

  it("quản lý kho kiểm tra lại: bắt buộc ghi chú; vẫn lệch thì giữ dialog; khớp thì phiên về Packing, KHÔNG sang Packed", async () => {
    const user = userEvent.setup();
    const { post } = renderStation({
      identity: IDENTITIES.warehouseManager,
      task: heldTask({ assignedUserId: OTHER_PICKER_ID }),
      session: heldSession(),
      reverifyResults: [
        heldTask({
          assignedUserId: OTHER_PICKER_ID,
          integrityEvidence: [mismatchEvidence("2026-10-10T04:00:00Z"), mismatchEvidence()],
        }),
        pickedTask({
          assignedUserId: OTHER_PICKER_ID,
          packStatus: "PACKING",
          integrityEvidence: [
            apiEvidence({ verifiedAt: "2026-10-10T05:00:00Z" }),
            mismatchEvidence(),
          ],
        }),
      ],
    });

    await user.click(await screen.findByRole("button", { name: action.reverify }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: action.reverify });
    await user.click(submit);
    expect(
      within(dialog).getByText(FULFILLMENT_FIELD_MESSAGES.resolutionNoteRequired),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Cách đã xử lý"), "đã khôi phục file in");
    await user.click(submit);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/design-integrity-reverification`, {
        resolutionNote: "đã khôi phục file in",
      }),
    );
    // Lần 1 vẫn lệch → dialog còn mở, báo vẫn bị giữ
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(fulfillment.stillOnHold);

    await user.click(submit);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(post).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByText(fulfillment.holdTitle)).toBeNull());
    // Phiên về "Đang đóng gói": người đóng hoàn tất lại (quản lý kho thao tác được trong phiên)
    expect(await screen.findAllByText("Đang đóng gói")).not.toHaveLength(0);
    expect(screen.queryByText("Đã đóng gói")).toBeNull();
    expect(
      screen.getByRole("button", { name: UI_LABELS.packing.action.complete }),
    ).toBeInTheDocument();
  });

  it("lấy hàng chưa xong (theo task) → ẩn nút Bắt đầu đóng gói, nói lý do", async () => {
    const { post } = renderStation({
      identity: IDENTITIES.warehouseStaff,
      task: apiTask({ pickStatus: "PICKING" }),
      session: pendingSession(),
    });
    expect(await screen.findByText(UI_LABELS.packing.notice.waitingPick)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI_LABELS.packing.action.start })).toBeNull();
    expect(screen.queryByText(UI_LABELS.packing.notice.pendingStart)).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("không đọc được task → vẫn có nút Bắt đầu; BE từ chối PACKING_NOT_READY thì báo bằng tiếng Việt", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    mockFulfillmentApi(
      IDENTITIES.warehouseStaff,
      {
        [PATH]: () => {
          throw new ApiError(404, "NOT_FOUND", "Resource not found");
        },
        [`${PATH}/packing-session`]: () => pendingSession(),
      },
      {
        [`${PATH}/packing-start`]: () => {
          throw new ApiError(409, "PACKING_NOT_READY", "Picking is PICKING");
        },
      },
    );
    renderFulfillmentScreen(<PackingStation id={TASK_ID} />);
    await user.click(await screen.findByRole("button", { name: UI_LABELS.packing.action.start }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(PACKING_ERROR_MESSAGES.PACKING_NOT_READY),
    );
  });

  it("người khác đã nhận đơn → NV kho chỉ xem, câu báo nêu tên người đang đóng", async () => {
    renderStation({
      identity: IDENTITIES.warehouseStaff,
      task: pickedTask(),
      session: apiSession({ packerId: OTHER_PACKER_ID, packerName: "Nguyễn Văn Đạt" }),
    });
    expect(
      await screen.findByText(UI_LABELS.packing.notice.takenTitle("Nguyễn Văn Đạt")),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI_LABELS.packing.action.complete })).toBeNull();
    expect(screen.queryByRole("button", { name: UI_LABELS.packing.action.openPackage })).toBeNull();
    expect(screen.queryByLabelText(UI_LABELS.packing.scan.label)).toBeNull();
  });

  it("quản lý kho vẫn thao tác được khi người khác đã nhận đơn (BE không bắn PACKING_TAKEN cho quản lý)", async () => {
    renderStation({
      identity: IDENTITIES.warehouseManager,
      task: pickedTask(),
      session: apiSession({ packerId: OTHER_PACKER_ID, packerName: "Nguyễn Văn Đạt" }),
    });
    expect(
      await screen.findByText(UI_LABELS.packing.notice.managerTitle("Nguyễn Văn Đạt")),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: UI_LABELS.packing.action.complete }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: UI_LABELS.packing.action.openPackage }),
    ).toBeInTheDocument();
  });

  it("QC theo seed BE không có packages:VIEW_PAGE → bị chặn ở cổng route (gap BE)", async () => {
    renderStation({ identity: IDENTITIES.qcStaff, task: heldTask(), userId: "qc-id" });
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.reverify })).toBeNull();
  });
});
