import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusDot } from "./StatusDot";

afterEach(cleanup);

describe("StatusDot label by domain", () => {
  it("stock REJECTED uses the Inventory label, not the supplier one", () => {
    render(<StatusDot domain="stock" status="REJECTED" />);
    expect(screen.getByText("Từ chối")).toBeInTheDocument();
    expect(screen.queryByText("NCC từ chối")).not.toBeInTheDocument();
    expect(screen.getByTitle("Từ chối — REJECTED")).toBeInTheDocument();
  });

  it("po REJECTED keeps the global supplier-response label", () => {
    render(<StatusDot domain="po" status="REJECTED" />);
    expect(screen.getByText("NCC từ chối")).toBeInTheDocument();
    expect(screen.getByTitle("NCC từ chối — REJECTED")).toBeInTheDocument();
  });

  it("shows an unmapped status verbatim", () => {
    render(<StatusDot domain="stock" status="FUTURE_STATUS" />);
    expect(screen.getByText("FUTURE_STATUS")).toBeInTheDocument();
    expect(screen.getByTitle("FUTURE_STATUS")).toBeInTheDocument();
  });
});
