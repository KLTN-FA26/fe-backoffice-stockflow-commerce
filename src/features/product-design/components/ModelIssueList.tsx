import { AlertCircle, AlertTriangle } from "lucide-react";

import { MODEL3D_ISSUE_LEVEL_LABELS, MODEL3D_READ_MESSAGES } from "@/constants/labels-model3d";
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { Alert } from "@/components/shared/Alert";
import { Badge } from "@/components/ui/badge";

import type { ModelIssue } from "../model3d/issues";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.issues;

/** The level in words, not by colour alone: "Lỗi" blocks the save, "Cảnh báo" does not. */
function IssueLevel({ level }: { level: ModelIssue["level"] }) {
  const isError = level === "error";
  const Icon = isError ? AlertCircle : AlertTriangle;
  return (
    <Badge
      variant="outline"
      className={isError ? "border-danger text-danger" : "border-warning text-warning"}
    >
      <Icon aria-hidden />
      {MODEL3D_ISSUE_LEVEL_LABELS[level]}
    </Badge>
  );
}

/** Every problem found in the file, one row each: level, message, the mesh it is about. */
export function ModelIssueList({ issues }: { issues: readonly ModelIssue[] }) {
  if (issues.length === 0) return <Alert tone="info">{TEXT.allClear}</Alert>;
  const errors = issues.filter((issue) => issue.level === "error").length;
  return (
    <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
      <h4 className="text-ink-primary text-sm font-semibold">
        {errors > 0 ? TEXT.errorsHeading(errors) : TEXT.warningsHeading}
      </h4>
      <p className="text-ink-tertiary mt-1 text-xs">{MODEL3D_READ_MESSAGES.axesNote}</p>
      <ul aria-label={TEXT.listLabel} className="mt-1">
        {issues.map((issue, index) => (
          <li
            key={`${issue.code}-${issue.meshName ?? ""}-${index}`}
            className="border-border-default flex items-start gap-3 border-b py-2.5 text-[0.8125rem] last:border-b-0"
          >
            <IssueLevel level={issue.level} />
            <div className="min-w-0 space-y-1">
              <p className="text-ink-primary">{issue.message}</p>
              {issue.meshName !== undefined && (
                <p className="text-ink-tertiary text-xs">
                  {PRINT_CONFIG_SCREEN_LABELS.report.meshInFile}:{" "}
                  <span className="font-mono">{issue.meshName}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
