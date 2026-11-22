"use client";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import { useModelFileUrl } from "../queries";

import type { PrintConfigDto } from "../types";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.summary;
/** Characters of the SHA-256 shown: enough to tell two files apart at a glance. */
const SHORT_CHECKSUM = 12;

/**
 * Where the saved `.glb` can be opened or downloaded (BE short-lived link), so the stored file can be checked against
 * the file that was measured; its SHA-256 (what the save compared) is shown beside it. Rendered only for a template that
 * has a file.
 */
export function ModelFileLink({ config }: { config: PrintConfigDto }) {
  const link = useModelFileUrl(config);
  const { fileName, fileChecksum } = config.model3d;

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      {link.isError ? (
        <span role="status" className="text-ink-secondary">
          {TEXT.fileLinkFailed}
        </span>
      ) : link.data ? (
        <a
          href={link.data.url}
          target="_blank"
          rel="noopener noreferrer"
          download={fileName ?? undefined}
          className="text-accent-text focus-visible:ring-ring rounded-sm underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
        >
          {TEXT.fileLink(fileName ?? "model.glb")}
        </a>
      ) : (
        <span role="status" className="text-ink-secondary">
          {TEXT.fileLinkLoading}
        </span>
      )}
      {fileChecksum && (
        <span
          title={fileChecksum}
          className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs"
        >
          {TEXT.fileChecksum(fileChecksum.slice(0, SHORT_CHECKSUM))}
        </span>
      )}
    </span>
  );
}
