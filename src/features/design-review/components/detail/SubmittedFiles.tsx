"use client";

import { useState } from "react";
import { Download, Eye, Files } from "lucide-react";

import { DESIGN_ARTIFACT_ROLE_LABELS } from "@/constants";

import { safeHttpUrl } from "@/lib/api/signed-url";
import { formatDateTime } from "@/lib/format/date";

import { designReviewErrorMessage } from "@/features/design-review/errors";
import { useArtifactLink, useFetchArtifactLink } from "@/features/design-review/queries";
import { fileSizeLabel, labelOf } from "@/features/design-review/selectors";

import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { DetailSection } from "@/components/shared/DetailSection";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import type { DesignArtifact } from "@/features/design-review/types";
import type { Submission } from "@/features/design-review/selectors";

function ArtifactViewer({ designId, artifact }: { designId: string; artifact: DesignArtifact }) {
  const link = useArtifactLink(designId, artifact.artifactId, true);
  if (link.isError)
    return <p className="text-danger text-xs">{designReviewErrorMessage(link.error)}</p>;
  if (!link.data) return <p className="text-ink-tertiary text-xs">Đang lấy link xem file…</p>;
  return (
    <SignedFilePreview
      url={link.data.url}
      contentType={artifact.contentType}
      alt={artifact.originalName}
      onRefresh={() => void link.refetch()}
    />
  );
}

function ArtifactRow({
  artifact,
  viewing,
  onToggleView,
  onDownload,
}: {
  artifact: DesignArtifact;
  viewing: boolean;
  onToggleView: () => void;
  onDownload: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[0.8125rem]">
      <span className="text-ink-tertiary w-[150px] shrink-0 text-xs font-medium">
        {labelOf(DESIGN_ARTIFACT_ROLE_LABELS, artifact.role)}
      </span>
      <span className="text-ink-primary min-w-0 flex-1 truncate" title={artifact.originalName}>
        {artifact.originalName}
      </span>
      <span className="text-ink-tertiary text-xs tabular-nums">
        {fileSizeLabel(artifact.sizeBytes)} · {formatDateTime(artifact.storedAt)}
      </span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        aria-pressed={viewing}
        onClick={onToggleView}
      >
        <Eye className="size-3.5" /> {viewing ? "Ẩn" : "Xem"}
      </Button>
      <Button type="button" size="xs" variant="outline" onClick={onDownload}>
        <Download className="size-3.5" /> Tải về
      </Button>
    </li>
  );
}

/** Bộ file đang chờ duyệt (bản mới nhất mỗi loại) + "Các lần gửi trước" thu gọn. */
export function SubmittedFiles({
  designId,
  submission,
}: {
  designId: string;
  submission: Submission;
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);
  const fetchLink = useFetchArtifactLink(designId);
  const download = (artifactId: string) =>
    void fetchLink(artifactId).then(
      (link) => {
        const url = safeHttpUrl(link.url);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        else toast.error("Link file không hợp lệ — không mở.");
      },
      (error: unknown) => toast.error(designReviewErrorMessage(error)),
    );
  const row = (artifact: DesignArtifact) => (
    <ArtifactRow
      key={artifact.artifactId}
      artifact={artifact}
      viewing={viewing === artifact.artifactId}
      onToggleView={() =>
        setViewing((current) => (current === artifact.artifactId ? null : artifact.artifactId))
      }
      onDownload={() => download(artifact.artifactId)}
    />
  );
  const all = [...submission.current, ...submission.previous];
  const viewed = all.find((artifact) => artifact.artifactId === viewing);

  return (
    <DetailSection title="File đã gửi" icon={Files}>
      {submission.current.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Khách chưa gửi file nào.</p>
      ) : (
        <ul className="divide-y divide-(--table-line)">{submission.current.map(row)}</ul>
      )}
      {submission.previous.length > 0 && (
        <div className="mt-2">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            aria-expanded={showPrevious}
            onClick={() => setShowPrevious((open) => !open)}
          >
            Các lần gửi trước ({submission.previous.length})
          </Button>
          {showPrevious && (
            <ul className="divide-y divide-(--table-line)">{submission.previous.map(row)}</ul>
          )}
        </div>
      )}
      {viewed && (
        <div className="mt-3">
          <ArtifactViewer designId={designId} artifact={viewed} />
        </div>
      )}
    </DetailSection>
  );
}
