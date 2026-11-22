import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskInfo } from "./TaskInfo";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";

const TASK_ID = "3f2b8c1e-5a4d-4b7e-9c11-0d2e6a7f8b90";
const ORDER_ID = "9a1c7e2d-0b3f-4c55-8e6a-1f2d3c4b5a69";

const actor = { can: () => false, userId: null } as unknown as FulfillmentActor;
const task = {
  taskId: TASK_ID,
  orderId: ORDER_ID,
  destination: null,
} as unknown as FulfillmentTask;

describe("TaskInfo", () => {
  it("không hiện dòng 'Mã task' và không lộ UUID của task (BE chưa có mã task đọc được)", () => {
    render(<TaskInfo task={task} actor={actor} orderNumber="SO-20261121-000001" />);
    expect(screen.queryByText("Mã task")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(TASK_ID);
    expect(screen.getByText("SO-20261121-000001")).toBeInTheDocument();
  });

  it("chưa tra được số đơn → id rút gọn, không phải UUID đầy đủ", () => {
    render(<TaskInfo task={task} actor={actor} orderNumber={undefined} />);
    expect(document.body.textContent).not.toContain(ORDER_ID);
  });
});
