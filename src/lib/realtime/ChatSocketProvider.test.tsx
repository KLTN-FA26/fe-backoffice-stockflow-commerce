import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth/auth-store";

import { ChatSocketProvider, useChatSocketStatus, useChatSubscription } from "./ChatSocketProvider";

const access = vi.hoisted(() => ({ canChat: true, isMock: false }));
vi.mock("@/lib/auth/components/Can", () => ({ useCan: () => access.canChat }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => access.isMock }));

interface FakeConnection {
  url: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  connected: boolean;
  statusListeners: Set<(connected: boolean) => void>;
  listeners: Map<string, (event: unknown) => void>;
  setConnected(connected: boolean): void;
}
const connections = vi.hoisted(() => [] as FakeConnection[]);
vi.mock("./chat-connection", () => ({
  ChatConnection: class {
    readonly start = vi.fn();
    readonly stop = vi.fn();
    private readonly fake: FakeConnection;
    constructor(readonly options: { url: string }) {
      const fake: FakeConnection = {
        url: options.url,
        start: this.start,
        stop: this.stop,
        connected: false,
        statusListeners: new Set(),
        listeners: new Map(),
        setConnected(connected) {
          fake.connected = connected;
          for (const listener of fake.statusListeners) listener(connected);
        },
      };
      this.fake = fake;
      connections.push(fake);
    }
    isConnected() {
      return this.fake.connected;
    }
    onStatus(listener: (connected: boolean) => void) {
      this.fake.statusListeners.add(listener);
      return () => this.fake.statusListeners.delete(listener);
    }
    subscribe(destination: string, listener: (event: unknown) => void) {
      this.fake.listeners.set(destination, listener);
      return () => this.fake.listeners.delete(destination);
    }
  },
}));

function signIn(userId: string | null) {
  useAuthStore.setState({
    user: userId
      ? {
          userId,
          fullName: "Sale",
          email: "sale@example.test",
          roles: ["Sales Staff"],
          username: "sale",
          status: "ACTIVE",
          lastLoginAt: null,
          mustChangePassword: false,
        }
      : null,
    status: userId ? "authenticated" : "unauthenticated",
    isAuthenticated: userId !== null,
  });
}

function Probe({ onEvent }: { onEvent?: (event: unknown) => void }) {
  const live = useChatSocketStatus();
  useChatSubscription("/topic/chat.inbox", (event) => onEvent?.(event));
  return <p>{live ? "socket nối" : "socket rớt"}</p>;
}

const renderProvider = (onEvent?: (event: unknown) => void) =>
  render(
    <ChatSocketProvider>
      <p>nội dung</p>
      <Probe onEvent={onEvent} />
    </ChatSocketProvider>,
  );

describe("ChatSocketProvider", () => {
  beforeEach(() => {
    connections.length = 0;
    access.canChat = true;
    access.isMock = false;
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://api.test/ws");
    signIn("user-1");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("opens one chat connection to NEXT_PUBLIC_WS_URL and closes it on unmount", () => {
    const view = renderProvider();
    expect(screen.getByText("nội dung")).toBeInTheDocument();
    expect(connections).toHaveLength(1);
    expect(connections[0]?.url).toBe("wss://api.test/ws");
    expect(connections[0]?.start).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(connections[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it("does nothing without NEXT_PUBLIC_WS_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "");
    renderProvider();
    expect(connections).toHaveLength(0);
  });

  it("does nothing in mock mode", () => {
    access.isMock = true;
    renderProvider();
    expect(connections).toHaveLength(0);
  });

  it("does nothing without chat-conversations:READ", () => {
    access.canChat = false;
    renderProvider();
    expect(connections).toHaveLength(0);
  });

  it("closes the socket on sign-out and opens a new one for a different user", () => {
    renderProvider();
    act(() => signIn("user-2"));
    expect(connections[0]?.stop).toHaveBeenCalledTimes(1);
    expect(connections).toHaveLength(2);
    expect(connections[1]?.start).toHaveBeenCalledTimes(1);
    act(() => signIn(null));
    expect(connections[1]?.stop).toHaveBeenCalledTimes(1);
    expect(connections).toHaveLength(2);
  });

  it("tells screens whether the socket is up, and passes its events to their subscriptions", () => {
    const onEvent = vi.fn();
    const view = renderProvider(onEvent);
    expect(screen.getByText("socket rớt")).toBeInTheDocument();
    act(() => connections[0]?.setConnected(true));
    expect(screen.getByText("socket nối")).toBeInTheDocument();
    connections[0]?.listeners.get("/topic/chat.inbox")?.({ type: "conversation.updated" });
    expect(onEvent).toHaveBeenCalledWith({ type: "conversation.updated" });
    act(() => connections[0]?.setConnected(false));
    expect(screen.getByText("socket rớt")).toBeInTheDocument();
    view.unmount();
    expect(connections[0]?.listeners.size).toBe(0);
  });

  it("reports no socket (screens keep polling) without NEXT_PUBLIC_WS_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "");
    renderProvider();
    expect(screen.getByText("socket rớt")).toBeInTheDocument();
  });
});
