import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AUTH_UI } from "@/constants/auth";

import { SessionErrorState } from "./SessionErrorState";

describe("SessionErrorState", () => {
  it("names the alert by the message, explains the session is kept and retries on click", async () => {
    const onRetry = vi.fn();
    render(<SessionErrorState message={AUTH_UI.bootstrapError} onRetry={onRetry} />);
    const alert = screen.getByRole("alert", { name: AUTH_UI.bootstrapError });
    expect(alert).toHaveTextContent(AUTH_UI.bootstrapErrorHint);
    await userEvent.click(screen.getByRole("button", { name: AUTH_UI.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it("renders the secondary action under retry", () => {
    render(
      <SessionErrorState
        message={AUTH_UI.bootstrapError}
        onRetry={vi.fn()}
        secondaryAction={<button type="button">Đăng xuất</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  });
});
