import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { QuantityField } from "../components/QuantityField";
import { useSingleChoiceDefault } from "../use-single-choice-default";

describe("useSingleChoiceDefault (UX audit S21-2)", () => {
  it("picks the only choice when nothing is chosen, and never overwrites a choice", () => {
    const apply = vi.fn();
    const { rerender } = renderHook(
      ({ only, current }) => useSingleChoiceDefault(only, current, apply),
      { initialProps: { only: "KHO-HN" as string | undefined, current: "" } },
    );
    expect(apply).toHaveBeenCalledWith("KHO-HN");
    apply.mockClear();
    rerender({ only: "KHO-HN", current: "KHO-HN" });
    expect(apply).not.toHaveBeenCalled();
  });

  it("does nothing with zero or several choices, and picks again when the choice is cleared (warehouse changed)", () => {
    const apply = vi.fn();
    const { rerender } = renderHook(
      ({ only, current }) => useSingleChoiceDefault(only, current, apply),
      { initialProps: { only: undefined as string | undefined, current: "" } },
    );
    expect(apply).not.toHaveBeenCalled();
    rerender({ only: "QUARANTINE-1", current: "QUARANTINE-1" });
    expect(apply).not.toHaveBeenCalled();
    // the other warehouse's area list arrives with the field cleared
    rerender({ only: "QUARANTINE-2", current: "" });
    expect(apply).toHaveBeenCalledWith("QUARANTINE-2");
  });
});

function QuantityHarness({ onValue }: { onValue: (value: number) => void }) {
  const form = useForm<{ quantity: number }>({ defaultValues: { quantity: Number.NaN } });
  return (
    <form onSubmit={form.handleSubmit((values) => onValue(values.quantity))}>
      <QuantityField
        control={form.control}
        name="quantity"
        inputProps={{ "aria-label": "SL trả" }}
      />
      <button type="submit">Gửi</button>
    </form>
  );
}

describe("QuantityField (UX audit S01-7)", () => {
  it("shows thousands grouped but the form still receives a number, as valueAsNumber did", async () => {
    const onValue = vi.fn();
    render(<QuantityHarness onValue={onValue} />);
    const field = screen.getByRole("textbox", { name: "SL trả" });
    await userEvent.type(field, "12000");
    expect(field).toHaveValue("12.000");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Gửi" }));
    });
    expect(onValue).toHaveBeenCalledWith(12000);
  });

  it("empty stays NaN, so the schema reports a missing quantity", async () => {
    const onValue = vi.fn();
    render(<QuantityHarness onValue={onValue} />);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Gửi" }));
    });
    expect(onValue).toHaveBeenCalledWith(Number.NaN);
  });
});
