import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PACKING_PERMISSIONS,
  TRANSFER_PACK_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { IDENTITIES } from "../__fixtures__/render";
import {
  OTHER_PACKER_ID,
  PACK_PATH,
  PARCEL_1_ID,
  PLAIN_LINE_ID,
  sealedParcel,
  tLine,
  tParcel,
  tSession,
  transferLabel,
} from "../__fixtures__/transfer-pack";
import { renderTransferPackStation } from "../__fixtures__/transfer-pack-render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const P = UI_LABELS.packing;
const L = UI_LABELS.transferPack;
const LABEL_URL = `${PACK_PATH}/packages/${PARCEL_1_ID}/label`;
const REOPEN_URL = `${PACK_PATH}/packages/${PARCEL_1_ID}/reopening`;
const sealedSession = (parcel = sealedParcel(), extra = {}) =>
  tSession({ lines: [tLine({ packed: 10, remaining: 0 })], packages: [parcel], ...extra });

describe("đóng gói chuyển kho — in nhãn kiện (BE GET …/label)", () => {
  it("kiện đã niêm phong có 'In nhãn': mở nhãn với số lệnh, n/N, kho đi / đến, không thu hộ, nội dung; in bằng window.print", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const { get } = renderTransferPackStation({
      session: sealedSession(),
      get: () => ({ [LABEL_URL]: () => transferLabel() }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.label }));
    expect(await screen.findByText("1/2")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(LABEL_URL, expect.anything());
    expect(screen.getByText("Kho HCM")).toBeInTheDocument();
    expect(screen.getByText("Kho Hà Nội")).toBeInTheDocument();
    expect(screen.getByText("12 Nguyễn Văn Linh, TP.HCM")).toBeInTheDocument();
    expect(screen.getByText(L.label.noCod)).toBeInTheDocument();
    expect(screen.getByText(P.label.fragile)).toBeInTheDocument();
    expect(screen.getByText(/TEE-BLK-M/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: P.action.print }));
    expect(print).toHaveBeenCalledTimes(1);
    // Đóng nhãn → về trạm
    await user.click(screen.getByRole("button", { name: P.label.close }));
    expect(await screen.findByRole("table", { name: L.lines.title })).toBeInTheDocument();
  });

  it("nhãn đã cũ: kiện mang 'Cần in lại nhãn'; mở nhãn làm nhãn hiện hành — báo dán nhãn mới và cờ biến mất khỏi kiện", async () => {
    const user = userEvent.setup();
    const { state } = renderTransferPackStation({
      session: sealedSession(sealedParcel({ labelOutdated: true })),
      get: (s) => ({
        [LABEL_URL]: () => {
          // BE: in lại nhãn cũ làm nhãn hiện hành
          s.session = sealedSession(sealedParcel({ labelOutdated: false }));
          return transferLabel();
        },
      }),
    });
    expect(await screen.findByText(L.packages.labelOutdated)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.action.label }));
    expect(await screen.findByText(L.label.outdatedFixed)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: P.label.close }));
    await waitFor(() =>
      expect(screen.queryByText(L.packages.labelOutdated)).not.toBeInTheDocument(),
    );
    expect(state.session.packages[0]?.labelOutdated).toBe(false);
  });

  it("kiện chưa niêm phong không có nút nhãn; thiếu packing:READ thì không có nút dù đã niêm phong", async () => {
    renderTransferPackStation({ session: tSession({ packages: [tParcel()] }) });
    await screen.findByText(P.packages.cardTitle(1));
    expect(screen.queryByRole("button", { name: L.action.label })).not.toBeInTheDocument();
    document.body.innerHTML = "";
    renderTransferPackStation({
      session: sealedSession(),
      identity: {
        permissions: [
          FULFILLMENT_PACKAGE_PERMISSIONS.viewPage,
          FULFILLMENT_PACKAGE_PERMISSIONS.read,
          FULFILLMENT_PACKING_PERMISSIONS.update,
        ],
      },
    });
    await screen.findByText(P.packages.cardTitle(1));
    expect(screen.queryByRole("button", { name: L.action.label })).not.toBeInTheDocument();
  });

  it("người chỉ-đọc có packing:READ in được nhãn của phiên đã đóng xong", async () => {
    const user = userEvent.setup();
    renderTransferPackStation({
      session: sealedSession(sealedParcel(), {
        packStatus: "PACKED",
        packedAt: "2026-10-22T04:00:00Z",
      }),
      userId: "reader",
      identity: {
        permissions: [
          FULFILLMENT_PACKAGE_PERMISSIONS.viewPage,
          FULFILLMENT_PACKAGE_PERMISSIONS.read,
          FULFILLMENT_PACKING_PERMISSIONS.read,
        ],
      },
      get: () => ({ [LABEL_URL]: () => transferLabel() }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.label }));
    expect(await screen.findByText("1/2")).toBeInTheDocument();
  });

  it("BE từ chối nhãn (409 PACK_STATE_CONFLICT: kiện đã huỷ / chưa niêm phong): câu tiếng Việt, có 'Thử lại'", async () => {
    const user = userEvent.setup();
    renderTransferPackStation({
      session: sealedSession(),
      get: () => ({
        [LABEL_URL]: () => {
          throw new ApiError(409, "PACK_STATE_CONFLICT", "voided");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.label }));
    expect(await screen.findByText(P.label.unavailableTitle)).toBeInTheDocument();
    expect(
      screen.getByText(TRANSFER_PACK_ERROR_MESSAGES.PACK_STATE_CONFLICT, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: UI_LABELS.common.retry })).toBeInTheDocument();
  });
});

describe("đóng gói chuyển kho — mở lại kiện đã niêm phong (BE POST …/reopening)", () => {
  it("xác nhận rồi POST reopening không body; kiện về đang mở (có lại nút niêm phong, mất nút nhãn)", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      session: sealedSession(),
      post: (state) => ({
        [REOPEN_URL]: () => {
          const reopened = tParcel({
            contents: [{ transferLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 10 }],
          });
          state.session = { ...state.session, packages: [reopened] };
          return reopened;
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.reopen }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(L.packages.reopenTitle)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: L.action.reopen }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(REOPEN_URL));
    expect(await screen.findByRole("button", { name: P.action.seal })).toBeEnabled();
    expect(screen.queryByRole("button", { name: L.action.label })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.reopen })).not.toBeInTheDocument();
  });

  it("gating như bàn đóng gói đơn: chỉ người làm việc được (chủ phiên / có APPROVE) và chỉ khi phiên chưa xong", async () => {
    // Người khác đang đóng + nhân viên thường → không
    renderTransferPackStation({
      session: sealedSession(sealedParcel(), { packerId: OTHER_PACKER_ID }),
    });
    await screen.findByText(P.packages.cardTitle(1));
    expect(screen.queryByRole("button", { name: L.action.reopen })).not.toBeInTheDocument();
    document.body.innerHTML = "";
    // Quản lý kho (APPROVE) làm hộ → có
    renderTransferPackStation({
      session: sealedSession(sealedParcel(), { packerId: OTHER_PACKER_ID }),
      identity: IDENTITIES.warehouseManager,
    });
    expect(await screen.findByRole("button", { name: L.action.reopen })).toBeInTheDocument();
    document.body.innerHTML = "";
    // Phiên đã hoàn tất → không (BE PACK_STATE_CONFLICT)
    renderTransferPackStation({
      session: sealedSession(sealedParcel(), {
        packStatus: "PACKED",
        packedAt: "2026-10-22T04:00:00Z",
      }),
      identity: IDENTITIES.warehouseManager,
    });
    await screen.findByText(L.notice.packedTitle);
    expect(screen.queryByRole("button", { name: L.action.reopen })).not.toBeInTheDocument();
  });

  it("BE 409 PACK_STATE_CONFLICT (phiên đã xong ở nơi khác): toast tiếng Việt, hộp thoại đóng", async () => {
    const user = userEvent.setup();
    renderTransferPackStation({
      session: sealedSession(),
      post: () => ({
        [REOPEN_URL]: () => {
          throw new ApiError(409, "PACK_STATE_CONFLICT", "done");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.action.reopen }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: L.action.reopen }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
