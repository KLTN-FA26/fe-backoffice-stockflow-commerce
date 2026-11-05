/**
 * Body lỗi của request tải file (`responseType: "blob"`, vd PDF nhãn thùng): BE trả file khi thành công nhưng lỗi vẫn
 * là JSON envelope — axios giao nó dưới dạng Blob. Đọc ra object trước khi `ApiError.from` tìm `errorCode`, nếu không
 * mọi lỗi chỉ còn `HTTP_<status>`.
 */

/** Blob → object JSON; không phải Blob thì trả nguyên; Blob không phải JSON → undefined. */
export async function readBlobErrorBody(data: unknown): Promise<unknown> {
  if (typeof Blob === "undefined" || !(data instanceof Blob)) return data;
  try {
    return JSON.parse(await data.text()) as unknown;
  } catch {
    return undefined;
  }
}
