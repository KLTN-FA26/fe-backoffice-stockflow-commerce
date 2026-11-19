/** Where a KPI number comes from: one list endpoint, counted over the given BE statuses. */
export interface CountSource {
  readonly path: string;
  readonly statuses: readonly string[];
  /** Endpoints that accept `status` repeated (`status=A&status=B`) count in one request. */
  readonly repeatStatus: boolean;
}
