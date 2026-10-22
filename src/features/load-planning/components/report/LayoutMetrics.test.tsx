import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "../../__fixtures__/layouts";
import { summarizeLayouts } from "../../selectors";

import { LayoutMetrics } from "./LayoutMetrics";
import { MetricsStrip } from "./MetricsStrip";

const valueOf = (label: string) => screen.getByText(label).nextElementSibling;

describe("LayoutMetrics", () => {
  it("shows vehicles, pieces, volume, utilisation, weight and unplaced for a plan", () => {
    render(<LayoutMetrics summary={summarizeLayouts([LAYOUT_PICKUP_KIT], 0)} />);
    expect(valueOf("Số xe")).toHaveTextContent("1");
    expect(valueOf("Số kiện")).toHaveTextContent("23");
    expect(valueOf("Thể tích dùng")).toHaveTextContent(/^\d+,\d{2} m³$/);
    expect(valueOf("Hiệu suất")).toHaveTextContent(/%$/);
    expect(valueOf("Khối lượng")).toHaveTextContent("133 / 1.000 kg");
    expect(valueOf("Chưa xếp")).toHaveTextContent("0");
  });

  it("tones unplaced pieces as a problem", () => {
    render(<LayoutMetrics summary={summarizeLayouts([LAYOUT_40HC], 15)} />);
    expect(valueOf("Chưa xếp")).toHaveClass("text-danger");
  });

  it("tones utilisation: good when the 40HC is well filled, a warning under 50%", () => {
    const { unmount } = render(<LayoutMetrics summary={summarizeLayouts([LAYOUT_40HC])} />);
    expect(valueOf("Hiệu suất")).toHaveClass("text-positive"); // 438 kiện ≈ 63% thể tích
    unmount();
    render(<LayoutMetrics summary={summarizeLayouts([LAYOUT_PICKUP_KIT])} />);
    expect(valueOf("Hiệu suất")).toHaveClass("text-warning");
  });

  it("tones an overweight plan as a problem", () => {
    render(
      <LayoutMetrics summary={summarizeLayouts([{ ...LAYOUT_PICKUP_KIT, maxPayloadKg: 100 }])} />,
    );
    expect(valueOf("Khối lượng")).toHaveClass("text-danger");
  });
});

describe("MetricsStrip", () => {
  it("renders label/value pairs with an optional icon and the default tone", () => {
    render(
      <MetricsStrip
        items={[
          { label: "A", value: "1", icon: <svg data-testid="icon" /> },
          { label: "B", value: "2" },
        ]}
      />,
    );
    expect(valueOf("A")).toHaveClass("text-ink-primary");
    expect(screen.getAllByTestId("icon")).toHaveLength(1);
    expect(valueOf("B")).toHaveTextContent("2");
  });
});
