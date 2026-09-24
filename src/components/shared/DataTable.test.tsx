import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, getPaginationItems, type ColumnDef } from "./DataTable";

type Row = { id: string };
const columns: ColumnDef<Row>[] = [{ key: "id", header: "ID", cell: (row) => row.id }];

function renderServerTable(page: number, totalPages: number, totalElements = totalPages * 10) {
  const onPageChange = vi.fn();
  render(
    <DataTable
      data={totalElements === 0 ? [] : [{ id: `row-${page}` }]}
      columns={columns}
      rowKey={(row) => row.id}
      caption="Rows"
      serverPagination={{
        page,
        size: 10,
        totalElements,
        totalPages,
        hasNext: page + 1 < totalPages,
        hasPrevious: page > 0,
        onPageChange,
        onPageSizeChange: vi.fn(),
      }}
    />,
  );
  return onPageChange;
}

describe("DataTable pagination", () => {
  it("renders every page for small page counts", () => {
    expect(getPaginationItems(1, 0)).toEqual([0]);
    expect(getPaginationItems(5, 0)).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps first, middle and last page windows bounded", () => {
    expect(getPaginationItems(100, 0)).toEqual([0, 1, 2, 3, 4, "ellipsis-end", 99]);
    expect(getPaginationItems(100, 50)).toEqual([
      0,
      "ellipsis-start",
      49,
      50,
      51,
      "ellipsis-end",
      99,
    ]);
    expect(getPaginationItems(100, 99)).toEqual([0, "ellipsis-start", 95, 96, 97, 98, 99]);
    expect(getPaginationItems(10_000, 5_000)).toHaveLength(7);
  });

  it("changes server pages using zero-based page numbers", () => {
    const onPageChange = renderServerTable(50, 100);
    expect(screen.getAllByRole("button", { name: /^Trang / })).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Trang 52" }));
    expect(onPageChange).toHaveBeenCalledWith(51);
    fireEvent.click(screen.getByRole("button", { name: "Trước" }));
    expect(onPageChange).toHaveBeenCalledWith(49);
  });

  it("keeps client-side page changes working", () => {
    render(
      <DataTable
        data={Array.from({ length: 12 }, (_, index) => ({ id: `row-${index + 1}` }))}
        columns={columns}
        rowKey={(row) => row.id}
        pageSize={5}
      />,
    );

    expect(screen.getByText("row-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trang 2" }));
    expect(screen.queryByText("row-1")).not.toBeInTheDocument();
    expect(screen.getByText("row-6")).toBeInTheDocument();
  });

  it("renders a correct zero-results state", () => {
    renderServerTable(0, 0, 0);
    expect(screen.getByText("Không có dữ liệu")).toBeInTheDocument();
    expect(screen.getByText("Hiển thị 0 / 0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Trang / })).not.toBeInTheDocument();
  });
});
