import { afterEach, describe, expect, it, vi } from "vitest";

import { SecureContextRequiredError, sha256Hex } from "./sha256";

afterEach(() => vi.unstubAllGlobals());

const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("sha256Hex", () => {
  it("hashes bytes and blobs alike", async () => {
    const bytes = new TextEncoder().encode("abc").buffer;
    expect(await sha256Hex(bytes)).toBe(ABC);
    expect(await sha256Hex(new Blob(["abc"]))).toBe(ABC);
  });

  it("without crypto.subtle (a page opened over plain http on a LAN address) it throws a named error", async () => {
    vi.stubGlobal("crypto", {});
    await expect(sha256Hex(new ArrayBuffer(4))).rejects.toBeInstanceOf(SecureContextRequiredError);
  });
});
