import { afterEach, describe, expect, it } from "vitest";

import { api } from "./client";

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  if (originalAdapter) api.defaults.adapter = originalAdapter;
  else delete api.defaults.adapter;
});

function answer(body: unknown) {
  api.defaults.adapter = async (config) => ({
    data: body,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  });
}

describe("success envelope", () => {
  it("unwraps `data`", async () => {
    answer({ success: true, data: { id: "h-1" } });

    const { data } = await api.get("/orders/o-1/completion-hold");

    expect(data).toEqual({ id: "h-1" });
  });

  it("reads an envelope without `data` (BE drops nulls) as null, not as the envelope", async () => {
    answer({ success: true, timestamp: "2026-11-20T00:00:00Z" });

    const { data } = await api.get("/orders/o-1/completion-hold");

    expect(data).toBeNull();
  });

  it("leaves a body that is not an envelope as it is", async () => {
    answer({ items: [1] });

    const { data } = await api.get("/anything");

    expect(data).toEqual({ items: [1] });
  });
});
