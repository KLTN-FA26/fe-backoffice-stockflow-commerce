/** The bytes of a `Blob` / `File`; falls back to `FileReader` where `Blob.arrayBuffer` is missing (jsdom). */
export function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    if (typeof blob.arrayBuffer === "function") {
      blob.arrayBuffer().then(resolve, reject);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("Unexpected FileReader result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("File could not be read"));
    reader.readAsArrayBuffer(blob);
  });
}
