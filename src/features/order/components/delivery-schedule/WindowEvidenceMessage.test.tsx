/**
 * Dời cửa sổ giao — bằng chứng khách đồng ý là TIN NHẮN của khách (docs 17 BR-28; BE
 * `GET …/window-change/evidence/messages` → chọn một tin → `evidenceMessageId` trong `POST …/window-change`): ô chọn là
 * `InputCombobox` (không bắt gõ mã), mỗi dòng nội dung + giờ gửi, chỉ gửi đúng một loại bằng chứng.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { openComboboxList } from "@/test/combobox";
import { pickDate } from "@/test/date-picker";

import { openOrderDetailTabInFile, pickOrderSelectOption } from "../../__fixtures__/render";
import {
  BATCH_2,
  SCHEDULE_PATH,
  WF4_PERMISSION_SETS,
  apiBatch,
  apiSchedule,
  callsTo,
  inDays,
  renderWf4Detail,
} from "../../__fixtures__/wf4";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const WINDOW_PATH = `${SCHEDULE_PATH}/${BATCH_2}/window-change`;
const MESSAGES_PATH = `${WINDOW_PATH}/evidence/messages`;
const NEWEST = "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c21";
const OLDER = "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c22";
const FILE_ONLY = "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c23";

const messages = [
  {
    messageId: NEWEST,
    kind: "TEXT",
    text: "Bên em đồng ý nhận đợt 2 sớm, giao giúp em đầu tuần sau",
    subject: "Lịch giao đợt 2",
    sentAt: "2026-11-27T03:15:00Z",
  },
  { messageId: FILE_ONLY, kind: "ATTACHMENT", sentAt: "2026-11-26T09:00:00Z" },
  {
    messageId: OLDER,
    kind: "TEXT",
    text: "Cho em hỏi giá in thêm màu",
    sentAt: "2026-11-20T02:00:00Z",
  },
];

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

type User = ReturnType<typeof userEvent.setup>;

async function openDialog(list: () => unknown = () => messages) {
  const post = vi.spyOn(api, "post").mockImplementation(async (url: string) => {
    if (url === WINDOW_PATH) return { data: schedule() };
    throw new Error(`Không có mock cho POST ${url}`);
  });
  const get = await renderWf4Detail(WF4_PERMISSION_SETS.sales, {
    [SCHEDULE_PATH]: schedule,
    [MESSAGES_PATH]: () => {
      const data = list();
      if (data instanceof Error) throw data;
      return data;
    },
  });
  const user = userEvent.setup();
  const card = await screen.findByRole("region", { name: "Lịch giao" });
  await user.click(
    within(card).getAllByRole("button", { name: "Dời cửa sổ giao" })[1] as HTMLElement,
  );
  return { user, get, post, dialog: await screen.findByRole("dialog") };
}

async function fillRest(user: User, dialog: HTMLElement) {
  await pickDate(user, within(dialog).getByLabelText(/^Từ ngày/), inDays(40));
  await pickDate(user, within(dialog).getByLabelText(/^Đến ngày/), inDays(43));
  await pickOrderSelectOption(user, /Lý do/, /Khách xin dời/);
  await user.type(within(dialog).getByRole("textbox", { name: /Ghi chú/ }), "Khách nhắn đồng ý");
}

const submitButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Dời cửa sổ giao" });
const chooseMessageKind = (user: User, dialog: HTMLElement) =>
  user.click(within(dialog).getByRole("radio", { name: "Tin nhắn của khách" }));

openOrderDetailTabInFile("delivery");

describe("Bằng chứng — tin nhắn của khách", () => {
  it("chỉ tải danh sách khi chọn 'Tin nhắn của khách'; liệt kê mới nhất trước, nội dung + giờ gửi, tin chỉ có tệp có nhãn riêng", async () => {
    const { user, get, dialog } = await openDialog();
    expect(callsTo(get, MESSAGES_PATH)).toBe(0);
    await chooseMessageKind(user, dialog);
    await waitFor(() => expect(callsTo(get, MESSAGES_PATH)).toBeGreaterThan(0));
    await openComboboxList(user, "Tin nhắn khách đã đồng ý");
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent(/Bên em đồng ý nhận đợt 2 sớm/);
    expect(options[0]).toHaveTextContent(/Lịch giao đợt 2/);
    expect(options[1]).toHaveTextContent("Tệp khách gửi trong chat");
    expect(options[2]).toHaveTextContent(/Cho em hỏi giá in thêm màu/);
    // Không bao giờ hiện mã tin nhắn
    expect(document.body.textContent).not.toContain(NEWEST);
    expect(within(dialog).queryByLabelText(/Mã tin nhắn/)).not.toBeInTheDocument();
  });

  it("gõ để tìm; chọn một tin → ô giữ nội dung tin; gửi evidenceMessageId và KHÔNG gửi evidenceUploadId", async () => {
    const { user, post, dialog } = await openDialog();
    await fillRest(user, dialog);
    await chooseMessageKind(user, dialog);
    expect(submitButton(dialog)).toBeDisabled();
    const input = await within(dialog).findByRole("combobox", {
      name: "Tin nhắn khách đã đồng ý",
    });
    await user.type(input, "giá in");
    // Khớp tốt nhất lên đầu (cùng luật xếp hạng `limitComboboxOptions` của mọi combobox)
    const ranked = await screen.findAllByRole("option");
    expect(ranked[0]).toHaveTextContent(/Cho em hỏi giá in thêm màu/);
    await user.clear(input);
    await user.type(input, "đồng ý");
    await user.click(await screen.findByRole("option", { name: /Bên em đồng ý nhận đợt 2 sớm/ }));
    await waitFor(() => expect(submitButton(dialog)).toBeEnabled());
    expect(input).toHaveValue("Bên em đồng ý nhận đợt 2 sớm, giao giúp em đầu tuần sau");

    await user.click(submitButton(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        WINDOW_PATH,
        {
          windowStart: inDays(40),
          windowEnd: inDays(43),
          reasonCode: "CUSTOMER_REQUEST",
          note: "Khách nhắn đồng ý",
          evidenceMessageId: NEWEST,
        },
        expect.anything(),
      ),
    );
    const body = post.mock.calls.find((call) => call[0] === WINDOW_PATH)?.[1] as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty("evidenceUploadId");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("khách chưa có tin nào dùng được → nói rõ dưới ô và chỉ sang 'Tệp đính kèm'; nút gửi vẫn khoá", async () => {
    const { user, dialog } = await openDialog(() => []);
    await fillRest(user, dialog);
    await chooseMessageKind(user, dialog);
    expect(await within(dialog).findByText(/Khách chưa có tin nhắn nào dùng được/)).toBeVisible();
    expect(submitButton(dialog)).toBeDisabled();
  });

  it("lỗi tải danh sách → có mục 'Bấm để thử lại' trong ô, không báo lỗi tiếng Anh", async () => {
    const { user, dialog } = await openDialog(() => new ApiError(500, "INTERNAL_ERROR", "Boom"));
    await chooseMessageKind(user, dialog);
    await openComboboxList(user, "Tin nhắn khách đã đồng ý");
    expect(
      await screen.findByRole("option", { name: /Không tải được tin nhắn của khách/ }),
    ).toBeVisible();
    expect(document.body.textContent).not.toContain("Boom");
  });

  it("đổi qua lại giữa tệp và tin nhắn: tin đã chọn giữ nguyên, chỉ loại đang chọn được gửi", async () => {
    const { user, dialog } = await openDialog();
    await chooseMessageKind(user, dialog);
    await openComboboxList(user, "Tin nhắn khách đã đồng ý");
    await user.click(await screen.findByRole("option", { name: /Bên em đồng ý nhận đợt 2 sớm/ }));
    await user.click(within(dialog).getByRole("radio", { name: /Tệp đính kèm/ }));
    expect(within(dialog).getByLabelText("Tệp bằng chứng")).toBeInTheDocument();
    await chooseMessageKind(user, dialog);
    expect(within(dialog).getByRole("combobox", { name: "Tin nhắn khách đã đồng ý" })).toHaveValue(
      "Bên em đồng ý nhận đợt 2 sớm, giao giúp em đầu tuần sau",
    );
  });
});
