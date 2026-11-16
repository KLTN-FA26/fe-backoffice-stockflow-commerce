/**
 * Dời cửa sổ giao — bằng chứng khách đồng ý là TỆP (docs 17 BR-28; BE `…/window-change/evidence/uploads` → PUT lên kho →
 * `evidenceUploadId`): chọn tệp thì tải ngay có tiến độ, lỗi tiếng Việt, đúng MỘT bằng chứng (tệp HOẶC mã tin nhắn).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { storageClient } from "@/lib/api/direct-upload";
import { ApiError } from "@/lib/api/error";
import { pickDate } from "@/test/date-picker";

import { pickOrderSelectOption } from "../../__fixtures__/render";
import {
  BATCH_2,
  CONSENT_MESSAGE,
  SCHEDULE_PATH,
  WF4_PERMISSION_SETS,
  apiBatch,
  apiSchedule,
  inDays,
  renderWf4Detail,
} from "../../__fixtures__/wf4";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const SLOT_PATH = `${SCHEDULE_PATH}/${BATCH_2}/window-change/evidence/uploads`;
const WINDOW_PATH = `${SCHEDULE_PATH}/${BATCH_2}/window-change`;
/** SHA-256("abc"). */
const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const apiError = (status: number, code: string) =>
  new ApiError(status, code, "English server message", undefined, "trace-1");

const schedule = () =>
  apiSchedule([
    apiBatch(),
    apiBatch({
      batchId: BATCH_2,
      seq: 2,
      contractWindowStart: inDays(30),
      contractWindowEnd: inDays(34),
      windowStart: inDays(30),
      windowEnd: inDays(34),
      state: "AWAITING_STOCK",
      releasedAt: undefined,
    }),
  ]);
const slot = (uploadId = "u-1") => ({
  uploadId,
  method: "PUT",
  url: `https://bucket.s3.amazonaws.com/incoming/${uploadId}`,
  headers: { "Content-Type": "application/pdf" },
  expiresAt: "2026-11-12T10:15:00Z",
});
const pdf = (name = "xac-nhan.pdf") => new File(["abc"], name, { type: "application/pdf" });

interface Routes {
  slot?: () => unknown;
  change?: () => unknown;
  put?: (config: {
    onUploadProgress?: (e: never) => void;
    signal?: AbortSignal;
  }) => Promise<unknown>;
}

/** Mở hộp thoại dời đợt 2 với `api.post` (slot + dời) và PUT kho được giả lập. */
async function openDialog(
  routes: Routes = {},
  options: Parameters<typeof userEvent.setup>[0] = {},
) {
  const post = vi.spyOn(api, "post").mockImplementation(async (url: string) => {
    if (url === SLOT_PATH) return { data: routes.slot ? routes.slot() : slot() };
    if (url === WINDOW_PATH) return { data: routes.change ? routes.change() : schedule() };
    throw new Error(`Không có mock cho POST ${url}`);
  });
  const put = vi
    .spyOn(storageClient, "request")
    .mockImplementation(async (config) =>
      routes.put ? routes.put(config as never) : { status: 200 },
    );
  await renderWf4Detail(WF4_PERMISSION_SETS.sales, { [SCHEDULE_PATH]: schedule });
  const user = userEvent.setup(options);
  const card = await screen.findByRole("region", { name: "Lịch giao" });
  await user.click(
    within(card).getAllByRole("button", { name: "Dời cửa sổ giao" })[1] as HTMLElement,
  );
  return { user, post, put, dialog: await screen.findByRole("dialog") };
}

type User = ReturnType<typeof userEvent.setup>;

async function fillRest(user: User, dialog: HTMLElement) {
  await pickDate(user, within(dialog).getByLabelText(/Từ ngày/), inDays(40));
  await pickDate(user, within(dialog).getByLabelText(/Đến ngày/), inDays(43));
  await pickOrderSelectOption(user, /Lý do/, /Khách xin dời/);
  await user.type(within(dialog).getByRole("textbox", { name: /Ghi chú/ }), "Khách gửi email");
}

const fileInput = (dialog: HTMLElement) => within(dialog).getByLabelText("Tệp bằng chứng");
const submitButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Dời cửa sổ giao" });

describe("Bằng chứng — mặc định là tệp", () => {
  it("chọn 'Tệp đính kèm' sẵn, có gợi ý loại / cỡ tệp, chưa có ô mã tin nhắn; nút gửi khoá", async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).getByRole("radio", { name: /Tệp đính kèm/ })).toBeChecked();
    expect(
      within(dialog).getByRole("radio", { name: "Tin nhắn chat của khách" }),
    ).not.toBeChecked();
    expect(dialog).toHaveTextContent(
      /PDF, Word, Excel hoặc ảnh JPEG \/ PNG chụp văn bản, tối đa 25 MB/,
    );
    expect(within(dialog).queryByLabelText(/Mã tin nhắn của khách/)).not.toBeInTheDocument();
    expect(submitButton(dialog)).toBeDisabled();
  });

  it("chọn tệp → xin đường tải với đúng khai báo (tên, loại, cỡ, SHA-256), PUT đúng headers, rồi 'Đã tải lên'", async () => {
    const { user, post, put, dialog } = await openDialog();
    const file = pdf();
    await user.upload(fileInput(dialog), file);
    expect(await within(dialog).findByText(/Đã tải lên: xac-nhan\.pdf/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      SLOT_PATH,
      { fileName: "xac-nhan.pdf", contentType: "application/pdf", sizeBytes: 3, sha256: ABC },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: "https://bucket.s3.amazonaws.com/incoming/u-1",
        data: file,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
  });

  it("tải xong + điền đủ → gửi evidenceUploadId, KHÔNG có evidenceMessageId; đóng hộp thoại", async () => {
    const { user, post, dialog } = await openDialog();
    await fillRest(user, dialog);
    await user.upload(fileInput(dialog), pdf());
    await within(dialog).findByText(/Đã tải lên/);
    await waitFor(() => expect(submitButton(dialog)).toBeEnabled());
    await user.click(submitButton(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        WINDOW_PATH,
        {
          windowStart: inDays(40),
          windowEnd: inDays(43),
          reasonCode: "CUSTOMER_REQUEST",
          note: "Khách gửi email",
          evidenceUploadId: "u-1",
        },
        expect.anything(),
      ),
    );
    const body = post.mock.calls.find((call) => call[0] === WINDOW_PATH)?.[1] as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty("evidenceMessageId");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Bằng chứng — tiến độ và huỷ", () => {
  it("hiện % tải lên + thanh tiến độ; nút gửi khoá tới khi tải xong", async () => {
    let finish: () => void = () => {};
    const { user, dialog } = await openDialog({
      put: (config) =>
        new Promise((resolve) => {
          config.onUploadProgress?.({ loaded: 2, total: 5 } as never);
          finish = () => resolve({ status: 200 });
        }),
    });
    await fillRest(user, dialog);
    await user.upload(fileInput(dialog), pdf());
    expect(await within(dialog).findByText(/xac-nhan\.pdf — Đang tải lên 40%/)).toBeInTheDocument();
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(submitButton(dialog)).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /Chọn tệp khác/ })).toBeDisabled();
    finish();
    expect(await within(dialog).findByText(/Đã tải lên/)).toBeInTheDocument();
    await waitFor(() => expect(submitButton(dialog)).toBeEnabled());
  });

  it("'Bỏ tệp' sau khi tải xong → không còn bằng chứng, nút gửi khoá lại", async () => {
    const { user, dialog } = await openDialog();
    await fillRest(user, dialog);
    await user.upload(fileInput(dialog), pdf());
    await within(dialog).findByText(/Đã tải lên/);
    await waitFor(() => expect(submitButton(dialog)).toBeEnabled());
    await user.click(within(dialog).getByRole("button", { name: "Bỏ tệp" }));
    expect(within(dialog).queryByText(/Đã tải lên/)).not.toBeInTheDocument();
    await waitFor(() => expect(submitButton(dialog)).toBeDisabled());
  });

  it("đóng hộp thoại khi đang tải → huỷ lần PUT (signal bị abort)", async () => {
    let signal: AbortSignal | undefined;
    const { user, dialog } = await openDialog({
      put: (config) => {
        signal = config.signal;
        return new Promise(() => {});
      },
    });
    await user.upload(fileInput(dialog), pdf());
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal?.aborted).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(signal?.aborted).toBe(true);
  });

  it("chọn tệp khác giữa chừng → tệp cũ bị huỷ, chỉ tệp mới được gắn", async () => {
    const signals: AbortSignal[] = [];
    let n = 0;
    const { user, dialog } = await openDialog({
      slot: () => slot(`u-${++n}`),
      put: (config) => {
        if (config.signal) signals.push(config.signal);
        return signals.length === 1 ? new Promise(() => {}) : Promise.resolve({ status: 200 });
      },
    });
    await user.upload(fileInput(dialog), pdf("cu.pdf"));
    await waitFor(() => expect(signals).toHaveLength(1));
    // Nút "Chọn tệp khác" khoá khi đang tải; người dùng bỏ tệp rồi chọn lại
    await user.click(within(dialog).getByRole("button", { name: "Bỏ tệp" }));
    expect(signals[0]?.aborted).toBe(true);
    await user.upload(fileInput(dialog), pdf("moi.pdf"));
    expect(await within(dialog).findByText(/Đã tải lên: moi\.pdf/)).toBeInTheDocument();
  });
});

describe("Bằng chứng — lỗi bằng tiếng Việt, không toast", () => {
  it("loại tệp không được nhận (WebP) / quá 25 MB / tệp rỗng → chặn sớm, KHÔNG xin đường tải", async () => {
    const { user, post, dialog } = await openDialog({}, { applyAccept: false });
    await user.upload(fileInput(dialog), new File(["x"], "anh.webp", { type: "image/webp" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /anh\.webp — Loại tệp không được nhận/,
    );
    const big = new File(["x"], "lon.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    await user.upload(fileInput(dialog), big);
    expect(
      await within(dialog).findByText(/lon\.pdf — Tệp quá lớn — tối đa 25 MB/),
    ).toBeInTheDocument();
    await user.upload(fileInput(dialog), new File([], "rong.pdf", { type: "application/pdf" }));
    expect(await within(dialog).findByText(/rong\.pdf — Tệp trống/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    expect(submitButton(dialog)).toBeDisabled();
  });

  it.each([
    [415, "UNSUPPORTED_MEDIA_TYPE", /Máy chủ không nhận loại tệp này/],
    [413, "PAYLOAD_TOO_LARGE", /Máy chủ từ chối vì tệp quá lớn/],
    [429, "RATE_LIMITED", /quá nhiều tệp trong giờ này/],
    [404, "DELIVERY_BATCH_NOT_FOUND", /Đợt giao không còn nhận được bằng chứng/],
    [403, "FORBIDDEN", /sales-contracts:UPDATE/],
    [503, "STORAGE_ERROR", /Kho lưu trữ tệp tạm thời không dùng được/],
  ])(
    "xin đường tải bị BE từ chối %s %s → câu Việt trong hộp thoại, giữ hộp thoại",
    async (status, code, text) => {
      const { user, dialog } = await openDialog({
        slot: () => {
          throw apiError(status, code);
        },
      });
      await user.upload(fileInput(dialog), pdf());
      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent(text);
      expect(alert).not.toHaveTextContent(/English/);
      expect(submitButton(dialog)).toBeDisabled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );

  it("kho từ chối PUT (hết hạn / chữ ký) → nói chọn lại tệp; chọn lại thì thành công", async () => {
    let attempt = 0;
    const { user, dialog } = await openDialog({
      put: async () => {
        if (++attempt === 1) throw { response: { status: 403 } };
        return { status: 200 };
      },
    });
    await user.upload(fileInput(dialog), pdf());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Kho lưu trữ từ chối tệp/);
    await user.upload(fileInput(dialog), pdf());
    expect(await within(dialog).findByText(/Đã tải lên: xac-nhan\.pdf/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mất mạng khi PUT → 'Không kết nối được — kiểm tra mạng'", async () => {
    const { user, dialog } = await openDialog({
      put: async () => {
        throw new Error("Network Error");
      },
    });
    await user.upload(fileInput(dialog), pdf());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/kiểm tra mạng/);
  });
});

describe("Bằng chứng — đúng MỘT loại, và lỗi khi gắn tệp", () => {
  it("đã tải tệp rồi đổi sang tin nhắn chat → chỉ gửi evidenceMessageId (không kèm evidenceUploadId)", async () => {
    const { user, post, dialog } = await openDialog();
    await fillRest(user, dialog);
    await user.upload(fileInput(dialog), pdf());
    await within(dialog).findByText(/Đã tải lên/);
    await user.click(within(dialog).getByRole("radio", { name: "Tin nhắn chat của khách" }));
    expect(within(dialog).queryByLabelText("Tệp bằng chứng")).not.toBeInTheDocument();
    // Chưa nhập mã tin nhắn → chưa gửi được dù đã có tệp
    await waitFor(() => expect(submitButton(dialog)).toBeDisabled());
    await user.type(within(dialog).getByLabelText(/Mã tin nhắn của khách/), CONSENT_MESSAGE);
    await waitFor(() => expect(submitButton(dialog)).toBeEnabled());
    await user.click(submitButton(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(WINDOW_PATH, expect.anything(), expect.anything()),
    );
    const body = post.mock.calls.find((call) => call[0] === WINDOW_PATH)?.[1] as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ evidenceMessageId: CONSENT_MESSAGE });
    expect(body).not.toHaveProperty("evidenceUploadId");
  });

  it.each([
    [415, "UNSUPPORTED_MEDIA_TYPE", /Nội dung tệp bằng chứng không đúng loại tệp/],
    [400, "VALIDATION_FAILED", /tệp đã tải lên đầy đủ/],
    [409, "CONFLICT", /đang được gắn ở một yêu cầu khác/],
  ])("BE từ chối lúc gắn tệp %s %s → câu Việt", async (status, code, text) => {
    const { user, dialog } = await openDialog({
      change: () => {
        throw apiError(status, code);
      },
    });
    await fillRest(user, dialog);
    await user.upload(fileInput(dialog), pdf());
    await within(dialog).findByText(/Đã tải lên/);
    await waitFor(() => expect(submitButton(dialog)).toBeEnabled());
    await user.click(submitButton(dialog));
    // 400 / 415 giữ hộp thoại (alert trong hộp thoại); 409 là dữ liệu cũ → đóng + toast
    if (status === 409) {
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    } else {
      expect(await within(dialog).findByText(text)).toBeInTheDocument();
    }
  });
});
