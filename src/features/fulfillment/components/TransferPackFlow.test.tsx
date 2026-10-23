import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TRANSFER_PACK_ERROR_MESSAGES, TRANSFER_PACK_FIELD_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { pickSelectOption } from "../__fixtures__/render";
import { stubUuids } from "../__fixtures__/packing-render";
import {
  KIT_LINE_ID,
  LOT_A_LINE_ID,
  LOT_B_LINE_ID,
  PACK_PATH,
  PARCEL_1_ID,
  PLAIN_LINE_ID,
  cartonResponse,
  kitLine,
  kitResponse,
  lotALine,
  lotBLine,
  sealedParcel,
  tLine,
  tParcel,
  tSession,
  withScanned,
} from "../__fixtures__/transfer-pack";
import { renderTransferPackStation } from "../__fixtures__/transfer-pack-render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const P = UI_LABELS.packing;
const L = UI_LABELS.transferPack;
const SCAN_URL = `${PACK_PATH}/packages/${PARCEL_1_ID}/scans`;
const SEAL_URL = `${PACK_PATH}/packages/${PARCEL_1_ID}/seal`;
const openSession = (overrides = {}) => tSession({ packages: [tParcel()], ...overrides });

async function scanCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const input = await screen.findByLabelText(P.scan.label);
  await user.type(input, `${code}{Enter}`);
}

/** Điền form cân đo niêm phong (nhãn của `SealFormDialog`). */
async function fillSeal(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: { weight?: string; l?: string; w?: string; h?: string },
) {
  const fields: [string, string | undefined][] = [
    [P.seal.weight, values.weight],
    [P.seal.length, values.l],
    [P.seal.width, values.w],
    [P.seal.height, values.h],
  ];
  for (const [label, value] of fields) {
    if (value === undefined) continue;
    const input = within(dialog).getByLabelText(label);
    await user.clear(input);
    await user.type(input, value);
  }
}

describe("đóng gói chuyển kho — mở kiện", () => {
  it("mở kiện: POST …/packages {packageType} (không Idempotency-Key — BE không nhận)", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      post: (state) => ({
        [`${PACK_PATH}/packages`]: () => {
          const parcel = tParcel();
          state.session = { ...state.session, packages: [parcel] };
          return parcel;
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.openPackage }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PACK_PATH}/packages`, { packageType: "CARTON" }),
    );
    expect(await screen.findByText(P.packages.cardTitle(1))).toBeInTheDocument();
  });
});

describe("đóng gói chuyển kho — lỗi khi mở kiện", () => {
  it("BE từ chối (PACKING_TAKEN): đúng MỘT toast tiếng Việt (factory toast, component không toast lại)", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => "id");
    renderTransferPackStation({
      post: () => ({
        [`${PACK_PATH}/packages`]: () => {
          throw new ApiError(409, "PACKING_TAKEN", "taken");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.openPackage }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(TRANSFER_PACK_ERROR_MESSAGES.PACKING_TAKEN);
  });
});

describe("đóng gói chuyển kho — quét kiểm", () => {
  it("quét SKU: scanId mới mỗi lần, không kèm lô cho dòng không nêu lô; số 'Đã đóng' cập nhật ngay", async () => {
    const user = userEvent.setup();
    const issued = stubUuids();
    const { post } = renderTransferPackStation({
      session: openSession(),
      post: (state) => ({
        [SCAN_URL]: () => {
          state.session = withScanned(state.session, tLine(), PARCEL_1_ID);
          return state.session;
        },
      }),
    });
    const input = await screen.findByLabelText(P.scan.label);
    expect(input).toHaveFocus();
    await scanCode(user, "TEE-BLK-M");
    expect(await screen.findAllByText(P.scan.added(1, "TEE-BLK-M", 1))).not.toHaveLength(0);
    expect(post).toHaveBeenCalledWith(SCAN_URL, {
      scanId: expect.any(String),
      scannedCode: "TEE-BLK-M",
      quantity: 1,
      lotNumber: undefined,
    });
    expect(issued()).toContain((post.mock.calls[0]?.[1] as { scanId: string }).scanId);
    const row = within(screen.getByRole("table", { name: L.lines.title }))
      .getByText("TEE-BLK-M")
      .closest("tr") as HTMLElement;
    // Cột: #, SKU, mã vạch, lô, yêu cầu, đã đóng, còn lại
    expect(within(row).getAllByRole("cell")[5]).toHaveTextContent("1");
    expect(within(row).getAllByRole("cell")[6]).toHaveTextContent("9");

    await scanCode(user, "8930000000011");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect((post.mock.calls[1]?.[1] as { scanId: string }).scanId).not.toBe(
      (post.mock.calls[0]?.[1] as { scanId: string }).scanId,
    );
  });

  it("dòng nêu lô: lần quét tự kèm đúng lô của dòng (BE: lô khi dòng nêu lô)", async () => {
    const user = userEvent.setup();
    const line = tLine({ lotNumber: "LOT-Z" });
    const { post } = renderTransferPackStation({
      session: openSession({ lines: [line] }),
      post: (state) => ({
        [SCAN_URL]: () => {
          state.session = withScanned(state.session, line, PARCEL_1_ID);
          return state.session;
        },
      }),
    });
    await scanCode(user, "TEE-BLK-M");
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        SCAN_URL,
        expect.objectContaining({ scannedCode: "TEE-BLK-M", lotNumber: "LOT-Z" }),
      ),
    );
  });

  it("mã nằm trên hai dòng (cùng SKU khác lô): hỏi chọn dòng, body có transferLineId + lô của dòng đó", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      session: openSession({ lines: [lotALine(), lotBLine()] }),
      post: (state) => ({
        [SCAN_URL]: () => {
          state.session = withScanned(state.session, lotBLine(), PARCEL_1_ID);
          return state.session;
        },
      }),
    });
    await scanCode(user, "MUG-WHT");
    const dialog = await screen.findByRole("dialog");
    // Chưa chọn dòng: chặn ở form, chưa gửi
    await user.click(within(dialog).getByRole("button", { name: L.scan.pickLineSubmit }));
    expect(await within(dialog).findByText(L.scan.lineRequired)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await pickSelectOption(
      user,
      L.scan.pickLineLabel,
      L.scan.pickLineOption(4, "MUG-WHT", "LOT-B"),
    );
    await user.click(within(dialog).getByRole("button", { name: L.scan.pickLineSubmit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        SCAN_URL,
        expect.objectContaining({
          scannedCode: "MUG-WHT",
          transferLineId: LOT_B_LINE_ID,
          lotNumber: "LOT-B",
        }),
      ),
    );
    expect(LOT_A_LINE_ID).not.toBe(LOT_B_LINE_ID);
  });

  it("lỗi nghiệp vụ (hàng không thuộc lệnh): câu tiếng Việt, không có 'Gửi lại'; lần quét kế dùng scanId mới", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      session: openSession(),
      post: () => ({
        [SCAN_URL]: () => {
          throw new ApiError(409, "PACK_ITEM_NOT_IN_ORDER", "not in order");
        },
      }),
    });
    await scanCode(user, "NOPE");
    expect(
      await screen.findAllByText(new RegExp(TRANSFER_PACK_ERROR_MESSAGES.PACK_ITEM_NOT_IN_ORDER)),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: P.action.retryScan })).not.toBeInTheDocument();
    await scanCode(user, "NOPE2");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect((post.mock.calls[1]?.[1] as { scanId: string }).scanId).not.toBe(
      (post.mock.calls[0]?.[1] as { scanId: string }).scanId,
    );
  });

  it("lỗi mạng: giữ scanId, 'Gửi lại' dùng ĐÚNG id đó (BE không ghi hai lần)", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { post } = renderTransferPackStation({
      session: openSession(),
      post: (state) => ({
        [SCAN_URL]: () => {
          attempts += 1;
          if (attempts === 1) throw new ApiError(0, "NETWORK_ERROR", "offline");
          state.session = withScanned(state.session, tLine(), PARCEL_1_ID);
          return state.session;
        },
      }),
    });
    await scanCode(user, "TEE-BLK-M");
    await user.click(await screen.findByRole("button", { name: P.action.retryScan }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect((post.mock.calls[1]?.[1] as { scanId: string }).scanId).toBe(
      (post.mock.calls[0]?.[1] as { scanId: string }).scanId,
    );
  });

  it("không có kiện mở: không có ô quét, nhắc mở kiện", async () => {
    renderTransferPackStation({ session: tSession({ packages: [] }) });
    expect(await screen.findByText(L.scan.noOpenPackage)).toBeInTheDocument();
    expect(screen.queryByLabelText(P.scan.label)).not.toBeInTheDocument();
  });
});

describe("đóng gói chuyển kho — niêm phong và huỷ kiện", () => {
  const withGoods = () =>
    openSession({
      packages: [
        tParcel({ contents: [{ transferLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 10 }] }),
      ],
    });

  it("kiện rỗng: nút niêm phong khoá", async () => {
    renderTransferPackStation({ session: openSession() });
    expect(await screen.findByRole("button", { name: P.action.seal })).toBeDisabled();
  });

  it("niêm phong: form cân đo chặn số sai ở FE; gửi số thực đo, loại kiện, cờ mặc định", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      session: withGoods(),
      post: (state) => ({
        [SEAL_URL]: () => {
          const parcel = sealedParcel({ weightKg: 5, lengthCm: 40, widthCm: 30, heightCm: 20 });
          state.session = { ...state.session, packages: [parcel] };
          return parcel;
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.seal }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    expect(await within(dialog).findAllByText(/lớn hơn 0/)).not.toHaveLength(0);
    expect(post).not.toHaveBeenCalled();

    await fillSeal(user, dialog, { weight: "5", l: "40", w: "30", h: "20" });
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(SEAL_URL, {
        weightKg: 5,
        lengthCm: 40,
        widthCm: 30,
        heightCm: 20,
        packageType: "CARTON",
        rotatable: undefined,
        fragile: undefined,
        kitOverrideReason: undefined,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(
      await screen.findByText(UI_LABELS.packing.packages.statusDisplay.SEALED),
    ).toBeInTheDocument();
  });

  it("hàng đi nhiều thùng trong kiện thường (KIT-FORCE): form hỏi lý do và gửi kitOverrideReason", async () => {
    const user = userEvent.setup();
    const kit = kitLine();
    const session = openSession({
      lines: [kit],
      packages: [
        tParcel({ contents: [{ transferLineId: KIT_LINE_ID, sku: "DESK-OAK", quantity: 1 }] }),
      ],
    });
    const { post } = renderTransferPackStation({
      session,
      post: () => ({ [SEAL_URL]: () => sealedParcel() }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.seal }));
    const dialog = await screen.findByRole("dialog");
    await fillSeal(user, dialog, { weight: "5", l: "40", w: "30", h: "20" });
    await user.type(within(dialog).getByLabelText(L.packages.kitReason), "Khách lấy rời");
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        SEAL_URL,
        expect.objectContaining({ kitOverrideReason: "Khách lấy rời" }),
      ),
    );
  });

  it("BE 422 KIT_OVERRIDE_REASON_REQUIRED: báo tiếng Việt ngay trong hộp thoại", async () => {
    const user = userEvent.setup();
    renderTransferPackStation({
      session: withGoods(),
      post: () => ({
        [SEAL_URL]: () => {
          throw new ApiError(422, "KIT_OVERRIDE_REASON_REQUIRED", "reason");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: P.action.seal }));
    const dialog = await screen.findByRole("dialog");
    await fillSeal(user, dialog, { weight: "5", l: "40", w: "30", h: "20" });
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    expect(
      await within(dialog).findByText(TRANSFER_PACK_ERROR_MESSAGES.KIT_OVERRIDE_REASON_REQUIRED),
    ).toBeInTheDocument();
  });

  it("huỷ kiện: xác nhận rồi DELETE; kiện đã niêm phong cũng huỷ được (chuyển kho không có 'mở lại')", async () => {
    const user = userEvent.setup();
    const { del } = renderTransferPackStation({
      session: openSession({ packages: [sealedParcel()] }),
      del: (state) => ({
        [`${PACK_PATH}/packages/${PARCEL_1_ID}`]: () => {
          state.session = { ...state.session, packages: [{ ...sealedParcel(), status: "VOIDED" }] };
          return state.session;
        },
      }),
    });
    expect(screen.queryByRole("button", { name: P.action.reopen })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: P.action.voidPackage }));
    await user.click(
      await within(await screen.findByRole("dialog")).findByRole("button", {
        name: P.action.voidPackage,
      }),
    );
    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(del.mock.calls[0]?.[0]).toBe(`${PACK_PATH}/packages/${PARCEL_1_ID}`);
    expect(
      await screen.findByText(L.notice.voidedPackages("PKG-TO-20261012-0001-1")),
    ).toBeInTheDocument();
  });
});

describe("đóng gói chuyển kho — đóng bộ", () => {
  const kitSession = () => tSession({ lines: [kitLine()], packages: [] });

  it("đóng bộ: chọn dòng đi nhiều thùng, để trống số phần → POST package-kits {transferLineId, packageType}", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      session: kitSession(),
      post: (state) => ({
        [`${PACK_PATH}/package-kits`]: () => {
          const kit = kitResponse();
          state.session = { ...state.session, packages: kit.packages };
          return kit;
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.openKit }));
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, UI_LABELS.transferPack.kit.line, /DESK-OAK/);
    await user.click(within(dialog).getByRole("button", { name: L.kit.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PACK_PATH}/package-kits`, {
        transferLineId: KIT_LINE_ID,
        partCount: undefined,
        packageType: "CARTON",
      }),
    );
    // Hai kiện của bộ hiện với nhãn "phần n/N"
    expect(await screen.findByText(L.packages.kitPart(1, 2))).toBeInTheDocument();
    expect(screen.getByText(L.packages.kitPart(2, 2))).toBeInTheDocument();
  });

  it("chưa chọn dòng → chặn ở form; số phần ngoài 2..99 → chặn; BE 422 KIT_PART_COUNT_MISMATCH → câu tiếng Việt", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      session: kitSession(),
      post: () => ({
        [`${PACK_PATH}/package-kits`]: () => {
          throw new ApiError(422, "KIT_PART_COUNT_MISMATCH", "mismatch");
        },
      }),
    });
    // Mở từ bảng dòng hàng: dòng được chọn sẵn
    await user.click(await screen.findByRole("button", { name: `${L.lines.openKit} DESK-OAK` }));
    const dialog = await screen.findByRole("dialog");
    const parts = within(dialog).getByLabelText(L.kit.partCount);
    await user.type(parts, "1");
    await user.click(within(dialog).getByRole("button", { name: L.kit.submit }));
    expect(
      await within(dialog).findAllByText(TRANSFER_PACK_FIELD_MESSAGES.partCountRange),
    ).not.toHaveLength(0);
    expect(post).not.toHaveBeenCalled();
    await user.clear(parts);
    await user.type(parts, "3");
    await user.click(within(dialog).getByRole("button", { name: L.kit.submit }));
    expect(
      await within(dialog).findByText(TRANSFER_PACK_ERROR_MESSAGES.KIT_PART_COUNT_MISMATCH),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      `${PACK_PATH}/package-kits`,
      expect.objectContaining({ transferLineId: KIT_LINE_ID, partCount: 3 }),
    );
  });

  it("không có dòng đi nhiều thùng: hộp thoại đóng bộ báo không có dòng và khoá nút", async () => {
    const user = userEvent.setup();
    renderTransferPackStation({ session: tSession({ lines: [tLine()], packages: [] }) });
    await user.click(await screen.findByRole("button", { name: L.action.openKit }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(L.kit.noKitLines)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: L.kit.submit })).toBeDisabled();
  });

  it("huỷ một phần của bộ huỷ cả bộ: nút ghi 'Huỷ cả bộ'", async () => {
    const kit = kitResponse();
    renderTransferPackStation({
      session: tSession({ lines: [kitLine()], packages: kit.packages }),
    });
    expect(await screen.findAllByRole("button", { name: L.packages.removeKit })).toHaveLength(2);
  });
});

describe("đóng gói chuyển kho — giao nguyên thùng (LP2-8)", () => {
  const CARTON_URL = `${PACK_PATH}/cartons`;
  const cartonSession = () => tSession({ lines: [tLine()], packages: [] });

  it("quét LPN → BE mở kiện → số đo gợi ý điền sẵn, người đóng sửa lại cân nặng rồi niêm phong", async () => {
    const user = userEvent.setup();
    const carton = cartonResponse();
    const sealUrl = `${PACK_PATH}/packages/${carton.parcel.packageId}/seal`;
    const { post } = renderTransferPackStation({
      session: cartonSession(),
      post: (state) => ({
        [CARTON_URL]: () => {
          state.session = { ...state.session, packages: [carton.parcel] };
          return carton;
        },
        [sealUrl]: () => sealedParcel({ stockPackageId: carton.parcel.stockPackageId }),
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.shipCarton }));
    const lpn = await screen.findByLabelText(L.carton.lpn);
    await user.type(lpn, "LPN-0001");
    await user.click(screen.getByRole("button", { name: L.carton.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(CARTON_URL, { lpn: "LPN-0001", packageType: "CARTON" }),
    );
    // Bước 2: form cân đo điền sẵn gợi ý của đơn vị đóng gói
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(L.carton.confirmTitle)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(P.seal.weight)).toHaveValue("6.2");
    expect(within(dialog).getByLabelText(P.seal.length)).toHaveValue("40");
    expect(within(dialog).getByLabelText(P.seal.width)).toHaveValue("30");
    expect(within(dialog).getByLabelText(P.seal.height)).toHaveValue("25");
    await fillSeal(user, dialog, { weight: "6.5" });
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        sealUrl,
        expect.objectContaining({ weightKg: 6.5, lengthCm: 40, widthCm: 30, heightCm: 25 }),
      ),
    );
  });

  it("đơn vị đóng gói không khai số đo: ô để trống kèm cảnh báo, buộc cân đo", async () => {
    const user = userEvent.setup();
    const carton = cartonResponse(false);
    const { post } = renderTransferPackStation({
      session: cartonSession(),
      post: () => ({ [CARTON_URL]: () => carton }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.shipCarton }));
    await user.type(await screen.findByLabelText(L.carton.lpn), "LPN-0002");
    await user.click(screen.getByRole("button", { name: L.carton.submit }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(L.carton.noSuggestion)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(P.seal.weight)).toHaveValue("");
    await user.click(within(dialog).getByRole("button", { name: P.seal.submit }));
    expect(await within(dialog).findAllByText(/lớn hơn 0/)).not.toHaveLength(0);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("LPN trống → chặn ở form; 409 STOCK_CARTON_NOT_SHIPPABLE và 404 (LPN lạ) → câu tiếng Việt, hộp thoại giữ nguyên", async () => {
    const user = userEvent.setup();
    let code = "STOCK_CARTON_NOT_SHIPPABLE";
    const { post } = renderTransferPackStation({
      session: cartonSession(),
      post: () => ({
        [CARTON_URL]: () => {
          throw new ApiError(code === "NOT_FOUND" ? 404 : 409, code, "x");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.shipCarton }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: L.carton.submit }));
    expect(
      await within(dialog).findByText(TRANSFER_PACK_FIELD_MESSAGES.lpnRequired),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(L.carton.lpn), "LPN-0003");
    await user.click(within(dialog).getByRole("button", { name: L.carton.submit }));
    expect(
      await within(dialog).findByText(TRANSFER_PACK_ERROR_MESSAGES.STOCK_CARTON_NOT_SHIPPABLE),
    ).toBeInTheDocument();

    code = "NOT_FOUND";
    await user.click(within(dialog).getByRole("button", { name: L.carton.submit }));
    expect(
      await within(dialog).findByText(TRANSFER_PACK_ERROR_MESSAGES.NOT_FOUND),
    ).toBeInTheDocument();
  });
});

describe("đóng gói chuyển kho — hoàn tất", () => {
  const COMPLETE_URL = `${PACK_PATH}/completion`;
  const doneSession = () => {
    const line = tLine({ packed: 10, remaining: 0 });
    return tSession({ lines: [line], packages: [sealedParcel()] });
  };
  const shortSession = () => {
    const line = tLine({ packed: 6, remaining: 4 });
    return tSession({
      lines: [line],
      packages: [
        sealedParcel({
          contents: [{ transferLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 6 }],
        }),
      ],
    });
  };
  const packedAfter = (state: { session: ReturnType<typeof tSession> }) => {
    state.session = { ...state.session, packStatus: "PACKED", packedAt: "2026-10-22T04:00:00Z" };
    return state.session;
  };

  it("đóng đủ: POST completion {partial: false} (không ghi chú), phiên chuyển Đã đóng gói", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      session: doneSession(),
      post: (state) => ({ [COMPLETE_URL]: () => packedAfter(state) }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: L.complete.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(COMPLETE_URL, { partial: false, note: undefined }),
    );
    expect(await screen.findByText(L.notice.packedTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.complete })).not.toBeInTheDocument();
  });

  it("thiếu so với yêu cầu: chỉ chuyển được phần đã đóng — bắt buộc ghi lý do, rồi gửi {partial: true, note}", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      session: shortSession(),
      post: (state) => ({ [COMPLETE_URL]: () => packedAfter(state) }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    const dialog = await screen.findByRole("dialog");
    // Đủ số lượng bị khoá, đã chọn sẵn "chỉ chuyển phần đã đóng"
    expect(within(dialog).getByRole("radio", { name: new RegExp(L.complete.full) })).toBeDisabled();
    expect(within(dialog).getByText(L.complete.missingLine("TEE-BLK-M", 4))).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: L.complete.submit }));
    expect(
      await within(dialog).findByText(TRANSFER_PACK_FIELD_MESSAGES.noteRequired),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(L.complete.note), "Hỏng 4 cái khi đóng");
    await user.click(within(dialog).getByRole("button", { name: L.complete.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(COMPLETE_URL, {
        partial: true,
        note: "Hỏng 4 cái khi đóng",
      }),
    );
  });

  it("còn kiện đang mở có hàng: báo và khoá nút hoàn tất (BE PACKAGE_NOT_SEALED)", async () => {
    const user = userEvent.setup();
    renderTransferPackStation({
      session: tSession({
        lines: [tLine({ packed: 10, remaining: 0 })],
        packages: [
          tParcel({
            contents: [{ transferLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 10 }],
          }),
        ],
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(L.complete.notReadyOpen)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: L.complete.submit })).toBeDisabled();
  });

  it("BE 409 PACKING_INCOMPLETE khi phiên đã đổi ở nơi khác: câu tiếng Việt trong hộp thoại", async () => {
    const user = userEvent.setup();
    renderTransferPackStation({
      session: doneSession(),
      post: () => ({
        [COMPLETE_URL]: () => {
          throw new ApiError(409, "PACKING_INCOMPLETE", "not all");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.complete }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: L.complete.submit }));
    expect(
      await within(dialog).findByText(TRANSFER_PACK_ERROR_MESSAGES.PACKING_INCOMPLETE),
    ).toBeInTheDocument();
  });
});

describe("đóng gói chuyển kho — lý do của kiện nguyên thùng", () => {
  it("lý do tiếng Anh BE ghi cho thùng nguyên được hiện bằng tiếng Việt, không có nhãn 'Lý do đóng kiện thường'", async () => {
    renderTransferPackStation({
      session: openSession({
        packages: [
          sealedParcel({
            stockPackageId: "s-1",
            kitOverrideReason: "Unopened stock carton shipped as it is (LP2-8)",
          }),
        ],
      }),
    });
    expect(await screen.findByText(L.packages.cartonAsIsReason)).toBeInTheDocument();
    expect(screen.queryByText(/Unopened stock carton/)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(L.packages.kitReason))).not.toBeInTheDocument();
  });

  it("lý do KIT-FORCE của người đóng vẫn hiện nguyên văn kèm nhãn", async () => {
    renderTransferPackStation({
      session: openSession({ packages: [sealedParcel({ kitOverrideReason: "Khách lấy rời" })] }),
    });
    expect(await screen.findByText(`${L.packages.kitReason}: Khách lấy rời`)).toBeInTheDocument();
  });
});
