import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FULFILLMENT_ERROR_MESSAGES, FULFILLMENT_FIELD_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { IDENTITIES, mockFulfillmentApi, renderFulfillmentScreen } from "../__fixtures__/render";
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
  userId?: string;
  /** Kết quả lần lượt của các lần đóng gói / kiểm tra lại. */
  packResults?: FulfillmentTaskApiDto[];
  reverifyResults?: FulfillmentTaskApiDto[];
}

function renderStation({
  identity,
  task: initial,
  userId,
  packResults,
  reverifyResults,
}: Scenario) {
  let task = initial;
  const next = (queue: FulfillmentTaskApiDto[] | undefined) => {
    const result = queue?.shift();
    if (!result) throw new Error("không còn kết quả giả lập");
    return (task = result);
  };
  const spies = mockFulfillmentApi(
    identity,
    {
      [PATH]: () => task,
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
      [PREVIEW_PATH]: () => artifact("CUSTOMER_PREVIEW", "image/png"),
      [PRINT_PATH]: () => artifact("PRINT_READY", "application/pdf"),
    },
    {
      [`${PATH}/packing-completion`]: () => next(packResults),
      [`${PATH}/design-integrity-reverification`]: () => next(reverifyResults),
    },
  );
  renderFulfillmentScreen(<PackingStation id={TASK_ID} />, userId ?? PICKER_ID);
  return spies;
}

async function confirmPacking(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: action.completePacking }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", { name: action.completePacking }),
  );
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
    // Vẫn xác nhận đóng gói được — BE tự đối chiếu
    expect(screen.getByRole("button", { name: action.completePacking })).toBeInTheDocument();
  });

  it("thiếu sales-orders:READ nhưng đã có evidence → suy dòng từ evidence, vẫn tải được artifact", async () => {
    renderStation({ identity: IDENTITIES.warehouseStaff, task: heldTask() });
    expect(await screen.findByRole("heading", { name: "Dòng 1" })).toBeInTheDocument();
    expect(
      await screen.findByRole("img", { name: /Thiết kế đã khoá của Dòng 1/ }),
    ).toBeInTheDocument();
  });

  it("điều phối đơn không có quyền tải artifact → không gọi download-url", async () => {
    // Cổng route cần packages:VIEW_PAGE — cấp thêm để vào tới màn, vẫn thiếu packages:READ
    const identity = {
      roles: IDENTITIES.orderCoordinator.roles,
      permissions: [
        ...IDENTITIES.orderCoordinator.permissions,
        "fulfillment-packages:VIEW_PAGE" as const,
      ],
    };
    const { get } = renderStation({ identity, task: pickedTask(), userId: "coordinator-id" });
    expect(await screen.findByText(/không có quyền xem file thiết kế/)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).includes("design-artifacts"))).toBe(false);
    expect(screen.queryByRole("button", { name: "File in" })).toBeNull();
  });
});

describe("PackingStation — xác nhận đóng gói và flow X-CHK", () => {
  it("đóng gói khớp checksum → POST không body, sang Packed, hết thao tác", async () => {
    const user = userEvent.setup();
    const { post } = renderStation({
      identity: IDENTITIES.staffWithOrders,
      task: pickedTask(),
      packResults: [
        pickedTask({
          packStatus: "PACKED",
          packedAt: "2026-10-10T03:00:00Z",
          integrityEvidence: [apiEvidence()],
        }),
      ],
    });
    await confirmPacking(user);
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/packing-completion`, undefined));
    expect(await screen.findByText(/Đã đóng gói — không còn thao tác/)).toBeInTheDocument();
    expect(screen.queryByText(fulfillment.holdTitle)).toBeNull();
    expect(screen.queryByRole("button", { name: action.completePacking })).toBeNull();
  });

  it("đóng gói lệch checksum (BE trả 200 + ON_HOLD) → cảnh báo giữ kiện + evidence lệch, NV kho không gỡ được", async () => {
    const user = userEvent.setup();
    renderStation({
      identity: IDENTITIES.staffWithOrders,
      task: pickedTask(),
      packResults: [heldTask()],
    });
    await confirmPacking(user);

    expect(await screen.findByText(fulfillment.holdTitle)).toBeInTheDocument();
    const history = screen.getByRole("table", { name: "Lịch sử đối chiếu checksum thiết kế" });
    expect(within(history).getByText("Lệch checksum")).toBeInTheDocument();
    expect(within(history).getByText("bbbbbbbbbbbb…")).toBeInTheDocument();
    // Không có nút bỏ qua; NV kho không kiểm tra lại, không đóng gói lại
    expect(screen.queryByRole("button", { name: action.reverify })).toBeNull();
    expect(screen.queryByRole("button", { name: action.completePacking })).toBeNull();
    expect(screen.getByText(/Chờ QC hoặc quản lý kho kiểm tra lại/)).toBeInTheDocument();
  });

  it("quản lý kho kiểm tra lại: bắt buộc ghi chú; vẫn lệch thì giữ dialog; khớp thì gỡ giữ", async () => {
    const user = userEvent.setup();
    const { post } = renderStation({
      identity: IDENTITIES.warehouseManager,
      task: heldTask({ assignedUserId: OTHER_PICKER_ID }),
      reverifyResults: [
        heldTask({
          assignedUserId: OTHER_PICKER_ID,
          integrityEvidence: [mismatchEvidence("2026-10-10T04:00:00Z"), mismatchEvidence()],
        }),
        pickedTask({
          assignedUserId: OTHER_PICKER_ID,
          packStatus: "PACKED",
          packedAt: "2026-10-10T05:00:00Z",
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
  });

  it("chưa lấy hàng xong → không có nút đóng gói, giải thích lý do", async () => {
    renderStation({
      identity: IDENTITIES.warehouseStaff,
      task: apiTask({ pickStatus: "PICKING" }),
    });
    expect(await screen.findByText(fulfillment.noActions.waitingPick)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.completePacking })).toBeNull();
  });

  it("quản lý kho không được gán → không đóng gói hộ", async () => {
    renderStation({
      identity: IDENTITIES.warehouseManager,
      task: pickedTask({ assignedUserId: OTHER_PICKER_ID }),
    });
    expect(await screen.findByText(fulfillment.noActions.notAssignee)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.completePacking })).toBeNull();
  });

  it("QC theo seed BE không có packages:VIEW_PAGE → bị chặn ở cổng route (gap BE)", async () => {
    renderStation({ identity: IDENTITIES.qcStaff, task: heldTask(), userId: "qc-id" });
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.reverify })).toBeNull();
  });
});
