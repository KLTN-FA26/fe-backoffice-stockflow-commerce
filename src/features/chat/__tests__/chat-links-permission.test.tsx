import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  conversation,
  overview,
  quoteRequestCard,
} from "../__fixtures__/chat";
import { CustomerPanel } from "../components/CustomerPanel";
import { DocumentCardBody } from "../components/DocumentCardBody";
import { QuoteRequestCardBody } from "../components/QuoteRequestCardBody";
import { chatCardSchema, chatConversationSchema, chatMessageSchema } from "../schemas";

import type { TestRole } from "@/test/api-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const quoteCard = chatCardSchema.parse({
  kind: "QUOTE",
  state: "ACTED",
  payload: {
    quoteId: "q-1",
    number: "QT-1",
    status: "CONVERTED",
    convertedOrderId: "o-1",
    convertedOrderNumber: "SO-1",
  },
});
const contractCard = chatCardSchema.parse({
  kind: "CONTRACT",
  state: "OPEN",
  payload: { number: "HD-1", status: "SENT", orderId: "o-1" },
});

function renderAs(role: TestRole, ui: React.ReactElement) {
  mockApi(role, { get: { [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview } });
  renderScreen(ui, role);
}

// SALES_STAFF: sales-quotes + sales-orders VIEW_PAGE. PRODUCTION_COORDINATOR: neither page.
describe("AUTH-8 — document links only for a viewer who can open the page", () => {
  it("Sale: quote card links the quote and the order it became; contract card links the contract", async () => {
    renderAs(
      "SALES_STAFF",
      <>
        <DocumentCardBody card={quoteCard} />
        <DocumentCardBody card={contractCard} />
      </>,
    );
    expect(await screen.findByRole("link", { name: "Mở báo giá" })).toHaveAttribute(
      "href",
      "/admin/quotes/q-1",
    );
    expect(screen.getByRole("link", { name: "Mở đơn SO-1" })).toHaveAttribute(
      "href",
      "/admin/orders/o-1",
    );
    expect(screen.getByRole("link", { name: "Mở hợp đồng" })).toBeInTheDocument();
  });

  it("no quote / order page: no links, the order number stays as plain text", async () => {
    renderAs(
      "PRODUCTION_COORDINATOR",
      <>
        <DocumentCardBody card={quoteCard} />
        <DocumentCardBody card={contractCard} />
      </>,
    );
    expect(await screen.findByText("Đã lên đơn SO-1")).toBeInTheDocument();
    expect(screen.getByText("QT-1")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("quote request card: the quote number is plain text without the quote page", async () => {
    const message = chatMessageSchema.parse(quoteRequestCard([]));
    const card = chatCardSchema.parse({
      ...message.card,
      payload: { ...message.card?.payload, quoteId: "q-1", quoteNumber: "QT-1" },
    });
    renderAs(
      "PRODUCTION_COORDINATOR",
      <QuoteRequestCardBody
        message={message}
        card={card}
        quoteGate={{ allowed: false, hint: null }}
      />,
    );
    expect(await screen.findByText("Báo giá QT-1")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("customer panel: context documents link per page permission", async () => {
    const withContexts = chatConversationSchema.parse({
      ...conversation,
      id: CONVERSATION_ID,
      contexts: [
        { id: "ctx-q", kind: "QUOTE", refId: "q-1", label: "QT-1" },
        { id: "ctx-o", kind: "ORDER", refId: "o-1", label: "SO-1" },
      ],
    });
    renderAs(
      "PRODUCTION_COORDINATOR",
      <CustomerPanel conversation={withContexts} canSend={false} canAttach={false} />,
    );
    expect(await screen.findByText("Báo giá QT-1")).toBeInTheDocument();
    expect(screen.getByText("Đơn hàng SO-1")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("customer panel: a Sale gets both links", async () => {
    const withContexts = chatConversationSchema.parse({
      ...conversation,
      contexts: [
        { id: "ctx-q", kind: "QUOTE", refId: "q-1", label: "QT-1" },
        { id: "ctx-o", kind: "ORDER", refId: "o-1", label: "SO-1" },
      ],
    });
    renderAs(
      "SALES_STAFF",
      <CustomerPanel conversation={withContexts} canSend={false} canAttach={false} />,
    );
    expect(await screen.findByRole("link", { name: "Báo giá QT-1" })).toHaveAttribute(
      "href",
      "/admin/quotes/q-1",
    );
    expect(screen.getByRole("link", { name: "Đơn hàng SO-1" })).toHaveAttribute(
      "href",
      "/admin/orders/o-1",
    );
  });
});

// SALES_STAFF holds sales-quotes:CREATE; ORDER_COORDINATOR reads quotes but does not.
describe("AUTH-2 — 'Lập báo giá' on a quote request card needs sales-quotes:CREATE", () => {
  const offered = () => {
    const message = chatMessageSchema.parse(quoteRequestCard(["CREATE_QUOTE"]));
    const card = message.card;
    if (!card) throw new Error("fixture has no card");
    return { message, card };
  };

  it("with quote CREATE: the button is there", async () => {
    const { message, card } = offered();
    renderAs(
      "SALES_STAFF",
      <QuoteRequestCardBody
        message={message}
        card={card}
        quoteGate={{ allowed: true, hint: null }}
      />,
    );
    expect(await screen.findByRole("button", { name: /Lập báo giá/ })).toBeEnabled();
  });

  it("without quote CREATE: no button even though the card offers the action", async () => {
    const { message, card } = offered();
    // Order coordinator: reads quotes (the quote card's link proves its permissions have loaded), cannot create one.
    renderAs(
      "ORDER_COORDINATOR",
      <>
        <QuoteRequestCardBody
          message={message}
          card={card}
          quoteGate={{ allowed: true, hint: null }}
        />
        <DocumentCardBody card={quoteCard} />
      </>,
    );
    expect(await screen.findByRole("link", { name: "Mở báo giá" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lập báo giá/ })).not.toBeInTheDocument();
  });
});
