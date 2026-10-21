import { act, render } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/lib/auth/auth-store";

import { AppProviders } from "./app-providers";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The Next app-router adapter needs a mounted router; the cache behaviour under test does not.
vi.mock("nuqs/adapters/next/app", () => ({
  NuqsAdapter: ({ children }: { children: ReactNode }) => children,
}));

const identity = (userId: string) => ({
  userId,
  username: userId,
  email: `${userId}@example.com`,
  fullName: null,
  status: "ACTIVE",
  roles: [],
  lastLoginAt: null,
});

function mountWithCache(): () => QueryClient {
  let client: QueryClient | undefined;
  function Probe() {
    client = useQueryClient();
    return null;
  }
  render(
    <AppProviders isMock={false}>
      <Probe />
    </AppProviders>,
  );
  return () => {
    if (!client) throw new Error("QueryClient not mounted");
    return client;
  };
}

const QUOTES = ["quotes", "list", {}];

afterEach(() => act(() => useAuthStore.getState().logout(false)));

describe("AppProviders — cached server data never outlives the identity that loaded it", () => {
  it("logout drops every cached response", () => {
    act(() => useAuthStore.getState().login(identity("customer-a"), false));
    const client = mountWithCache();
    client().setQueryData(QUOTES, ["quote of customer A"]);

    act(() => useAuthStore.getState().logout(false));

    expect(client().getQueryData(QUOTES)).toBeUndefined();
  });

  it("a different user replacing the session drops the previous user's cache", () => {
    act(() => useAuthStore.getState().login(identity("customer-a"), false));
    const client = mountWithCache();
    client().setQueryData(QUOTES, ["quote of customer A"]);

    act(() => useAuthStore.getState().login(identity("staff-b"), false));

    expect(client().getQueryData(QUOTES)).toBeUndefined();
  });

  it("first sign-in and a same-user refresh keep the cache", () => {
    const client = mountWithCache();
    client().setQueryData(QUOTES, ["loaded before bootstrap"]);

    act(() => useAuthStore.getState().login(identity("customer-a"), false));
    expect(client().getQueryData(QUOTES)).toEqual(["loaded before bootstrap"]);

    act(() => useAuthStore.getState().login(identity("customer-a"), false));
    expect(client().getQueryData(QUOTES)).toEqual(["loaded before bootstrap"]);
  });
});
