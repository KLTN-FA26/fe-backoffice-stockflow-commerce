import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { ChatConversationScreen, ChatInbox } from "..";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  conversation,
  customerText,
  messagePage,
  overview,
  quoteRequestCard,
} from "../__fixtures__/chat";
import { chatErrorMessage } from "../mutations";

import type { PermissionCode } from "@/lib/auth";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const READ: PermissionCode = "customer-sales-owners:READ";
const BASE = `/chat/conversations/${CONVERSATION_ID}`;
const OWNER_URL = `/customers/${CUSTOMER_ID}/sales-owner`;
const OTHER_NAME = "Trần Văn Sales";
const BLOCKED = `Khách này do ${OTHER_NAME} phụ trách. Nhờ ${OTHER_NAME} hoặc Sales Manager.`;
const owned = (salesOwnerId: string) => ({
  customerId: CUSTOMER_ID,
  salesOwnerId,
  salesOwnerName: OTHER_NAME,
  active: true,
  state: "ASSIGNED",
});
const unowned = { customerId: CUSTOMER_ID, state: "UNASSIGNED" };
const queued = {
  ...conversation,
  status: "QUEUED",
  nextStatuses: ["ASSIGNED"],
  assignedAgentId: undefined,
  assignedAgentName: undefined,
};

function renderThread(
  conv: unknown,
  ownerRoute: () => unknown,
  post: Record<string, () => unknown> = {},
  messages: unknown[] = [customerText],
) {
  const api = mockApi(
    "SALES_STAFF",
    {
      get: {
        [BASE]: () => conv,
        [`${BASE}/messages`]: () => messagePage(messages),
        [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview,
        [OWNER_URL]: ownerRoute,
      },
      post,
    },
    { extra: [READ] },
  );
  renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
  return api;
}

describe("Chat — Sale phụ trách khách (KE-HOACH BR-S05, BR-S12)", () => {
  it("§6: the inbox row shows the customer's owner", async () => {
    mockApi(
      "SALES_STAFF",
      {
        get: {
          "/chat/conversations": () => bePage([conversation]),
          "/chat/unread-count": () => ({ conversations: 0, messages: 0, queued: 0 }),
          [OWNER_URL]: () => owned("someone"),
        },
      },
      { extra: [READ] },
    );
    renderScreen(<ChatInbox />, "SALES_STAFF");
    expect(await screen.findByText(`Sale phụ trách: ${OTHER_NAME}`)).toBeInTheDocument();
  });

  it("BR-S05: a queued conversation of an unowned customer reads 'Chưa có Sale phụ trách'", async () => {
    mockApi(
      "SALES_STAFF",
      {
        get: {
          "/chat/conversations": () => bePage([queued]),
          "/chat/unread-count": () => ({ conversations: 0, messages: 0, queued: 1 }),
          [OWNER_URL]: () => unowned,
        },
      },
      { extra: [READ] },
    );
    renderScreen(<ChatInbox />, "SALES_STAFF", "?scope=unassigned");
    expect(await screen.findByText("Chưa có Sale phụ trách")).toBeInTheDocument();
  });

  it("fallback: the inbox renders as before when the owner endpoint is missing", async () => {
    mockApi(
      "SALES_STAFF",
      {
        get: {
          "/chat/conversations": () => bePage([conversation]),
          "/chat/unread-count": () => ({ conversations: 0, messages: 0, queued: 0 }),
          [OWNER_URL]: () => {
            throw apiError(404, "NOT_FOUND");
          },
        },
      },
      { extra: [READ] },
    );
    renderScreen(<ChatInbox />, "SALES_STAFF");
    expect(await screen.findByText("Báo giá ly logo xanh")).toBeInTheDocument();
    expect(screen.queryByText(/Sale phụ trách/)).not.toBeInTheDocument();
  });

  it("§6: the thread shows the customer's owner", async () => {
    renderThread(conversation, () => owned("someone"));
    expect(await screen.findByText(`Sale phụ trách: ${OTHER_NAME}`)).toBeInTheDocument();
  });

  it("BR-S05: 'Nhận hội thoại' of an unowned customer says it makes you the owner", async () => {
    renderThread(queued, () => unowned);
    const claim = await screen.findByRole("button", { name: "Nhận hội thoại" });
    expect(
      await screen.findByText("Nhận hội thoại thì bạn thành Sale phụ trách của khách này."),
    ).toBeInTheDocument();
    expect(claim).toBeEnabled();
  });

  it("BR-S05 / case 18: a queued conversation of a customer owned by someone else cannot be claimed", async () => {
    renderThread(queued, () => owned("someone"));
    const claim = await screen.findByRole("button", { name: "Nhận hội thoại" });
    await waitFor(() => expect(claim).toBeDisabled());
    const reason = `Khách này do ${OTHER_NAME} phụ trách nên không nhận được hội thoại. Nhờ ${OTHER_NAME} hoặc Sales Manager.`;
    expect(claim).toHaveAttribute("title", reason);
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  it("BR-S05: BE 409 CUSTOMER_UNASSIGNED_CLAIM_ONLY on claim → the Vietnamese sentence", async () => {
    const toastError = vi.spyOn(toast, "error");
    renderThread(
      queued,
      () => {
        throw apiError(404, "NOT_FOUND");
      },
      {
        [`${BASE}/claim`]: () => {
          throw apiError(409, "CUSTOMER_UNASSIGNED_CLAIM_ONLY", undefined, "x", {
            salesOwnerName: OTHER_NAME,
          });
        },
      },
    );
    await userEvent.click(await screen.findByRole("button", { name: "Nhận hội thoại" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        `Khách này do ${OTHER_NAME} phụ trách nên không nhận được hội thoại. Nhờ ${OTHER_NAME} hoặc Sales Manager.`,
      ),
    );
  });

  it("BR-S12: 'Lập báo giá' from a request card is off for another Sales' customer, with the reason", async () => {
    renderThread(
      { ...conversation, assignedAgentId: "u-test", assignedAgentName: "Test" },
      () => owned("someone"),
      {},
      [quoteRequestCard(["CREATE_QUOTE"]), customerText],
    );
    const button = await screen.findByRole("button", { name: /Lập báo giá/ });
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getAllByText(BLOCKED).length).toBeGreaterThan(0);
  });

  it("BR-S12: chatErrorMessage maps CUSTOMER_OWNED_BY_OTHER_SALES with the known owner", () => {
    expect(chatErrorMessage(apiError(409, "CUSTOMER_OWNED_BY_OTHER_SALES"), OTHER_NAME)).toBe(
      BLOCKED,
    );
  });
});

describe("Mở hội thoại mới — khách của Sale khác (BR-S12)", () => {
  const MOC_AN = {
    customerId: CUSTOMER_ID,
    fullName: "Công ty Mộc An",
    email: "mua@mocan.vn",
    taxCode: "0312345678",
    status: "ACTIVE",
  };

  function renderInbox(ownerRoute: () => unknown) {
    const spy = mockApi(
      "SALES_STAFF",
      {
        get: {
          "/chat/conversations": () => bePage([]),
          "/customers": () => bePage([MOC_AN]),
          [`/customers/${CUSTOMER_ID}`]: () => MOC_AN,
          [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview,
          "/chat/unread-count": () => ({ conversations: 0, messages: 0, queued: 0 }),
          [OWNER_URL]: ownerRoute,
        },
        post: { "/chat/conversations": () => ({ ...conversation, id: "new-conv" }) },
      },
      { extra: [READ] },
    );
    renderScreen(<ChatInbox />, "SALES_STAFF");
    return spy;
  }

  async function pickCustomer() {
    await userEvent.click(await screen.findByRole("button", { name: /Mở hội thoại mới/ }));
    const box = await screen.findByRole("combobox", { name: "Khách hàng" });
    await userEvent.type(box, "Mộc");
    await userEvent.click(await screen.findByRole("option", { name: /Công ty Mộc An/ }));
  }

  it("BR-S12: another Sales' customer → the open button is off and the reason is shown", async () => {
    const spy = renderInbox(() => owned("someone"));
    await pickCustomer();
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(BLOCKED)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Mở hội thoại" })).toBeDisabled();
    expect(spy.post).not.toHaveBeenCalled();
  });

  it("BR-S12: the owner opens the conversation as before", async () => {
    renderInbox(() => owned("u-test"));
    await pickCustomer();
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mở hội thoại" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
  });
});
