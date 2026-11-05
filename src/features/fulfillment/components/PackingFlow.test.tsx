import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PACKING_ERROR_MESSAGES,
  PACKING_FIELD_MESSAGES,
  PACKING_INVALID_RESPONSE_MESSAGE,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import {
  LOT_LINE_ID,
  PACKAGE_ID,
  PACKING_PATH,
  apiSession,
  lotLine,
  packLine,
  packPackage,
  pendingSession,
  printLine,
  serialLine,
} from "../__fixtures__/packing";
import { renderPackingStation, stubUuids } from "../__fixtures__/packing-render";
import { pickSelectOption } from "../__fixtures__/render";

import type { PackingSessionDto } from "../packing-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const P = UI_LABELS.packing;
const SCAN_URL = `${PACKING_PATH}/packages/${PACKAGE_ID}/scans`;
const openPackageSession = (overrides: Partial<PackingSessionDto> = {}) =>
  apiSession({ packages: [packPackage()], ...overrides });

/** Phiên sau khi `quantity` đơn vị `sku` vào kiện (đúng như BE trả lại phiên mới). */
function withScanned(
  session: PackingSessionDto,
  line = packLine(),
  quantity = 1,
): PackingSessionDto {
  const [first, ...rest] = session.lines.map((candidate) =>
    candidate.orderLineId === line.orderLineId
      ? {
          ...candidate,
          packed: candidate.packed + quantity,
          remaining: candidate.remaining - quantity,
        }
      : candidate,
  );
  return {
    ...session,
    lines: first ? [first, ...rest] : [],
    packages: session.packages.map((pkg) => ({
      ...pkg,
      contents: [...pkg.contents, { orderLineId: line.orderLineId, sku: line.sku, quantity }],
    })),
  };
}

async function scanCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const input = await screen.findByLabelText(P.scan.label);
  await user.type(input, `${code}{Enter}`);
}

describe("trạm đóng gói — nhận đơn và mở kiện", () => {
  it("nhận đơn: POST packing-start không body → phiên chuyển Packing, hiện thao tác đóng", async () => {
    const user = userEvent.setup();
    const { post } = renderPackingStation({
      session: pendingSession(),
      post: (state) => ({
        [`${PACKING_PATH}/packing-start`]: () => {
          state.session = apiSession();
          return state.session;
        },
      }),
    });
    expect(await screen.findByText(P.notice.pendingStart)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: P.action.start }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PACKING_PATH}/packing-start`));
    expect(await screen.findByRole("button", { name: P.action.complete })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: P.action.openPackage })).toBeInTheDocument();
  });

  it("PACKING_TAKEN khi nhận đơn: báo bằng tiếng Việt và tải lại phiên để thấy ai đang đóng", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    const { get, state } = renderPackingStation({
      session: pendingSession(),
      post: (s) => ({
        [`${PACKING_PATH}/packing-start`]: () => {
          // Người khác nhận đơn trước: phiên đã đổi trên BE
          s.session = apiSession({ packerId: "other", packerName: "Nguyễn Văn Đạt" });
          throw new ApiError(409, "PACKING_TAKEN", "Another packer is packing order SO-1");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.start }));
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(error.mock.calls[0]?.[0]).toBe(PACKING_ERROR_MESSAGES.PACKING_TAKEN);
    // Phiên được tải lại → banner nêu tên người đang đóng; không còn nút nhận đơn
    expect(await screen.findByText(P.notice.takenTitle("Nguyễn Văn Đạt"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: P.action.start })).toBeNull();
    expect(
      get.mock.calls.filter(([url]) => String(url).endsWith("packing-session")).length,
    ).toBeGreaterThan(1);
    expect(state.session.packerName).toBe("Nguyễn Văn Đạt");
  });

  it("mở kiện: POST packages {packageType} + Idempotency-Key; lỗi mạng gửi lại CÙNG key, thành công thì key mới", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const issued = stubUuids();
    let attempts = 0;
    const { post } = renderPackingStation({
      post: (state) => ({
        [`${PACKING_PATH}/packages`]: () => {
          attempts += 1;
          if (attempts === 1) throw new ApiError(0, "NETWORK_ERROR", "Network Error");
          state.session = openPackageSession();
          return packPackage();
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.openPackage }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    // Lỗi mạng: bấm lại → cùng Idempotency-Key
    await user.click(await screen.findByRole("button", { name: P.action.openPackage }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const headers = post.mock.calls.map(([, , config]) => config);
    expect(headers[0]).toEqual({ headers: { "Idempotency-Key": issued()[0] } });
    expect(headers[1]).toEqual(headers[0]);
    expect(post.mock.calls[1]?.[1]).toEqual({ packageType: "CARTON" });
    // Thành công → kiện hiện ra, lần mở kế tiếp dùng key mới
    expect(
      await screen.findByRole("heading", { name: P.packages.cardTitle(1) }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: P.action.openPackage }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    expect(post.mock.calls[2]?.[2]).not.toEqual(headers[0]);
  });
});

describe("trạm đóng gói — quét kiểm", () => {
  it("quét: ô quét luôn focus, Enter gửi; mỗi lần quét một scanId MỚI; phản hồi + số 'Đã đóng' cập nhật", async () => {
    const user = userEvent.setup();
    const issued = stubUuids();
    const { post } = renderPackingStation({
      session: openPackageSession(),
      post: (state) => ({
        [SCAN_URL]: () => {
          state.session = withScanned(state.session);
          return state.session;
        },
      }),
    });
    const input = await screen.findByLabelText(P.scan.label);
    expect(input).toHaveFocus();
    await scanCode(user, "TEE-BLK-M");
    // Phản hồi hiện ở dòng nhìn được và ở vùng đọc cho trình đọc màn hình
    expect(await screen.findAllByText(P.scan.added(1, "TEE-BLK-M", 1))).not.toHaveLength(0);
    expect(post).toHaveBeenCalledWith(SCAN_URL, {
      scanId: expect.any(String),
      scannedCode: "TEE-BLK-M",
      quantity: 1,
    });
    expect(issued()).toContain((post.mock.calls[0]?.[1] as { scanId: string }).scanId);
    // Số "Còn lại" của dòng giảm ngay (phiên mới nằm trong cache, không chờ tải lại)
    const lines = screen.getByRole("table", { name: P.lines.title });
    const row = within(lines).getByText("TEE-BLK-M").closest("tr") as HTMLElement;
    // Cột: SKU, mã vạch, cần, đã về bàn, đã đóng, đã giao, còn lại
    expect(within(row).getAllByRole("cell")[4]).toHaveTextContent("1");
    expect(within(row).getAllByRole("cell")[6]).toHaveTextContent("2");
    expect(input).toHaveFocus();

    await scanCode(user, "8930000000011");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]?.[1]).toMatchObject({ scannedCode: "8930000000011" });
    expect((post.mock.calls[1]?.[1] as { scanId: string }).scanId).not.toBe(
      (post.mock.calls[0]?.[1] as { scanId: string }).scanId,
    );
  });

  it("quét số lượng khác 1: ô số lượng gửi đúng; số không hợp lệ không gọi API", async () => {
    const user = userEvent.setup();
    const { post } = renderPackingStation({
      session: openPackageSession(),
      post: (state) => ({
        [SCAN_URL]: () => {
          state.session = withScanned(state.session, packLine(), 2);
          return state.session;
        },
      }),
    });
    const quantity = await screen.findByLabelText(P.scan.quantity);
    await user.clear(quantity);
    await user.type(quantity, "0");
    await scanCode(user, "TEE-BLK-M");
    expect(await screen.findAllByText(/số lượng nguyên dương/i)).not.toHaveLength(0);
    expect(post).not.toHaveBeenCalled();
    await user.clear(quantity);
    await user.type(quantity, "2");
    await scanCode(user, "TEE-BLK-M");
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(SCAN_URL, expect.objectContaining({ quantity: 2 })),
    );
    // Quét hàng loạt là một lần duy nhất: ô số lượng về 1, lần quét sau chỉ đóng 1
    await waitFor(() => expect(quantity).toHaveValue("1"));
    await scanCode(user, "TEE-BLK-M");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]?.[1]).toMatchObject({ quantity: 1 });
  });

  it("phản hồi sai hợp đồng (parse lỗi): không đưa vào 'Gửi lại' cùng scanId; tải lại phiên; lần quét kế dùng scanId mới", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const { post, get } = renderPackingStation({
      session: openPackageSession(),
      post: () => ({ [SCAN_URL]: () => ({ taskId: "chi-co-mot-field" }) }),
    });
    await scanCode(user, "TEE-BLK-M");
    expect(
      await screen.findAllByText(new RegExp(PACKING_INVALID_RESPONSE_MESSAGE.slice(0, 30))),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: P.action.retryScan })).toBeNull();
    await waitFor(() =>
      expect(
        get.mock.calls.filter(([url]) => String(url).endsWith("packing-session")).length,
      ).toBeGreaterThan(1),
    );
    await scanCode(user, "TEE-BLK-M");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const ids = post.mock.calls.map(([, body]) => (body as { scanId: string }).scanId);
    expect(new Set(ids).size).toBe(2);
  });

  it("lỗi mạng: lần quét giữ nguyên scanId, 'Gửi lại' dùng ĐÚNG id đó (BE không ghi hai lần)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const issued = stubUuids();
    let attempts = 0;
    const { post } = renderPackingStation({
      session: openPackageSession(),
      post: (state) => ({
        [SCAN_URL]: () => {
          attempts += 1;
          if (attempts === 1) throw new ApiError(0, "NETWORK_ERROR", "Network Error");
          state.session = withScanned(state.session);
          return state.session;
        },
      }),
    });
    await scanCode(user, "TEE-BLK-M");
    expect(await screen.findByText(P.scan.failedTitle)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: P.action.retryScan }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]?.[1]).toEqual(post.mock.calls[0]?.[1]);
    expect(issued()).toContain((post.mock.calls[0]?.[1] as { scanId: string }).scanId);
    expect(await screen.findAllByText(P.scan.added(1, "TEE-BLK-M", 1))).not.toHaveLength(0);
    expect(screen.queryByText(P.scan.failedTitle)).toBeNull();
  });

  it("lỗi nghiệp vụ (hàng không thuộc đơn): báo tiếng Việt, KHÔNG có 'Gửi lại', lần quét kế dùng scanId mới", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    stubUuids();
    const { post } = renderPackingStation({
      session: openPackageSession(),
      post: () => ({
        [SCAN_URL]: () => {
          throw new ApiError(409, "PACK_ITEM_NOT_IN_ORDER", "XYZ is not on order SO-1");
        },
      }),
    });
    await scanCode(user, "XYZ");
    expect(
      await screen.findAllByText(new RegExp(PACKING_ERROR_MESSAGES.PACK_ITEM_NOT_IN_ORDER)),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: P.action.retryScan })).toBeNull();
    await scanCode(user, "XYZ");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const ids = post.mock.calls.map(([, body]) => (body as { scanId: string }).scanId);
    expect(new Set(ids).size).toBe(2);
  });

  it("lỗi phiên đã đổi (PACK_STATE_CONFLICT): báo + tải lại phiên", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const { get } = renderPackingStation({
      session: openPackageSession(),
      post: () => ({
        [SCAN_URL]: () => {
          throw new ApiError(409, "PACK_STATE_CONFLICT", "Packing is ON_HOLD");
        },
      }),
    });
    await scanCode(user, "TEE-BLK-M");
    expect(
      (
        await screen.findAllByText(
          new RegExp(PACKING_ERROR_MESSAGES.PACK_STATE_CONFLICT.slice(0, 30)),
        )
      ).length,
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        get.mock.calls.filter(([url]) => String(url).endsWith("packing-session")).length,
      ).toBeGreaterThan(1),
    );
  });

  it("dòng theo lô: hỏi số lô — gõ / quét mã lô (không phân biệt hoa thường) khớp lô đã lấy, body có đúng tên lô; lô lạ bị chặn ở form", async () => {
    const user = userEvent.setup();
    const { post } = renderPackingStation({
      session: openPackageSession({ lines: [lotLine()] }),
      post: (state) => ({
        [SCAN_URL]: () => {
          state.session = withScanned(state.session, lotLine());
          return state.session;
        },
      }),
    });
    await scanCode(user, "MUG-WHT");
    const dialog = await screen.findByRole("dialog");
    const lot = within(dialog).getByLabelText(P.scan.promptLot);
    expect(lot).toHaveFocus();
    // Chưa nhập lô → không gửi
    await user.click(within(dialog).getByRole("button", { name: P.scan.promptSubmit }));
    expect(within(dialog).getByText(PACKING_FIELD_MESSAGES.lotRequired)).toBeInTheDocument();
    // Lô không thuộc hàng đã lấy → chặn, không gọi API
    await user.type(lot, "LOT-Z");
    await user.click(within(dialog).getByRole("button", { name: P.scan.promptSubmit }));
    expect(within(dialog).getByText(PACKING_FIELD_MESSAGES.lotUnknown)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    // Quét mã lô bằng máy quét (kết thúc Enter) viết thường → gửi đúng "LOT-B"
    await user.clear(lot);
    await user.type(lot, "lot-b{Enter}");
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        SCAN_URL,
        expect.objectContaining({ scannedCode: "MUG-WHT", lotNumber: "LOT-B", quantity: 1 }),
      ),
    );
    expect((post.mock.calls[0]?.[1] as { serialNumber?: string }).serialNumber).toBeUndefined();
  });

  it("dòng theo serial: hỏi serial, mỗi lần một đơn vị (quantity 1 dù ô số lượng khác)", async () => {
    const user = userEvent.setup();
    const { post } = renderPackingStation({
      session: openPackageSession({ lines: [serialLine()] }),
      post: (state) => ({
        [SCAN_URL]: () => {
          state.session = withScanned(state.session, serialLine());
          return state.session;
        },
      }),
    });
    const quantity = await screen.findByLabelText(P.scan.quantity);
    await user.clear(quantity);
    await user.type(quantity, "3");
    await scanCode(user, "HOODIE-BLK-L");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: P.scan.promptSubmit }));
    expect(within(dialog).getByText("Nhập số serial")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(P.scan.promptSerial), "SN-0001");
    await user.click(within(dialog).getByRole("button", { name: P.scan.promptSubmit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        SCAN_URL,
        expect.objectContaining({
          scannedCode: "HOODIE-BLK-L",
          serialNumber: "SN-0001",
          quantity: 1,
        }),
      ),
    );
  });

  it("mã nằm trên hai dòng đều còn thiếu: chọn dòng, body có orderLineId (BE PACK_SCAN_AMBIGUOUS)", async () => {
    const user = userEvent.setup();
    const plain = packLine({ sku: "MUG", barcode: "111", wanted: 2, available: 2, remaining: 2 });
    const printed = printLine({
      sku: "MUG",
      barcode: "111",
      wanted: 2,
      available: 2,
      remaining: 2,
    });
    const { post } = renderPackingStation({
      session: openPackageSession({ lines: [plain, printed] }),
      post: (state) => ({
        [SCAN_URL]: () => {
          state.session = withScanned(state.session, printed);
          return state.session;
        },
      }),
    });
    await scanCode(user, "MUG");
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, P.scan.promptLine, /MUG — in theo thiết kế/);
    await user.click(within(dialog).getByRole("button", { name: P.scan.promptSubmit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        SCAN_URL,
        expect.objectContaining({ orderLineId: printed.orderLineId, scannedCode: "MUG" }),
      ),
    );
  });

  it("không có kiện mở → ô quét không hiện, nhắc mở kiện; quét hai kiện: chọn kiện nhận hàng", async () => {
    renderPackingStation({ session: apiSession({ packages: [] }) });
    expect(await screen.findByText(P.scan.noOpenPackage)).toBeInTheDocument();
    expect(screen.queryByLabelText(P.scan.label)).toBeNull();
  });
});

describe("trạm đóng gói — bớt hàng khỏi kiện", () => {
  it("DELETE .../lines/{orderLineId} kèm quantity, lô, scanId; gửi lại sau lỗi mạng dùng CÙNG scanId", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const issued = stubUuids();
    const line = lotLine({ packed: 2, remaining: 2 });
    const session = openPackageSession({
      lines: [line],
      packages: [
        packPackage({
          contents: [{ orderLineId: LOT_LINE_ID, sku: "MUG-WHT", lotNumber: "LOT-A", quantity: 2 }],
        }),
      ],
    });
    let attempts = 0;
    const { del } = renderPackingStation({
      session,
      del: (state) => ({
        [`${PACKING_PATH}/packages/${PACKAGE_ID}/lines/${LOT_LINE_ID}`]: () => {
          attempts += 1;
          if (attempts === 1) throw new ApiError(0, "NETWORK_ERROR", "Network Error");
          state.session = { ...session, packages: [packPackage()], lines: [lotLine()] };
          return state.session;
        },
      }),
    });
    await user.click(
      await screen.findByRole("button", { name: `${P.action.removeUnits} MUG-WHT` }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText(P.remove.quantity));
    await user.type(within(dialog).getByLabelText(P.remove.quantity), "2");
    await user.click(within(dialog).getByRole("button", { name: P.remove.submit }));
    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
    // Lỗi mạng → dialog còn, bấm lại: cùng scanId
    await user.click(within(dialog).getByRole("button", { name: P.remove.submit }));
    await waitFor(() => expect(del).toHaveBeenCalledTimes(2));
    const params = del.mock.calls.map(([, config]) => config);
    expect(params[0]).toEqual({
      params: {
        quantity: 2,
        lotNumber: "LOT-A",
        serialNumber: undefined,
        scanId: expect.any(String),
      },
    });
    expect(issued()).toContain((params[0] as { params: { scanId: string } }).params.scanId);
    expect(params[1]).toEqual(params[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText(P.packages.noContents)).toBeInTheDocument();
  });

  it("không bớt quá số đang có trong kiện", async () => {
    const user = userEvent.setup();
    const { del } = renderPackingStation({
      session: openPackageSession({
        packages: [
          packPackage({
            contents: [{ orderLineId: packLine().orderLineId, sku: "TEE-BLK-M", quantity: 1 }],
          }),
        ],
      }),
    });
    await user.click(
      await screen.findByRole("button", { name: `${P.action.removeUnits} TEE-BLK-M` }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText(P.remove.quantity));
    await user.type(within(dialog).getByLabelText(P.remove.quantity), "2");
    await user.click(within(dialog).getByRole("button", { name: P.remove.submit }));
    expect(within(dialog).getByText("Vượt quá số đang có trong kiện")).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();
  });
});
