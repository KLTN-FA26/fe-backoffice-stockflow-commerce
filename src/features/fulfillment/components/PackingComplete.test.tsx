import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PACKING_ERROR_MESSAGES,
  PACKING_FIELD_MESSAGES,
  STORAGE_KEYS,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import {
  PACKAGE_ID,
  PACKING_PATH,
  SECOND_PACKAGE_ID,
  SHIPMENT_ID,
  apiLabel,
  apiSession,
  packLine,
  packPackage,
  packShipment,
  sealedPackage,
  serialLine,
} from "../__fixtures__/packing";
import { renderPackingStation, stubUuids } from "../__fixtures__/packing-render";
import { pickSelectOption } from "../__fixtures__/render";
import { TASK_ID, pickedTask } from "../__fixtures__/task";

import type { PackingSessionDto } from "../packing-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

const P = UI_LABELS.packing;
const PKG = `${PACKING_PATH}/packages/${PACKAGE_ID}`;
const COMPLETION = `${PACKING_PATH}/packing-completion`;
const REQUEST_KEY = STORAGE_KEYS.packingCompletionRequest(TASK_ID);

/** Đã niêm phong 3 áo, đủ số cần → hoàn tất đủ được. */
const fullySealed = (overrides: Partial<PackingSessionDto> = {}) =>
  apiSession({
    lines: [packLine({ packed: 3, remaining: 0 })],
    packages: [sealedPackage()],
    ...overrides,
  });

/** Niêm phong 3 áo nhưng đơn còn một dòng chưa đóng → chỉ giao được một phần. */
const missingLine = (overrides: Partial<PackingSessionDto> = {}) =>
  apiSession({
    lines: [packLine({ packed: 3, remaining: 0 }), serialLine()],
    packages: [sealedPackage()],
    ...overrides,
  });

const doneTask = (overrides: Record<string, unknown> = {}) => ({
  ...pickedTask({ packStatus: "PACKED", packedAt: "2026-10-10T03:40:00Z" }),
  shipmentId: SHIPMENT_ID,
  ...overrides,
});

async function openComplete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: P.action.complete }));
  return screen.findByRole("dialog");
}

describe("niêm phong kiện", () => {
  it("bắt buộc khối lượng + dài × rộng × cao (BR-03): thiếu / sai thì báo từng ô và KHÔNG gọi API", async () => {
    const user = userEvent.setup();
    const { post } = renderPackingStation({
      session: apiSession({
        lines: [packLine({ packed: 3, remaining: 0 })],
        packages: [
          packPackage({
            contents: [{ orderLineId: packLine().orderLineId, sku: "TEE-BLK-M", quantity: 3 }],
          }),
        ],
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.seal }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    expect(within(dialog).getByText(PACKING_FIELD_MESSAGES.weightInvalid)).toBeInTheDocument();
    expect(within(dialog).getAllByText(PACKING_FIELD_MESSAGES.dimensionInvalid)).toHaveLength(3);
    await user.type(within(dialog).getByLabelText(P.seal.weight), "0");
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    expect(within(dialog).getByText(PACKING_FIELD_MESSAGES.weightInvalid)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("POST seal đúng body (dấu phẩy VN, loại kiện, cờ ghi đè); cờ để mặc định thì không gửi", async () => {
    const user = userEvent.setup();
    const { post } = renderPackingStation({
      session: apiSession({
        lines: [packLine({ packed: 3, remaining: 0 })],
        packages: [
          packPackage({
            contents: [{ orderLineId: packLine().orderLineId, sku: "TEE-BLK-M", quantity: 3 }],
          }),
        ],
      }),
      post: (state) => ({
        [`${PKG}/seal`]: () => {
          state.session = fullySealed();
          return sealedPackage();
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.seal }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(P.seal.weight), "1,25");
    await user.type(within(dialog).getByLabelText(P.seal.length), "30");
    await user.type(within(dialog).getByLabelText(P.seal.width), "20");
    await user.type(within(dialog).getByLabelText(P.seal.height), "10");
    await pickSelectOption(user, P.seal.packageType, P.packages.typeOption.BAG);
    await pickSelectOption(user, P.seal.fragile, P.seal.flagYes);
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PKG}/seal`, {
        weightKg: 1.25,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 10,
        packageType: "BAG",
        rotatable: undefined,
        fragile: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Kiện đã niêm phong: hiện số đo, khối lượng quy đổi, trạng thái; không còn nút niêm phong
    expect(await screen.findByText(/1,25 kg/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: P.action.seal })).toBeNull();
  });

  it("BE từ chối PACKAGE_EMPTY / 400: câu tiếng Việt trong dialog, dialog giữ nguyên", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderPackingStation({
      session: apiSession({
        packages: [
          packPackage({
            contents: [{ orderLineId: packLine().orderLineId, sku: "TEE-BLK-M", quantity: 1 }],
          }),
        ],
      }),
      post: () => ({
        [`${PKG}/seal`]: () => {
          throw new ApiError(409, "PACKAGE_EMPTY", "Package 1 has nothing in it");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.seal }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(P.seal.weight), "2");
    await user.type(within(dialog).getByLabelText(P.seal.length), "1");
    await user.type(within(dialog).getByLabelText(P.seal.width), "1");
    await user.type(within(dialog).getByLabelText(P.seal.height), "1");
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      PACKING_ERROR_MESSAGES.PACKAGE_EMPTY,
    );
  });

  it("kiện rỗng: nút niêm phong bị khoá", async () => {
    renderPackingStation({ session: apiSession({ packages: [packPackage()] }) });
    expect(await screen.findByRole("button", { name: P.action.seal })).toBeDisabled();
  });
});

describe("mở lại / huỷ kiện", () => {
  it("mở lại kiện đã niêm phong: xác nhận → POST reopening", async () => {
    const user = userEvent.setup();
    const { post } = renderPackingStation({
      session: fullySealed(),
      post: (state) => ({
        [`${PKG}/reopening`]: () => {
          state.session = apiSession({ packages: [packPackage()] });
          return packPackage();
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.reopen }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: P.action.reopen }),
    );
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PKG}/reopening`));
    expect(await screen.findByRole("button", { name: P.action.seal })).toBeInTheDocument();
  });

  it("huỷ kiện: xác nhận → DELETE kiện; kiện đã vào lô giao không có nút mở lại / huỷ", async () => {
    const user = userEvent.setup();
    const { del } = renderPackingStation({
      session: fullySealed(),
      del: (state) => ({
        [PKG]: () => {
          state.session = apiSession({
            packages: [{ ...sealedPackage(), status: "VOIDED" }],
          });
          return state.session;
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.voidPackage }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: P.action.voidPackage }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith(PKG));
    expect(await screen.findByText(/Kiện đã huỷ: PKG-/)).toBeInTheDocument();
  });

  it("lô giao có currency: hiện số tiền thu hộ theo currency của lô", async () => {
    renderPackingStation({
      session: fullySealed({
        packages: [sealedPackage({ shipmentId: SHIPMENT_ID })],
        shipments: [packShipment({ codAmount: 450000, currency: "VND" })],
      }),
    });
    expect(await screen.findByText(/450\.000/)).toBeInTheDocument();
  });

  it("lô giao chưa có currency (BE cũ): chỉ báo 'có thu hộ', không đoán tiền tệ", async () => {
    renderPackingStation({
      session: fullySealed({
        packages: [sealedPackage({ shipmentId: SHIPMENT_ID })],
        shipments: [packShipment({ codAmount: 450000, currency: undefined })],
      }),
    });
    expect(await screen.findByText(P.shipments.hasCod)).toBeInTheDocument();
  });

  it("kiện đã vào lô giao: chỉ còn xem nhãn", async () => {
    renderPackingStation({
      session: fullySealed({
        packages: [sealedPackage({ shipmentId: SHIPMENT_ID })],
        shipments: [packShipment()],
      }),
    });
    expect(await screen.findByRole("button", { name: P.action.label })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: P.action.reopen })).toBeNull();
    expect(screen.queryByRole("button", { name: P.action.voidPackage })).toBeNull();
    expect(screen.getAllByText("SO-20261010-000431-S1").length).toBeGreaterThan(0);
  });
});

describe("hoàn tất đóng gói", () => {
  it("đóng đủ: POST {requestId, partial:false} với requestId lưu theo task trong sessionStorage; hiện lô giao vừa tạo", async () => {
    const user = userEvent.setup();
    const issued = stubUuids();
    const { post } = renderPackingStation({
      session: fullySealed(),
      post: (state) => ({
        [COMPLETION]: () => {
          state.session = fullySealed({
            packStatus: "PACKED",
            shipments: [packShipment()],
            packages: [sealedPackage({ shipmentId: SHIPMENT_ID })],
          });
          return doneTask();
        },
      }),
    });
    const dialog = await openComplete(user);
    expect(
      within(dialog).getByRole("radio", { name: new RegExp(P.complete.modeFull) }),
    ).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitFull }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(COMPLETION, {
        requestId: expect.any(String),
        partial: false,
        note: undefined,
      }),
    );
    const requestId = (post.mock.calls[0]?.[1] as { requestId: string }).requestId;
    expect(issued()).toContain(requestId);
    // Kết quả: lô giao + số kiện, phiên chuyển Đã đóng gói; id đã bỏ vì lô đã tạo
    expect(await within(dialog).findByText("SO-20261010-000431-S1")).toBeInTheDocument();
    expect(
      within(dialog).getByText(P.complete.resultShippedFull, { exact: false }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(REQUEST_KEY)).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: P.complete.close }));
    expect(await screen.findAllByText("Đã đóng gói")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: P.action.complete })).toBeNull();
  });

  it("còn dòng chưa đóng: chỉ giao một phần; bắt buộc lý do (không gọi API khi trống); POST {partial:true, note}", async () => {
    const user = userEvent.setup();
    const { post } = renderPackingStation({
      session: missingLine(),
      post: (state) => ({
        [COMPLETION]: () => {
          state.session = missingLine({
            shipments: [packShipment({ partial: true, partialNote: "thiếu áo khoác" })],
            packages: [sealedPackage({ shipmentId: SHIPMENT_ID })],
          });
          return doneTask({ packStatus: "PACKING", packedAt: undefined });
        },
      }),
    });
    const dialog = await openComplete(user);
    expect(
      within(dialog).getByRole("radio", { name: new RegExp(P.complete.modeFull) }),
    ).toBeDisabled();
    expect(within(dialog).getByText(/HOODIE-BLK-L: 0\/1/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitPartial }));
    expect(within(dialog).getByText(PACKING_FIELD_MESSAGES.noteRequired)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(P.complete.note), "thiếu áo khoác");
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitPartial }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(COMPLETION, {
        requestId: expect.any(String),
        partial: true,
        note: "thiếu áo khoác",
      }),
    );
    expect(
      await within(dialog).findByText(P.complete.resultShippedPartial, { exact: false }),
    ).toBeInTheDocument();
  });

  it("lỗi mạng khi hoàn tất: id GIỮ trong sessionStorage, bấm lại gửi CÙNG requestId (BE trả lại lô đã tạo)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    let attempts = 0;
    const { post } = renderPackingStation({
      session: fullySealed(),
      post: () => ({
        [COMPLETION]: () => {
          attempts += 1;
          if (attempts === 1) throw new ApiError(0, "NETWORK_ERROR", "Network Error");
          return doneTask();
        },
      }),
    });
    const dialog = await openComplete(user);
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitFull }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const first = (post.mock.calls[0]?.[1] as { requestId: string }).requestId;
    expect(JSON.parse(window.sessionStorage.getItem(REQUEST_KEY) ?? "{}").id).toBe(first);
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitFull }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect((post.mock.calls[1]?.[1] as { requestId: string }).requestId).toBe(first);
  });

  it.each([
    ["PACKING_INCOMPLETE"],
    ["PACK_PARTIAL_NOT_ALLOWED"],
    ["PACK_NOTHING_TO_SHIP"],
    ["PACKAGE_NOT_SEALED"],
  ] as const)("BE trả 409 %s → câu tiếng Việt trong dialog", async (code) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderPackingStation({
      session: fullySealed(),
      post: () => ({
        [COMPLETION]: () => {
          throw new ApiError(409, code, "English message");
        },
      }),
    });
    const dialog = await openComplete(user);
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitFull }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      PACKING_ERROR_MESSAGES[code],
    );
    expect(within(dialog).queryByText("English message")).toBeNull();
  });

  it("PACKING_INCOMPLETE (phiên đã đổi) → tải lại phiên", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const { get } = renderPackingStation({
      session: fullySealed(),
      post: () => ({
        [COMPLETION]: () => {
          throw new ApiError(409, "PACKING_INCOMPLETE", "Not everything is packed");
        },
      }),
    });
    const dialog = await openComplete(user);
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitFull }));
    await within(dialog).findByRole("alert");
    await waitFor(() =>
      expect(
        get.mock.calls.filter(([url]) => String(url).endsWith("packing-session")).length,
      ).toBeGreaterThan(1),
    );
  });

  it("lệch checksum thiết kế: 200 + On Hold, không có lô giao → dialog báo bị giữ (không phải lỗi), phiên chuyển Tạm giữ", async () => {
    const user = userEvent.setup();
    const warning = vi.spyOn(toast, "warning").mockImplementation(() => "");
    renderPackingStation({
      session: fullySealed(),
      post: (state) => ({
        [COMPLETION]: () => {
          state.session = fullySealed({ packStatus: "ON_HOLD" });
          return pickedTask({ packStatus: "ON_HOLD" });
        },
      }),
    });
    const dialog = await openComplete(user);
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitFull }));
    expect(await within(dialog).findByText(P.complete.resultHeld)).toBeInTheDocument();
    expect(warning).toHaveBeenCalled();
    // Chưa có lô giao → id giữ lại để hoàn tất lần nữa sau khi QC kiểm tra lại
    expect(window.sessionStorage.getItem(REQUEST_KEY)).not.toBeNull();
    await user.click(within(dialog).getByRole("button", { name: P.complete.close }));
    expect(await screen.findByText(UI_LABELS.fulfillment.holdTitle)).toBeInTheDocument();
  });

  it("kiện còn mở có hàng / chưa có kiện niêm phong → dialog chặn nút, nêu lý do", async () => {
    const user = userEvent.setup();
    renderPackingStation({
      session: apiSession({
        packages: [
          sealedPackage(),
          packPackage({
            packageId: SECOND_PACKAGE_ID,
            packageNo: 2,
            contents: [{ orderLineId: packLine().orderLineId, sku: "TEE-BLK-M", quantity: 1 }],
          }),
        ],
      }),
    });
    const dialog = await openComplete(user);
    expect(within(dialog).getByText(P.complete.openPackagesTitle)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: P.complete.submitPartial })).toBeDisabled();
  });

  it("đơn còn khoản phải thu trước bàn giao → banner cảnh báo (vẫn đóng gói bình thường)", async () => {
    renderPackingStation({
      session: fullySealed({ paymentDue: { amountDueBeforeHandover: 400000, currency: "VND" } }),
    });
    expect(await screen.findByText(P.notice.paymentTitle)).toBeInTheDocument();
    expect(screen.getByText(/phải thanh toán trước khi giao cho hãng/)).toHaveTextContent(
      /400\.000/,
    );
    expect(screen.getByRole("button", { name: P.action.complete })).toBeEnabled();
  });

  it("kết quả hoàn tất kèm paymentDue (task) → cảnh báo thu tiền trong dialog kết quả", async () => {
    const user = userEvent.setup();
    renderPackingStation({
      session: fullySealed(),
      post: (state) => ({
        [COMPLETION]: () => {
          state.session = fullySealed({ packStatus: "PACKED", shipments: [packShipment()] });
          return doneTask({ paymentDue: { amountDueBeforeHandover: 150000, currency: "VND" } });
        },
      }),
    });
    const dialog = await openComplete(user);
    await user.click(within(dialog).getByRole("button", { name: P.complete.submitFull }));
    expect(await within(dialog).findByText(P.notice.paymentTitle)).toBeInTheDocument();
    expect(within(dialog).getByText(/150\.000/)).toBeInTheDocument();
  });
});

describe("nhãn kiện", () => {
  it("nhãn TẠM: n/N, COD, người nhận, địa chỉ hoàn, cờ, nội dung; in bằng window.print", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const { get } = renderPackingStation({
      session: fullySealed(),
      get: () => ({ [`${PKG}/label`]: () => apiLabel() }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.label }));
    expect(await screen.findByText(P.label.provisional)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === `${PKG}/label`)).toBe(true);
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText(/450\.000/)).toBeInTheDocument();
    expect(screen.getByText("Vũ Đức Long")).toBeInTheDocument();
    expect(screen.getByText("+84 966 777 888")).toBeInTheDocument();
    expect(screen.getByText("15 Quang Trung")).toBeInTheDocument();
    expect(screen.getByText("Kho Hà Nội — Trung tâm")).toBeInTheDocument();
    expect(screen.getByText(/Lô CN2/)).toBeInTheDocument();
    expect(screen.getByText(P.label.fragile)).toBeInTheDocument();
    expect(screen.getByText(P.label.notRotatable)).toBeInTheDocument();
    expect(screen.getByText(/3 ×/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: P.action.print }));
    expect(print).toHaveBeenCalledTimes(1);
    // Quay lại trạm
    await user.click(screen.getByRole("button", { name: P.label.close }));
    expect(await screen.findByRole("heading", { name: P.packages.title })).toBeInTheDocument();
  });

  it("nhãn chốt (đã vào lô giao): không còn dấu TẠM, có mã lô; không thu hộ khi COD = 0", async () => {
    const user = userEvent.setup();
    renderPackingStation({
      session: fullySealed({
        packages: [sealedPackage({ shipmentId: SHIPMENT_ID })],
        shipments: [packShipment()],
      }),
      get: () => ({
        [`${PKG}/label`]: () =>
          apiLabel({
            provisional: false,
            shipmentId: SHIPMENT_ID,
            shipmentCode: "SO-20261010-000431-S1",
            packageCount: 1,
            codAmount: 0,
          }),
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.label }));
    expect(await screen.findByText(P.label.noCod)).toBeInTheDocument();
    expect(screen.queryByText(P.label.provisional)).toBeNull();
    expect(screen.getAllByText("SO-20261010-000431-S1").length).toBeGreaterThan(0);
  });

  it("BE từ chối nhãn (PACKAGE_NOT_SEALED): báo bằng tiếng Việt", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderPackingStation({
      session: fullySealed(),
      get: () => ({
        [`${PKG}/label`]: () => {
          throw new ApiError(409, "PACKAGE_NOT_SEALED", "A package is still open");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.label }));
    expect(await screen.findByText(P.label.unavailableTitle)).toBeInTheDocument();
    expect(
      screen.getByText(PACKING_ERROR_MESSAGES.PACKAGE_NOT_SEALED, { exact: false }),
    ).toBeInTheDocument();
  });

  it("BE trả 409 PACK_STATE_CONFLICT khi lấy nhãn → báo và tải lại phiên", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const { get } = renderPackingStation({
      session: fullySealed(),
      get: () => ({
        [`${PKG}/label`]: () => {
          throw new ApiError(409, "PACK_STATE_CONFLICT", "Packing is ON_HOLD");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.label }));
    expect(await screen.findByText(P.label.unavailableTitle)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        get.mock.calls.filter(([url]) => String(url).endsWith("packing-session")).length,
      ).toBeGreaterThan(1),
    );
  });

  it("không có fulfillment-packing:READ (QC) → không có nút xem nhãn", async () => {
    renderPackingStation({
      identity: {
        permissions: [
          "fulfillment-packages:VIEW_PAGE",
          "fulfillment-packages:READ",
          "fulfillment-pick-lists:READ",
        ],
      },
      session: fullySealed(),
      userId: "qc",
    });
    expect(await screen.findByRole("heading", { name: P.packages.title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: P.action.label })).toBeNull();
  });
});
