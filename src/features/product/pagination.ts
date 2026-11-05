/** URL controls remain one-based for people; the API/shared PageResponse is zero-based. */
export function toProductApiPage(uiPage: number): number {
  return Math.max(0, uiPage - 1);
}

export function toProductUiPage(apiPage: number): number {
  return Math.max(0, apiPage) + 1;
}
