import { afterEach, describe, expect, it, vi } from "vitest";

import { deliveryNoteFileName } from "./delivery-note-api";
import { saveBlob } from "./save-blob";

afterEach(() => vi.restoreAllMocks());

describe("saveBlob", () => {
  it("clicks a temporary download link with the file name, then releases the URL", () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(`${this.download}|${this.href}`);
    });
    saveBlob(new Blob(["pdf"]), "a.pdf");
    expect(names).toEqual(["a.pdf|blob:x"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

describe("deliveryNoteFileName", () => {
  it("is built from the shipment code, safe for a file system", () => {
    expect(deliveryNoteFileName("SO-20261117-000003-S1")).toBe(
      "bien-ban-giao-nhan-SO-20261117-000003-S1.pdf",
    );
    expect(deliveryNoteFileName(" a/b c ")).toBe("bien-ban-giao-nhan-a_b_c.pdf");
  });
});
