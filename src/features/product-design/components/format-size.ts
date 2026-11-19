import { formatFixed } from "@/lib/format";

const KB = 1024;
const MB = 1024 * 1024;

/** A file's size with one decimal, in KB under 1 MB and in MB above ("812,4 KB", "60,0 MB"), as the row of a file shows it. */
export const formatFileSize = (bytes: number): string =>
  bytes < MB ? `${formatFixed(bytes / KB, 1)} KB` : `${formatFixed(bytes / MB, 1)} MB`;
