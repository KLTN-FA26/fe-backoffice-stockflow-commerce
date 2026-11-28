"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { EmptyState } from "@/components/shared/EmptyState";
import { Label } from "@/components/ui/label";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import { FieldError } from "../primitives";
import { CandidateOption, CandidatesError } from "./TaskCandidateParts";

import type { TaskCandidate, TaskCandidatePage } from "@/features/fulfillment/types";

const { candidate: candidateCopy } = UI_LABELS.fulfillment;

/** Chữ thường, bỏ dấu — gõ "tra sua" vẫn tìm ra "Trà Sữa Mây". */
const fold = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");

interface TaskCandidateSelectProps {
  /** Kết quả `useTaskCandidates` — chọn đơn trong trang đầu của `GET /fulfillment/task-candidates`. */
  query: {
    data: TaskCandidatePage | undefined;
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  value: string;
  onChange: (orderId: string) => void;
  error: string | undefined;
}

/**
 * Chọn đơn chờ xuất kho: lỗi (kèm Thử lại trừ 403), trống, hoặc ô gõ tìm theo số đơn / tên khách (không dấu cũng được).
 * BE chưa có tham số tìm cho `task-candidates` nên tìm trong các đơn đã tải (trang đầu, cũ nhất trước) — quá một trang
 * thì có dòng nói rõ còn đơn chưa hiện. Chọn sẵn khi chỉ có một đơn do hộp thoại làm (`CreateTaskDialog`).
 */
export function TaskCandidateSelect({ query, value, onChange, error }: TaskCandidateSelectProps) {
  const [open, setOpen] = useState(false);
  const options: TaskCandidate[] = query.data?.items ?? [];
  const selected = options.find((order) => order.orderId === value);

  if (query.isError) {
    return <CandidatesError error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!query.isPending && options.length === 0) {
    return (
      <EmptyState
        className="py-6"
        title={candidateCopy.emptyTitle}
        description={candidateCopy.emptyDescription}
      />
    );
  }
  return (
    <div>
      <Label htmlFor="task-order" className="text-[0.8125rem]">
        {candidateCopy.fieldLabel}
      </Label>
      <div className="mt-1">
        <InputCombobox
          id="task-order"
          open={open}
          onOpenChange={setOpen}
          displayValue={
            selected
              ? `${selected.orderNumber} · ${selected.customerName ?? ""}`.replace(/ · $/, "")
              : ""
          }
          placeholder={query.isPending ? candidateCopy.loading : candidateCopy.placeholder}
          searchPlaceholder={candidateCopy.search}
          ariaLabel={candidateCopy.fieldLabel}
          hasError={!!error}
          describedBy={error ? "task-order-error" : undefined}
          disabled={query.isPending}
          autoFocus
          // Danh sách mở trong khung hộp: cao vừa phải, không đè xuống nút Huỷ / Tạo
          contentClassName="max-h-60"
        >
          <CommandList>
            <CommandEmpty>{candidateCopy.noMatch}</CommandEmpty>
            <CommandGroup className="p-0">
              {options.map((candidate) => (
                <CommandItem
                  key={candidate.orderId}
                  value={`${candidate.orderNumber} ${candidate.customerName ?? ""}`}
                  keywords={[fold(`${candidate.orderNumber} ${candidate.customerName ?? ""}`)]}
                  className={COMBOBOX_ITEM_CLASS}
                  onSelect={() => {
                    onChange(candidate.orderId);
                    setOpen(false);
                  }}
                >
                  <CandidateOption candidate={candidate} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </InputCombobox>
      </div>
      <FieldError id="task-order-error">{error}</FieldError>
      {query.data?.hasNext && (
        <p className="text-ink-tertiary mt-1 text-xs">
          {candidateCopy.truncated(options.length, query.data.totalElements)}
        </p>
      )}
    </div>
  );
}
