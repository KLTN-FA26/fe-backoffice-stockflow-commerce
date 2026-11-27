import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, mockApi, renderScreen } from "@/test/api-screen";
import "@/test/jsdom-popover";

import { QuoteDetail, QuoteEdit } from "..";
import {
  CUSTOMER,
  CUSTOMER_ID,
  QUOTE_ACCEPTED,
  QUOTE_DRAFT_PLATE_UNPRICED,
  QUOTE_ID,
} from "../__fixtures__/quote-ds02";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

/** `renderScreen` đăng nhập "u-test". */
const ME = "u-test";
const OTHER = "aa40c7cb-70b4-2d3a-f730-e2b5a217c662";
const OTHER_NAME = "Trần Văn Sales";
const BLOCKED = `Khách này do ${OTHER_NAME} phụ trách. Nhờ ${OTHER_NAME} hoặc Sales Manager.`;
const READ: PermissionCode = "customer-sales-owners:READ";
const MANAGE: PermissionCode = "customer-sales-owners:UPDATE";
const MORE = "Thao tác khác với báo giá";

const detailUrl = `/quotes/${QUOTE_ID}`;
const ownerUrl = `/customers/${CUSTOMER_ID}/sales-owner`;
const priced = {
  ...QUOTE_DRAFT_PLATE_UNPRICED,
  fees: QUOTE_ACCEPTED.fees,
  priced: true,
  proposed: QUOTE_ACCEPTED.proposed,
};
const revisable = { ...priced, status: "CHANGES_REQUESTED" };

function owner(salesOwnerId: string, extra: Record<string, unknown> = {}) {
  return {
    customerId: CUSTOMER_ID,
    salesOwnerId,
    salesOwnerName: OTHER_NAME,
    active: true,
    state: "ASSIGNED",
    since: "2026-11-20T02:00:00Z",
    version: 1,
    ...extra,
  };
}

function renderDetail(
  quote: unknown,
  ownerRoute: () => unknown,
  extra: readonly PermissionCode[] = [READ],
  post: Record<string, () => unknown> = {},
) {
  const api = mockApi(
    "SALES_STAFF",
    {
      get: {
        [detailUrl]: () => quote,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        [ownerUrl]: ownerRoute,
      },
      post,
    },
    { extra },
  );
  renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
  return api;
}

describe("Quote detail — sales owner, strict mode (KE-HOACH BR-S12)", () => {
  it("BR-S12: another Sales' customer → send / edit / cancel disabled with the reason as tooltip and note", async () => {
    renderDetail(priced, () => owner(OTHER));
    const send = await screen.findByRole("button", { name: /Gửi khách/ });
    await waitFor(() => expect(send).toBeDisabled());
    expect(send).toHaveAttribute("title", BLOCKED);
    expect(screen.getByText(BLOCKED)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: MORE }));
    expect(await screen.findByRole("button", { name: "Sửa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Huỷ báo giá" })).toBeDisabled();
    // Tải PDF không bị chặn.
    expect(screen.getByRole("button", { name: "Tải PDF" })).toBeEnabled();
  });

  it("BR-S12: revise is disabled too for another Sales' customer", async () => {
    renderDetail(revisable, () => owner(OTHER));
    const revise = await screen.findByRole("button", { name: "Mở bản sửa" });
    await waitFor(() => expect(revise).toBeDisabled());
    expect(revise).toHaveAttribute("title", BLOCKED);
  });

  it("BR-S12: converting an accepted quote is not blocked (BE-C: conversion unchanged)", async () => {
    const api = renderDetail(QUOTE_ACCEPTED, () => owner(OTHER));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(ownerUrl, expect.anything()));
    expect(await screen.findByRole("button", { name: "Tạo đơn" })).toBeEnabled();
    // ACCEPTED có "Tạo đơn" và (không có SKU ngừng bán) không có Huỷ → không nút nào bị chặn, không câu lý do.
    expect(screen.queryByText(BLOCKED)).not.toBeInTheDocument();
  });

  it("BR-S12: the owner acts as before — no reason shown", async () => {
    renderDetail(priced, () => owner(ME, { salesOwnerName: "Test" }));
    const send = await screen.findByRole("button", { name: /Gửi khách/ });
    await waitFor(() => expect(send).toBeEnabled());
    expect(screen.queryByText(/phụ trách\. Nhờ/)).not.toBeInTheDocument();
  });

  it("BR-S07: the active cover acts and sees 'Bạn đang lo thay cho …'", async () => {
    renderDetail(priced, () =>
      owner(OTHER, { cover: { userId: ME, name: "Test", until: "2099-12-05" } }),
    );
    expect(
      await screen.findByText(`Bạn đang lo thay cho ${OTHER_NAME} tới 05/12/2099`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi khách/ })).toBeEnabled();
  });

  it("BR-S12: a Sales Manager (customer-sales-owners:UPDATE) acts on any customer", async () => {
    renderDetail(priced, () => owner(OTHER), [READ, MANAGE]);
    const send = await screen.findByRole("button", { name: /Gửi khách/ });
    await waitFor(() => expect(send).toBeEnabled());
    expect(screen.queryByText(BLOCKED)).not.toBeInTheDocument();
  });

  it("BR-S12: a customer with no active owner (NEEDS_ASSIGNMENT) can be worked by any Sales", async () => {
    renderDetail(priced, () => owner(OTHER, { active: false, state: "NEEDS_ASSIGNMENT" }));
    const send = await screen.findByRole("button", { name: /Gửi khách/ });
    await waitFor(() => expect(send).toBeEnabled());
  });

  it("fallback: the owner endpoint answers 404 (BE not deployed) → nothing is blocked", async () => {
    renderDetail(priced, () => {
      throw apiError(404, "NOT_FOUND");
    });
    expect(await screen.findByRole("button", { name: /Gửi khách/ })).toBeEnabled();
    expect(screen.queryByText(/phụ trách\. Nhờ/)).not.toBeInTheDocument();
  });

  it("fallback: without customer-sales-owners:READ the owner is not asked for", async () => {
    const api = renderDetail(priced, () => owner(OTHER), []);
    expect(await screen.findByRole("button", { name: /Gửi khách/ })).toBeEnabled();
    expect(api.get).not.toHaveBeenCalledWith(ownerUrl, expect.anything());
  });

  it("BR-S12: BE 409 CUSTOMER_OWNED_BY_OTHER_SALES → the same Vietnamese sentence, owner name from details", async () => {
    const toastError = vi.spyOn(toast, "error");
    renderDetail(
      priced,
      () => {
        throw apiError(404, "NOT_FOUND");
      },
      [READ],
      {
        [`${detailUrl}/sending`]: () => {
          throw apiError(409, "CUSTOMER_OWNED_BY_OTHER_SALES", undefined, "owned", {
            salesOwnerName: OTHER_NAME,
          });
        },
      },
    );
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Gửi khách" }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(BLOCKED));
  });
});

describe("Quote form — sales owner (BR-S12)", () => {
  it("BR-S12: editing a draft of another Sales' customer → save disabled with the reason", async () => {
    mockApi(
      "SALES_STAFF",
      {
        get: {
          [detailUrl]: () => priced,
          [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
          [ownerUrl]: () => owner(OTHER),
        },
      },
      { extra: [READ] },
    );
    renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
    const save = await screen.findByRole("button", { name: "Lưu báo giá" });
    await waitFor(() => expect(save).toBeDisabled());
    expect(save).toHaveAttribute("title", BLOCKED);
    expect(screen.getByText(BLOCKED)).toBeInTheDocument();
  });

  it("BR-S12: the owner saves as before", async () => {
    mockApi(
      "SALES_STAFF",
      {
        get: {
          [detailUrl]: () => priced,
          [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
          [ownerUrl]: () => owner(ME),
        },
      },
      { extra: [READ] },
    );
    renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
    const save = await screen.findByRole("button", { name: "Lưu báo giá" });
    await waitFor(() => expect(save).toBeEnabled());
  });
});
