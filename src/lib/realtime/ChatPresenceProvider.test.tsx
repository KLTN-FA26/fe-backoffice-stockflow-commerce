import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth/auth-store";

import { ChatPresenceProvider } from "./ChatPresenceProvider";

const access = vi.hoisted(() => ({ canChat: true, isMock: false }));
vi.mock("@/lib/auth/components/Can", () => ({ useCan: () => access.canChat }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => access.isMock }));

const connections = vi.hoisted(
  () => [] as { url: string; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[],
);
vi.mock("./presence-connection", () => ({
  PresenceConnection: class {
    readonly start = vi.fn();
    readonly stop = vi.fn();
    constructor(readonly options: { url: string }) {
      connections.push({ url: options.url, start: this.start, stop: this.stop });
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

const renderProvider = () =>
  render(
    <ChatPresenceProvider>
      <p>nội dung</p>
    </ChatPresenceProvider>,
  );

describe("ChatPresenceProvider", () => {
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

  it("opens one presence connection to NEXT_PUBLIC_WS_URL and closes it on unmount", () => {
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
});
