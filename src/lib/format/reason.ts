/**
 * Free-text reasons are counted the way the backend counts them (BE `StatusChangeReason`): after trimming ASCII
 * whitespace, every Unicode space (NBSP, ideographic space...) and the zero-width space, and in code points, not
 * UTF-16 units - an emoji is one character. JS `\s` already covers the Unicode spaces; `​` is added explicitly.
 */
const EDGES = /^[\s​]+|[\s​]+$/g;

export const stripReason = (value: string): string => value.replace(EDGES, "");

/** Number of characters the backend would count in `value` after trimming. */
export const reasonLength = (value: string): number => [...stripReason(value)].length;
