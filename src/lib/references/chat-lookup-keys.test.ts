import { describe, expect, it } from "vitest";

import { chatLookupKeys } from "./chat-lookup";

describe("chatLookupKeys", () => {
  it("one key per subject, all under the shared prefix so one invalidation clears them", () => {
    const quote = chatLookupKeys.about("QUOTE", "q-1");
    expect(quote.slice(0, chatLookupKeys.all.length)).toEqual(chatLookupKeys.all);
    expect(quote).not.toEqual(chatLookupKeys.about("ORDER", "q-1"));
    expect(quote).not.toEqual(chatLookupKeys.about("QUOTE", "q-2"));
    expect(chatLookupKeys.about("CUSTOMER", "c-1")).toEqual(
      chatLookupKeys.about("CUSTOMER", "c-1"),
    );
  });
});
