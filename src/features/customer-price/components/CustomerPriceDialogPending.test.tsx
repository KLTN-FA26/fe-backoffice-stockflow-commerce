/**
 * Dialog bảng giá khi POST / PUT ĐANG CHẠY (Step 5B.5): mọi lối đóng (Esc, bấm nền, Huỷ) bị bỏ qua, không
 * hỏi bỏ bản nháp, không gửi lại; có kết quả thì hành vi thường quay lại. Request được giữ bằng Promise
 * do test tự mở (không dùng hẹn giờ); "thả" thì chuyển tiếp sang mock adapter thật nên thành công /
 * CONFLICT / OPTIMISTIC_LOCK đúng như route Step 4B.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_PRICE_ERROR_MESSAGES as E,
  CUSTOMER_PRICE_PERMISSIONS as P,
  CUSTOMER_PRICE_UI_LABELS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  PRICED_CUSTOMER as A,
  UNPRICED_CUSTOMER as C,
  resetCustomerPriceMockStore,
} from "@/lib/api/mock-customer-price-store";
import { resetCustomerMockStore } from "@/lib/api/mock-customer-store";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { toast } from "@/components/shared/Toast";

import { renderCustomerPrices, stubPermissions } from "../__fixtures__/render";
import { updateCustomerPrice } from "../api";
import { CustomerPriceList } from "./CustomerPriceList";

const L = CUSTOMER_PRICE_UI_LABELS;
const F = L.form;
const EDITOR = [P.viewPage, P.read, P.create, P.update];
const SKU = "SKU-001-BLK-L";
const FREE_SKU = "SKU-001-WHT-L";
const PRICES = "/catalog/customer-prices/";

vi.setConfig({ testTimeout: 30_000 });
const WAIT = { timeout: 5_000 };

// `post` / `put` gốc (đi qua mock adapter) — lấy trước mọi spy
const realPost = api.post.bind(api);
const realPut = api.put.bind(api);

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetCustomerMockStore();
  resetCustomerPriceMockStore();
  resetVariantMockStore();
});
afterEach(() => vi.restoreAllMocks());

type User = ReturnType<typeof userEvent.setup>;
const setupUser = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
const render = (search: string) => renderCustomerPrices(<CustomerPriceList />, search);
const qty = (row: number) => screen.getByLabelText(`${F.tierLabel(row)} — ${L.field.minQuantity}`);
const price = (row: number) => screen.getByLabelText(`${F.tierLabel(row)} — ${L.field.unitPrice}`);
const dialog = () => screen.queryByRole("dialog");
const overlay = () => document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
const cancel = () => screen.getByRole("button", { name: "Huỷ" });

/**
 * Giữ lời gọi POST / PUT bảng giá kế tiếp tới khi test gọi `release()` (chuyển sang adapter thật) hoặc
 * `fail(e)`. Các lời gọi khác (và lời gọi sau đó) đi thẳng adapter.
 */
function hold(method: "post" | "put") {
  const real = method === "post" ? realPost : realPut;
  const calls: string[] = [];
  let release: () => void = () => undefined;
  let fail: (e: unknown) => void = () => undefined;
  let held = false;
  vi.spyOn(api, method).mockImplementation((url: string, body?: unknown, config?: unknown) => {
    if (!url.startsWith(PRICES)) return real(url, body, config as never);
    calls.push(url);
    if (held) return real(url, body, config as never);
    held = true;
    return new Promise((resolve, reject) => {
      release = () => void real(url, body, config as never).then(resolve, reject);
      fail = reject;
    });
  });
  return { calls, release: () => release(), fail: (e: unknown) => fail(e) };
}

/** Thử từng lối đóng khi đang lưu; SAU MỖI lối: dialog còn, không hỏi bỏ bản nháp, không gửi lại. */
async function tryEveryDismissal(user: User, sent: string[]) {
  const stillSaving = () => {
    expect(dialog()).toBeInTheDocument();
    expect(screen.queryByText(F.discardTitle)).toBeNull();
    expect(screen.getByRole("button", { name: F.saving })).toBeDisabled();
    expect(sent).toHaveLength(1);
  };
  await user.keyboard("{Escape}");
  stillSaving();
  const backdrop = overlay();
  expect(backdrop).not.toBeNull();
  if (backdrop) await user.click(backdrop);
  stillSaving();
  expect(cancel()).toBeDisabled();
  await user.click(cancel());
  stillSaving();
  await user.click(screen.getByRole("button", { name: F.saving }));
  stillSaving();
}

async function startCreate(user: User, sku = FREE_SKU) {
  await user.click(await screen.findByRole("button", { name: F.create }, WAIT));
  await screen.findByRole("dialog");
  await user.type(screen.getByLabelText(F.sku), sku);
  await user.type(qty(1), "1");
  await user.type(price(1), "1000");
  await user.click(screen.getByRole("button", { name: F.save }));
  await screen.findByRole("button", { name: F.saving });
}

async function startEdit(user: User, newPrice = "88000") {
  await user.click(await screen.findByRole("button", { name: F.editRow(SKU) }, WAIT));
  await waitFor(() => expect(price(1)).toBeInTheDocument(), WAIT);
  await user.clear(price(1));
  await user.type(price(1), newPrice);
  await user.click(screen.getByRole("button", { name: F.save }));
  await screen.findByRole("button", { name: F.saving });
}

describe("5B.5 tạo — đang POST", () => {
  it("1 + 2 + 3 + 4 Esc / bấm nền / Huỷ / Lưu lại khi đang lưu → bỏ qua; thả request → thành công thường, một toast", async () => {
    stubPermissions(EDITOR);
    const success = vi.spyOn(toast, "success");
    const post = hold("post");
    render(`customerId=${C}`);
    const user = setupUser();
    await startCreate(user);
    await tryEveryDismissal(user, post.calls);
    expect(screen.getByLabelText(F.sku)).toHaveValue(FREE_SKU);

    post.release();
    await waitFor(() => expect(dialog()).toBeNull(), WAIT);
    expect(screen.queryByText(F.discardTitle)).toBeNull();
    expect(post.calls).toHaveLength(1);
    expect(success).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith(F.saved);
  });

  it("7 + 8 POST lỗi → giữ dialog + bản nháp + báo lỗi; lối đóng mở lại và hỏi bỏ bản nháp như thường", async () => {
    stubPermissions(EDITOR);
    const post = hold("post");
    render(`customerId=${C}`);
    const user = setupUser();
    await startCreate(user);
    await user.keyboard("{Escape}");
    post.fail(new ApiError(503, "SERVICE_UNAVAILABLE", "down"));
    expect(await screen.findByText(E.unexpected, {}, WAIT)).toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
    expect(screen.queryByText(F.discardTitle)).toBeNull();
    expect(screen.getByLabelText(F.sku)).toHaveValue(FREE_SKU);
    expect(price(1)).toHaveValue("1000");
    expect(cancel()).toBeEnabled();

    await user.keyboard("{Escape}");
    expect(await screen.findByText(F.discardTitle)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: F.keepEditing }));
    await waitFor(() => expect(screen.queryByText(F.discardTitle)).toBeNull());
    const backdrop = overlay();
    if (backdrop) await user.click(backdrop);
    expect(await screen.findByText(F.discardTitle)).toBeInTheDocument();
    expect(post.calls).toHaveLength(1);
  });

  it("10 POST bị giữ rồi trả 409 CONFLICT → nút mở bản có sẵn + hộp hỏi của 5B.4 vẫn chạy", async () => {
    stubPermissions(EDITOR);
    const post = hold("post");
    render(`customerId=${A}`);
    const user = setupUser();
    await startCreate(user, SKU);
    await user.keyboard("{Escape}");
    expect(screen.queryByText(F.discardTitle)).toBeNull();
    post.release();
    expect(await screen.findByText(E.CONFLICT, {}, WAIT)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: F.conflictOpenExisting(SKU) }));
    expect(await screen.findByText(F.openExistingTitle(SKU))).toBeInTheDocument();
    expect(screen.getByText(F.createTitle)).toBeInTheDocument();
  });
});

describe("5B.5 sửa — đang PUT", () => {
  it("5 + 6 Esc / bấm nền / Huỷ khi đang lưu → bỏ qua; thả request → lưu xong như thường, một toast", async () => {
    stubPermissions(EDITOR);
    const success = vi.spyOn(toast, "success");
    const put = hold("put");
    render(`customerId=${A}`);
    const user = setupUser();
    await startEdit(user);
    await tryEveryDismissal(user, put.calls);
    expect(price(1)).toHaveValue("88000");

    put.release();
    await waitFor(() => expect(dialog()).toBeNull(), WAIT);
    expect(screen.queryByText(F.discardTitle)).toBeNull();
    expect(put.calls).toEqual([`${PRICES}${A}/${SKU}`]);
    expect(success).toHaveBeenCalledTimes(1);
  });

  it("9 PUT lỗi → giữ bản nháp + báo lỗi; Esc sau đó hỏi bỏ bản nháp như thường", async () => {
    stubPermissions(EDITOR);
    const put = hold("put");
    render(`customerId=${A}`);
    const user = setupUser();
    await startEdit(user);
    put.fail(new Error("Network Error"));
    expect(await screen.findByText(E.unexpected, {}, WAIT)).toBeInTheDocument();
    expect(price(1)).toHaveValue("88000");
    await user.keyboard("{Escape}");
    expect(await screen.findByText(F.discardTitle)).toBeInTheDocument();
  });

  it("11 PUT bị giữ rồi trả 409 OPTIMISTIC_LOCK → giữ bản nháp, tải lại của 5B.3 vẫn chạy sau khi request xong", async () => {
    stubPermissions(EDITOR);
    render(`customerId=${A}`);
    const user = setupUser();
    await user.click(await screen.findByRole("button", { name: F.editRow(SKU) }, WAIT));
    await waitFor(() => expect(price(1)).toBeInTheDocument(), WAIT);
    // người khác lưu trước (qua route mock thật): server lên version 3
    await updateCustomerPrice({
      customerId: A,
      sku: SKU,
      version: 2,
      values: { tiers: [{ minQuantity: 20, unitPrice: "70000" }], note: null },
    });
    const put = hold("put");
    await user.clear(price(1));
    await user.type(price(1), "88000");
    await user.click(screen.getByRole("button", { name: F.save }));
    await screen.findByRole("button", { name: F.saving });
    await user.keyboard("{Escape}");
    expect(screen.queryByText(F.discardTitle)).toBeNull();
    put.release();
    expect(await screen.findByText(E.OPTIMISTIC_LOCK, {}, WAIT)).toBeInTheDocument();
    expect(price(1)).toHaveValue("88000");
    await user.click(screen.getByRole("button", { name: F.reload }));
    await waitFor(() => expect(qty(1)).toHaveValue("20"), WAIT);
    expect(put.calls).toHaveLength(1);
  });
});

/**
 * 5B.5a — khe thời gian ĐẦU lần lưu: TanStack báo trạng thái mutation cho React qua `setTimeout(0)`
 * (`notifyManager`), còn `mutationFn` (→ `api.post` / `api.put`) chạy trong microtask ngay sau `mutate()`.
 * Thao tác đóng được bắn ĐỒNG BỘ ngay trong lời gọi API — lúc request đã bắt đầu nhưng React chưa render
 * trạng thái đang lưu (nút Lưu còn bật) — không chờ chỉ báo "Đang lưu…".
 */
describe("5B.5a đóng dialog ngay lúc request vừa bắt đầu", () => {
  const escape = () =>
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  // Radix hoãn "bấm ra ngoài" tới `click` của cùng cú bấm (deferPointerDownOutside) → bắn đủ cặp
  const pointerOnOverlay = () => {
    const backdrop = overlay();
    if (!backdrop) throw new Error("no overlay");
    fireEvent.pointerDown(backdrop, { button: 0 });
    fireEvent.click(backdrop, { button: 0 });
  };

  /** Giữ request kế tiếp; NGAY khi nó bắt đầu thì chạy `dismiss` (đồng bộ, trước mọi render). */
  function dismissOnStart(method: "post" | "put", dismiss: () => void) {
    const real = method === "post" ? realPost : realPut;
    const calls: string[] = [];
    const seen = { saveEnabledAtStart: false };
    let release: () => void = () => undefined;
    vi.spyOn(api, method).mockImplementation((url: string, body?: unknown, config?: unknown) => {
      if (!url.startsWith(PRICES)) return real(url, body, config as never);
      calls.push(url);
      seen.saveEnabledAtStart = !screen
        .getByRole("button", { name: F.save })
        .hasAttribute("disabled");
      dismiss();
      return new Promise((resolve, reject) => {
        release = () => void real(url, body, config as never).then(resolve, reject);
      });
    });
    return { calls, seen, release: () => release() };
  }

  async function fillCreate(user: User) {
    await user.click(await screen.findByRole("button", { name: F.create }, WAIT));
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText(F.sku), FREE_SKU);
    await user.type(qty(1), "1");
    await user.type(price(1), "1000");
  }

  it.each([
    ["Esc", escape],
    ["bấm nền", pointerOnOverlay],
  ])(
    "tạo: %s ngay khi POST bắt đầu → không đóng, không hỏi bỏ bản nháp; xong thì đóng như thường",
    async (_label, dismiss) => {
      stubPermissions(EDITOR);
      const success = vi.spyOn(toast, "success");
      const post = dismissOnStart("post", dismiss);
      render(`customerId=${C}`);
      const user = setupUser();
      await fillCreate(user);
      await user.click(screen.getByRole("button", { name: F.save }));
      await waitFor(() => expect(post.calls).toHaveLength(1), WAIT);
      // bằng chứng thao tác đóng rơi đúng vào khe: lúc request bắt đầu, nút Lưu chưa bị khoá
      expect(post.seen.saveEnabledAtStart).toBe(true);
      await screen.findByRole("button", { name: F.saving });
      expect(screen.queryByText(F.discardTitle)).toBeNull();
      expect(dialog()).toBeInTheDocument();
      expect(screen.getByLabelText(F.sku)).toHaveValue(FREE_SKU);

      post.release();
      await waitFor(() => expect(dialog()).toBeNull(), WAIT);
      expect(screen.queryByText(F.discardTitle)).toBeNull();
      expect(post.calls).toHaveLength(1);
      expect(success).toHaveBeenCalledTimes(1);
    },
  );

  it("sửa: Esc ngay khi PUT bắt đầu → không đóng, không hỏi; xong thì đóng như thường", async () => {
    stubPermissions(EDITOR);
    const put = dismissOnStart("put", escape);
    render(`customerId=${A}`);
    const user = setupUser();
    await user.click(await screen.findByRole("button", { name: F.editRow(SKU) }, WAIT));
    await waitFor(() => expect(price(1)).toBeInTheDocument(), WAIT);
    await user.clear(price(1));
    await user.type(price(1), "88000");
    await user.click(screen.getByRole("button", { name: F.save }));
    await waitFor(() => expect(put.calls).toHaveLength(1), WAIT);
    expect(put.seen.saveEnabledAtStart).toBe(true);
    await screen.findByRole("button", { name: F.saving });
    expect(screen.queryByText(F.discardTitle)).toBeNull();
    expect(dialog()).toBeInTheDocument();

    put.release();
    await waitFor(() => expect(dialog()).toBeNull(), WAIT);
    expect(screen.queryByText(F.discardTitle)).toBeNull();
    expect(put.calls).toHaveLength(1);
  });

  it("kiểm lỗi phía form (chưa gửi gì) → không khoá dialog: Esc vẫn hỏi bỏ bản nháp", async () => {
    stubPermissions(EDITOR);
    const post = vi.spyOn(api, "post");
    render(`customerId=${C}`);
    const user = setupUser();
    await user.click(await screen.findByRole("button", { name: F.create }, WAIT));
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText(F.sku), "sku with spaces");
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(await screen.findByText(F.discardTitle)).toBeInTheDocument();
    expect(post.mock.calls.filter(([url]) => String(url).startsWith(PRICES))).toHaveLength(0);
  });
});
