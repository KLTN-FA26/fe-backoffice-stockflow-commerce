import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { focusManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { QuoteEdit } from "..";
import {
  CUSTOMER,
  CUSTOMER_ID,
  QUOTE_ACCEPTED,
  QUOTE_DRAFT_PLATE_UNPRICED,
  QUOTE_ID,
  SKU,
} from "../__fixtures__/quote-ds02";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Detail queries stay fresh for 60 s: let the clock pass, then focus the window like a returning tab. */
function refocusAfterAMinute() {
  vi.setSystemTime(Date.now() + 61_000);
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

const detailUrl = `/quotes/${QUOTE_ID}`;
const SAVED_TERMS = "Điều khoản do người khác vừa lưu.";
const opened = { ...QUOTE_DRAFT_PLATE_UNPRICED, fees: QUOTE_ACCEPTED.fees, version: 2 };
const newer = { ...opened, terms: SAVED_TERMS, version: 3 };
const skus = [
  {
    variantId: "v1",
    productId: "p1",
    sku: SKU,
    name: "Ly 12oz xanh",
    ownerCustomerId: CUSTOMER_ID,
    status: "ACTIVE",
  },
];

function renderEdit(current: () => unknown, put: Record<string, () => unknown> = {}) {
  const api = mockApi("SALES_STAFF", {
    get: {
      [detailUrl]: current,
      [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      "/customer-skus": () => skus,
      [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => null,
    },
    put,
  });
  renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
  return api;
}

describe("WF-02 N2 — form báo giá cũ không ghi đè bản mới", () => {
  it("bản mới về khi đang sửa → cảnh báo, nút Lưu khoá, không gọi PUT", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let current: unknown = opened;
    const api = renderEdit(() => current);
    const terms = await screen.findByLabelText("Điều khoản");
    await userEvent.clear(terms);
    await userEvent.type(terms, "Điều khoản của tôi");
    current = newer;
    refocusAfterAMinute();
    expect(await screen.findByText(/vừa được người khác lưu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu báo giá" })).toBeDisabled();
    expect(screen.getByLabelText("Điều khoản")).toHaveValue("Điều khoản của tôi");
    expect(api.put).not.toHaveBeenCalled();
  });

  it("bấm Tải lại → form mang giá trị bản mới, Lưu gửi version mới", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let current: unknown = opened;
    const api = renderEdit(() => current, { [detailUrl]: () => newer });
    await screen.findByLabelText("Điều khoản");
    current = newer;
    refocusAfterAMinute();
    await userEvent.click(await screen.findByRole("button", { name: "Tải lại theo bản mới" }));
    expect(screen.getByLabelText("Điều khoản")).toHaveValue(SAVED_TERMS);
    expect(screen.queryByText(/vừa được người khác lưu/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lưu báo giá" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect((api.put.mock.calls[0]?.[1] as { version: number }).version).toBe(3);
  });

  it("PUT 409 OPTIMISTIC_LOCK → không tự gửi lại, cảnh báo hiện", async () => {
    let current: unknown = opened;
    const api = renderEdit(() => current, {
      [detailUrl]: () => {
        current = newer; // lần tải lại sau 409 mang version mới
        throw apiError(409, "OPTIMISTIC_LOCK");
      },
    });
    await screen.findByLabelText("Điều khoản");
    await userEvent.click(screen.getByRole("button", { name: "Lưu báo giá" }));
    expect(await screen.findByText(/vừa được người khác sửa/)).toBeInTheDocument();
    expect(await screen.findByText(/vừa được người khác lưu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu báo giá" })).toBeDisabled();
    expect(api.put).toHaveBeenCalledTimes(1);
  });
});

describe("WF-02 mục 24 / N8 — QUOTE_BELOW_MOQ gắn về ô số thùng của dòng", () => {
  it("details.lineNo → lỗi ở ô Số thùng của dòng đó, câu BE hiện nguyên văn", async () => {
    const message = "Dòng 1: 60 thùng thấp hơn MOQ 100 thùng.";
    renderEdit(() => opened, {
      [detailUrl]: () => {
        throw apiError(409, "QUOTE_BELOW_MOQ", undefined, message, {
          lineNo: 1,
          sku: SKU,
          cartons: 60,
          moq: 100,
        });
      },
    });
    await screen.findByLabelText("Điều khoản");
    await userEvent.click(screen.getByRole("button", { name: "Lưu báo giá" }));
    const cartons = await screen.findByLabelText(/Số thùng/);
    await waitFor(() => expect(cartons).toBeInvalid());
    expect(within(cartons.closest("div") as HTMLElement).getByText(message)).toBeInTheDocument();
  });
});
