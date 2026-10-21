"use client";

import { UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { FieldError } from "../primitives";
import { SELECT_FIELD } from "./AssigneeSelect";
import { CandidateOption, CandidatesError, CandidateSummary } from "./TaskCandidateParts";

import type { TaskCandidate, TaskCandidatePage } from "@/features/fulfillment/types";

const { candidate: candidateCopy } = UI_LABELS.fulfillment;

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

/** Chọn đơn chờ xuất kho: lỗi (kèm Thử lại trừ 403), trống, hoặc ô chọn kèm khách / số dòng / dòng in. */
export function TaskCandidateSelect({ query, value, onChange, error }: TaskCandidateSelectProps) {
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
      <Select value={value} onValueChange={onChange} disabled={query.isPending}>
        <SelectTrigger
          id="task-order"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "task-order-error" : undefined}
          className={SELECT_FIELD}
        >
          <SelectValue
            placeholder={query.isPending ? candidateCopy.loading : candidateCopy.placeholder}
          >
            {selected && <CandidateSummary candidate={selected} />}
          </SelectValue>
        </SelectTrigger>
        <TitledSelectContent title={candidateCopy.fieldLabel}>
          {options.map((candidate) => (
            <SelectItem key={candidate.orderId} value={candidate.orderId}>
              <CandidateOption candidate={candidate} />
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
      <FieldError id="task-order-error">{error}</FieldError>
      {query.data?.hasNext && (
        <p className="text-ink-tertiary mt-1 text-xs">
          {candidateCopy.truncated(options.length, query.data.totalElements)}
        </p>
      )}
    </div>
  );
}
