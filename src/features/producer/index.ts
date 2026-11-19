/**
 * Danh mục đơn vị sản xuất (docs 17 §4.3) — public API barrel. Contract: BE `ProducerController` (`/producers`).
 * Module khác tra tên / chọn đơn vị qua `lib/references/producer-options`, không import feature này.
 */

export * from "./types";
export * from "./schemas";
export * from "./api";
export * from "./queries";
export * from "./mutations";
export * from "./lifecycle";
export * from "./errors";
export * from "./selectors";
