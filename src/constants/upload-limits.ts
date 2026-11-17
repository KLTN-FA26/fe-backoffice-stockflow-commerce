/**
 * Kích thước body lớn nhất của một lần tải file qua BFF (`/api/backend/*`): file 10 MiB (BE `FileCategory
 * .PRODUCT_IMAGE` và `.PRINT_MODEL`) cộng 64 KiB cho phần JSON đi kèm và vỏ multipart (boundary, header từng phần).
 * Dùng chung cho giới hạn theo route của BFF (`lib/auth/server/body-limit.ts`) và cho trần body mà proxy của Next
 * đọc trước khi tới route handler (`experimental.proxyClientMaxBodySize` trong `next.config.ts`). Không import gì.
 */
export const MAX_UPLOAD_REQUEST_BYTES = 10 * 1024 * 1024 + 64 * 1024;
