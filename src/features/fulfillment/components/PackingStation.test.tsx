import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FULFILLMENT_ERROR_MESSAGES, PACKING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
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
  apiTask,
  apiTaskLines,
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

/** Tab giả của `window.open` — đủ các thứ `ArtifactButtons` chạm tới. */
function fakeTab() {
  const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
  // jsdom không cho dựng `Window` thật; chỉ cần đúng ba thuộc tính trên
  return tab as typeof tab & Window;
}

interface Scenario {
  identity: TestIdentity;
  task: FulfillmentTaskApiDto;
  /** Phiên đóng gói (mặc định: IN_PROGRESS bởi người được gán, có một dòng thường + một dòng in). */
  session?: PackingSessionDto;
  userId?: string;
  /** Đơn trả về cho `GET /orders/{id}` khi có sales-orders:READ (mặc định `fulfillmentOrder`). */
  order?: object;
}

const withPrintLine = (overrides: Partial<PackingSessionDto> = {}) =>
  apiSession({ lines: [packLine(), printLine()], ...overrides });

function renderStation({
  identity,
  task: initial,
  session: initialSession,
  userId,
  order,
}: Scenario) {
  const task = initial;
  const session = initialSession ?? withPrintLine();
  const spies = mockFulfillmentApi(
    identity,
    {
      // GET /tasks/{id} kèm `lines` (SCRUM-466) — dòng thiết kế đọc từ đây, không từ đơn
      [PATH]: () => ({ lines: apiTaskLines, ...task }),
      [`${PATH}/packing-session`]: () => session,
      // Chỉ người có sales-orders:READ mới gọi — trạm đọc cờ `printLinesReady` của đơn (BE PR #150)
      [`/orders/${ORDER_ID}`]: () => order ?? fulfillmentOrder,
      [PREVIEW_PATH]: () => artifact("CUSTOMER_PREVIEW", "image/png"),
      [PRINT_PATH]: () => artifact("PRINT_READY", "application/pdf"),
    },
    {},
  );
  renderFulfillmentScreen(<PackingStation id={TASK_ID} />, userId ?? PICKER_ID);
  return spies;
}

describe("PackingStation — thiết kế đã khoá bên cạnh dòng tuỳ chỉnh", () => {
  it("NV kho chưa đối chiếu → vẫn thấy dòng thiết kế từ task, checksum '—', ảnh xem trước từ URL ký", async () => {
    const { get } = renderStation({ identity: IDENTITIES.warehouseStaff, task: pickedTask() });

    const card = (await screen.findByRole("heading", { name: "TEE-CUSTOM-L" })).closest("article");
    expect(card).not.toBeNull();
    const inCard = within(card as HTMLElement);
    // TaskLine BE không có checksum đã khoá — chỉ biết sau lần đối chiếu đầu
    expect(inCard.getByText("—")).toBeInTheDocument();
    expect(inCard.getByText("Chưa đối chiếu")).toBeInTheDocument();
    expect(
      await inCard.findByRole("img", { name: /Thiết kế đã khoá của TEE-CUSTOM-L/ }),
    ).toHaveAttribute("src", "https://files.example/CUSTOMER_PREVIEW?sig=1");
    // Dòng hàng thường không có card thiết kế
    expect(screen.queryByRole("heading", { name: "TEE-BLK-M" })).toBeNull();
    expect(get.mock.calls.some(([url]) => url === PREVIEW_PATH)).toBe(true);
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/orders"))).toBe(false);
  });

  it("tải file in: mở tab ngay trong cú bấm, gán URL ký sau khi API trả về", async () => {
    const user = userEvent.setup();
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockReturnValue(tab);
    const { get } = renderStation({ identity: IDENTITIES.warehouseStaff, task: pickedTask() });

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
    mockFulfillmentApi(IDENTITIES.warehouseStaff, {
      [PATH]: () => ({ ...pickedTask(), lines: apiTaskLines }),
      [`${PATH}/packing-session`]: () => withPrintLine(),
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
    const { get } = renderStation({ identity: IDENTITIES.warehouseStaff, task: pickedTask() });

    await user.click(await screen.findByRole("button", { name: "File in" }));
    expect(error).toHaveBeenCalledWith(FULFILLMENT_ERROR_MESSAGES.popupBlocked);
    expect(get.mock.calls.some(([url]) => url === PRINT_PATH)).toBe(false);
  });

  it("đơn đã rời khâu xuất kho (409 PICK_TASK_STATE_CONFLICT) → đóng tab, báo đơn đã đóng, không báo lệch checksum", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab);
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    const refuse = () => {
      throw new ApiError(
        409,
        "PICK_TASK_STATE_CONFLICT",
        "The order is SHIPPED; this fulfillment task is closed",
      );
    };
    mockFulfillmentApi(IDENTITIES.warehouseStaff, {
      [PATH]: () => ({
        ...pickedTask({ packStatus: "COMPLETED", packedAt: "2026-10-10T03:00:00Z" }),
        lines: apiTaskLines,
      }),
      [`${PATH}/packing-session`]: () => withPrintLine({ packStatus: "COMPLETED" }),
      [PREVIEW_PATH]: refuse,
      [PRINT_PATH]: refuse,
    });
    renderFulfillmentScreen(<PackingStation id={TASK_ID} />);

    // Khung xem trước cũng báo đơn đã rời khâu xuất kho
    expect(
      await screen.findByText(FULFILLMENT_ERROR_MESSAGES.artifactOrderClosed),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "File in" }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(error).toHaveBeenCalledWith(FULFILLMENT_ERROR_MESSAGES.artifactOrderClosed);
    expect(screen.queryByText(FULFILLMENT_ERROR_MESSAGES.artifactMismatch)).toBeNull();
  });

  it("BE từ chối cấp file (409 CONFLICT) → báo đúng là lệch checksum", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFulfillmentApi(IDENTITIES.warehouseStaff, {
      [PATH]: () => ({ ...pickedTask(), lines: apiTaskLines }),
      [`${PATH}/packing-session`]: () => withPrintLine(),
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
    mockFulfillmentApi(IDENTITIES.warehouseStaff, {
      [PATH]: () => ({ ...pickedTask(), lines: apiTaskLines }),
      [`${PATH}/packing-session`]: () => withPrintLine(),
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

  it("NV kho theo seed BE (thiếu sales-orders:READ) → dòng thiết kế lấy từ task, không gọi /orders", async () => {
    const { get } = renderStation({ identity: IDENTITIES.warehouseStaff, task: pickedTask() });
    expect(await screen.findByRole("heading", { name: "TEE-CUSTOM-L" })).toBeInTheDocument();
    expect(screen.queryByText(/Chưa đủ quyền xem dòng đơn hàng/)).toBeNull();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/orders"))).toBe(false);
    // Vẫn hoàn tất đóng gói được — BE tự đối chiếu
    expect(
      screen.getByRole("button", { name: UI_LABELS.packing.action.complete }),
    ).toBeInTheDocument();
  });

  it("đã có evidence → hiện checksum đã khoá của lần đối chiếu mới nhất, vẫn tải được artifact", async () => {
    renderStation({
      identity: IDENTITIES.warehouseStaff,
      task: pickedTask({ integrityEvidence: [mismatchEvidence()] }),
      session: withPrintLine(),
    });
    const card = (await screen.findByRole("heading", { name: "TEE-CUSTOM-L" })).closest("article");
    expect(within(card as HTMLElement).getByText("aaaaaaaaaaaa…")).toBeInTheDocument();
    expect(
      await screen.findByRole("img", { name: /Thiết kế đã khoá của TEE-CUSTOM-L/ }),
    ).toBeInTheDocument();
  });

  it("người đóng không phải người lấy hàng: pick đã xong → vẫn xem / tải được file thiết kế (BE #136)", async () => {
    renderStation({
      identity: IDENTITIES.warehouseStaff,
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

describe("PackingStation — hàng in chưa về bàn đóng gói (printLinesReady = false, BE PR #150)", () => {
  const waitingSession = () =>
    withPrintLine({ lines: [packLine(), printLine({ available: 0, remaining: 2 })] });

  it("đơn báo printLinesReady=false → thông báo, dòng in hiện 'Chờ in' thay vì cảnh báo thiếu hàng", async () => {
    renderStation({
      identity: IDENTITIES.staffWithOrders,
      task: pickedTask(),
      session: waitingSession(),
      order: { ...fulfillmentOrder, printLinesReady: false },
    });

    expect(await screen.findByText(UI_LABELS.packing.notice.printWaitingTitle)).toBeInTheDocument();
    expect(screen.getByText(UI_LABELS.packing.lines.printWaiting)).toBeInTheDocument();
    expect(screen.queryByText(/Mới có 0\/2 về bàn đóng gói/)).toBeNull();
  });

  it("đơn báo printLinesReady=true → không có thông báo, dòng in hiện số đã về bàn", async () => {
    renderStation({
      identity: IDENTITIES.staffWithOrders,
      task: pickedTask(),
      session: withPrintLine(),
      order: { ...fulfillmentOrder, printLinesReady: true },
    });

    await screen.findByRole("heading", { name: "TEE-CUSTOM-L" });
    expect(screen.queryByText(UI_LABELS.packing.notice.printWaitingTitle)).toBeNull();
    expect(screen.queryByText(UI_LABELS.packing.lines.printWaiting)).toBeNull();
  });

  it("không đọc được đơn (thiếu sales-orders:READ) → suy từ phiên: dòng in 'đã về bàn' = 0", async () => {
    renderStation({
      identity: IDENTITIES.warehouseStaff,
      task: pickedTask(),
      session: waitingSession(),
    });

    expect(await screen.findByText(UI_LABELS.packing.notice.printWaitingTitle)).toBeInTheDocument();
  });
});

describe("PackingStation — quyền thao tác", () => {
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
    renderStation({ identity: IDENTITIES.qcStaff, task: pickedTask(), userId: "qc-id" });
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
  });
});
